// supabase/functions/quote-response/index.ts
// Handles customer quote accept/decline via tokenised URL.
//
// GET  ?token=xxx → Renders branded accept/decline page
// POST ?token=xxx → Processes the response, updates document status, sends push notification

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function htmlPage(title: string, body: string, color = '#2563EB') {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title} — GasPilot</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { background: #fff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); max-width: 480px; width: 100%; padding: 40px 32px; text-align: center; }
  .logo { font-size: 24px; font-weight: 800; color: ${color}; margin-bottom: 8px; }
  h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin: 16px 0 8px; }
  p { font-size: 15px; color: #64748b; line-height: 1.5; margin-bottom: 16px; }
  .ref { background: #f1f5f9; border-radius: 8px; padding: 12px; margin: 16px 0; font-size: 14px; color: #334155; }
  .ref strong { color: #0f172a; }
  textarea { width: 100%; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 14px; resize: vertical; min-height: 80px; margin: 8px 0 16px; font-family: inherit; }
  .btn-row { display: flex; gap: 12px; justify-content: center; margin-top: 16px; }
  .btn { display: inline-flex; align-items: center; justify-content: center; padding: 14px 28px; border-radius: 12px; font-size: 15px; font-weight: 700; border: none; cursor: pointer; text-decoration: none; min-width: 140px; }
  .btn-accept { background: #16a34a; color: #fff; }
  .btn-accept:hover { background: #15803d; }
  .btn-decline { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
  .btn-decline:hover { background: #e2e8f0; }
  .footer { margin-top: 24px; font-size: 12px; color: #94a3b8; }
  .success-icon { font-size: 48px; margin-bottom: 8px; }
</style>
</head><body>
<div class="card">${body}</div>
</body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response(
      htmlPage('Invalid Link', '<h1>Invalid Link</h1><p>This link is missing the required token.</p>'),
      { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }, status: 400 },
    )
  }

  // Look up token
  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from('document_tokens')
    .select('*, documents:document_id(id, reference, type, status, company_id, user_id, customer_snapshot, total)')
    .eq('token', token)
    .single()

  if (tokenError || !tokenRow) {
    return new Response(
      htmlPage('Link Not Found', '<h1>Link Not Found</h1><p>This link is invalid or has expired.</p>'),
      { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }, status: 404 },
    )
  }

  // Check expiry
  if (new Date(tokenRow.expires_at) < new Date()) {
    return new Response(
      htmlPage('Link Expired', '<h1>Link Expired</h1><p>This link has expired. Please contact the sender for a new quote.</p>'),
      { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }, status: 410 },
    )
  }

  // Check if already used
  if (tokenRow.used_at) {
    const action = tokenRow.action === 'accept' ? 'accepted' : tokenRow.action === 'decline' ? 'declined' : 'responded to'
    return new Response(
      htmlPage('Already Responded',
        `<div class="success-icon">${tokenRow.action === 'accept' ? '✅' : '❌'}</div>
         <h1>Already Responded</h1>
         <p>This quote has already been ${action}.</p>
         <div class="footer">Powered by <strong>GasPilot</strong></div>`),
      { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  const doc = tokenRow.documents as any
  const reference = doc?.reference || 'Quote'
  const customerName = (doc?.customer_snapshot as any)?.name || 'Customer'
  const total = doc?.total ? `£${Number(doc.total).toFixed(2)}` : ''

  // ── GET → Show accept/decline form ──
  if (req.method === 'GET') {
    // Build form action from env (Deno runtime URL may lack /functions/v1/ prefix and use http)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || url.origin
    const formAction = `${supabaseUrl}/functions/v1/quote-response?token=${encodeURIComponent(token)}`
    const page = htmlPage('Quote Response',
      `<div class="logo">GasPilot</div>
       <h1>Quote ${escapeHtml(reference)}</h1>
       <div class="ref">
         <strong>Customer:</strong> ${escapeHtml(customerName)}
         ${total ? `<br/><strong>Total:</strong> ${escapeHtml(total)}` : ''}
       </div>
       <p>Please review your quote and respond below.</p>
       <form method="POST" action="${formAction}">
         <label style="display:block;text-align:left;font-size:13px;font-weight:600;color:#64748b;margin-bottom:4px;">Message (optional)</label>
         <textarea name="message" placeholder="Any notes or comments..."></textarea>
         <div class="btn-row">
           <button type="submit" name="action" value="accept" class="btn btn-accept">✓ Accept Quote</button>
           <button type="submit" name="action" value="decline" class="btn btn-decline">✗ Decline</button>
         </div>
       </form>
       <div class="footer">Powered by <strong>GasPilot</strong></div>`,
    )
    return new Response(page, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // ── POST → Process response ──
  if (req.method === 'POST') {
    let action = 'accept'
    let message = ''

    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData()
      action = (formData.get('action') as string) || 'accept'
      message = (formData.get('message') as string) || ''
    } else {
      try {
        const json = await req.json()
        action = json.action || 'accept'
        message = json.message || ''
      } catch {
        // default to accept
      }
    }

    const validAction = action === 'decline' ? 'decline' : 'accept'
    const newStatus = validAction === 'accept' ? 'Accepted' : 'Declined'

    // Mark token as used
    await supabaseAdmin
      .from('document_tokens')
      .update({
        action: validAction,
        customer_message: message.slice(0, 1000) || null,
        used_at: new Date().toISOString(),
      })
      .eq('id', tokenRow.id)

    // Update document status
    await supabaseAdmin
      .from('documents')
      .update({ status: newStatus })
      .eq('id', doc.id)

    // Send push notification to the engineer
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('push_token, display_name')
        .eq('id', doc.user_id)
        .single()

      if (profile?.push_token) {
        const emoji = validAction === 'accept' ? '✅' : '❌'
        const pushTitle = validAction === 'accept' ? 'Quote Accepted!' : 'Quote Declined'
        const pushBody = `${emoji} ${customerName} has ${validAction === 'accept' ? 'accepted' : 'declined'} quote ${reference}${message ? ` — "${message.slice(0, 100)}"` : ''}`

        await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            to: profile.push_token,
            title: pushTitle,
            body: pushBody,
            sound: 'default',
            data: {
              type: 'quote_response',
              documentId: doc.id,
              action: validAction,
            },
          }]),
        })
      }
    } catch {
      // Push is best-effort
    }

    // Show confirmation page
    const isAccept = validAction === 'accept'
    const page = htmlPage(
      isAccept ? 'Quote Accepted' : 'Quote Declined',
      `<div class="success-icon">${isAccept ? '✅' : '❌'}</div>
       <h1>Quote ${isAccept ? 'Accepted' : 'Declined'}</h1>
       <p>${isAccept
          ? `Thank you! You have accepted quote ${escapeHtml(reference)}. The engineer has been notified and will be in touch shortly.`
          : `You have declined quote ${escapeHtml(reference)}. The engineer has been notified.`
        }</p>
       ${message ? `<div class="ref"><strong>Your message:</strong> ${escapeHtml(message)}</div>` : ''}
       <div class="footer">Powered by <strong>GasPilot</strong></div>`,
      isAccept ? '#16a34a' : '#64748b',
    )

    return new Response(page, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  return new Response('Method not allowed', { status: 405 })
})

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
