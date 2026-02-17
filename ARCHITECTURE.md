# Architecture

## System overview

Thirteen Labs is a split frontend/backend application with data and cache infrastructure:

- Frontend: React SPA (Vite) for dashboard, portfolio sandbox, and assistant UX.
- Backend: Flask API with blueprint-based routes and service modules.
- Data: PostgreSQL via SQLAlchemy models + Alembic migrations.
- Cache/runtime support: Valkey (Redis-compatible).
- External services: Backboard/Gemini (assistant reasoning/memory), ElevenLabs (voice), Solana, Presage.

## Request flow

1. User action in frontend page/component.
2. Frontend API module in `frontend/src/api/*` calls backend route.
3. Flask route validates input and delegates to service layer (`backend/app/services/*`).
4. Service layer reads/writes DB models and/or calls external APIs.
5. Route returns normalized JSON (or audio stream for TTS).

## Backend structure

- App entrypoint: `backend/run.py`
- App factory + blueprint registration: `backend/app/__init__.py`
- Routes: `backend/app/routes/*`
- Models: `backend/app/models/*`
- Services: `backend/app/services/*`
- Migrations: `backend/migrations/*`

### Key route groups

- Auth/user lifecycle: `auth.py`, `users.py`
- Financial records: `transactions.py`, `bills.py`, `goals.py`, `wallets.py`, `cards.py`
- Analytics/dashboard: `dashboard.py`, `insights.py`, `portfolio.py`
- Assistant + voice: `assistant.py`

### Assistant and voice path

- Chat: frontend sends conversation context to backend assistant route.
- STT: browser audio upload to `/api/assistant/stt`.
- TTS: text to `/api/assistant/tts`, backend streams playable audio back.
- Frontend voice orchestration is centralized in `frontend/src/hooks/useVoiceAssistant.js`.

## Frontend structure

- App shell + routing: `frontend/src/App.jsx`
- Shared layout: `frontend/src/components/Layout.jsx`
- Pages: `frontend/src/pages/*`
- API clients: `frontend/src/api/*`
- Reusable UI and assistant widgets: `frontend/src/components/*`

### Portfolio sandbox design

`frontend/src/pages/Portfolio.jsx` is the state container and orchestration layer:

- Allocation/risk state and slider math.
- Investment projections and summary calculations.
- Spending suggestions hydration.
- Assistant chat payload assembly.
- Voice input/output handlers.

Presentation is split into focused components under `frontend/src/components/portfolio/`:

- `PortfolioHeaderCard.jsx`
- `PortfolioAllocationPanel.jsx`
- `PortfolioSummaryPanel.jsx`
- `PortfolioAssistantPanel.jsx`

## Deployment topology

`docker-compose.yml` runs:

- `frontend` (Vite app)
- `backend` (Gunicorn + Flask)
- `db` (PostgreSQL)
- `valkey` (cache)

The backend container runs migrations on startup before serving traffic.

## Engineering constraints

- Preserve backend route contracts to avoid frontend breakage.
- Keep voice route behavior stable (`/api/assistant/stt`, `/api/assistant/tts`).
- Prefer component extraction over behavioral rewrites for UI modernization.
- Validate with build/lint/compile checks after each targeted refactor.
