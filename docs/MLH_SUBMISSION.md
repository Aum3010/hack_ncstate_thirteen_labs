# Thirteen Labs
**AI Personal Finance Buddy Powered by Real-Time Transactions**

---

## Inspiration

*From passive tracking to active understanding.*

You check your bank app. Numbers stare back. What do they *mean*? What should you *change*?

Personal finance tools show people what they spent, but not what it means or what to change. Money management is a job in itself.

Most apps rely on manual tracking and static dashboards that users must interpret themselves. In reality, people don't need more charts — they need clear guidance tied to their actual behaviour. That mental load is the real friction.

We wanted to build a financial companion that understands spending automatically and explains it in simple terms. By using real transaction data as the source of truth and combining it with AI reasoning, we aimed to shift personal finance from passive tracking to active understanding.

Financial clarity should be **conversational** and **continuous** — not something users have to calculate on their own. Thirteen Labs flips the model: real transaction data + AI reasoning = guidance you can *talk* to.

---

## What It Does

**Thirteen Labs** is an AI-powered personal finance assistant that connects to your Solana wallet so you never manually track a transaction. It helps you understand spending, optimize expenses, and progress toward financial goals — without the mental load of figuring it out yourself.

The app connects to a transaction source — such as a Solana wallet — to automatically ingest financial activity and build a real-time spending history. No spreadsheets, no manual entry, no wondering where the money went.

This financial data is analyzed by an intent-routed AI system that identifies patterns, detects unnecessary expenses, and generates personalized guidance. The assistant doesn't just answer questions — it explains *your* spending, *your* bills, and *your* goals in plain language, with numbers preserved. Ask what matters to you; get answers that matter.

You can interact conversationally with the assistant (text or voice) to ask questions like:

- Where am I overspending?
- What expenses can I reduce?
- How can I save faster?
- Am I on track for my goals?
- Which bill should I pay first?
- Am I at risk of missing any payments?

You get clear TLDR explanations grounded in your actual data — no guesswork, no spreadsheets.

**Voice interaction:** Speak to the assistant (mic → STT → chat → TTS) and hear replies — hands-free guidance while cooking, commuting, or multitasking, with no voice files stored.

---

## Financial Horizons Model

We structure finances across three horizons — each with a clear benefit for you:

**Now** — day-to-day discretionary spending (dining, groceries, outings)  
*See where your day-to-day money goes so you can trim what doesn't matter.*

**Commit** — recurring obligations (rent, subscriptions, bills)  
*Never miss a credit card bill or subscription. The assistant surfaces what's due and when, so you stay on top of obligations instead of paying late fees or hurting your credit.*

**Grow** — long-term savings and investments  
*Track how much actually reaches savings and investments — not just intentions.*

The hero chart shows how your actual spending maps to these three horizons — so you see the gap between plan and reality at a glance. One look tells you whether you're living within your means or overspending before goals get funded.

---

## How We Built It

Thirteen Labs uses transaction ingestion plus an intent-routed orchestrator and Backboard (Gemini).

**Flow:**

Transaction Source (Solana) → Categorization (SPL memo + fallback) → Financial State (DB snapshot) → Intent-Routed Orchestrator → Backboard (Gemini) → Assistant Output

The Solana wallet acts as a real-time transaction feed that automatically generates financial history without manual entry. Transactions are categorized via SPL memo parsing into investments, bill_payments, and short_term_goals, with fallback heuristics for raw activity.

The orchestrator builds a condensed financial context (transactions, bills, goals, budget allocation) and routes user intents:

- **Spending / Transactions** — recent categories, amounts, specific cuts
- **Bills / Obligations** — unpaid bills, due dates, payment order
- **Goals / Progress** — named goals, progress %, deadlines
- **General insights** — data-driven summary and actionable steps

Backboard provides the LLM with memory and conversation continuity. The assistant is constrained to personal finance and produces TLDR explanations with preserved numeric values.

---

## Challenges We Ran Into

**Converting raw transactions into meaningful financial categories**  
Transaction data is low-level and inconsistent. We designed normalization and categorization logic to map raw activity into human-understandable spending behavior. We learned that SPL memo conventions plus fallback heuristics are essential when source data varies.

**Designing safe, finance-scoped AI outputs**  
Financial guidance requires guardrails. We constrained the assistant to personal finance explanations and numeric fidelity via system prompts and modes (conservative/balanced/aggressive) to avoid unsafe or speculative advice.

**Multi-agent orchestration consistency**  
Our pipeline uses intent routing to specialize behavior across goals, bills, transactions, and insights. Maintaining consistent context across these paths required structured financial state passing in a single orchestrator.

**Explaining behavior instead of just analyzing it**  
We focused on interpretable insights rather than metrics. This required designing TLDR output constraints and layman-language translation in prompts.

We learned that the hard part isn't fetching data — it's turning it into advice users can act on without a finance degree.

---

## Accomplishments That We're Proud Of

**Real-time financial understanding without manual input**  
Connect a transaction source and instantly get behavioral insights — no manual tracking, no data entry. Your spending history builds itself.

**Never miss a bill**  
The bill payment horizon surfaces what's due and when, so you avoid late fees, interest spikes, and credit score hits from forgotten credit card or subscription payments.

**Finance-scoped conversational assistant**  
An AI assistant that explains *your* spending, *your* savings, and *your* allocation in simple TLDR terms grounded in real numbers — advice tailored to you, not generic tips.

**Single orchestrator with intent routing**  
One API call, context-aware responses for goals, bills, transactions, and general advice — no separate microservices, just smart routing and structured context.

**Multi-horizon financial model (Now / Commit / Grow)**  
We created a framework that evaluates short-term spending, recurring obligations, and long-term wealth simultaneously.

**Voice interaction with no storage**  
Speak to the assistant and hear replies — hands-free guidance while cooking, commuting, or multitasking, via ElevenLabs STT/TTS, with all audio in-memory and no voice files stored.

---

## What We Learned

Interpretation is more valuable than visibility.  
Clear explanations create more value than dashboards.

Financial guidance requires strict AI constraints.  
Finance-scoped prompts and numeric fidelity rules improved reliability.

Behavior change depends on contextual insights.  
Users respond better to goal-oriented explanations than raw totals.

Real transaction data improves AI relevance.  
Insights grounded in actual behavior are more actionable and trustworthy.

---

## What's Next for Thirteen Labs

Our vision: a financial intelligence layer that sits alongside everyday activity and continuously guides decisions toward user goals — no extra work required.

We plan to expand Thirteen Labs into a continuous personal finance copilot:

- multi-account transaction aggregation
- automated budgeting and savings suggestions
- goal forecasting and simulation
- anomaly and waste detection
- proactive financial alerts
- adaptive investment allocation guidance

---

## Built With

- React JS
- Python Flask
- Backboard.io (Gemini LLM enabled multi-agent orchestration pipeline)
- ElevenLabs (Text-to-Speech and Speech-to-Text for voice interaction)
- Valkey
- Solana wallet integration (Auth + transaction ingestion)

---

## Tagline

**Understand your spending. Reach your goals.**
