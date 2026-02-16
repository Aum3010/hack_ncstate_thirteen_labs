import uuid
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, session
from nacl.signing import VerifyKey
import base58

from app import db
from app.models import User, Wallet, DisconnectedWallet
from solders.pubkey import Pubkey

auth_bp = Blueprint("auth", __name__)

# In-memory challenge store: nonce -> expires_at (UTC datetime)
_solana_challenges = {}
CHALLENGE_PREFIX = "Sign in to Nightshade: "
CHALLENGE_TTL_MINUTES = 5


def get_current_user_id():
    return session.get("user_id")


def _decode_signature(signature_input) -> bytes | None:
    """Decode signature from base58 string or base64 string. Returns 64 bytes or None."""
    if not signature_input:
        return None
    if isinstance(signature_input, str):
        try:
            sig_bytes = base58.b58decode(signature_input)
            return sig_bytes if len(sig_bytes) == 64 else None
        except Exception:
            try:
                import base64
                sig_bytes = base64.b64decode(signature_input)
                return sig_bytes if len(sig_bytes) == 64 else None
            except Exception:
                return None
    return None


def _verify_solana_signature(message: str, signature_input, address: str) -> bool:
    """Verify Ed25519 signature from Phantom (base58 or base64). Returns True if valid."""
    try:
        msg_bytes = message.encode("utf-8")
        if len(msg_bytes) > 1024:
            return False
        pubkey = Pubkey.from_string(address)
        sig_bytes = _decode_signature(signature_input)
        if not sig_bytes or len(sig_bytes) != 64:
            return False
        verify_key = VerifyKey(bytes(pubkey))
        verify_key.verify(msg_bytes, sig_bytes)
        return True
    except Exception:
        return False


def _validate_email(email):
    if not email or not isinstance(email, str):
        return False
    email = email.strip()
    return "@" in email and 1 < len(email) <= 255


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    username = (data.get("username") or "").strip() or None
    password = data.get("password")
    if not password or len(password) < 6:
        return jsonify({"error": "Password required, at least 6 characters"}), 400
    if not _validate_email(email):
        return jsonify({"error": "Valid email is required"}), 400
    if User.query.filter_by(email=email).first():
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
    if Wallet.query.filter_by(user_id=uid).count() >= 1:
        return (
            jsonify({
                "error": "Only one wallet allowed per account. Disconnect the current wallet in Profile to connect a different one.",
            }),
            400,
        )
    wallet = Wallet(user_id=uid, address=address, chain="solana")
    db.session.add(wallet)
    db.session.commit()
    return jsonify({"wallet": wallet.to_dict(), "message": "Wallet linked"})


@auth_bp.route("/solana/challenge", methods=["POST"])
def solana_challenge():
    """Return a one-time message for the client to sign. Replay protection."""
    nonce = uuid.uuid4().hex
    message = CHALLENGE_PREFIX + nonce
    expires = datetime.utcnow() + timedelta(minutes=CHALLENGE_TTL_MINUTES)
    _solana_challenges[nonce] = expires
    return jsonify({"message": message, "expires_at": expires.isoformat()})


@auth_bp.route("/solana/login", methods=["POST"])
def solana_login():
    """Verify Phantom signature and find or create user; set session."""
    data = request.get_json() or {}
    address = (data.get("address") or "").strip()
    message = (data.get("message") or "").strip()
    signature = data.get("signature")
    if not address or not message or not signature:
        return jsonify({"error": "address, message, and signature required"}), 400
    if not message.startswith(CHALLENGE_PREFIX):
        return jsonify({"error": "Invalid message format"}), 400
    nonce = message[len(CHALLENGE_PREFIX) :].strip()
    expires = _solana_challenges.get(nonce)
    if expires is None:
        return jsonify({"error": "Challenge expired or already used"}), 400
    if datetime.utcnow() > expires:
        _solana_challenges.pop(nonce, None)
        return jsonify({"error": "Challenge expired"}), 400
    _solana_challenges.pop(nonce, None)
    try:
        Pubkey.from_string(address)
    except Exception:
        return jsonify({"error": "Invalid wallet address"}), 400
    if not _verify_solana_signature(message, signature, address):
        return jsonify({"error": "Invalid signature"}), 401
    wallet = Wallet.query.filter_by(address=address).first()
    if wallet:
        user = User.query.get(wallet.user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
    else:
        rec = DisconnectedWallet.query.filter_by(address=address).first()
        if rec:
            user = User.query.get(rec.user_id)
            if not user:
                return jsonify({"error": "User not found"}), 404
            wallet = Wallet(user_id=user.id, address=address, chain="solana")
            db.session.add(wallet)
            db.session.delete(rec)
            db.session.commit()
        else:
            # First-time Phantom sign-in: create user and link wallet
            user = User(email=None, username=None)
            db.session.add(user)
            db.session.flush()
            wallet = Wallet(user_id=user.id, address=address, chain="solana")
            db.session.add(wallet)
            db.session.commit()
    session["user_id"] = user.id
    return jsonify({"user": user.to_dict(), "message": "Logged in"})


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
