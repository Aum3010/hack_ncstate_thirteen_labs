from flask import Blueprint, jsonify
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
