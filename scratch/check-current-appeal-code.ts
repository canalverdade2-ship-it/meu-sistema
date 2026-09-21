import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const challengeId = '5a8924f7-b0b3-4b2d-8bde-e69337760fad'
const submittedCode = '328501'
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const digest = await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(`partner-appeal:${challengeId}:${submittedCode}:${serviceRoleKey}`),
)
const calculatedHash = Array.from(new Uint8Array(digest))
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('')

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {autoRefreshToken: false, persistSession: false},
})
const {data, error} = await admin
  .from('parceiros_resgates_recurso_desafios')
  .select('code_hash, expires_at, consumed_at, attempts')
  .eq('id', challengeId)
  .maybeSingle()

if (error) throw error
console.log(JSON.stringify({
  found: Boolean(data),
  matches: data?.code_hash === calculatedHash,
  expired: data ? new Date(data.expires_at).getTime() <= Date.now() : null,
  consumed: Boolean(data?.consumed_at),
  attempts: data?.attempts ?? null,
}))
