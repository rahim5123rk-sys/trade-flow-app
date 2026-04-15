// supabase/functions/resend-webhook/index.ts
// Receives Resend webhook events (delivered, opened, bounced, complained)
// and updates the email_events table status.
//
// Resend webhook docs: https://resend.com/docs/dashboard/webhooks/introduction
// Events: email.delivered, email.opened, email.bounced, email.complained

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') || ''

// Map Resend event types to our status values
const EVENT_TO_STATUS: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
}

// Status priority — only upgrade, never downgrade
const STATUS_PRIORITY: Record<string, number> = {
  sent: 1,
  delivered: 2,
  opened: 3,
  bounced: 2, // same level as delivered (terminal)
  complained: 2,
}

Deno.serve(async (req) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Verify webhook secret if configured (Resend sends it as svix-signature)
  // For now we use a simple shared secret in a custom header
  if (WEBHOOK_SECRET) {
    const providedSecret = req.headers.get('webhook-secret') || ''
    if (providedSecret !== WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response('Bad Request: invalid JSON', { status: 400 })
  }

  const eventType = body?.type as string
  const newStatus = EVENT_TO_STATUS[eventType]

  if (!newStatus) {
    // Unknown event type — acknowledge but ignore
    return new Response(JSON.stringify({ received: true, ignored: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const resendMessageId = body?.data?.email_id as string
  if (!resendMessageId) {
    return new Response(JSON.stringify({ received: true, error: 'no email_id' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Find matching email events
  const { data: events } = await supabaseAdmin
    .from('email_events')
    .select('id, status')
    .eq('resend_message_id', resendMessageId)

  if (!events || events.length === 0) {
    // No matching record — could be an email sent before tracking was enabled
    return new Response(JSON.stringify({ received: true, matched: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Only upgrade status, never downgrade (e.g. don't go from 'opened' back to 'delivered')
  const newPriority = STATUS_PRIORITY[newStatus] || 0
  let updated = 0

  for (const event of events) {
    const currentPriority = STATUS_PRIORITY[event.status] || 0
    if (newPriority > currentPriority) {
      await supabaseAdmin
        .from('email_events')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', event.id)
      updated++
    }
  }

  return new Response(
    JSON.stringify({ received: true, matched: events.length, updated }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
