# TTS Deep Dive -- Zero-Storage Streaming Architecture

This document traces the exact code path of a TTS request from HTTP to browser. Designed to be fed to LLMs for context.

**Key principle: No audio ever touches the server's disk. Everything is streamed.**

---

## 1. Entry Point: Flask Route

**File:** `app/routes/assistant.py` -- `POST /api/assistant/tts`

```
Frontend sends: POST /api/assistant/tts
Body: {"text": "Hello world", "voice_id": null}
```

**What happens step by step:**

1. Route handler `tts()` is called (line 48)
2. Authentication check via `get_current_user_id()` -- returns 401 if no session
3. Extracts `text` and `voice_id` from JSON body
4. Calls `stream_speech(text, voice_id=voice_id)` -- returns a Python generator
5. Wraps the generator in `stream_with_context()` to keep the Flask request context alive
6. Returns `flask.Response(stream, mimetype="audio/mpeg")` with chunked transfer encoding

**The response is a chunked MP3 stream. Bytes flow directly from ElevenLabs to the browser. The server never buffers the complete audio.**

---

## 2. Streaming Service: `stream_speech()`

**File:** `app/services/eleven_service.py` -- lines 42-82

### Call chain:

```
stream_speech("Hello world", voice_id=None)
    |
    +--> voice = voice_id or "JBFqnCBsd6RMkjVDRZzb"  (default: George voice)
    |
    +--> Acquire semaphore (max 3 concurrent API calls)
    |
    +--> Create ElevenLabs client using ELEVENLABS_API_KEY from .env
    |
    +--> Call ElevenLabs TTS API:
    |      client.text_to_speech.convert(
    |          text="Hello world",
    |          voice_id="JBFqnCBsd6RMkjVDRZzb",
    |          model_id="eleven_flash_v2_5",
    |          output_format="mp3_44100_128"
    |      )
    |
    +--> API returns a generator of MP3 chunks
    |
    +--> for chunk in response:
    |        yield chunk    <-- each chunk goes straight to Flask Response
    |
    +--> Release semaphore
```

### Retry logic:

If the API call fails with a 429 (rate limit), timeout, or connection error:
- Wait 0.6 seconds
- Retry up to 3 times total
- If all retries fail, raise the last exception

Note: retries can only happen before the first chunk is yielded. Once streaming starts, errors will propagate to the client as a broken stream.

### Convenience wrapper: `generate_speech()`

For cases where you need the complete buffer (e.g., passing to STT):

```python
def generate_speech(text, voice_id=None) -> bytes:
    return b"".join(stream_speech(text, voice_id=voice_id))
```

This still writes nothing to disk -- it just collects chunks in memory.

---

## 3. Where Audio Gets Stored

**Nowhere.** That is the entire point.

| Previous architecture | Current architecture |
|---|---|
| TTS cache on disk (`app/cache/tts_cache/`) | Removed. No cache. |
| Generated audio dir (`generated_audio/`) | Removed. No saved files. |
| `b"".join(chunks)` buffered in memory, then written to file | Chunks yielded directly to HTTP response |
| `send_file(io.BytesIO(audio))` | `Response(stream_with_context(generator))` |

The only place audio bytes exist is:
1. **In the ElevenLabs SDK's HTTP response buffer** (managed by httpx)
2. **In the Flask response stream** (flushed to the client as chunks arrive)
3. **In the browser** (client-side, after receiving the stream)

---

## 4. Data Flow Diagram

```
[Frontend]
    |
    | POST /api/assistant/tts  {"text": "Hello world"}
    v
[Flask Route: assistant.py:tts()]
    |
    | stream_speech("Hello world")  --> returns generator
    |
    | Response(stream_with_context(generator), mimetype="audio/mpeg")
    v
[eleven_service.py:stream_speech()]
    |
    | client.text_to_speech.convert(...)  --> returns chunk generator
    |
    | for chunk in response:
    |     yield chunk  ----+
    |                      |
    v                      v
[ElevenLabs API]     [HTTP Response to Browser]
                           |
                           | Transfer-Encoding: chunked
                           | Content-Type: audio/mpeg
                           |
                           v
                     [Browser plays audio]
```

**Zero disk I/O. Zero temp files. Zero cache files.**

---

## 5. Audio Format Details

| Property | Value |
|----------|-------|
| Format | MP3 |
| Sample rate | 44,100 Hz |
| Bitrate | 128 kbps |
| Channels | Mono (typical for speech) |
| ElevenLabs format string | `mp3_44100_128` |
| Typical total size | ~15-30 KB for a short sentence |
| Chunk size | Variable (determined by ElevenLabs SDK) |
| Transfer encoding | Chunked |

This format is compatible with ElevenLabs Free Tier.

---

## 6. ElevenLabs API Details

| Property | Value |
|----------|-------|
| SDK | `elevenlabs` Python package |
| Client class | `ElevenLabs(api_key=...)` |
| TTS method | `client.text_to_speech.convert()` |
| TTS model | `eleven_flash_v2_5` (fast, low-latency) |
| Default voice | `JBFqnCBsd6RMkjVDRZzb` (George) |
| STT method | `client.speech_to_text.convert()` |
| STT model | `scribe_v2` |
| Auth | API key via `ELEVENLABS_API_KEY` env var |
| Rate limit | Semaphore capped at 3 concurrent calls |
| Retry | 3 attempts, 0.6s delay, on 429/timeout/connection errors |

---

## 7. Key Files Summary

| File | Role | Stores audio? |
|------|------|---------------|
| `app/routes/assistant.py` | HTTP endpoint, streams chunks to client | No |
| `app/services/eleven_service.py` | ElevenLabs API, yields chunks from generator | No |
| `app/services/audio_service.py` | In-memory format conversion (pydub) | No |
| `.env` | Contains `ELEVENLABS_API_KEY` | No |

---

## 8. What the Frontend Receives

The frontend gets a chunked MP3 stream. To play it:

```javascript
// Stream and play TTS audio in the browser
const res = await fetch("/api/assistant/tts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "Hello world" })
});

const blob = await res.blob();
const url = URL.createObjectURL(blob);
const audio = new Audio(url);
audio.play();
```

The response headers:
```
Content-Type: audio/mpeg
Content-Disposition: inline
Cache-Control: no-cache
Transfer-Encoding: chunked
```

---

## 9. STT Flow (Speech-to-Text)

STT is also zero-storage. Audio bytes from the browser upload are held in memory only.

```
[Browser: MediaRecorder]
    |
    | POST /api/assistant/stt  (multipart/form-data, field: "audio")
    v
[Flask Route: assistant.py:stt()]
    |
    | audio_bytes = request.files["audio"].read()   <-- in memory
    |
    | transcribe_audio(audio_bytes, language="en")
    v
[eleven_service.py:transcribe_audio()]
    |
    | io.BytesIO(audio_bytes)  --> file-like wrapper, still in memory
    |
    | client.speech_to_text.convert(file=..., model_id="scribe_v2")
    v
[ElevenLabs API]
    |
    | returns: result.text = "The transcribed text"
    v
[Flask Route]
    |
    | return jsonify({"text": "The transcribed text"})
    v
[Browser receives JSON]
```

**No audio files are saved at any point.**
