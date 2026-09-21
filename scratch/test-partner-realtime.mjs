import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'

const supabaseUrl = 'https://api.147-15-43-141.nip.io'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs'
const protocol = 'PROT-RES-2026-8CB036'
const sshKey = 'C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key'

const headers = {apikey: anonKey, Authorization: `Bearer ${anonKey}`}
const directResponse = await fetch(
  `${supabaseUrl}/rest/v1/parceiros_resgates?select=id&limit=1`,
  {headers},
)

const supabase = createClient(supabaseUrl, anonKey)
const {data: consultation, error: consultationError} = await supabase.rpc(
  'gsa_public_consultar_protocolo',
  {p_codigo: protocol},
)
if (consultationError) throw consultationError

const record = Array.isArray(consultation) ? consultation[0] : consultation
if (!record?.tracking_key) throw new Error('Consulta sem tracking_key')

let updateStarted = false
const realtimeResult = await new Promise((resolve, reject) => {
  const timeout = setTimeout(async () => {
    await supabase.removeChannel(channel)
    reject(new Error('Timeout aguardando evento Realtime'))
  }, 15000)

  const channel = supabase
    .channel(`appeal-realtime-test-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'parceiros_resgates_public_status',
        filter: `tracking_key=eq.${record.tracking_key}`,
      },
      async (payload) => {
        clearTimeout(timeout)
        await supabase.removeChannel(channel)
        resolve({eventType: payload.eventType, revision: payload.new?.revision})
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && !updateStarted) {
        updateStarted = true
        const child = spawn(
          'ssh',
          ['-i', sshKey, 'opc@147.15.43.141', '/home/opc/touch-partner-realtime.sh'],
          {stdio: 'ignore'},
        )
        child.on('exit', (code) => {
          if (code !== 0) reject(new Error(`Falha ao provocar atualização técnica: ${code}`))
        })
      }
      if (status === 'CHANNEL_ERROR') reject(new Error('Falha no canal Realtime'))
    })
})

console.log(JSON.stringify({
  directPrivateTableStatus: directResponse.status,
  protocolFound: Boolean(record?.id),
  timelineEvents: Array.isArray(record?.eventos) ? record.eventos.length : 0,
  realtime: realtimeResult,
}))
