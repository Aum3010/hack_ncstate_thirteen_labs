from flask import Blueprint, jsonify
from app.routes.auth import get_current_user_id
from app.services.valkey import orderbook_get, orderbook_set

orderbook_bp = Blueprint("orderbook", __name__)


@orderbook_bp.route("/", methods=["GET"])
def get():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    symbol = __import__("flask").request.args.get("symbol", "SOL/USDC")
    data = orderbook_get(symbol)
    if data is None:
        data = {"bids": [], "asks": [], "cached": False}
    else:
        data["cached"] = True
    return jsonify(data)
