from flask import Blueprint, request, jsonify
from datetime import date, datetime
from app import db
from app.routes.auth import get_current_user_id
from app.models import Bill

bills_bp = Blueprint("bills", __name__)


@bills_bp.route("/", methods=["GET"])
def list_bills():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    bills = Bill.query.filter_by(user_id=uid).order_by(Bill.due_date.asc().nullslast(), Bill.due_day.asc().nullslast()).all()
    return jsonify({"bills": [b.to_dict() for b in bills]})


@bills_bp.route("/", methods=["POST"])
def create_bill():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    amount = data.get("amount") or data.get("amount_cents")
    if not name:
        return jsonify({"error": "name required"}), 400
    if amount is None:
        return jsonify({"error": "amount required"}), 400
    amount_cents = int(round(float(amount) * 100)) if abs(float(amount)) < 1e9 else int(amount)
    bill_type = (data.get("bill_type") or "recurring").strip() or "recurring"
    due_date = data.get("due_date")
    if due_date:
        try:
            due_date = date.fromisoformat(due_date)
        except Exception:
            due_date = None
    due_day = data.get("due_day")
    if due_day is not None:
        due_day = int(due_day)
    b = Bill(
        user_id=uid,
        bill_type=bill_type,
        name=name,
        amount_cents=amount_cents,
        currency=data.get("currency", "USD"),
        due_day=due_day,
        due_date=due_date,
        is_recurring=bool(data.get("is_recurring", True)),
        frequency=data.get("frequency", "monthly"),
        reminder_days_before=int(data.get("reminder_days_before", 3)),
        card_last_four=(data.get("card_last_four") or "")[:4] or None,
        minimum_payment_cents=data.get("minimum_payment_cents"),
        statement_due_day=data.get("statement_due_day"),
    )
    db.session.add(b)
    db.session.commit()
    return jsonify(b.to_dict()), 201


@bills_bp.route("/reminders", methods=["GET"])
def reminders():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    days = int(request.args.get("days", 7))
    from datetime import date, timedelta
    today = date.today()
    end = today + timedelta(days=days)
    bills = Bill.query.filter_by(user_id=uid).filter(Bill.paid_at.is_(None)).all()
    out = []
    for b in bills:
        due = None
        if b.due_date:
            due = b.due_date
        elif b.due_day:
            due = date(today.year, today.month, min(b.due_day, 28))
            if due < today:
                due = date(today.year, today.month + 1, min(b.due_day, 28)) if today.month < 12 else date(today.year + 1, 1, min(b.due_day, 28))
        if due and today <= due <= end:
            out.append({**b.to_dict(), "due_date": due.isoformat()})
    return jsonify({"reminders": out})


@bills_bp.route("/<int:bill_id>", methods=["GET", "PATCH", "DELETE"])
def bill_detail(bill_id):
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    bill = Bill.query.filter_by(id=bill_id, user_id=uid).first()
    if not bill:
        return jsonify({"error": "Bill not found"}), 404
    if request.method == "GET":
        return jsonify(bill.to_dict())
    if request.method == "DELETE":
        db.session.delete(bill)
        db.session.commit()
        return jsonify({"message": "Deleted"}), 200
    data = request.get_json() or {}
    if "name" in data:
        bill.name = (data["name"] or "").strip() or bill.name
    if "amount" in data:
        bill.amount_cents = int(round(float(data["amount"]) * 100))
    if "amount_cents" in data:
        bill.amount_cents = int(data["amount_cents"])
    if "due_date" in data:
        try:
            bill.due_date = date.fromisoformat(data["due_date"]) if data["due_date"] else None
        except Exception:
            pass
    if "due_day" in data:
        bill.due_day = int(data["due_day"]) if data["due_day"] is not None else None
    if "reminder_days_before" in data:
        bill.reminder_days_before = int(data["reminder_days_before"])
    if "paid_at" in data:
        bill.paid_at = datetime.utcnow() if data.get("paid_at") else None
    db.session.commit()
    return jsonify(bill.to_dict())
