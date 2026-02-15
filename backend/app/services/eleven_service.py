"""ElevenLabs API service -- TTS and STT only. Zero storage.

All audio is streamed directly from the API. Nothing touches disk.
Uses ElevenLabs Free Tier compatible settings (mp3_44100_128).
"""

import io
import os
import threading
import time
from typing import Generator

from elevenlabs import ElevenLabs

# Rate-limit concurrent API calls (Free Tier is strict)
_semaphore = threading.Semaphore(3)

MAX_RETRIES = 3
RETRY_DELAY = 0.6

# Default voice -- George (free tier compatible)
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


def stream_speech(text: str, voice_id: str = None) -> Generator[bytes, None, None]:
    """Stream TTS audio chunks from ElevenLabs. Zero disk storage.

    Yields MP3 chunks as they arrive from the API.
    The caller is responsible for forwarding chunks to the client.

    Args:
        text: The text to convert to speech.
        voice_id: ElevenLabs voice ID (default: George).

    Yields:
        Raw MP3 byte chunks.
    """
    if not text or not text.strip():
        raise ValueError("text must not be empty")

    voice = voice_id or DEFAULT_VOICE_ID

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
                # Yield chunks directly -- no buffering, no disk
                for chunk in response:
                    yield chunk
                return

            except Exception as e:
                last_exc = e
                if _is_retryable(e) and attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
                    continue
                raise
        raise last_exc  # type: ignore[misc]
    finally:
        _semaphore.release()


def generate_speech(text: str, voice_id: str = None) -> bytes:
    """Convert text to speech via ElevenLabs TTS. Returns complete MP3 bytes.

    Convenience wrapper around stream_speech() for cases where you need
    the full audio buffer (e.g., STT roundtrip, format conversion).
    Nothing is written to disk.
    """
    return b"".join(stream_speech(text, voice_id=voice_id))


def transcribe_audio(audio_bytes: bytes, language: str = "en") -> str:
    """Transcribe audio bytes via ElevenLabs STT (scribe_v2).

    Accepts raw audio bytes (WAV, MP3, webm, etc.).
    Returns the transcribed text string. Nothing is written to disk.
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
