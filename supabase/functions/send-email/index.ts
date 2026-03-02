import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from "npm:resend@2.0.0"

// Initialize Resend with the secret you set earlier
const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200,
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    })
  }

  try {
    const { to, subject, html, pdfBase64, attachmentName } = await req.json()

    const recipients = Array.isArray(to)
      ? to.filter((email) => typeof email === 'string' && email.trim().length > 0)
      : typeof to === 'string' && to.trim().length > 0
        ? [to]
        : []

    if (!recipients.length || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, html' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const data = await resend.emails.send({
      from: 'GasCertPal <info@gascertpal.com>',
      to: recipients,
      subject: subject,
      html: html,
      attachments: pdfBase64
        ? [
            {
              filename: attachmentName || 'cp12-certificate.pdf',
              content: pdfBase64,
            },
          ]
        : undefined,
    })

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email error'
    return new Response(JSON.stringify({
      error: message,
      details: typeof error === 'object' ? error : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})