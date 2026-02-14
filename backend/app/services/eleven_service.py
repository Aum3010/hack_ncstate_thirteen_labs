"""ElevenLabs API service — TTS and STT only.

Uses ElevenLabs Free Tier compatible settings (mp3_44100_128).
"""

import io
import hashlib
import os
import threading
import time

from elevenlabs import ElevenLabs

# Rate-limit concurrent API calls (Free Tier is strict)
_semaphore = threading.Semaphore(3)

MAX_RETRIES = 3
RETRY_DELAY = 0.6

# File-based TTS cache to avoid redundant API calls
_CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "cache", "tts_cache")
os.makedirs(_CACHE_DIR, exist_ok=True)

# Default voice — George (free tier compatible)
DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"


def _get_client() -> ElevenLabs:
    """Create an ElevenLabs client from the environment API key."""
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY environment variable is not set")
    return ElevenLabs(api_key=api_key)


def _is_retryable(exc: Exception) -> bool:
    """Check if an exception warrants a retry (rate-limit, timeout, connection)."""
    msg = str(exc).lower()
    return "429" in msg or "timeout" in msg or "connection" in msg


def generate_speech(text: str, voice_id: str = None) -> bytes:
    """Convert text to speech via ElevenLabs TTS.

    Returns raw MP3 bytes (mp3_44100_128).
    Results are cached on disk keyed by text hash.
    """
    if not text or not text.strip():
        raise ValueError("text must not be empty")

    voice = voice_id or DEFAULT_VOICE_ID

    # Check cache first
    cache_key = hashlib.sha256(f"{voice}:{text}".encode("utf-8")).hexdigest()
    cache_path = os.path.join(_CACHE_DIR, f"{cache_key}.mp3")
    if os.path.exists(cache_path):
        with open(cache_path, "rb") as f:
            return f.read()

    _semaphore.acquire()
    try:
        last_exc = None
        for attempt in range(MAX_RETRIES):
            try:
                client = _get_client()
                response = client.text_to_speech.convert(
                    text=text,
                    voice_id=voice,
                    model_id="eleven_flash_v2_5",
                    output_format="mp3_44100_128",
                )
                audio = b"".join(chunk for chunk in response)

                # Persist to cache
                with open(cache_path, "wb") as f:
                    f.write(audio)
                return audio

            except Exception as e:
                last_exc = e
                if _is_retryable(e) and attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
                    continue
                raise
        raise last_exc  # type: ignore[misc]
    finally:
        _semaphore.release()


def transcribe_audio(audio_bytes: bytes, language: str = "en") -> str:
    """Transcribe audio bytes via ElevenLabs STT (scribe_v2).

    Accepts raw audio bytes (WAV, MP3, etc.).
    Returns the transcribed text string.
    """
    if not audio_bytes:
        raise ValueError("audio_bytes must not be empty")

    audio_file = io.BytesIO(audio_bytes)

    last_exc = None
    for attempt in range(MAX_RETRIES):
        try:
            client = _get_client()
            result = client.speech_to_text.convert(
                file=audio_file,
                model_id="scribe_v2",
                language_code=language,
            )
            return result.text
        except Exception as e:
            last_exc = e
            if _is_retryable(e) and attempt < MAX_RETRIES - 1:
                audio_file.seek(0)
                time.sleep(RETRY_DELAY)
                continue
            raise
    raise last_exc  # type: ignore[misc]
