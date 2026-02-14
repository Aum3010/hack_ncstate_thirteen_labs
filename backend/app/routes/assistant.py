import io
import os

from flask import Blueprint, request, jsonify, send_file, make_response
from app.routes.auth import get_current_user_id
from app.services.eleven_service import generate_speech, transcribe_audio
from app.services.audio_service import record_from_mic

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
    """POST /tts — Convert text to speech, returns audio/mpeg stream.

    Body JSON: {"text": "...", "voice_id": "..." (optional)}
    """
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401

    data = request.get_json() or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text required"}), 400

    voice_id = data.get("voice_id")

    try:
        audio = generate_speech(text, voice_id=voice_id)
        response = make_response(
            send_file(io.BytesIO(audio), mimetype="audio/mpeg")
        )
        response.headers["Content-Type"] = "audio/mpeg"
        response.headers["Content-Disposition"] = "inline"
        response.headers["Cache-Control"] = "no-cache"
        return response
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return jsonify({"error": "Voice service unavailable"}), 503


@assistant_bp.route("/stt", methods=["POST"])
def stt():
    """POST /stt — Transcribe uploaded audio file to text.

    Expects multipart/form-data with an 'audio' file field.
    Optional form field 'language' (default: "en").
    """
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401

    if "audio" not in request.files:
        return jsonify({"error": "No 'audio' file in request"}), 400

    language = request.form.get("language", "en")

    try:
        audio_bytes = request.files["audio"].read()
        transcript = transcribe_audio(audio_bytes, language=language)
        return jsonify({"text": transcript})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return jsonify({"error": "Voice service unavailable"}), 503


@assistant_bp.route("/record-stt", methods=["POST"])
def record_stt():
    """POST /record-stt — Record from server microphone and transcribe.

    Body JSON: {"duration": 5 (optional), "language": "en" (optional)}

    NOTE: This endpoint records from the SERVER's microphone.
    Only useful when the Flask server runs on the same machine as the user
    (e.g. local development). For production, use /stt with client-side recording.
    """
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401

    data = request.get_json() or {}
    duration = data.get("duration", 5)
    language = data.get("language", "en")

    try:
        duration = int(duration)
        if duration < 1 or duration > 30:
            return jsonify({"error": "duration must be between 1 and 30 seconds"}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "duration must be an integer"}), 400

    try:
        wav_bytes = record_from_mic(duration=duration)
        transcript = transcribe_audio(wav_bytes, language=language)
        return jsonify({"text": transcript})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return jsonify({"error": "Recording or transcription failed"}), 503
