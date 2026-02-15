# Jarvis-like voice integration plan (TTS + STT)

**Goal:** Add speech-to-text and text-to-speech so users can talk to the app and hear replies, with **no voice file storage**—everything in-memory / streamed.

**Current state:**
- **Backend:** `POST /api/assistant/tts` exists (ElevenLabs, returns JSON `{ audio_url: "data:audio/mpeg;base64,..." }`). No STT route. No `eleven_service` or `audio_service` (those were from the reference doc).
- **Frontend:** `AssistantFab` and `ChatBar` are text-only. `portfolio.js` has `textToSpeech(text)` and expects TTS JSON with `audio_url`. No recording or STT yet.

---

## 1. Backend

### 1.1 Add STT route (no file storage)

- **Route:** `POST /api/assistant/stt`
- **Contract:** `multipart/form-data`: `audio` (file), optional `language` (string, default `"en"`). Response: `{ "text": "…" }`.
- **Implementation:** Read uploaded file into memory (e.g. `request.files["audio"].read()`), call ElevenLabs Speech-to-Text API with that bytes, return transcript. Do **not** save to disk.
- **ElevenLabs STT:** Use [ElevenLabs STT API](https://elevenlabs.io/docs/api-reference/speech-to-text) (e.g. `POST https://api.elevenlabs.io/v1/speech-to-text`) with the same `ELEVENLABS_API_KEY`. If the API expects a specific format (e.g. WAV), add an in-memory conversion step (see optional services below).

### 1.2 TTS (keep as-is or optionally stream)

- **Current:** TTS returns base64 in JSON; frontend uses `audio_url`. No storage—fine for “no voice files.”
- **Optional later:** Switch to streaming MP3 (chunked response) for lower latency and less memory; would require a small `eleven_service` and frontend to consume `response.blob()` and play while streaming or after. Not required for the first version.

### 1.3 Optional: shared ElevenLabs service layer

- **`app/services/eleven_service.py`:** Centralize TTS (and optionally streaming) and STT:
  - `transcribe_audio(audio_bytes, language="en")` → `str`
  - `generate_speech(text, voice_id=None)` → `bytes` (or a stream generator for streaming TTS).
- **`app/services/audio_service.py`:** Only if needed—e.g. convert browser `webm` to a format ElevenLabs STT accepts, using in-memory conversion (e.g. pydub + FFmpeg in Docker). If ElevenLabs accepts webm, this can be skipped.
- **Dependencies:** Add `elevenlabs` (or keep `requests`). If you need conversion: `pydub`, and ensure FFmpeg is in the Docker image.

### 1.4 Environment

- `.env` / `.env.example`: `ELEVENLABS_API_KEY` already present; ensure it’s set for both TTS and STT.

---

## 2. Frontend – “Jarvis” flow (no file storage)

### 2.1 End-to-end voice flow

1. User presses **mic** (push-to-talk or toggle).
2. **Record** in-browser (e.g. `MediaRecorder`, format e.g. `audio/webm`), in memory only.
3. On release/stop: **STT** — send audio blob to `POST /api/assistant/stt` (FormData with `audio`), get `{ text }`.
4. **Chat** — send `text` to `POST /api/assistant/chat` (same payload as current text input: `message`, `mode`, `context`, etc.), get `{ text: reply }`.
5. **TTS** — send `reply` to `POST /api/assistant/tts`, get `{ audio_url }` (base64 data URL).
6. **Play** — `new Audio(audio_url).play()` (or equivalent). No saving to disk.

All audio stays in memory / network; no recording or TTS files stored.

### 2.2 API helpers

- **`speechToText(audioBlob)`** (new): `POST /api/assistant/stt` with FormData, return `{ text }`. Use `credentials: 'include'` and same `API` base as rest of app.
- **`textToSpeech(text)`**: Already in `portfolio.js`; consider moving to a shared module (e.g. `api/assistant.js`) and reusing from both portfolio and the Jarvis UI.
- **Playback helper:** e.g. `playTTSFromResponse(data)` that expects `data.audio_url` and plays it (and optionally returns a Promise that resolves when playback ends).

### 2.3 Where to surface the Jarvis UX

- **Option A – AssistantFab:** Add a mic button; when used, run the flow above and show the transcript + reply in the existing panel (and play TTS). Keeps one entry point.
- **Option B – ChatBar:** Add mic next to the text input; same flow, append user message (from STT) and assistant reply to the thread and play TTS.
- **Option C – Both:** Same flow and shared helpers; mic in both AssistantFab and ChatBar.

Recommendation: start with **AssistantFab** (or ChatBar, depending on which you consider the “main” assistant), then add the other if desired.

### 2.4 UI/UX details

- **Recording state:** Show clear “listening…” / “recording” state and disable sending text while recording if needed.
- **Errors:** If STT fails, show “Couldn’t hear you” (or similar); if TTS fails, show the reply as text only.
- **Permissions:** Request microphone permission when the user first hits the mic; handle denial gracefully.
- **Accessibility:** Label mic button (e.g. “Speak”), and ensure transcript and reply are visible for users who can’t use audio.

---

## 3. Implementation checklist (summary)

| # | Task | Notes |
|---|------|--------|
| 1 | **Backend: STT route** | `POST /api/assistant/stt`, multipart `audio` + optional `language`, return `{ text }`, no disk write. |
| 2 | **Backend: ElevenLabs STT** | Call API with in-memory bytes; add format conversion only if API requires it. |
| 3 | **Frontend: STT helper** | `speechToText(blob)` → POST to `/api/assistant/stt`, return transcript. |
| 4 | **Frontend: Recording** | MediaRecorder, in-memory chunks → single Blob, no file save. |
| 5 | **Frontend: Jarvis flow** | Mic → record → STT → chat → TTS → play; reuse existing `/chat` and `/tts`. |
| 6 | **Frontend: Mic button + state** | Add to AssistantFab (and/or ChatBar); recording/listening/playing states. |
| 7 | **Optional** | Move `textToSpeech` to shared `api/assistant.js`; add streaming TTS later if desired. |

---

## 4. No-storage guarantee

- **Backend:** Do not call `save()` or write audio to the filesystem; read upload into memory, call ElevenLabs, return response.
- **Frontend:** Do not use `FileSystem` APIs or download recordings; use Blob/ArrayBuffer only for the request and play TTS from the in-memory data URL or blob.

This keeps the integration “Jarvis-like” and strictly **speech-to-text and text-to-speech** with no stored voice files.
