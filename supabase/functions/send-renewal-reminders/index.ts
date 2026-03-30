import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Resend } from "npm:resend@2.0.0"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
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

  const BATCH_SIZE = 500
  let offset = 0
  let sent = 0
  let skipped = 0
  const failures: Array<{id: string; reason: string}> = []

  // Fetch all companies' reminder-days config once
  const { data: allCompanies } = await supabase
    .from('companies')
    .select('id, reminder_days_before')

  const reminderDaysMap: Record<string, number> = {}
  for (const c of allCompanies ?? []) {
    reminderDaysMap[c.id] = c.reminder_days_before ?? 30
  }

  while (true) {
    const {data: docs, error} = await supabase
      .from('documents')
      .select('id,type,reference,expiry_date,company_id,customer_snapshot,payment_info')
      .in('type', ['cp12', 'service_record'])
      .not('expiry_date', 'is', null)
      .like('payment_info', '%"renewalReminderEnabled":true%')
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      return new Response(JSON.stringify({error: error.message}), {
        status: 500,
        headers: jsonHeaders,
      })
    }

    if (!docs || docs.length === 0) break

    // Collect eligible documents for this fetch batch
    interface EligibleDoc {
      id: string
      recipients: string[]
      subject: string
      html: string
      nextPayload: Record<string, unknown>
    }
    const eligible: EligibleDoc[] = []

    for (const doc of docs) {
      try {
        const dueDate = parseDdMmYyyy(doc.expiry_date)
        if (!dueDate) { skipped += 1; continue }

        const reminderDays = reminderDaysMap[doc.company_id] ?? 30
        const days = dayDiff(today, dueDate)
        if (days > reminderDays || days < 0) { skipped += 1; continue }

        const payload = JSON.parse(doc.payment_info || '{}') as any
        const pdfData = payload?.pdfData || {}

        // Double-check parsed value (SQL filter handles the broad filter)
        if (!pdfData.renewalReminderEnabled) { skipped += 1; continue }

        const reminderSentForDate = payload?.reminderMeta?.lastSentForDate || ''
        if (reminderSentForDate === doc.expiry_date) { skipped += 1; continue }

        const customerName = pdfData.customerName || pdfData.landlordName || pdfData.tenantName || doc.customer_snapshot?.name || 'Customer'
        const propertyAddress = pdfData.propertyAddress || doc.customer_snapshot?.address || 'Not provided'
        const fallbackEmail = pdfData.customerEmail || pdfData.landlordEmail || pdfData.tenantEmail || ''
        const baseRecipients = [doc.customer_snapshot?.email || fallbackEmail]
        const oneTimeEmails: string[] = Array.isArray(payload?.oneTimeReminderEmails) ? payload.oneTimeReminderEmails : []
        const recipients = sanitizeRecipients([...baseRecipients, ...oneTimeEmails])

        if (!recipients.length) { skipped += 1; continue }

        const docLabel = doc.type === 'service_record' ? 'Service Record' : 'Gas Safety Certificate'
        const subject = `${docLabel} Reminder: ${doc.reference || 'Document'} expires on ${doc.expiry_date}`
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#0f172a;line-height:1.5;">
            <h2 style="margin:0 0 12px;">Renewal Reminder</h2>
            <p style="margin:0 0 12px;">Hi ${customerName}, your ${docLabel.toLowerCase()} is due to expire in ${days} days.</p>
            <table style="width:100%;border-collapse:collapse;margin:12px 0 20px;">
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Document</td><td style="padding:8px;border:1px solid #e2e8f0;">${docLabel}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Reference</td><td style="padding:8px;border:1px solid #e2e8f0;">${doc.reference || 'N/A'}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Property</td><td style="padding:8px;border:1px solid #e2e8f0;">${propertyAddress}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Renewal Date</td><td style="padding:8px;border:1px solid #e2e8f0;">${doc.expiry_date || 'N/A'}</td></tr>
            </table>
            <p style="margin:0;color:#475569;font-size:14px;">Please get in touch to arrange your renewal before the due date.</p>
          </div>
        `

        // Validate email payload size (reject if HTML exceeds 256KB)
        if (html.length > 256_000) {
          failures.push({id: doc.id, reason: 'Email payload too large'})
          continue
        }

        const { oneTimeReminderEmails: _removed, ...payloadWithoutOneTime } = payload
        const nextPayload = {
          ...payloadWithoutOneTime,
          reminderMeta: {
            ...(payload?.reminderMeta || {}),
            lastSentAt: new Date().toISOString(),
            lastSentForDate: doc.expiry_date || '',
          },
        }

        eligible.push({id: doc.id, recipients, subject, html, nextPayload})
      } catch (error) {
        failures.push({
          id: doc.id,
          reason: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Process eligible documents in concurrent batches of 5
    const SEND_BATCH_SIZE = 5
    for (let i = 0; i < eligible.length; i += SEND_BATCH_SIZE) {
      const batch = eligible.slice(i, i + SEND_BATCH_SIZE)

      const sendResults = await Promise.allSettled(
        batch.map((doc) =>
          resend.emails.send({
            from: Deno.env.get('RESEND_FROM_EMAIL') || 'GasPilot <info@gaspilotapp.com>',
            to: doc.recipients,
            subject: doc.subject,
            html: doc.html,
          })
        )
      )

      // Collect successful sends for batch update
      const successfulDocs: EligibleDoc[] = []
      sendResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          successfulDocs.push(batch[idx])
        } else {
          failures.push({
            id: batch[idx].id,
            reason: result.reason?.message || 'Email send failed',
          })
        }
      })

      // Batch update all successful sends concurrently
      if (successfulDocs.length > 0) {
        const updateResults = await Promise.allSettled(
          successfulDocs.map((doc) =>
            supabase
              .from('documents')
              .update({payment_info: JSON.stringify(doc.nextPayload)})
              .eq('id', doc.id)
          )
        )

        updateResults.forEach((result, idx) => {
          if (result.status === 'fulfilled' && !result.value.error) {
            sent += 1
          } else {
            const reason =
              result.status === 'rejected'
                ? result.reason?.message || 'Update failed'
                : result.value.error?.message || 'Update failed'
            failures.push({id: successfulDocs[idx].id, reason})
          }
        })
      }
    }

    if (docs.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }

  return new Response(JSON.stringify({sent, skipped, failures}), {
    status: 200,
    headers: jsonHeaders,
  })
})
