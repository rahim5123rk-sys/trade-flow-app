import {serve} from "https://deno.land/std@0.168.0/http/server.ts"
import {createClient} from "https://esm.sh/@supabase/supabase-js@2"
import {Resend} from "npm:resend@2.0.0"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_RECIPIENTS = 5

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get('SUPABASE_URL') || '*',
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

  // ── Auth verification (handles both HS256 and ES256 JWT algorithms) ──
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )

  let user
  try {
    const { data, error: authError } = await supabase.auth.getUser()
    if (authError || !data.user) {
      throw new Error(authError?.message || 'No user found')
    }
    user = data.user
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Auth failed', details: err.message, url: Deno.env.get('SUPABASE_URL') ? 'set' : 'missing', key: Deno.env.get('SUPABASE_ANON_KEY') ? 'set' : 'missing' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    })
  }

  // ── Input validation ──
  try {
    const { to, subject, html, pdfBase64, attachmentName } = await req.json()

    // Validate and sanitize recipients
    const recipients = (Array.isArray(to) ? to : typeof to === 'string' ? [to] : [])
      .map((e: unknown) => typeof e === 'string' ? e.trim().toLowerCase() : '')
      .filter((e: string) => EMAIL_REGEX.test(e))

    if (!recipients.length) {
      return new Response(JSON.stringify({ error: 'No valid recipient email addresses' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    if (recipients.length > MAX_RECIPIENTS) {
      return new Response(JSON.stringify({ error: `Maximum ${MAX_RECIPIENTS} recipients allowed` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Subject is required' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    if (!html || typeof html !== 'string' || html.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'HTML body is required' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const data = await resend.emails.send({
      from: 'GasPilot <info@gaspilotapp.com>',
      to: recipients,
      subject: subject.trim(),
      html: html,
      attachments: pdfBase64
        ? [
            {
              filename: attachmentName || 'gas-safety-certificate.pdf',
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
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
