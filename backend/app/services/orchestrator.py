"""Multi-agent orchestrator: build context, route intent, call Backboard with system prompt and mode."""
import logging
import os
import json
from collections import defaultdict

from app import db
from app.models import User
from app.services.backboard_ingest import build_user_financial_snapshot

logger = logging.getLogger(__name__)

# Cache assistant_id after first create (when BACKBOARD_ASSISTANT_ID is not set)
_cached_assistant_id = None

# Intent keywords for routing (optional; used for single-call with full context in v1)
GOALS_KEYWORDS = ("goal", "goals", "saving", "saved", "target", "deadline", "progress")
BILLS_KEYWORDS = ("bill", "bills", "due", "payment", "pay ", "reminder")
TRANSACTIONS_KEYWORDS = ("transaction", "transactions", "spend", "spending", "solana", "crypto", "wallet")
INSIGHTS_KEYWORDS = ("insight", "recommend", "advice", "how am i", "summary", "overview")


def build_context(user_id: int) -> str:
    """Build text context from DB snapshot for the LLM (condensed for prompt)."""
    snapshot = build_user_financial_snapshot(user_id)
    if not snapshot:
        return "No financial data available for this user."
    lines = [
        "Use the numbers and names below. Do not give generic advice; tailor everything to this user.",
        "",
        "=== User financial context ===",
    ]
    summary = snapshot.get("summary", {})
    lines.append(
        f"Monthly spend (recent): ${summary.get('total_spend_dollars', 0):.2f}. "
        f"Unpaid bills total: ${summary.get('unpaid_bills_dollars', 0):.2f}. "
        f"Goals: {summary.get('goals_count', 0)} goals, "
        f"target ${summary.get('goal_target_cents', 0) / 100:.2f}, saved ${summary.get('goal_saved_cents', 0) / 100:.2f}."
    )
    cfg = snapshot.get("partition_config", {})
    if cfg:
        inv = cfg.get("investments", {}) or {}
        bills_cfg = cfg.get("bill_payments", {}) or {}
        goals_cfg = cfg.get("short_term_goals", {}) or {}
        lines.append(
            f"Budget allocation: investments {inv.get('target_pct', 0)}%, "
            f"bills {bills_cfg.get('target_pct', 0)}%, short-term goals {goals_cfg.get('target_pct', 0)}%."
        )
    transactions = snapshot.get("transactions") or []
    if transactions:
        by_cat = defaultdict(lambda: 0)
        for t in transactions:
            by_cat[t.get("category") or "other"] += t.get("amount_cents", 0)
        if by_cat:
            top_cat = max(by_cat, key=by_cat.get)
            top_dollars = by_cat[top_cat] / 100
            lines.append(f"Largest spending category: {top_cat} (${top_dollars:.2f}).")
        lines.append("Recent transactions (last 20):")
        for t in transactions[:20]:
            amt = t.get("amount_cents", 0) / 100
            cat = t.get("category", "?")
            desc = (t.get("description") or "")[:40]
            lines.append(f"  - ${amt:.2f} ({cat}) {desc}")
    bills = snapshot.get("bills") or []
    if bills:
        lines.append("Unpaid bills:")
        for b in bills:
            due = b.get("due_date") or "N/A"
            lines.append(f"  - {b.get('name')}: ${b.get('amount', 0):.2f}, due {due}")
    goals = snapshot.get("goals") or []
    if goals:
        lines.append("Goals:")
        for g in goals:
            pct = (g.get("saved_cents", 0) / max(g.get("target_cents", 1), 1)) * 100
            deadline = g.get("deadline") or "N/A"
            lines.append(f"  - {g.get('name')}: ${g.get('saved', 0):.2f} / ${g.get('target', 0):.2f} ({pct:.0f}%), deadline {deadline}")
        if len(goals) == 1:
            g = goals[0]
            pct = (g.get("saved_cents", 0) / max(g.get("target_cents", 1), 1)) * 100
            lines.append(f"Summary: Goal '{g.get('name')}' is {pct:.0f}% of target, deadline {g.get('deadline') or 'none'}.")
        elif len(goals) > 1:
            parts = [f"'{g.get('name')}' {100 * (g.get('saved_cents', 0) / max(g.get('target_cents', 1), 1)):.0f}%" for g in goals[:5]]
            lines.append("Summary: " + "; ".join(parts) + ".")
    return "\n".join(lines)


