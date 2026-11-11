// scripts/generate-mandarin-audio.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
}
if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
  throw new Error(
    'Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID in .env.local. ' +
    'Pick a multilingual-capable voice from https://elevenlabs.io/app/voice-library and use its voice ID.'
  )
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function synthesize(text: string): Promise<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
      }),
    }
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ElevenLabs request failed (${response.status}): ${errorText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function uploadAndLink(
  table: 'mandarin_vocab_items' | 'mandarin_examples',
  id: string,
  hanzi: string
): Promise<void> {
  const audioBuffer = await synthesize(hanzi)
  const path = `${table}/${id}.mp3`

  const { error: uploadError } = await supabase.storage
    .from('mandarin-audio')
    .upload(path, audioBuffer, { contentType: 'audio/mpeg', upsert: true })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from('mandarin-audio').getPublicUrl(path)

  const { error: updateError } = await supabase
    .from(table)
    .update({ audio_url: urlData.publicUrl })
    .eq('id', id)
  if (updateError) throw updateError

  console.log(`✓ ${table} ${id}: ${hanzi}`)
}

async function main() {
  const { data: vocabRows, error: vocabError } = await supabase
    .from('mandarin_vocab_items')
    .select('id, hanzi')
    .is('audio_url', null)
  if (vocabError) throw vocabError

  const { data: exampleRows, error: exampleError } = await supabase
    .from('mandarin_examples')
    .select('id, hanzi')
    .is('audio_url', null)
  if (exampleError) throw exampleError

  console.log(`Generating audio for ${vocabRows?.length ?? 0} vocab items and ${exampleRows?.length ?? 0} examples...`)

  for (const row of vocabRows ?? []) {
    await uploadAndLink('mandarin_vocab_items', row.id, row.hanzi)
  }
  for (const row of exampleRows ?? []) {
    await uploadAndLink('mandarin_examples', row.id, row.hanzi)
  }

  console.log('Done.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
