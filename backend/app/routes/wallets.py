from flask import Blueprint, jsonify
from app.routes.auth import get_current_user_id
from app.models import Wallet

wallets_bp = Blueprint("wallets", __name__)


@wallets_bp.route("/", methods=["GET"])
def list_wallets():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    wallets = Wallet.query.filter_by(user_id=uid).all()
    return jsonify({"wallets": [w.to_dict() for w in wallets]})
