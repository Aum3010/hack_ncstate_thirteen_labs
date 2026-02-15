# Nightshade Backend

Flask API backend for the Nightshade personal finance platform. Includes AI voice assistant (ElevenLabs TTS/STT), document parsing (Gemini), crypto wallet tracking, and budgeting tools.

Runs headless in Docker. Zero disk storage for audio -- all TTS is streamed directly from ElevenLabs to the browser.

---

## Quick Start

```bash
# From project root (one level up from backend/)
docker-compose up --build
```

This starts:

| Service | Port | Description |
|---------|------|-------------|
| `backend` | 5000 | Flask API (Gunicorn, 2 workers) |
| `frontend` | 3000 | React frontend (Vite) |
| `db` | 5432 | PostgreSQL 15 |
| `valkey` | 6379 | Valkey (Redis-compatible cache) |

Migrations run automatically on startup via `entrypoint.sh`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```env
FLASK_ENV=development
SECRET_KEY=your-secret-key-change-in-production
DATABASE_URL=postgresql://nightshade:nightshade@db:5432/nightshade
REDIS_URL=redis://valkey:6379/0
SOLANA_RPC_URL=https://api.devnet.solana.com
PRESAGE_API_KEY=
BACKBOARD_API_KEY=
ELEVENLABS_API_KEY=your-elevenlabs-api-key
TWELVELABS_API_KEY=
```

The `ELEVENLABS_API_KEY` is required for voice features. Free tier works.

---

## Project Structure

```
backend/
|-- run.py                      # App entry point
|-- config.py                   # Config from env vars
|-- Dockerfile                  # python:3.11-slim + ffmpeg
|-- entrypoint.sh               # Wait for Postgres, run migrations, start Gunicorn
|-- requirements.txt
|
|-- app/
|   |-- __init__.py             # create_app() factory, blueprint registration
|   |
|   |-- models/
|   |   |-- user.py             # User (email, password hash, partitions)
|   |   |-- wallet.py           # Solana wallet addresses
|   |   |-- transaction.py      # Financial transactions (amount in cents)
|   |   |-- bill.py             # Recurring/one-time bills
|   |   |-- card.py             # Credit cards (last 4 digits)
|   |   |-- document_ref.py     # Uploaded document references
|   |   |-- goal.py             # Financial goals
|   |
|   |-- routes/
|   |   |-- auth.py             # Register, login, logout, wallet connect
|   |   |-- users.py            # GET /api/users/me
|   |   |-- wallets.py          # Wallet management, Solana tx fetching
|   |   |-- transactions.py     # Transaction CRUD with date filtering
|   |   |-- bills.py            # Bill CRUD with reminders
|   |   |-- cards.py            # Card management with Presage verification
|   |   |-- documents.py        # Document upload + Gemini invoice parsing
|   |   |-- assistant.py        # Voice assistant (TTS streaming, STT)
|   |   |-- goals.py            # Financial goals CRUD
|   |   |-- dashboard.py        # Dashboard summary + pie chart data
|   |   |-- insights.py         # AI-powered financial insights
|   |   |-- orderbook.py        # Crypto orderbook (Valkey-cached)
|   |
|   |-- services/
|   |   |-- eleven_service.py   # ElevenLabs API (TTS streaming + STT)
|   |   |-- audio_service.py    # In-memory audio format conversion (pydub)
|   |   |-- valkey.py           # Redis/Valkey client + orderbook cache
|
|-- migrations/                 # Flask-Migrate (Alembic)
```

---

## API Endpoints

All endpoints are prefixed with `/api`. Most require authentication (session cookie).

### Auth (`/api/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create account |
| POST | `/login` | Login (sets session cookie) |
| POST | `/logout` | Logout |
| POST | `/wallet-connect` | Link Solana wallet |

### Voice Assistant (`/api/assistant`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/tts` | Text-to-speech (streaming MP3) |
| POST | `/stt` | Speech-to-text (file upload) |
| POST | `/chat` | Chat with Backboard/Gemini |

### Financial Data

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/transactions` | Transaction CRUD |
| GET/POST | `/api/bills` | Bill management |
| GET/POST | `/api/cards` | Card management |
| GET/POST | `/api/goals` | Financial goals |
| GET/POST | `/api/documents` | Document upload + parsing |
| GET | `/api/wallets` | Wallet listing |
| GET | `/api/dashboard/summary` | Dashboard data |
| GET | `/api/insights/hero` | AI insights |
| GET | `/api/orderbook/<symbol>` | Crypto orderbook |

---

## Voice Architecture (Zero-Storage Streaming)

No audio files are ever written to disk. All TTS audio streams directly from ElevenLabs through Flask to the browser.

```
Browser
  |
  | POST /api/assistant/tts {"text": "Hello"}
  v
Flask Route (assistant.py)
  |
  | stream_speech("Hello") --> Python generator
  |
  | Response(stream_with_context(generator), mimetype="audio/mpeg")
  v
