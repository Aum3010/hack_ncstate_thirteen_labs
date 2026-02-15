# Voice (STT + TTS) Developer README

This is the final reference for Nightshade voice features.

Scope: speech-to-text (STT) and text-to-speech (TTS) in the backend + frontend integration behavior currently implemented.

---

## 1) Current Voice Architecture

Voice pipeline in app:

1. Browser records audio (`MediaRecorder`)
2. `POST /api/assistant/stt` returns transcript JSON
3. Transcript is used as chat input and sent to `POST /api/assistant/chat`
4. Assistant text reply is generated
5. Reply text is sent to `POST /api/assistant/tts`
6. Browser plays MP3 audio

No backend disk writes for audio.

---

## 2) API Endpoints

Base: `/api/assistant`

### `POST /stt`

- Auth required (session cookie)
- Request: `multipart/form-data`
  - `audio` (required)
  - `language` (optional, default `en`)
- Response: JSON

```json
{ "text": "transcribed text" }
```

### `POST /tts`

- Auth required (session cookie)
- Request: JSON

```json
{ "text": "hello", "voice_id": "optional" }
```

- Response: `audio/mpeg` streamed/chunked MP3

### `POST /chat`

- Existing LLM chat endpoint (unchanged)
- Voice flow reuses the same chat logic as typed messages

---

## 3) Backend Implementation Details

### Files

- `app/routes/assistant.py`
  - `stt()` reads uploaded bytes in-memory and transcribes
  - `tts()` streams MP3 directly using Flask `Response(..., mimetype="audio/mpeg")`
- `app/services/eleven_service.py`
  - `stream_speech(text, voice_id)` for streaming TTS MP3 chunks
  - `transcribe_audio(audio_bytes, language)` for STT
- `app/services/audio_service.py`
  - In-memory audio conversion helpers via pydub/ffmpeg

### STT fallback behavior (implemented)

`/stt` tries direct transcription first. If that fails, backend does in-memory conversion to **MP3** and retries transcription.

This improves compatibility across browsers and devices while keeping free-tier-friendly MP3 handling in fallback path.

---

## 4) Frontend Integration (Current)

### Shared hook

- `frontend/src/hooks/useVoiceAssistant.js`
- States:
  - `micState`: `idle | recording | processing`
  - `assistantAudio`: `playing | stopped`
  - `voiceError`: error string for UI feedback

### Chat surfaces wired

- `frontend/src/components/ChatBar.jsx`
- `frontend/src/pages/Portfolio.jsx`
- `frontend/src/components/PortfolioChat.jsx`
- `frontend/src/components/AssistantFab.jsx`

### Implemented behavior

- Mic button:
  - Tap to record
  - Tap again (or timeout) to stop
  - STT transcript is written into input and sent through existing send handler
- TTS for assistant reply:
  - Assistant text is spoken automatically
- Typed text to speech:
  - Dedicated speaker button (`🔊`) next to input speaks typed text without sending

---

## 5) Environment Requirements

Set in runtime env (`.env` used by docker-compose backend service):

```env
ELEVENLABS_API_KEY=...
```

If missing:

- `/stt` returns 503 with key error
- `/tts` returns 503 with key error

---

## 6) Docker Requirements

`backend/Dockerfile` includes:

- `ffmpeg`
- `libsndfile1`
- `gcc`
- `libpq-dev`

Also verifies availability at build time:

- `ffmpeg -version`
- `ffprobe -version`

Runtime env hints are set:

- `FFMPEG_BINARY=/usr/bin/ffmpeg`
- `FFPROBE_BINARY=/usr/bin/ffprobe`

---

## 7) Build / Run

From repo root:

```bash
docker-compose up --build
```

If backend config changed:

```bash
docker-compose up -d --build backend
```

---

## 8) Smoke Test Checklist

1. Login to app
2. Open a chat UI (ChatBar / Portfolio / AssistantFab)
3. Type message and send
   - Expect assistant text response
   - Expect spoken TTS audio
4. Click mic and speak
   - Expect transcript
   - Expect transcript is sent to chat
   - Expect assistant spoken reply
5. Click `🔊` with typed text in box
   - Expect typed text playback without sending to chat

---

## 9) Troubleshooting

### STT works, TTS silent

- Check browser autoplay policy (user interaction usually required)
- Verify `/api/assistant/tts` returns `audio/mpeg`
- Verify `ELEVENLABS_API_KEY` is present in backend env
- Rebuild backend container after env/package changes

### Mic does not capture

- Check browser microphone permission
- Ensure secure context (`https` or localhost)
- Confirm browser supports `MediaRecorder`

### STT errors on some devices

- Backend fallback conversion to MP3 is enabled
- Ensure ffmpeg exists in backend container (build verifies this)

---

## 10) Security Notes

- Keep API keys only in `.env` (already git-ignored)
- Rotate any key exposed in logs/chat immediately

---

## 11) What Not To Change

To preserve current behavior:

- Do not change `/api/assistant/chat` contract for voice flow
- Do not store audio files on disk
- Keep TTS response as streamed MP3
- Keep chat send path shared between typed and voice inputs
