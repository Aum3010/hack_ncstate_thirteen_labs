"""Audio service — recording, MP3 decoding, playback.

No ElevenLabs API logic. No Flask.
Uses sounddevice for recording/playback, pydub for MP3 decoding.
Designed for Windows compatibility.
"""

import io
import os

import numpy as np
import sounddevice as sd
import soundfile as sf
from pydub import AudioSegment

# Recording defaults
DEFAULT_SAMPLE_RATE = 44100
DEFAULT_CHANNELS = 1


def record_from_mic(duration: int = None, sample_rate: int = DEFAULT_SAMPLE_RATE) -> bytes:
    """Record audio from the default microphone.

    Args:
        duration: Recording length in seconds. If None, records for 5 seconds.
        sample_rate: Sample rate in Hz.

    Returns:
        Raw WAV bytes suitable for passing to transcribe_audio().
    """
    duration = duration or 5

    recording = sd.rec(
        int(duration * sample_rate),
        samplerate=sample_rate,
        channels=DEFAULT_CHANNELS,
        dtype="int16",
    )
    sd.wait()  # Block until recording is finished

    # Encode as WAV in memory
    buf = io.BytesIO()
    sf.write(buf, recording, sample_rate, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def play_mp3_bytes(audio_bytes: bytes) -> None:
    """Decode MP3 bytes and play through the default audio output.

    Uses pydub to decode MP3 → PCM, then sounddevice for playback.
    Blocks until playback is complete.
    """
    if not audio_bytes:
        raise ValueError("audio_bytes must not be empty")

    # Decode MP3 → raw PCM via pydub
    segment = AudioSegment.from_mp3(io.BytesIO(audio_bytes))

    # Convert to numpy array for sounddevice
    samples = np.array(segment.get_array_of_samples(), dtype=np.float32)

    # Normalize to [-1.0, 1.0]
    max_val = float(2 ** (segment.sample_width * 8 - 1))
    samples = samples / max_val

    # Handle stereo: reshape to (n_samples, n_channels)
    if segment.channels > 1:
        samples = samples.reshape(-1, segment.channels)

    sd.play(samples, samplerate=segment.frame_rate)
    sd.wait()


def save_audio_file(audio_bytes: bytes, path: str) -> str:
    """Save raw audio bytes to a file on disk.

    Args:
        audio_bytes: The audio data to save.
        path: Destination file path (e.g. "output.mp3").

    Returns:
        The absolute path of the saved file.
    """
    if not audio_bytes:
        raise ValueError("audio_bytes must not be empty")

    abs_path = os.path.abspath(path)
    os.makedirs(os.path.dirname(abs_path) or ".", exist_ok=True)

    with open(abs_path, "wb") as f:
        f.write(audio_bytes)

    return abs_path