eleven_service.py
  |
  | client.text_to_speech.convert(...) --> chunk generator
  |
  | for chunk in response:
  |     yield chunk  -------> HTTP chunked response to browser
  v
ElevenLabs API
```

### TTS: `POST /api/assistant/tts`

**Request:**

```json
{
  "text": "Hello world",
  "voice_id": "JBFqnCBsd6RMkjVDRZzb"
}
```

`voice_id` is optional (defaults to George).

**Response:** Chunked `audio/mpeg` stream (raw MP3 bytes, not JSON).

**Frontend playback:**

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

### STT: `POST /api/assistant/stt`

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | file | yes | Audio file (wav, mp3, webm, ogg) |
| `language` | string | no | Language code (default `"en"`) |

**Response:**

```json
{
  "text": "The transcribed text"
}
```

**Browser recording + upload:**

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

## Service Functions Reference

### `eleven_service.py` -- ElevenLabs API

```python
from app.services.eleven_service import stream_speech, generate_speech, transcribe_audio
```

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `stream_speech` | `(text, voice_id=None)` | `Generator[bytes]` | Yields MP3 chunks from ElevenLabs. Used by Flask route for streaming. |
| `generate_speech` | `(text, voice_id=None)` | `bytes` | Convenience wrapper. Collects all chunks into one bytes object. |
| `transcribe_audio` | `(audio_bytes, language="en")` | `str` | Sends audio to ElevenLabs STT, returns transcript text. |

**ElevenLabs config:**

| Setting | Value |
|---------|-------|
| TTS model | `eleven_flash_v2_5` |
| Output format | `mp3_44100_128` (Free Tier safe) |
| Default voice | `JBFqnCBsd6RMkjVDRZzb` (George) |
| STT model | `scribe_v2` |
| Max concurrent calls | 3 (semaphore) |
| Retry | 3 attempts, 0.6s delay on 429/timeout/connection |

**SDK note:** The `elevenlabs` Python SDK uses `language_code=` as the parameter name for `speech_to_text.convert()`, not `language=`. The `transcribe_audio()` function accepts `language` in its public signature and maps it to `language_code` internally.

### `audio_service.py` -- In-Memory Audio Processing

```python
from app.services.audio_service import convert_audio, get_audio_duration, normalize_audio_for_stt
```

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `convert_audio` | `(audio_bytes, source_format="mp3", target_format="wav")` | `bytes` | Format conversion via pydub/FFmpeg. |
| `get_audio_duration` | `(audio_bytes, format="mp3")` | `float` | Duration in seconds. |
| `normalize_audio_for_stt` | `(audio_bytes, source_format="webm")` | `bytes` | Converts to mono 16kHz WAV for STT. |

All functions operate entirely in memory. No files are written.

---

## Dependencies

### Python packages (`requirements.txt`)

```
flask>=3.0.0
flask-cors>=4.0.0
flask-sqlalchemy>=3.1.0
psycopg2-binary>=2.9.9
python-dotenv>=1.0.0
gunicorn>=21.0.0
werkzeug>=3.0.0
redis>=5.0.0
requests>=2.31.0
google-generativeai>=0.8.0
flask-migrate>=4.0.0
elevenlabs>=1.0.0
soundfile>=0.12.1
pydub>=0.25.1
numpy>=1.24.0
```

No `sounddevice`, no `PortAudio`. Audio processing is headless (pydub + FFmpeg only).

### System packages (installed in Dockerfile)

| Package | Purpose |
|---------|---------|
| `gcc` | Compile psycopg2 |
| `libpq-dev` | PostgreSQL client headers |
| `ffmpeg` | Audio encoding/decoding for pydub |
| `libsndfile1` | Audio I/O for soundfile |

---

## Local Development (without Docker)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env             # edit with your keys

# Need PostgreSQL and Redis running locally
flask db upgrade
flask run
```

**Windows:** FFmpeg must be installed and on PATH for pydub to work. Get it from [gyan.dev/ffmpeg](https://www.gyan.dev/ffmpeg/builds/).

---

## Database

PostgreSQL 15 with Flask-Migrate (Alembic).

**Models:** User, Wallet, Transaction, Bill, Card, DocumentRef, Goal

Migrations run automatically on Docker startup. To run manually:

```bash
flask db upgrade          # apply migrations
flask db migrate -m "msg" # generate new migration
```

---

## Testing the Voice Endpoints

```bash
# TTS -- save streamed audio to file
curl -X POST http://localhost:5000/api/assistant/tts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"text": "Hello world"}' \
  --output speech.mp3

# STT -- transcribe an audio file
curl -X POST http://localhost:5000/api/assistant/stt \
  -b cookies.txt \
  -F "audio=@speech.mp3" \
  -F "language=en"
```

You need a valid session cookie. Login first via `POST /api/auth/login`.
