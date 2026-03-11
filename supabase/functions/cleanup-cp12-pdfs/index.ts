// ============================================
// Supabase Edge Function: cleanup-cp12-pdfs
// Deletes CP12 PDF files older than 24 hours
// Schedule daily in Supabase Dashboard → Edge Functions → Schedule
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const BUCKET = 'cp12-pdfs'
const MAX_AGE_HOURS = 24

serve(async (req) => {
  // Only allow calls authenticated with the service role key
  // (Supabase cron scheduler passes this automatically)
  const authHeader = req.headers.get('Authorization')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey,
  )

  const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000)
  let totalDeleted = 0
  let errors = 0

  // List all top-level entries — these are company-ID "folders" (id === null)
  const { data: topLevel, error: listError } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 1000 })

  if (listError) {
    return new Response(JSON.stringify({ error: listError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Supabase Storage pseudo-folders have id === null
  const companyFolders = (topLevel ?? []).filter(entry => entry.id === null)

  for (const folder of companyFolders) {
    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(folder.name, { limit: 1000 })

    const toDelete = (files ?? [])
      .filter(f => f.id !== null && f.created_at && new Date(f.created_at) < cutoff)
      .map(f => `${folder.name}/${f.name}`)

    if (toDelete.length > 0) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(toDelete)
      if (removeError) {
        errors++
      } else {
        totalDeleted += toDelete.length
      }
    }
  }

  return new Response(
    JSON.stringify({ deleted: totalDeleted, errors, cutoff: cutoff.toISOString() }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
