from flask import Blueprint, request, jsonify
from app import db
from app.routes.auth import get_current_user_id
from app.models import User

users_bp = Blueprint("users", __name__)


@users_bp.route("/me", methods=["GET"])
def me():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict())


@users_bp.route("/me", methods=["PATCH"])
def update_me():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "User not found"}), 404
    data = request.get_json() or {}
    if "partition_config" in data:
        cfg = data["partition_config"]
        if isinstance(cfg, dict):
            user.partition_config = cfg
    if "onboarding_completed" in data:
        user.onboarding_completed = bool(data["onboarding_completed"])
    db.session.commit()
    return jsonify(user.to_dict())