def _base_system_prompt() -> str:
    """Comprehensive base system prompt for user-specific, actionable advice."""
    return (
        "You are a financial assistant for the Nightshade app, with access to this user's real data "
        "(transactions, bills, goals, budget allocation). "
        "Always ground advice in the provided context: reference the user's actual dollar amounts, goal names, "
        "bill names, and categories. Never give advice that could apply to any user; if context is empty, "
        "say so and ask them to add data. "
        "Every response must include at least one concrete next step the user can do (e.g. 'Add a $50 transfer "
        "to [Goal X] by Friday,' 'Pay [Bill Y] before [due date]'). Prefer specific numbers and dates over "
        "vague suggestions. Go deeper than bullet lists of generic tips: prioritize 2–4 high-impact, "
        "personalized points and explain briefly why each fits this user's situation. Be concise and substantive; "
        "avoid filler and repetition. "
        "Always end responses with a TLDR summary in simple language that includes all important numeric values "
        "from your answer and explains what those numbers mean financially."
    )


def _tldr_explainer_prompt() -> str:
    return (
        "You are a personal finance explanation assistant embedded in a finance tracking and investment planning application.\n\n"
        "Your role is to help users understand their spending, savings, and portfolio in simple terms and guide them toward their financial goals.\n\n"
        "--------------------------------\n"
        "DOMAIN CONSTRAINT\n"
        "--------------------------------\n"
        "You must ONLY answer questions related to:\n"
        "- personal finance\n"
        "- budgeting\n"
        "- spending habits\n"
        "- savings\n"
        "- investments\n"
        "- portfolio allocation\n"
        "- financial goals\n\n"
        "If a question is unrelated to personal finance, politely refuse and redirect to finance context.\n\n"
        "--------------------------------\n"
        "GOAL-ORIENTED BEHAVIOR\n"
        "--------------------------------\n"
        "Always interpret the user’s finances relative to their stated or implied goals.\n\n"
        "Examples of goals:\n"
        "- saving for house\n"
        "- emergency fund\n"
        "- retirement\n"
        "- investing growth\n"
        "- reducing spending\n"
        "- increasing savings rate\n\n"
        "Your explanations should highlight how current behavior helps or hurts progress toward the goal and suggest practical adjustments.\n\n"
        "--------------------------------\n"
        "RESPONSE STYLE (MANDATORY)\n"
        "--------------------------------\n"
        "Respond ONLY with a single TLDR explanation in plain, everyday language.\n\n"
        "Requirements:\n"
        "- easy for non-experts to understand\n"
        "- concise (2–4 sentences)\n"
        "- preserve all important numbers\n"
        "- include financial meaning of numbers\n"
        "- actionable if relevant\n\n"
        "Do NOT include:\n"
        "- headings\n"
        "- bullet points\n"
        "- sections\n"
        "- disclaimers\n"
        "- role statements\n"
        "- greetings\n"
        "- filler text\n\n"
        "--------------------------------\n"
        "NUMERIC FIDELITY\n"
        "--------------------------------\n"
        "Never change, round away, or omit important financial numbers provided in context.\n\n"
        "Always reference:\n"
        "- dollar amounts\n"
        "- percentages\n"
        "- time horizons\n"
        "- rates of return\n"
        "- category totals\n\n"
        "Explain what those numbers imply for the user.\n\n"
        "--------------------------------\n"
        "FINANCIAL GUARDRAILS\n"
        "--------------------------------\n"
        "Do NOT:\n"
        "- provide tax, legal, or regulated investment advice\n"
        "- recommend specific securities\n"
        "- make guarantees or promises\n"
        "- speculate beyond provided data\n"
        "- assume missing financial facts\n\n"
        "You may:\n"
        "- explain patterns\n"
        "- compare spending vs norms\n"
        "- estimate simple growth if rate provided\n"
        "- suggest general budgeting or allocation adjustments\n\n"
        "--------------------------------\n"
        "DATA CONTEXT USAGE\n"
        "--------------------------------\n"
        "You will receive structured financial context such as:\n"
        "- spending by category\n"
        "- savings progress\n"
        "- portfolio allocation\n"
        "- user goal\n"
        "- risk level\n\n"
        "Use only this data to form explanations.\n\n"
        "If data is insufficient, state the limitation briefly within the TLDR.\n\n"
        "--------------------------------\n"
        "OUT-OF-DOMAIN HANDLING\n"
        "--------------------------------\n"
        "If the question is not about personal finance:\n\n"
        "Reply:\n"
        "\"I can help with your finances and goals. Could you ask about your spending, savings, or investments?\"\n\n"
        "--------------------------------\n"
        "OUTPUT CONTRACT\n"
        "--------------------------------\n"
        "Always produce exactly one TLDR paragraph following the rules above."
    )


