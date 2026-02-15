import os
from flask import Blueprint, jsonify
from app import db
from app.routes.auth import get_current_user_id
from app.models import Wallet, Transaction
from app.services.solana import fetch_and_normalize_transactions
from app.services.backboard_ingest import ingest_user_context_to_backboard

wallets_bp = Blueprint("wallets", __name__)


@wallets_bp.route("/", methods=["GET"])
def list_wallets():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    wallets = Wallet.query.filter_by(user_id=uid).all()
    return jsonify({"wallets": [w.to_dict() for w in wallets]})


@wallets_bp.route("/<int:wallet_id>/sync", methods=["POST"])
def sync_wallet(wallet_id):
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    wallet = Wallet.query.filter_by(id=wallet_id, user_id=uid).first()
    if not wallet:
        return jsonify({"error": "Wallet not found"}), 404
    if wallet.chain != "solana":
        return jsonify({"error": "Only Solana wallets can be synced"}), 400
    try:
        txns = fetch_and_normalize_transactions(wallet.address, uid, limit=100)
        for t in txns:
            rec = Transaction(**t)
            db.session.add(rec)
        db.session.commit()
        api_key = os.environ.get("BACKBOARD_API_KEY", "")
        if api_key:
            ingest_user_context_to_backboard(uid, api_key)
        return jsonify({"message": "Synced", "imported": len(txns), "wallet": wallet.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 502
