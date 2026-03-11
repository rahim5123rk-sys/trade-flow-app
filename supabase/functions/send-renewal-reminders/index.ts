import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Resend } from "npm:resend@2.0.0"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
const REMINDER_DAYS_BEFORE = 7
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const jsonHeaders = {
  'Content-Type': 'application/json',
}

const parseDdMmYyyy = (value?: string | null): Date | null => {
  if (!value) return null
  const parts = value.split('/')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts.map((part) => Number(part))
  if (!dd || !mm || !yyyy) return null
  const date = new Date(yyyy, mm - 1, dd)
  date.setHours(0, 0, 0, 0)
  return date
}

const sanitizeRecipients = (emails: string[]): string[] => {
  const unique = new Set<string>()

  for (const email of emails) {
    const clean = (email || '').trim().toLowerCase()
    if (clean && EMAIL_REGEX.test(clean)) {
      unique.add(clean)
    }
  }

  return Array.from(unique)
}

const dayDiff = (from: Date, to: Date): number => {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((to.getTime() - from.getTime()) / msPerDay)
}

serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({error: 'Unauthorized'}), {
      status: 401,
      headers: jsonHeaders,
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({error: 'Missing Supabase environment configuration'}), {
      status: 500,
      headers: jsonHeaders,
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const {data: docs, error} = await supabase
    .from('documents')
    .select('id,type,reference,expiry_date,customer_snapshot,payment_info')
    .in('type', ['cp12', 'service_record'])
    .not('expiry_date', 'is', null)

  if (error) {
    return new Response(JSON.stringify({error: error.message}), {
      status: 500,
      headers: jsonHeaders,
    })
  }

  let sent = 0
  let skipped = 0
  const failures: Array<{id: string; reason: string}> = []

  for (const doc of docs ?? []) {
    try {
      const dueDate = parseDdMmYyyy(doc.expiry_date)
      if (!dueDate || dayDiff(today, dueDate) !== REMINDER_DAYS_BEFORE) {
        skipped += 1
        continue
      }

      const payload = JSON.parse(doc.payment_info || '{}') as any
      const pdfData = payload?.pdfData || {}
      const reminderEnabled = !!pdfData.renewalReminderEnabled
      const reminderSentForDate = payload?.reminderMeta?.lastSentForDate || ''

      if (!reminderEnabled || reminderSentForDate === doc.expiry_date) {
        skipped += 1
        continue
      }

      const customerName = pdfData.customerName || pdfData.landlordName || pdfData.tenantName || doc.customer_snapshot?.name || 'Customer'
      const propertyAddress = pdfData.propertyAddress || doc.customer_snapshot?.address || 'Not provided'
      const fallbackEmail = pdfData.customerEmail || pdfData.landlordEmail || pdfData.tenantEmail || ''
      const recipients = sanitizeRecipients([doc.customer_snapshot?.email || fallbackEmail])

      if (!recipients.length) {
        skipped += 1
        continue
      }

      const docLabel = doc.type === 'service_record' ? 'Service Record' : 'Gas Safety Certificate'
      const subject = `${docLabel} Reminder: ${doc.reference || 'Document'} expires on ${doc.expiry_date}`
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#0f172a;line-height:1.5;">
          <h2 style="margin:0 0 12px;">Renewal Reminder</h2>
          <p style="margin:0 0 12px;">Hi ${customerName}, your ${docLabel.toLowerCase()} is due to expire in ${REMINDER_DAYS_BEFORE} days.</p>
          <table style="width:100%;border-collapse:collapse;margin:12px 0 20px;">
            <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Document</td><td style="padding:8px;border:1px solid #e2e8f0;">${docLabel}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Reference</td><td style="padding:8px;border:1px solid #e2e8f0;">${doc.reference || 'N/A'}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Property</td><td style="padding:8px;border:1px solid #e2e8f0;">${propertyAddress}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Renewal Date</td><td style="padding:8px;border:1px solid #e2e8f0;">${doc.expiry_date || 'N/A'}</td></tr>
          </table>
          <p style="margin:0;color:#475569;font-size:14px;">Please get in touch to arrange your renewal before the due date.</p>
        </div>
      `

      await resend.emails.send({
        from: Deno.env.get('RESEND_FROM_EMAIL') || 'GasPilot <info@gascertpal.com>',
        to: recipients,
        subject,
        html,
      })

      const nextPayload = {
        ...payload,
        reminderMeta: {
          ...(payload?.reminderMeta || {}),
          lastSentAt: new Date().toISOString(),
          lastSentForDate: doc.expiry_date || '',
        },
      }

      const {error: updateError} = await supabase
        .from('documents')
        .update({payment_info: JSON.stringify(nextPayload)})
        .eq('id', doc.id)

      if (updateError) {
        failures.push({id: doc.id, reason: updateError.message})
        continue
      }

      sent += 1
    } catch (error) {
      failures.push({
        id: doc.id,
        reason: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return new Response(JSON.stringify({sent, skipped, failures, reminderDaysBefore: REMINDER_DAYS_BEFORE}), {
    status: 200,
    headers: jsonHeaders,
  })
})
