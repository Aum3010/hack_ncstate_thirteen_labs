import { API } from './config'

function credentials() {
  return { credentials: 'include' }
}

/**
 * Send audio blob to STT; returns { text }.
 */
export async function speechToText(audioBlob, language = 'en') {
  const form = new FormData()
  const blobType = (audioBlob?.type || '').toLowerCase()
  let filename = 'recording.webm'
  if (blobType.includes('ogg')) filename = 'recording.ogg'
  else if (blobType.includes('wav')) filename = 'recording.wav'
  else if (blobType.includes('mpeg') || blobType.includes('mp3')) filename = 'recording.mp3'
  else if (blobType.includes('mp4') || blobType.includes('aac')) filename = 'recording.m4a'
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
 * Request streamed TTS audio for text; returns audio Blob.
 */
export async function textToSpeechBlob(text) {
  const res = await fetch(`${API}/api/assistant/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...credentials(),
    body: JSON.stringify({ text }),
  })

  const contentType = (res.headers.get('content-type') || '').toLowerCase()

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'TTS failed')
  }

  if (contentType.includes('audio/')) {
    return res.blob()
  }

  const data = await res.json().catch(() => ({}))
  const audioUrl = data?.audio_url
  if (typeof audioUrl === 'string' && audioUrl.startsWith('data:audio/')) {
    const base64 = audioUrl.split(',')[1]
    if (!base64) throw new Error('TTS failed')
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes], { type: 'audio/mpeg' })
  }

  throw new Error(data?.error || 'TTS failed')
}

export const textToSpeech = textToSpeechBlob

/**
 * Play audio element and resolve when playback ends.
 */
export function playAudioBlob(audio) {
  if (!audio) return Promise.resolve()
  return new Promise((resolve, reject) => {
    audio.onended = () => resolve()
    audio.onerror = (e) => reject(e.error || new Error('Playback failed'))
    audio.play().catch(reject)
  })
}

export const playTTSFromResponse = playAudioBlob
