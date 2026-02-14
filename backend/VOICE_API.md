# Voice API — Developer Reference

Base URL: `/api/assistant`

All endpoints require authentication (session cookie).

---

## REST Endpoints

### POST `/api/assistant/tts`

Convert text to speech. Returns raw audio stream.

**Request** — `application/json`

```json
{
  "text": "Hello world",
  "voice_id": "JBFqnCBsd6RMkjVDRZzb"  // optional, defaults to George
}
```

**Response** — `audio/mpeg` (MP3 binary stream)

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

---

### POST `/api/assistant/stt`

Transcribe an uploaded audio file to text.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | file | yes | Audio file (WAV, MP3, etc.) |
| `language` | string | no | Language code, default `"en"` |

**Response** — `application/json`

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

---

### POST `/api/assistant/record-stt`

Record from the server's microphone and transcribe. Only works when the server runs locally on the same machine as the user.

**Request** — `application/json`

```json
{
  "duration": 5,       // optional, 1-30 seconds, default 5
  "language": "en"     // optional, default "en"
}
```

**Response** — `application/json`

```json
{
  "text": "The transcribed text appears here"
}
```

**Errors**

| Status | Body |
|--------|------|
| 400 | `{"error": "duration must be between 1 and 30 seconds"}` |
| 401 | `{"error": "Not authenticated"}` |
| 503 | `{"error": "Recording or transcription failed"}` |

**curl example**

```bash
curl -X POST http://localhost:5000/api/assistant/record-stt \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"duration": 5}'
```

---

## Service Functions (for internal use)

### `eleven_service.py`

Located at `app/services/eleven_service.py`. Handles ElevenLabs API calls only.

```python
from app.services.eleven_service import generate_speech, transcribe_audio
```

#### `generate_speech(text, voice_id=None) -> bytes`

Converts text to MP3 audio bytes via ElevenLabs TTS.

- Uses model `eleven_flash_v2_5` with `mp3_44100_128` output (Free Tier safe)
- Results are cached to disk (`app/cache/tts_cache/`) keyed by SHA-256 of `voice_id:text`
- Retries up to 3 times on 429 / timeout / connection errors
- Concurrent calls are limited to 3 via semaphore

```python
mp3_bytes = generate_speech("Hello world")
mp3_bytes = generate_speech("Hola", voice_id="custom_voice_id")
```

#### `transcribe_audio(audio_bytes, language="en") -> str`

Transcribes audio bytes to text via ElevenLabs STT (scribe_v2).

- Accepts WAV, MP3, or any format ElevenLabs supports
- Retries up to 3 times on transient errors

```python
text = transcribe_audio(wav_bytes)
text = transcribe_audio(mp3_bytes, language="es")
```

---

### `audio_service.py`

Located at `app/services/audio_service.py`. Handles local audio I/O only.

```python
from app.services.audio_service import record_from_mic, play_mp3_bytes, save_audio_file
```

#### `record_from_mic(duration=5, sample_rate=44100) -> bytes`

Records from the default microphone using `sounddevice`. Blocks until done.

- Returns WAV bytes (PCM 16-bit, mono)
- Output can be passed directly to `transcribe_audio()`

```python
wav_bytes = record_from_mic()
wav_bytes = record_from_mic(duration=10)
```

#### `play_mp3_bytes(audio_bytes) -> None`

Decodes MP3 via `pydub` and plays through the default audio output via `sounddevice`. Blocks until playback completes.

```python
mp3_bytes = generate_speech("Hello")
play_mp3_bytes(mp3_bytes)
```

#### `save_audio_file(audio_bytes, path) -> str`

Writes audio bytes to disk. Creates parent directories if needed. Returns the absolute path.

```python
abs_path = save_audio_file(mp3_bytes, "output/speech.mp3")
```

---

## Common Workflows

### Text to speech with playback

```python
from app.services.eleven_service import generate_speech
from app.services.audio_service import play_mp3_bytes

mp3 = generate_speech("Hello from ElevenLabs")
play_mp3_bytes(mp3)
```

### Record and transcribe

```python
from app.services.audio_service import record_from_mic
from app.services.eleven_service import transcribe_audio

wav = record_from_mic(duration=5)
text = transcribe_audio(wav)
print(text)
```

### Save TTS output to file

```python
from app.services.eleven_service import generate_speech
from app.services.audio_service import save_audio_file

mp3 = generate_speech("Save this to disk")
path = save_audio_file(mp3, "output/saved.mp3")
```

---

## Environment Setup

Required in `.env`:

```
ELEVENLABS_API_KEY=your_key_here
```

Required system dependencies (Windows):

- Python 3.10+
- FFmpeg (required by pydub for MP3 decoding) — add to PATH

Python packages:

```
pip install elevenlabs sounddevice soundfile pydub numpy
```

---

## Architecture

```
Flask Route (assistant.py)
    |
    +-- eleven_service.py    ElevenLabs API only (TTS + STT)
    |       no audio, no Flask, no globals
    |
    +-- audio_service.py     Local audio I/O only (mic + playback + save)
            no API calls, no Flask, no globals
```

Each service is independently importable and testable. No circular dependencies.
