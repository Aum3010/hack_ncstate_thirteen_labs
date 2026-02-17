# Thirteen Labs

Personal finance co-pilot with an urban noir interface. Users can track transactions, bills, goals, wallets, and portfolio allocations, then ask an AI assistant questions by text or voice.

## What this includes

- React/Vite frontend with dashboard, money, risk, calendar, bills, and portfolio sandbox flows.
- Flask backend with REST routes for auth, finance data, portfolio analysis, and assistant orchestration.
- Postgres for persistence and Valkey for cache/session-like workflows.
- Voice pipeline: browser microphone input → backend STT → assistant response → backend TTS playback.

## Tech stack

- Frontend: React 18, Vite, Recharts
- Backend: Flask, SQLAlchemy, Flask-Migrate, Gunicorn
- Data: PostgreSQL, Valkey
- Integrations: Backboard/Gemini, ElevenLabs, Solana, Presage, TwelveLabs (optional)

## Quickstart

### Full stack with Docker (recommended)

1. Create root environment file next to `docker-compose.yml`.
2. Set required values (at minimum DB/cache defaults and any API keys you need).
3. Start all services:

```bash
docker compose up -d --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5000

### Local frontend only

```bash
cd frontend
npm install
npm run dev
```

### Local backend only

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set FLASK_APP=run:app
flask db upgrade
python run.py
```

## Required / optional environment variables

- `DATABASE_URL` (required)
- `REDIS_URL` (required for cache-backed features)
- `BACKBOARD_API_KEY` (assistant context + memory)
- `ELEVENLABS_API_KEY` (voice STT/TTS)
- `PRESAGE_API_KEY` (biometric card verification)
- `SOLANA_RPC_URL` (wallet data)
- `TWELVELABS_API_KEY` (optional media indexing)

## Documentation

- Setup and local environment: `SETUP.md`
- Architecture and module map: `ARCHITECTURE.md`
- Voice API implementation details: `backend/VOICE_STT_TTS_README.md`

## Project structure

- `frontend/` React app and UI components
- `backend/` Flask app, models, services, routes, migrations
- `scripts/` utility scripts and reminder/send helpers
- `docker-compose.yml` local orchestration for frontend/backend/db/valkey
