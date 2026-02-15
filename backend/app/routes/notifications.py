from flask import Blueprint, request, jsonify, current_app
from flask_cors import cross_origin

from notify import process_notifications

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.route("/run", methods=["POST"])  # POST /api/notifications/run
@cross_origin(supports_credentials=True)
def run_now():
    token = request.headers.get("X-Admin-Token") or request.args.get("token")
    expected = current_app.config.get("ADMIN_TOKEN")
    if not expected or token != expected:
        return jsonify({"error": "unauthorized"}), 401
    try:
        summary = process_notifications()
        return jsonify({"status": "ok", "summary": summary})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