def get_mode_system_append(mode: str) -> str:
    """Return the mode-specific system instruction to append to the base prompt."""
    mode = (mode or "balanced").strip().lower()
    if mode == "conservative":
        return (
            " Mode: Conservative. Prioritize safety, emergency fund, bill due dates, and debt reduction. "
            "Tie every recommendation to their unpaid bills and goal deadlines. Avoid suggesting more crypto or "
            "speculative investments. Be cautious and specific about which bill to pay first and when."
        )
    if mode == "aggressive":
        return (
            " Mode: Aggressive. Prioritize growth and reaching goals faster. When their data supports it, "
            "suggest reallocating or increasing goal contributions; cite their actual allocation and progress. "
            "Be direct and opportunity-focused while still grounding every suggestion in their numbers."
        )
    return (
        " Mode: Balanced. Emphasize trade-offs (e.g. 'Given your 20% investments and 30% goals, you could …'). "
        "Suggest small, sustainable changes first. Weigh both safety and growth based on the user's context."
    )


def route_intent(message: str) -> list[str]:
    """Classify user message into agent types (insights, goals, transactions, bills, general)."""
    msg = (message or "").lower().strip()
    intents = []
    if any(k in msg for k in GOALS_KEYWORDS):
        intents.append("goals")
    if any(k in msg for k in BILLS_KEYWORDS):
        intents.append("bills")
    if any(k in msg for k in TRANSACTIONS_KEYWORDS):
        intents.append("transactions")
    if any(k in msg for k in INSIGHTS_KEYWORDS) or not intents:
        intents.append("insights")
    if "general" not in intents and not intents:
        intents.append("general")
    return list(dict.fromkeys(intents))  # dedupe order-preserving


