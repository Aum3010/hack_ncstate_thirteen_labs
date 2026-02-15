# Nightshade

Utility-first financial app: bill reminders, calendar, money & crypto, risk, and an AI assistant (Gemini via Backboard). Metropolitan urban noir UI.

## Tech stack

- **Frontend:** React (Vite)
- **Backend:** Python Flask + Gunicorn
- **DB:** Postgres
- **Cache:** Valkey (Redis-compatible)
- **APIs:** Solana, Presage, Backboard (memory + Gemini), ElevenLabs, TwelveLabs (optional)

## Run locally

### Backend + DB + Valkey (Docker)

```bash
docker-compose up -d db valkey
cd backend
python3 -m venv .venv && source .venv/bin/activate  # or Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: DATABASE_URL=postgresql://nightshade:nightshade@localhost:5432/nightshade, REDIS_URL=redis://localhost:6379/0
export FLASK_APP=run:app
flask db upgrade   # run migrations once
python run.py      # or: gunicorn -b 0.0.0.0:5000 run:app
```

### Backend (standalone, no Docker)

Create a Postgres DB and set `DATABASE_URL`. Run migrations once before starting the app.

```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL=postgresql://user:pass@localhost/nightshade
export FLASK_APP=run:app
flask db upgrade   # run migrations once
python run.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. Use Register/Login (password). Link wallet on Dashboard. Add bills, view Calendar, use the floating Assistant (Backboard/Gemini when API key is set).

### Full stack with Docker

Create a `.env` file in the project root (next to `docker-compose.yml`) so the backend can load API keys and optional Backboard URLs. Copy from the example: `cp .env.example .env`, then set `BACKBOARD_API_KEY` if you use the assistant.

```bash
docker compose up -d --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- The backend container runs **migrations** once on startup (`flask db upgrade`) before starting Gunicorn, so the DB schema is applied automatically.

## Auth

- **Password:** Register with email or username + password; login the same way.
- **Solana wallet:** After login, paste wallet address on Dashboard to link (or use “Link wallet”).
- **Presage:** For adding a credit card, send `X-Presage-Token` or `presage_token` in the request body. Link Presage in Auth → Presage verify.

## API keys (optional)

Set in backend `.env` or environment (for Docker full stack, use a root `.env` next to `docker-compose.yml` — e.g. `cp .env.example .env` — and set keys there):

- `BACKBOARD_API_KEY` — memory + Gemini via Backboard (assistant chat).
- `ELEVENLABS_API_KEY` — TTS for assistant voice.
- `PRESAGE_API_KEY` — biometric verification.
- `SOLANA_RPC_URL` — for wallet/balance (default mainnet).
- `TWELVELABS_API_KEY` — video indexing (optional).

### Backboard connection (assistant)

Backboard API base URL per [docs](https://docs.backboard.io/): `https://app.backboard.io/api`. Use your API key from [Backboard Dashboard](https://app.backboard.io) → Settings → API Keys.

If you see **"Failed to resolve app.backboard.io"** or **"NameResolutionError / Temporary failure in name resolution"**:

0. **Docker Desktop on Mac:** Ensure **Swap > 0** in Settings → Resources ([known DNS bug](https://github.com/docker/for-mac/issues/7074)). Apply and restart Docker, then `docker compose down && docker compose up -d`.
1. **extra_hosts (included):** `docker-compose.yml` adds `app.backboard.io` to the backend container's `/etc/hosts` to bypass DNS. If Backboard changes infrastructure and it stops working, run `dig +short app.backboard.io` and update the IP in `extra_hosts` under the backend service.
2. **Docker:** Restart after env changes: `docker compose down` then `docker compose up -d`. The backend uses DNS 8.8.8.8 and 1.1.1.1. If resolution still fails, run the backend outside Docker (see step 4) to isolate whether it's container DNS or host network.
3. **Override API base:** If Backboard provides an alternate host, set `BACKBOARD_API_BASE=https://<host>/api` in `.env` (root for Docker, or `backend/` for local run). The default is `https://app.backboard.io/api`. For document ingest, set `BACKBOARD_INGEST_URL` if needed.
4. **Backend outside Docker:** Run `python run.py` in `backend/` on your host. The host's DNS is used; if resolution works there but not in Docker, the container may have network/DNS restrictions (VPN, firewall, or Docker network isolation).
5. **Network checks:** Ensure outbound HTTPS works. From host: `curl -I https://app.backboard.io/api/assistants -H "X-API-Key: YOUR_KEY"` (or `docker compose exec backend curl ...` from inside the container).

## Database migrations

- Migrations use **Flask-Migrate (Alembic)**. Migration files live in `backend/migrations/`.
- **In Docker:** The backend entrypoint runs `flask db upgrade` before starting Gunicorn, so no extra step is needed.
- **Local dev:** Run `flask db upgrade` once after setting `DATABASE_URL` and `FLASK_APP=run:app`. After adding or changing models, run `flask db migrate -m "description"` then `flask db upgrade`.

## Project layout

- `backend/` — Flask app, Postgres models, auth, bills, transactions, wallets, cards, documents, assistant, orderbook; `migrations/` for DB migrations.
- `frontend/` — React app, Dashboard, Bills, Calendar, Money, Risk, Assistant fab.
- `docker-compose.yml` — Postgres, Valkey, backend, frontend.
