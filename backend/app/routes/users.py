import re
from flask import Blueprint, request, jsonify
from app import db
from app.routes.auth import get_current_user_id
from app.models import User

users_bp = Blueprint("users", __name__)

EMAIL_RE = re.compile(r"^[^@]+@[^@]+\.[^@]+$")
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def _validate_email(email):
    if not email or not isinstance(email, str):
        return False
    email = email.strip()
    return bool(EMAIL_RE.match(email)) and 1 < len(email) <= 255


def _validate_username(username):
    if not username or not isinstance(username, str):
        return False
    username = username.strip()
    return 1 <= len(username) <= 80 and bool(USERNAME_RE.match(username))


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
    if "assistant_mode" in data:
        mode = (data.get("assistant_mode") or "").strip().lower()
        if mode in ("conservative", "aggressive", "balanced"):
            user.assistant_mode = mode
    if "email" in data:
        email = (data.get("email") or "").strip() or None
        if email is not None:
            if email and not _validate_email(email):
                return jsonify({"error": "Invalid email format"}), 400
            if email:
                existing = User.query.filter_by(email=email).first()
                if existing and existing.id != uid:
                    return jsonify({"error": "Email already in use"}), 409
            user.email = email
    if "username" in data:
        username = (data.get("username") or "").strip() or None
        if username is not None:
            if username and not _validate_username(username):
                return jsonify({"error": "Invalid username: use letters, numbers, underscore, hyphen, 1–80 chars"}), 400
            if username:
                existing = User.query.filter_by(username=username).first()
                if existing and existing.id != uid:
                    return jsonify({"error": "Username already taken"}), 409
            user.username = username
    if "onboarding_answers" in data:
        val = data["onboarding_answers"]
        if val is None or isinstance(val, dict):
            user.onboarding_answers = val
    if "profile_questionnaire" in data:
        val = data["profile_questionnaire"]
        if val is None or isinstance(val, dict):
            user.profile_questionnaire = val
    db.session.commit()
    return jsonify(user.to_dict())
