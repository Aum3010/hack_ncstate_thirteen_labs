from flask import Blueprint, request, jsonify
from app import db
from app.routes.auth import get_current_user_id
from app.models import Card, User

cards_bp = Blueprint("cards", __name__)


def require_presage():
    """Presage gate: expect X-Presage-Token or body presage_token for sensitive actions."""
    token = request.headers.get("X-Presage-Token") or (request.get_json() or {}).get("presage_token")
    if not token:
        return None
    return token


@cards_bp.route("/", methods=["GET"])
def list_cards():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    cards = Card.query.filter_by(user_id=uid).all()
    return jsonify({"cards": [c.to_dict() for c in cards]})


@cards_bp.route("/", methods=["POST"])
def add_card():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    if not require_presage():
        return jsonify({"error": "Presage biometric verification required to add a card"}), 403
    data = request.get_json() or {}
    last_four = (data.get("last_four") or data.get("lastFour") or "").strip().replace(" ", "")[-4:]
    if len(last_four) != 4 or not last_four.isdigit():
        return jsonify({"error": "Valid last 4 digits required"}), 400
    card = Card(
        user_id=uid,
        last_four=last_four,
        label=(data.get("label") or "").strip() or None,
        statement_due_day=int(data["statement_due_day"]) if data.get("statement_due_day") is not None else None,
    )
    db.session.add(card)
    db.session.commit()
    return jsonify(card.to_dict()), 201
