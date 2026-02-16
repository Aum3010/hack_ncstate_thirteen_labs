import os
from flask import Blueprint, request, jsonify, Response, stream_with_context
from app.routes.auth import get_current_user_id
from app.services.backboard_ingest import ingest_user_context_to_backboard
from app.services.orchestrator import chat as orchestrator_chat
from app.services.eleven_service import stream_speech, transcribe_audio
from app.services.audio_service import convert_audio
from app.models import User

assistant_bp = Blueprint("assistant", __name__)


def _detect_audio_format(filename: str, content_type: str) -> str:
    name = (filename or "").lower()
    ctype = (content_type or "").lower()
    if name.endswith(".wav") or "wav" in ctype:
        return "wav"
    if name.endswith(".mp3") or "mpeg" in ctype or "mp3" in ctype:
        return "mp3"
    if name.endswith(".ogg") or "ogg" in ctype:
        return "ogg"
    if name.endswith(".m4a") or "mp4" in ctype or "aac" in ctype:
        return "mp4"
    return "webm"


@assistant_bp.route("/chat", methods=["POST"])
def chat():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json() or {}
    message = (data.get("message") or data.get("text") or data.get("question") or "").strip()
    if not message:
        return jsonify({"error": "message required"}), 400
    messages = data.get("messages")
    if not isinstance(messages, list):
        messages = None
    finance_payload = {
        "question": (data.get("question") or "").strip() or message,
        "portfolio": data.get("portfolio"),
        "spending": data.get("spending"),
        "savings": data.get("savings"),
        "risk": (data.get("risk") or "").strip() or None,
    }
    if not any(finance_payload.get(k) for k in ("portfolio", "spending", "savings")):
        finance_payload = None
    mode = (data.get("mode") or data.get("risk") or "").strip() or None
    if not mode:
        user = User.query.get(uid)
        mode = (user.assistant_mode or "balanced") if user else "balanced"
    route = (data.get("route") or "").strip() or None
    context = data.get("context") or {}
    page = context.get("page") if isinstance(context, dict) else None
    if not page and route:
        page = (route or "").replace("/", "").strip() or "dashboard"
    api_key = os.environ.get("BACKBOARD_API_KEY", "")
    out = orchestrator_chat(message, uid, api_key, mode=mode, messages=messages, finance_payload=finance_payload, page=page)
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


@assistant_bp.route("/stt", methods=["POST"])
def stt():
    """ElevenLabs STT: transcribe audio. No file storage; read into memory and return text."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    if not os.environ.get("ELEVENLABS_API_KEY", ""):
        return jsonify({"error": "Set ELEVENLABS_API_KEY for STT"}), 503
    audio_file = request.files.get("audio")
    if not audio_file:
        return jsonify({"error": "audio file required"}), 400
    language = (request.form.get("language") or "en").strip() or "en"
    source_format = _detect_audio_format(audio_file.filename or "", audio_file.content_type or "")
    try:
        audio_bytes = audio_file.read()
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    if not audio_bytes:
        return jsonify({"error": "empty audio"}), 400
    try:
        text = transcribe_audio(audio_bytes, language=language)
        return jsonify({"text": (text or "").strip()})
    except Exception as e:
        primary_error = str(e)
        try:
            fallback_mp3 = convert_audio(audio_bytes, source_format=source_format, target_format="mp3")
            text = transcribe_audio(fallback_mp3, language=language)
            return jsonify({"text": (text or "").strip()})
        except Exception as fallback_error:
            return jsonify({
                "error": f"STT failed: {primary_error}",
                "fallback_error": str(fallback_error),
            }), 502


@assistant_bp.route("/tts", methods=["POST"])
def tts():
    """ElevenLabs TTS: stream MP3 audio directly from ElevenLabs to browser."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json() or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text required"}), 400
    if not os.environ.get("ELEVENLABS_API_KEY", ""):
        return jsonify({"error": "Set ELEVENLABS_API_KEY for TTS"}), 503
    voice_id = (data.get("voice_id") or "").strip() or None
    try:
        audio_stream = stream_with_context(stream_speech(text, voice_id=voice_id))
        response = Response(audio_stream, mimetype="audio/mpeg")
        response.headers["Content-Disposition"] = "inline"
        response.headers["Cache-Control"] = "no-cache"
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 502
