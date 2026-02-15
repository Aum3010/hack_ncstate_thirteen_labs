from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from app import db
from app.routes.auth import get_current_user_id
from app.models import Transaction

transactions_bp = Blueprint("transactions", __name__)


@transactions_bp.route("/", methods=["GET"])
def list_transactions():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    # Pagination params
    try:
        limit = int(request.args.get("limit", 50))
    except Exception:
        limit = 50
    limit = max(1, min(limit, 200))
    try:
        offset = int(request.args.get("offset", 0))
    except Exception:
        offset = 0
    offset = max(0, offset)

    # Optional date filter (YYYY-MM-DD)
    date_str = request.args.get("date")
    q = Transaction.query.filter_by(user_id=uid)
    if date_str:
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d")
            start = datetime(d.year, d.month, d.day)
            end = start + timedelta(days=1)
            q = q.filter(Transaction.transaction_at >= start, Transaction.transaction_at < end)
        except Exception:
            pass

    total = q.count()
    items = q.order_by(Transaction.transaction_at.desc()).offset(offset).limit(limit).all()
    return jsonify({
        "transactions": [t.to_dict() for t in items],
        "limit": limit,
        "offset": offset,
        "count": total,
        "date": date_str,
    })


@transactions_bp.route("/", methods=["POST"])
def create_transaction():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json() or {}
    amount = data.get("amount") or data.get("amount_cents")
    if amount is None:
        return jsonify({"error": "amount required"}), 400
    if isinstance(amount, (int, float)) and abs(amount) < 1e9:
        amount_cents = int(round(float(amount) * 100))
    else:
        amount_cents = int(amount)
    category = data.get("category", "").strip() or None
    description = data.get("description", "").strip() or None
    source = data.get("source", "manual")
    trans_at = data.get("transaction_at")
    if trans_at:
        try:
            transaction_at = datetime.fromisoformat(trans_at.replace("Z", "+00:00"))
        except Exception:
            transaction_at = datetime.utcnow()
    else:
        transaction_at = datetime.utcnow()
    t = Transaction(
        user_id=uid,
        amount_cents=amount_cents,
        currency=data.get("currency", "USD"),
        category=category,
        description=description,
        source=source,
        transaction_at=transaction_at,
    )
    db.session.add(t)
    db.session.commit()
    return jsonify(t.to_dict()), 201
