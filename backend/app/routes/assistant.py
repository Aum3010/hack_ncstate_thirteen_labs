import os

from flask import Blueprint, request, jsonify, Response, stream_with_context
from app.routes.auth import get_current_user_id
from app.services.eleven_service import stream_speech, transcribe_audio

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
    """POST /tts -- Stream text-to-speech audio directly from ElevenLabs.

    Body JSON: {"text": "...", "voice_id": "..." (optional)}

    Returns a streaming audio/mpeg response. Chunks flow directly from
    ElevenLabs API to the client browser with zero disk storage.
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
        # Validate inputs before starting the stream
        # (stream_speech raises ValueError for empty text)
        audio_stream = stream_speech(text, voice_id=voice_id)

        return Response(
            stream_with_context(audio_stream),
            mimetype="audio/mpeg",
            headers={
                "Content-Disposition": "inline",
                "Cache-Control": "no-cache",
                "Transfer-Encoding": "chunked",
            },
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return jsonify({"error": "Voice service unavailable"}), 503


@assistant_bp.route("/stt", methods=["POST"])
def stt():
    """POST /stt -- Transcribe uploaded audio file to text.

    Expects multipart/form-data with an 'audio' file field.
    Optional form field 'language' (default: "en").

    The frontend records audio via MediaRecorder (browser) and uploads it here.
    ElevenLabs STT accepts mp3, wav, webm, ogg, and other common formats.
    Audio bytes are read into memory, sent to the API, and discarded. Nothing
    is written to disk.
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
