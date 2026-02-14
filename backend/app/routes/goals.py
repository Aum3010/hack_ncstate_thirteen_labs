from flask import Blueprint, request, jsonify
from datetime import date
from app import db
from app.routes.auth import get_current_user_id
from app.models import Goal

goals_bp = Blueprint("goals", __name__)


@goals_bp.route("/", methods=["GET"])
def list_goals():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    goals = Goal.query.filter_by(user_id=uid).order_by(Goal.created_at.desc()).all()
    return jsonify({"goals": [g.to_dict() for g in goals]})


@goals_bp.route("/", methods=["POST"])
def create_goal():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    target = data.get("target") or data.get("target_cents")
    if not name:
        return jsonify({"error": "name required"}), 400
    if target is None:
        return jsonify({"error": "target or target_cents required"}), 400
    target_cents = int(round(float(target) * 100)) if abs(float(target)) < 1e9 else int(target)
    category = (data.get("category") or "short_term").strip() or "short_term"
    deadline = data.get("deadline")
    if deadline:
        try:
            deadline = date.fromisoformat(deadline)
        except Exception:
            deadline = None
    g = Goal(
        user_id=uid,
        name=name,
        target_cents=target_cents,
        saved_cents=int(data.get("saved_cents", 0) or 0),
        category=category,
        deadline=deadline,
    )
    db.session.add(g)
    db.session.commit()
    return jsonify(g.to_dict()), 201


@goals_bp.route("/<int:goal_id>", methods=["GET", "PATCH", "DELETE"])
def goal_detail(goal_id):
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    goal = Goal.query.filter_by(id=goal_id, user_id=uid).first()
    if not goal:
        return jsonify({"error": "Goal not found"}), 404
    if request.method == "GET":
        return jsonify(goal.to_dict())
    if request.method == "DELETE":
        db.session.delete(goal)
        db.session.commit()
        return jsonify({"message": "Deleted"}), 200
    data = request.get_json() or {}
    if "name" in data:
        goal.name = (data["name"] or "").strip() or goal.name
    if "target" in data:
        goal.target_cents = int(round(float(data["target"]) * 100))
    if "target_cents" in data:
        goal.target_cents = int(data["target_cents"])
    if "saved_cents" in data:
        goal.saved_cents = int(data["saved_cents"])
    if "category" in data:
        goal.category = (data["category"] or "").strip() or goal.category
    if "deadline" in data:
        try:
            goal.deadline = date.fromisoformat(data["deadline"]) if data["deadline"] else None
        except Exception:
            pass
    db.session.commit()
    return jsonify(goal.to_dict())
