from flask import Blueprint, request, jsonify, session
from app import db
from app.models import User, Wallet

auth_bp = Blueprint("auth", __name__)


def get_current_user_id():
    return session.get("user_id")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = data.get("email")
    username = data.get("username")
    password = data.get("password")
    if not password or len(password) < 6:
        return jsonify({"error": "Password required, at least 6 characters"}), 400
    if not email and not username:
        return jsonify({"error": "Email or username required"}), 400
    if email and User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409
    if username and User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already taken"}), 409
    user = User(email=email, username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    session["user_id"] = user.id
    return jsonify({"user": user.to_dict(), "message": "Registered"})


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email")
    username = data.get("username")
    password = data.get("password")
    if not password:
        return jsonify({"error": "Password required"}), 400
    user = None
    if email:
        user = User.query.filter_by(email=email).first()
    if not user and username:
        user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401
    session["user_id"] = user.id
    return jsonify({"user": user.to_dict(), "message": "Logged in"})


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"message": "Logged out"})


@auth_bp.route("/me", methods=["GET"])
def me():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"user": None}), 200
    user = User.query.get(uid)
    if not user:
        session.pop("user_id", None)
        return jsonify({"user": None}), 200
    return jsonify({"user": user.to_dict()})


@auth_bp.route("/wallet/connect", methods=["POST"])
def wallet_connect():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json() or {}
    address = (data.get("address") or "").strip()
    if not address:
        return jsonify({"error": "Wallet address required"}), 400
    existing = Wallet.query.filter_by(address=address).first()
    if existing and existing.user_id != uid:
        return jsonify({"error": "Wallet linked to another account"}), 409
    if existing and existing.user_id == uid:
        return jsonify({"wallet": existing.to_dict(), "message": "Already linked"})
    wallet = Wallet(user_id=uid, address=address, chain="solana")
    db.session.add(wallet)
    db.session.commit()
    return jsonify({"wallet": wallet.to_dict(), "message": "Wallet linked"})


@auth_bp.route("/presage/verify", methods=["POST"])
def presage_verify():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json() or {}
    presage_token = data.get("presage_token") or data.get("token")
    if not presage_token:
        return jsonify({"error": "Presage verification token required"}), 400
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "User not found"}), 404
    user.presage_user_id = str(presage_token)[:255]
    db.session.commit()
    return jsonify({"message": "Presage linked", "user": user.to_dict()})
