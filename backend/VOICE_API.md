# Voice API -- Developer Reference

Base URL: `/api/assistant`

All endpoints require authentication (session cookie).

Runs headless inside Docker. Zero disk storage -- all audio is streamed.

---

## REST Endpoints

### POST `/api/assistant/tts`

Stream text-to-speech audio directly from ElevenLabs to the browser.

**Request** -- `application/json`

```json
{
  "text": "Hello world",
  "voice_id": "JBFqnCBsd6RMkjVDRZzb"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | yes | Text to convert to speech |
| `voice_id` | string | no | ElevenLabs voice ID (default: George) |

**Response** -- `audio/mpeg` (chunked MP3 stream)

```
Content-Type: audio/mpeg
Transfer-Encoding: chunked
```

**Errors**

| Status | Body |
|--------|------|
| 400 | `{"error": "text required"}` |
| 401 | `{"error": "Not authenticated"}` |
| 503 | `{"error": "Voice service unavailable"}` |

**curl example**

```bash
curl -X POST http://localhost:5000/api/assistant/tts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"text": "Hello world"}' \
  --output speech.mp3
```

**JavaScript example**

```javascript
const res = await fetch("/api/assistant/tts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "Hello world" })
});
const blob = await res.blob();
const audio = new Audio(URL.createObjectURL(blob));
audio.play();
```

---

### POST `/api/assistant/stt`

Transcribe an uploaded audio file to text.

The frontend should record audio via the browser's `MediaRecorder` API and upload it here. ElevenLabs STT accepts mp3, wav, webm, ogg, and other common formats directly.

**Request** -- `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | file | yes | Audio file (WAV, MP3, webm, ogg, etc.) |
| `language` | string | no | Language code, default `"en"` |

**Response** -- `application/json`

```json
{
  "text": "The transcribed text appears here"
}
```

**Errors**

| Status | Body |
|--------|------|
| 400 | `{"error": "No 'audio' file in request"}` |
| 401 | `{"error": "Not authenticated"}` |
| 503 | `{"error": "Voice service unavailable"}` |

**curl example**

```bash
curl -X POST http://localhost:5000/api/assistant/stt \
  -b cookies.txt \
  -F "audio=@recording.wav" \
  -F "language=en"
```

**JavaScript example (browser recording)**

```javascript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream);
const chunks = [];

recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = async () => {
  const blob = new Blob(chunks, { type: "audio/webm" });
  const form = new FormData();
  form.append("audio", blob, "recording.webm");

  const res = await fetch("/api/assistant/stt", { method: "POST", body: form });
  const { text } = await res.json();
  console.log("Transcript:", text);
};

recorder.start();
setTimeout(() => recorder.stop(), 5000);
```

---

## Service Functions (for internal use)

### `eleven_service.py`

Located at `app/services/eleven_service.py`. ElevenLabs API only. Zero storage.

```python
from app.services.eleven_service import stream_speech, generate_speech, transcribe_audio
```

#### `stream_speech(text, voice_id=None) -> Generator[bytes]`

Yields MP3 chunks directly from the ElevenLabs API. Used by the Flask route for streaming responses.

```python
for chunk in stream_speech("Hello world"):
    # each chunk is a bytes object, part of the MP3 stream
    pass
```

#### `generate_speech(text, voice_id=None) -> bytes`

Convenience wrapper that collects all chunks into a single bytes object. Use when you need the complete audio buffer in memory (e.g., for format conversion).

```python
mp3_bytes = generate_speech("Hello world")
```

#### `transcribe_audio(audio_bytes, language="en") -> str`

Transcribes audio bytes to text via ElevenLabs STT (scribe_v2).

```python
text = transcribe_audio(wav_bytes)
text = transcribe_audio(webm_bytes, language="es")
```

---

### `audio_service.py`

Located at `app/services/audio_service.py`. In-memory audio processing via pydub + FFmpeg. Zero storage.

```python
from app.services.audio_service import convert_audio, get_audio_duration, normalize_audio_for_stt
```

#### `convert_audio(audio_bytes, source_format="mp3", target_format="wav") -> bytes`

Converts audio between formats in memory.

```python
wav_bytes = convert_audio(mp3_bytes, source_format="mp3", target_format="wav")
```

#### `get_audio_duration(audio_bytes, format="mp3") -> float`

Returns audio duration in seconds.

```python
duration = get_audio_duration(mp3_bytes)  # e.g. 3.45
```

#### `normalize_audio_for_stt(audio_bytes, source_format="webm") -> bytes`

Converts browser-recorded audio to mono 16kHz WAV optimized for STT.

```python
wav = normalize_audio_for_stt(webm_bytes, source_format="webm")
text = transcribe_audio(wav)
```

---

## Environment Setup

Required in `.env`:

```
ELEVENLABS_API_KEY=your_key_here
```

### Docker (production)

The Dockerfile installs `ffmpeg` and `libsndfile1` automatically. No additional setup.

### Local development (Windows)

- Python 3.10+
- FFmpeg installed and on PATH

```
pip install -r requirements.txt
```

---

## Architecture

```
Browser (MediaRecorder / Audio element)
    |
    v
Flask Route (assistant.py)
    |
    +-- eleven_service.py    ElevenLabs API only (TTS streaming + STT)
    |       yields chunks, no buffering, no disk, no globals
    |
    +-- audio_service.py     In-memory format conversion (pydub + FFmpeg)
            no disk I/O, no sound card, no mic
```

**Zero storage. No cache. No temp files. No generated_audio/.**

Each service is independently importable and testable. No circular dependencies.
