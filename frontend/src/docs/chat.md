# Portfolio Chat Architecture

## 1) Chat API flow

- `Portfolio` page chat input and `PortfolioChat` component collect the user question.
- Frontend sends a POST to `POST /api/assistant/chat` via `portfolioChat(...)` in `frontend/src/api/portfolio.js`.
- Backend route `backend/app/routes/assistant.py` reads `question`, `portfolio`, `spending`, and `savings` from the request body.
- Route calls `chat(...)` in `backend/app/services/orchestrator.py`.
- Orchestrator builds prompt + user context and forwards to Backboard/Gemini thread API.
- Backend returns `{ text }`; frontend renders one TLDR output block.

## 2) Chat prompt text used

Location: `backend/app/services/orchestrator.py` in `_tldr_explainer_prompt()`.

Prompt text:

"You are a financial explanation assistant. Answer the user's question about their finances. Respond ONLY with a TLDR explanation in simple layman language. Preserve all numeric values and financial meaning. Be concise and practical. Do not include sections or headings."

## 3) Portfolio allocation definition

- Portfolio allocation data is prepared in `frontend/src/pages/Portfolio.jsx` from `alloc` + `pieData`.
- Categories and percentages are sent as:
  - `portfolio.risk`
  - `portfolio.allocation[]` with `{ category, percentage }`.
- Risk mode is set by the risk dropdown (`conservative`, `balanced`, `aggressive`) and stored in `risk` state.

## 4) Spending analysis source

- Spending totals are computed in frontend from `listTransactions({ limit: 200 })`.
- For each positive transaction amount, totals are grouped by `category` into `amount_cents`.
- Savings goals are loaded from `listGoals()` and sent in `savings`.

## 5) Example request + response

Request body:

```json
{
  "question": "Is my dining spending too high?",
  "mode": "balanced",
  "portfolio": {
    "risk": "balanced",
    "allocation": [
      { "category": "Stocks", "percentage": 25 },
      { "category": "Roth IRA", "percentage": 20 }
    ]
  },
  "spending": [
    { "category": "dining", "amount_cents": 52000 },
    { "category": "transport", "amount_cents": 18000 }
  ],
  "savings": [
    { "id": 2, "name": "Emergency Fund", "target_cents": 300000, "saved_cents": 120000 }
  ]
}
```

Response body:

```json
{
  "text": "TLDR: You spend about $520 per month on dining, which is 22% of your discretionary budget. Reducing this by $150/month would allow you to invest an extra $1,800/year, which could grow to about $25k over 10 years at 7%."
}
```