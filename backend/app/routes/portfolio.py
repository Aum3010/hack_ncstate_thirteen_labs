from flask import Blueprint, request, jsonify
from app import db
from app.routes.auth import get_current_user_id
from app.models import PortfolioItem, Transaction, Goal
from app.services.portfolio_llm import generate_allocation, analyze_spending, generate_description

portfolio_bp = Blueprint("portfolio", __name__)


@portfolio_bp.route("/", methods=["GET"])
def list_items():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    items = PortfolioItem.query.filter_by(user_id=uid).order_by(PortfolioItem.created_at.desc()).all()
    return jsonify({"items": [i.to_dict() for i in items]})


@portfolio_bp.route("/", methods=["POST"])
def create_item():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400
    item = PortfolioItem(
        user_id=uid,
        title=title,
        description=(data.get("description") or "").strip() or None,
        tech_stack=(data.get("tech_stack") or "").strip() or None,
        url=(data.get("url") or "").strip() or None,
        image_url=(data.get("image_url") or "").strip() or None,
        status=(data.get("status") or "active").strip(),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@portfolio_bp.route("/<int:item_id>", methods=["GET", "PATCH", "DELETE"])
def item_detail(item_id):
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    item = PortfolioItem.query.filter_by(id=item_id, user_id=uid).first()
    if not item:
        return jsonify({"error": "Item not found"}), 404
    if request.method == "GET":
        return jsonify(item.to_dict())
    if request.method == "DELETE":
        db.session.delete(item)
        db.session.commit()
        return jsonify({"message": "Deleted"}), 200
    data = request.get_json() or {}
    if "title" in data:
        item.title = (data["title"] or "").strip() or item.title
    if "description" in data:
        item.description = (data["description"] or "").strip() or None
    if "tech_stack" in data:
        item.tech_stack = (data["tech_stack"] or "").strip() or None
    if "url" in data:
        item.url = (data["url"] or "").strip() or None
    if "image_url" in data:
        item.image_url = (data["image_url"] or "").strip() or None
    if "status" in data:
        item.status = (data["status"] or "").strip() or item.status
    db.session.commit()
    return jsonify(item.to_dict())


@portfolio_bp.route("/<int:item_id>/generate-description", methods=["POST"])
def gen_description(item_id):
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    item = PortfolioItem.query.filter_by(id=item_id, user_id=uid).first()
    if not item:
        return jsonify({"error": "Item not found"}), 404
    desc = generate_description(item.title, item.tech_stack, item.description)
    if desc is None:
        return jsonify({"error": "LLM unavailable. Set BACKBOARD_API_KEY to enable."}), 503
    item.description = desc
    db.session.commit()
    return jsonify(item.to_dict())


@portfolio_bp.route("/allocation", methods=["POST"])
def get_allocation():
    """LLM-generated portfolio allocation based on user's investment goal."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json() or {}
    goal = (data.get("goal") or "").strip()
    if not goal:
        return jsonify({"error": "goal required"}), 400
    risk = (data.get("risk_tolerance") or "balanced").strip()
    result = generate_allocation(goal, risk)
    return jsonify(result)


@portfolio_bp.route("/spending-analysis", methods=["GET"])
def get_spending_analysis():
    """LLM-analyzed spending patterns with reduction suggestions."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    transactions = Transaction.query.filter_by(user_id=uid).order_by(Transaction.created_at.desc()).limit(100).all()
    goals = Goal.query.filter_by(user_id=uid).all()
    tx_dicts = [t.to_dict() for t in transactions]
    goal_dicts = [g.to_dict() for g in goals]
    result = analyze_spending(tx_dicts, goal_dicts)
    savings = []
    for g in goals:
        d = g.to_dict()
        pct = (g.saved_cents / max(g.target_cents, 1)) * 100 if g.target_cents else 0
        d["progress_pct"] = round(pct, 1)
        savings.append(d)
    result["savings"] = savings
    return jsonify(result)
