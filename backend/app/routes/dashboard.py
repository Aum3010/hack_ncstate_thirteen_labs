"""Dashboard summary for hero pie chart and insights."""
from flask import Blueprint, jsonify
from app.routes.auth import get_current_user_id
from app.models import User, Transaction, Bill, Goal, Wallet
from datetime import datetime

dashboard_bp = Blueprint("dashboard", __name__)

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


@dashboard_bp.route("/summary", methods=["GET"])
def summary():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "User not found"}), 404

    cfg = user.get_partition_config()
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    transactions = Transaction.query.filter(
        Transaction.user_id == uid,
        Transaction.transaction_at >= month_start,
    ).all()

    bills = Bill.query.filter_by(user_id=uid).filter(Bill.paid_at.is_(None)).all()
    goals = Goal.query.filter_by(user_id=uid).all()
    wallets = Wallet.query.filter_by(user_id=uid).all()

    actual = {k: 0 for k in PARTITION_KEYS}
    for t in transactions:
        key = _map_category(t.category)
        if key in actual:
            actual[key] += t.amount_cents

    bill_total = sum(b.amount_cents for b in bills)
    actual["bill_payments"] += bill_total

    total_actual = sum(actual.values())

    pie_data = []
    labels = {
        "investments": "Investments",
        "bill_payments": "Bill Payments",
        "short_term_goals": "Short-term Goals",
    }
    colors = {
        "investments": "#00d4ff",
        "bill_payments": "#ff2d92",
        "short_term_goals": "#00ff88",
    }
    for k in PARTITION_KEYS:
        a = actual.get(k, 0)
        pie_data.append({
            "name": labels.get(k, k),
            "key": k,
            "actual_cents": a,
            "value": max(a, 1),
            "fill": colors.get(k, "#8888a0"),
        })

    return jsonify({
        "partitions": pie_data,
        "total_actual_cents": total_actual,
        "wallets": [w.to_dict() for w in wallets],
        "goals": [g.to_dict() for g in goals],
        "insights": [],
    })
