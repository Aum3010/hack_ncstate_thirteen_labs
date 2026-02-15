import os
from flask import Blueprint, request, jsonify
from app.routes.auth import get_current_user_id
from app.services.backboard_ingest import ingest_user_context_to_backboard
from app.services.orchestrator import chat as orchestrator_chat
from app.models import User

assistant_bp = Blueprint("assistant", __name__)


@assistant_bp.route("/chat", methods=["POST"])
def chat():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json() or {}
    message = (data.get("message") or data.get("text") or "").strip()
    if not message:
        return jsonify({"error": "message required"}), 400
    mode = (data.get("mode") or "").strip() or None
    if not mode:
        user = User.query.get(uid)
        mode = (user.assistant_mode or "balanced") if user else "balanced"
    api_key = os.environ.get("BACKBOARD_API_KEY", "")
    out = orchestrator_chat(message, uid, api_key, mode=mode)
    return jsonify(out)


@assistant_bp.route("/refresh-memory", methods=["POST"])
def refresh_memory():
    """Trigger ingest of user financial snapshot to Backboard for memory/RAG."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    api_key = os.environ.get("BACKBOARD_API_KEY", "")
    if not api_key:
        return jsonify({"message": "BACKBOARD_API_KEY not set; ingest skipped"}), 200
    backboard_id = ingest_user_context_to_backboard(uid, api_key)
    return jsonify({"message": "Memory refreshed", "backboard_id": backboard_id}), 200


@assistant_bp.route("/tts", methods=["POST"])
def tts():
    """ElevenLabs TTS: convert text to speech. Stub when no key."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json() or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text required"}), 400
    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    if not api_key:
        return jsonify({"audio_url": None, "message": "Set ELEVENLABS_API_KEY for TTS"})
    try:
        import requests
        r = requests.post(
            "https://api.elevenlabs.io/v1/text-to-speech/default",
            headers={"xi-api-key": api_key, "Content-Type": "application/json"},
            json={"text": text},
            timeout=15,
        )
        if r.ok:
            return jsonify({"audio_url": "data:audio/mpeg;base64," + __import__("base64").b64encode(r.content).decode()})
    except Exception as e:
        return jsonify({"error": str(e)}), 502
    return jsonify({"error": "TTS failed"}), 502
