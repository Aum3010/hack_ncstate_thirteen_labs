"""Short-term experience recommendations based on user budget and profile."""
from flask import Blueprint, jsonify, request
from app.routes.auth import get_current_user_id
from app.models import User, Transaction, Bill
from app.services.experiences import generate_experiences
from datetime import datetime

experiences_bp = Blueprint("experiences", __name__)

PARTITION_KEYS = ("investments", "bill_payments", "short_term_goals")
CATEGORY_MAP = {
    "investments": "investments",
    "bill_payments": "bill_payments",
    "short_term_goals": "short_term_goals",
    "solana_transfer": "investments",
    "transfer": "investments",
    "recurring": "bill_payments",
    "rent": "bill_payments",
    "utilities": "bill_payments",
    "subscription": "bill_payments",
    "credit_card": "bill_payments",
}


def _map_category(cat: str | None) -> str:
    if not cat:
        return "bill_payments"
    c = (cat or "").lower().strip()
    return CATEGORY_MAP.get(c, "bill_payments")


def _compute_short_term_budget(uid: int) -> tuple[int, int, int]:
    """Return (total_cents, spent_cents, remaining_cents) for short-term partition."""
    user = User.query.get(uid)
    if not user:
        return 0, 0, 0
    cfg = user.get_partition_config()
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    transactions = Transaction.query.filter(
        Transaction.user_id == uid,
        Transaction.transaction_at >= month_start,
    ).all()
    bills = Bill.query.filter_by(user_id=uid).filter(Bill.paid_at.is_(None)).all()

    actual = {k: 0 for k in PARTITION_KEYS}
    for t in transactions:
        if t.amount_cents >= 0:
            continue
        key = _map_category(t.category)
        if key in actual:
            actual[key] += abs(t.amount_cents)
    bill_total = sum(b.amount_cents for b in bills)
    actual["bill_payments"] += bill_total

    total_actual = sum(actual.values())
    short_term_spent = actual.get("short_term_goals", 0)
    short_term_pct = 30
    if cfg:
        part = cfg.get("short_term_goals") or {}
        if isinstance(part, dict):
            short_term_pct = part.get("target_pct", 30)

    if total_actual <= 0:
        total_actual = 2000 * 100  # fallback $2000/month
    short_term_target = int(total_actual * (short_term_pct / 100))
    remaining = max(0, short_term_target - short_term_spent)
    if remaining <= 0:
        remaining = 50 * 100  # minimum $50 for suggestions
    return short_term_target, short_term_spent, remaining


@experiences_bp.route("/", methods=["GET"])
def get_experiences():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "User not found"}), 404

    location = request.args.get("location", "")
    total_cents, spent_cents, remaining_cents = _compute_short_term_budget(uid)

    experiences = generate_experiences(uid, location.strip() or None, remaining_cents)

    tiers = {"free": [], "$": [], "$$": [], "$$$": []}
    for exp in experiences:
        tier = exp.get("price_tier", "$")
        if tier in tiers:
            tiers[tier].append(exp)
        else:
            tiers["$"].append(exp)

    return jsonify({
        "experiences": experiences,
        "budget": {
            "total_cents": total_cents,
            "spent_cents": spent_cents,
            "remaining_cents": remaining_cents,
        },
        "tiers": tiers,
    })
