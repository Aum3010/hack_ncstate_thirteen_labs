from flask import Blueprint, request, jsonify
from app.routes.auth import get_current_user_id
import os

assistant_bp = Blueprint("assistant", __name__)


def backboard_chat(message, user_id, api_key):
    """Call Backboard (Gemini via Backboard) for assistant. Stub if no key."""
    if not api_key:
        return {"text": "Assistant is connected via Backboard (Gemini). Set BACKBOARD_API_KEY to enable.", "action": None}
    try:
        import requests
        url = os.environ.get("BACKBOARD_CHAT_URL", "https://api.backboard.io/v1/chat")
        r = requests.post(
            url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"message": message, "user_id": str(user_id)},
            timeout=30,
        )
        if r.ok:
            return r.json()
    except Exception as e:
        return {"text": f"Backboard unavailable: {e}", "action": None}
    return {"text": "Could not get response.", "action": None}


@assistant_bp.route("/chat", methods=["POST"])
def chat():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json() or {}
    message = (data.get("message") or data.get("text") or "").strip()
    if not message:
        return jsonify({"error": "message required"}), 400
    api_key = os.environ.get("BACKBOARD_API_KEY", "")
    out = backboard_chat(message, uid, api_key)
    return jsonify(out)


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
