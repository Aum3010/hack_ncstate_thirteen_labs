"""AI-powered financial insights for the hero section."""
import os
import json
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from flask import Blueprint, jsonify
from app.routes.auth import get_current_user_id
from app.models import User, Transaction, Bill, Goal
from datetime import datetime

insights_bp = Blueprint("insights", __name__)

GEMINI_TIMEOUT_SECONDS = 15


def _call_gemini_for_insights(context: str) -> list[dict]:
    """Call Gemini with user context, return list of {type, text, category}."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or os.environ.get("BACKBOARD_API_KEY")
    if not api_key:
        return []
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        prompt = (
            "Given this user's financial picture, provide 2-3 short, actionable insights. "
            "Respond with valid JSON array only, no markdown. "
            'Format: [{"type": "suggestion", "text": "insight text", "category": "bills"|"investments"|"goals"|"general"}]. '
            "Be concise (one sentence per insight). "
            "Context:\n" + context
        )
        response = client.models.generate_content(model="gemini-1.5-flash", contents=prompt)
        text = (response.text or "").strip()
        text = text.removeprefix("```json").removeprefix("```").strip().removesuffix("```").strip()
        out = json.loads(text)
        if isinstance(out, list):
            return out[:5]
        return []
    except Exception:
        return []


@insights_bp.route("/", methods=["GET"])
def get_insights():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "User not found"}), 404

    cfg = user.get_partition_config()
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    txns = Transaction.query.filter(
        Transaction.user_id == uid,
        Transaction.transaction_at >= month_start,
    ).all()
    bills = Bill.query.filter_by(user_id=uid).filter(Bill.paid_at.is_(None)).all()
    goals = Goal.query.filter_by(user_id=uid).all()

    total_spend = sum(abs(t.amount_cents) for t in txns if t.amount_cents < 0)
    bill_total = sum(b.amount_cents for b in bills)
    goal_targets = sum(g.target_cents for g in goals)
    goal_saved = sum(g.saved_cents for g in goals)

    context_lines = [
        f"Partition config: investments {cfg.get('investments', {}).get('target_pct', 0)}%, "
        f"bills {cfg.get('bill_payments', {}).get('target_pct', 0)}%, "
        f"goals {cfg.get('short_term_goals', {}).get('target_pct', 0)}%",
        f"Monthly spend (transactions): ${total_spend / 100:.2f}",
        f"Unpaid bills total: ${bill_total / 100:.2f}",
        f"Goals: {len(goals)} goals, target ${goal_targets / 100:.2f}, saved ${goal_saved / 100:.2f}",
    ]
    if goals:
        context_lines.append("Goal names: " + ", ".join(g.name for g in goals[:5]))
    context = "\n".join(context_lines)
    executor = ThreadPoolExecutor(max_workers=1)
    try:
        future = executor.submit(_call_gemini_for_insights, context)
        insights = future.result(timeout=GEMINI_TIMEOUT_SECONDS)
    except FuturesTimeoutError:
        insights = []
    except Exception:
        insights = []
    finally:
        executor.shutdown(wait=False)
    return jsonify({"insights": insights})
