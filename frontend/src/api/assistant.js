import { API } from './config'

function credentials() {
  return { credentials: 'include' }
}

/**
 * Send audio blob to STT; returns { text }.
 */
export async function speechToText(audioBlob, language = 'en') {
  const form = new FormData()
  const filename = audioBlob.type && audioBlob.type.includes('webm') ? 'recording.webm' : 'recording.ogg'
  form.append('audio', audioBlob, filename)
  form.append('language', language)
  const res = await fetch(`${API}/api/assistant/stt`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || res.statusText || 'STT failed')
  return data
}

/**
 * Request TTS for text; returns { audio_url } (base64 data URL).
 */
export async function textToSpeech(text) {
  const res = await fetch(`${API}/api/assistant/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error('TTS failed')
  return res.json()
}

/**
 * Play TTS from API response. Resolves when playback ends or errors.
 * @param {{ audio_url?: string }} data - response from textToSpeech()
 */
export function playTTSFromResponse(data) {
  const url = data?.audio_url
  if (!url) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const audio = new Audio(url)
    audio.onended = () => resolve()
    audio.onerror = (e) => reject(e.error || new Error('Playback failed'))
    audio.play().catch(reject)
  })
}
