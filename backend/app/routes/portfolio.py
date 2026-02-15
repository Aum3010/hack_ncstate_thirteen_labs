import os
from collections import defaultdict

from flask import Blueprint, request, jsonify
from app import db
from app.routes.auth import get_current_user_id
from app.models import PortfolioItem, Transaction, Goal
from app.services.portfolio_llm import _parse_json_response
from app.services.orchestrator import chat as orchestrator_chat

portfolio_bp = Blueprint("portfolio", __name__)

# Fallback allocation when orchestrator/parsing fails (same as portfolio_llm)
DEFAULT_ALLOCATION = {
    "categories": [
        {"name": "US Stocks", "percentage": 40, "color": "#00d4ff"},
        {"name": "International Stocks", "percentage": 20, "color": "#ff2d92"},
        {"name": "Bonds", "percentage": 20, "color": "#00ff88"},
        {"name": "Real Estate", "percentage": 10, "color": "#f59e0b"},
        {"name": "Cash / Savings", "percentage": 10, "color": "#8b5cf6"},
    ]
}


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
    api_key = os.environ.get("BACKBOARD_API_KEY", "")
    if not api_key:
        return jsonify({"error": "LLM unavailable. Set BACKBOARD_API_KEY to enable."}), 503
    finance_payload = {
        "portfolio_task": "description",
        "title": item.title or "",
        "tech_stack": item.tech_stack or "",
        "existing_description": item.description or "",
    }
    message = f"Generate a portfolio description for: {item.title}"
    out = orchestrator_chat(message, uid, api_key, finance_payload=finance_payload)
    desc = (out.get("text") or "").strip()
    if not desc:
        return jsonify({"error": "LLM unavailable. Set BACKBOARD_API_KEY to enable."}), 503
    item.description = desc
    db.session.commit()
    return jsonify(item.to_dict())


@portfolio_bp.route("/allocation", methods=["POST"])
def get_allocation():
    """LLM-generated portfolio allocation based on user's investment goal (via orchestrator + memory)."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json() or {}
    goal = (data.get("goal") or "").strip() or "general growth and retirement"
    risk = (data.get("risk_tolerance") or "balanced").strip()
    api_key = os.environ.get("BACKBOARD_API_KEY", "")
    if not api_key:
        return jsonify(DEFAULT_ALLOCATION)
    finance_payload = {"portfolio_task": "allocation", "goal": goal, "risk_tolerance": risk}
    message = f"Generate portfolio allocation for goal: {goal}, risk tolerance: {risk}"
    out = orchestrator_chat(message, uid, api_key, finance_payload=finance_payload)
    text = out.get("text") or ""
    parsed = _parse_json_response(text)
    if parsed and "categories" in parsed:
        return jsonify(parsed)
    return jsonify(DEFAULT_ALLOCATION)


def _spending_fallback(tx_dicts):
    """Fallback suggestions when orchestrator/parsing fails (same logic as portfolio_llm)."""
    if not tx_dicts:
        return {"suggestions": [{"category": "general", "message": "Add transactions to get personalized spending analysis.", "save_amount": 0}]}
    by_cat = defaultdict(float)
    for t in tx_dicts:
        cat = t.get("category") or "other"
        by_cat[cat] += (t.get("amount_cents") or 0) / 100
    suggestions = []
    for cat, amt in sorted(by_cat.items(), key=lambda x: -x[1])[:3]:
        reduction = round(amt * 0.15, 2)
        suggestions.append({
            "category": cat,
            "message": f"Consider reducing {cat} spending by 15% to save ${reduction:.2f}/month.",
            "save_amount": reduction,
        })
    return {"suggestions": suggestions}


@portfolio_bp.route("/spending-analysis", methods=["GET"])
def get_spending_analysis():
    """LLM-analyzed spending patterns with reduction suggestions (via orchestrator + memory)."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    transactions = Transaction.query.filter_by(user_id=uid).order_by(Transaction.created_at.desc()).limit(100).all()
    goals = Goal.query.filter_by(user_id=uid).all()
    tx_dicts = [t.to_dict() for t in transactions]
    goal_dicts = [g.to_dict() for g in goals]

    spending_lines = []
    by_cat = defaultdict(float)
    for t in tx_dicts:
        cat = t.get("category") or "other"
        by_cat[cat] += (t.get("amount_cents") or 0) / 100
    for cat, amt in sorted(by_cat.items(), key=lambda x: -x[1]):
        spending_lines.append(f"  {cat}: ${amt:.2f}")
    spending_summary = "\n".join(spending_lines) if spending_lines else "No spending data."

    goals_lines = []
    for g in goal_dicts:
        target = g.get("target", g.get("target_cents", 0) / 100 if g.get("target_cents") else 0)
        saved = g.get("saved", g.get("saved_cents", 0) / 100 if g.get("saved_cents") else 0)
        goals_lines.append(f"  {g.get('name')}: ${saved:.2f} / ${target:.2f}")
    goals_summary = "\n".join(goals_lines) if goals_lines else "No goals set."

    api_key = os.environ.get("BACKBOARD_API_KEY", "")
    if not api_key:
        result = _spending_fallback(tx_dicts)
    else:
        finance_payload = {
            "portfolio_task": "spending_analysis",
            "spending_summary": spending_summary,
            "goals_summary": goals_summary,
        }
        message = "Analyze spending and suggest reductions to redirect savings toward goals."
        out = orchestrator_chat(message, uid, api_key, finance_payload=finance_payload)
        text = out.get("text") or ""
        parsed = _parse_json_response(text)
        if parsed and "suggestions" in parsed:
            result = parsed
        else:
            result = _spending_fallback(tx_dicts)

    savings = []
    for g in goals:
        d = g.to_dict()
        pct = (g.saved_cents / max(g.target_cents, 1)) * 100 if g.target_cents else 0
        d["progress_pct"] = round(pct, 1)
        savings.append(d)
    result["savings"] = savings
    return jsonify(result)
