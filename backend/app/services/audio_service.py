"""Audio service -- in-memory audio processing via pydub + FFmpeg.

Zero storage. No files are written to disk.
No sound card, no microphone, no GUI required.
Works inside Docker containers (python:3.11-slim + ffmpeg).
"""

import io

from pydub import AudioSegment


def convert_audio(audio_bytes: bytes, source_format: str = "mp3", target_format: str = "wav") -> bytes:
    """Convert audio bytes between formats in memory using pydub/FFmpeg.

    Args:
        audio_bytes: Raw audio data.
        source_format: Input format (mp3, wav, ogg, webm, etc.).
        target_format: Output format.

    Returns:
        Converted audio bytes.
    """
    if not audio_bytes:
        raise ValueError("audio_bytes must not be empty")

    segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format=source_format)
    buf = io.BytesIO()
    segment.export(buf, format=target_format)
    return buf.getvalue()


def get_audio_duration(audio_bytes: bytes, format: str = "mp3") -> float:
    """Get the duration of an audio buffer in seconds.

    Args:
        audio_bytes: Raw audio data.
        format: Audio format (mp3, wav, etc.).

    Returns:
        Duration in seconds.
    """
    if not audio_bytes:
        raise ValueError("audio_bytes must not be empty")

    segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format=format)
    return segment.duration_seconds


def normalize_audio_for_stt(audio_bytes: bytes, source_format: str = "webm") -> bytes:
    """Convert browser-recorded audio (typically webm/ogg) to WAV for STT.

    Browsers record via MediaRecorder as webm/opus or ogg/opus.
    ElevenLabs STT accepts these directly, but this function is available
    if you need to normalize to WAV first.

    Args:
        audio_bytes: Raw audio from the browser.
        source_format: Input format (webm, ogg, mp3, etc.).

    Returns:
        WAV bytes (mono, 16kHz, PCM 16-bit) optimized for speech recognition.
    """
    if not audio_bytes:
        raise ValueError("audio_bytes must not be empty")

    segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format=source_format)

    # Normalize for STT: mono, 16kHz, 16-bit
    segment = segment.set_channels(1).set_frame_rate(16000).set_sample_width(2)

    buf = io.BytesIO()
    segment.export(buf, format="wav")
    return buf.getvalue()