def chat(
    message: str,
    user_id: int,
    api_key: str,
    mode: str | None = None,
    messages: list | None = None,
    finance_payload: dict | None = None,
) -> dict:
    """
    Orchestrator entry: build context, build system prompt (with mode), call Backboard once.
    Returns {"text": "...", "action": None} compatible with existing frontend.
    """
    global _cached_assistant_id
    if not api_key:
        return {
            "text": "Assistant is connected via Backboard (Gemini). Set BACKBOARD_API_KEY to enable.",
            "action": None,
        }
    context = build_context(user_id)
    base_system = _base_system_prompt()
    if finance_payload:
        system_prompt = _tldr_explainer_prompt()
    else:
        mode_append = get_mode_system_append(mode)
        system_prompt = base_system + mode_append

    if not finance_payload:
        intents = route_intent(message)
        intent_instruction = ""
        if "goals" in intents:
            intent_instruction = " The user is asking about goals. Focus on their named goals, progress %, and deadlines; suggest a concrete next action for at least one goal."
        elif "bills" in intents:
            intent_instruction = " The user is asking about bills. Focus on unpaid bills, due dates, and paying on time; suggest which bill to pay first if relevant."
        elif "transactions" in intents:
            intent_instruction = " The user is asking about spending/transactions. Focus on recent categories and amounts; suggest one or two specific cuts or habits."
        else:
            intent_instruction = " The user wants overall insight or advice. Give a concise, data-driven summary and 2–3 actionable steps tied to their numbers."
        system_prompt = system_prompt + intent_instruction

    history_lines = []
    if isinstance(messages, list):
        for m in messages:
            if not isinstance(m, dict):
                continue
            role = (m.get("role") or "").strip().lower()
            content = (m.get("content") or m.get("text") or "").strip()
            if role in ("user", "assistant") and content:
                history_lines.append(f"{role.capitalize()}: {content}")
    history_text = "\n".join(history_lines) if history_lines else f"User: {message}"

    finance_payload_text = ""
    if finance_payload:
        finance_payload_text = f"\n\nStructured finance payload:\n{json.dumps(finance_payload, ensure_ascii=False)}"

    full_message = (
        f"[System: {system_prompt}]\n\n[Context:\n{context}\n]\n\n"
        f"Conversation so far:\n{history_text}\n\n"
        f"Latest user question: {message}"
        f"{finance_payload_text}"
    )
    try:
        import requests

        base_url = os.environ.get("BACKBOARD_API_BASE", "https://app.backboard.io/api").rstrip("/")
        headers = {"X-API-Key": api_key, "Content-Type": "application/json"}

        # 1) Get or create assistant
        assistant_id = os.environ.get("BACKBOARD_ASSISTANT_ID") or _cached_assistant_id
        if not assistant_id:
            r = requests.post(
                f"{base_url}/assistants",
                headers=headers,
                json={
                    "name": "Nightshade Financial",
                    "system_prompt": base_system + get_mode_system_append(mode or "balanced"),
                },
                timeout=30,
            )
            if not r.ok:
                logger.warning("Backboard create assistant failed: status=%s body=%s", r.status_code, (r.text or "")[:500])
                return {"text": f"Backboard unavailable: create assistant returned {r.status_code}.", "action": None}
            data = r.json()
            assistant_id = data.get("assistant_id")
            if assistant_id:
                _cached_assistant_id = assistant_id

        if not assistant_id:
            return {"text": "Backboard unavailable: no assistant id.", "action": None}

        # 2) Get or create thread for user
        user = User.query.get(user_id)
        if not user:
            return {"text": "User not found.", "action": None}
        thread_id = user.backboard_thread_id
        if not thread_id:
            r = requests.post(
                f"{base_url}/assistants/{assistant_id}/threads",
                headers=headers,
                json={},
                timeout=30,
            )
            if not r.ok:
                logger.warning("Backboard create thread failed: status=%s body=%s", r.status_code, (r.text or "")[:500])
                return {"text": f"Backboard unavailable: create thread returned {r.status_code}.", "action": None}
            thread_id = r.json().get("thread_id")
            if thread_id:
                user.backboard_thread_id = thread_id
                db.session.commit()
        if not thread_id:
            return {"text": "Backboard unavailable: no thread id.", "action": None}

        # 3) Send message (API expects multipart/form-data; web_search=Auto for current rates/context when relevant)
        msg_headers = {"X-API-Key": api_key}
        r = requests.post(
            f"{base_url}/threads/{thread_id}/messages",
            headers=msg_headers,
            data={"stream": "false", "memory": "Auto", "web_search": "Auto"},
            files=[("content", (None, full_message))],
            timeout=60,
        )
        if not r.ok:
            body_snippet = (r.text or "")[:500]
            logger.warning(
                "Backboard messages returned non-2xx: status=%s body=%s",
                r.status_code,
                body_snippet,
            )
            user_hint = f"Backboard returned {r.status_code}. Check server logs for details."
            try:
                err = r.json()
                msg = err.get("error") or err.get("message") or err.get("detail")
                if isinstance(msg, str) and msg:
                    user_hint = f"Backboard returned {r.status_code}: {(msg[:100])}."
            except Exception:
                pass
            return {"text": user_hint, "action": None}
        out = r.json()
        content = out.get("content") or out.get("text") or out.get("response")
        return {"text": content or "No response.", "action": out.get("action")}
    except Exception as e:
        logger.exception("Backboard chat failed")
        return {"text": f"Backboard unavailable: {e}", "action": None}
