# Setup Guide

This guide covers reliable local setup for Thirteen Labs on Windows and Docker-based full-stack development.

## Prerequisites

- Docker Desktop (recommended path)
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+ (only for non-Docker backend run)
- Valkey/Redis (only for non-Docker backend run)

## Option A: Full stack with Docker (recommended)

1. Create a root `.env` next to `docker-compose.yml`.
2. Add environment values used by backend services.
3. Start the stack:

```bash
docker compose up -d --build
```

Endpoints:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

Notes:
- Backend container runs migrations on startup (`flask db upgrade`).
- Restart backend after changing API keys:

```bash
docker compose restart backend
```

## Option B: Local backend + local frontend (without Docker)

### 1) Start dependencies

- Run PostgreSQL and create database `nightshade`.
- Run Valkey/Redis on port `6379`.

### 2) Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Set environment variables (PowerShell):

```powershell
$env:DATABASE_URL = "postgresql://nightshade:nightshade@localhost:5432/nightshade"
$env:REDIS_URL = "redis://localhost:6379/0"
$env:FLASK_APP = "run:app"
```

Run migrations and start API:

```bash
flask db upgrade
python run.py
```

### 3) Frontend setup

```bash
cd frontend
npm install
npm run dev
```

## Assistant and voice keys

Add these to the backend environment (or root `.env` for Docker):

- `BACKBOARD_API_KEY`
- `ELEVENLABS_API_KEY`

Optional integration keys:

- `PRESAGE_API_KEY`
- `SOLANA_RPC_URL`
- `TWELVELABS_API_KEY`

## Common troubleshooting

### Backboard 401 / unavailable assistant

- Verify `BACKBOARD_API_KEY` is present in the backend runtime environment.
- If using Docker, run:

```bash
docker compose exec backend env | grep BACKBOARD
```

- Restart backend after changing env:

```bash
docker compose restart backend
```

### Voice STT/TTS issues

- Verify `ELEVENLABS_API_KEY` is set in backend env.
- Confirm backend route health at `/api/assistant/stt` and `/api/assistant/tts`.
- See detailed troubleshooting in `backend/VOICE_STT_TTS_README.md`.

### Frontend build verification

```bash
cd frontend
npm run build
```
