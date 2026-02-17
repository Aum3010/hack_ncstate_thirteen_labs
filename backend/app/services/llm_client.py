import json
import os
from typing import Any, Dict, List, Optional

import requests


def _groq_api_key() -> Optional[str]:
  """Return Groq API key from env, if present."""
  return os.environ.get("GROQ_API_KEY") or os.environ.get("GROQ_API_TOKEN")


def groq_chat_completion(
  messages: List[Dict[str, str]],
  model: Optional[str] = None,
  max_tokens: int = 1024,
  temperature: float = 0.4,
) -> Optional[str]:
  """
  Minimal Groq chat completion client using the OpenAI-compatible API.

  Returns the assistant message content, or None on error / missing key.
  """
  api_key = _groq_api_key()
  if not api_key:
    return None
  model_name = model or os.environ.get("GROQ_MODEL") or "llama-3.1-8b-instant"
  try:
    resp = requests.post(
      "https://api.groq.com/openai/v1/chat/completions",
      headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
      },
      json={
        "model": model_name,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
      },
      timeout=60,
    )
    if not resp.ok:
      return None
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
      return None
    msg = choices[0].get("message") or {}
    content = (msg.get("content") or "").strip()
    return content or None
  except Exception:
    return None


def json_from_groq(
  system_prompt: str,
  user_prompt: str,
  model: Optional[str] = None,
  max_tokens: int = 1024,
  temperature: float = 0.3,
) -> Any:
  """
  Helper for JSON-structured responses from Groq.

  Returns parsed JSON (dict / list) or None on error / missing key.
  """
  content = groq_chat_completion(
    [
      {"role": "system", "content": system_prompt},
      {"role": "user", "content": user_prompt},
    ],
    model=model,
    max_tokens=max_tokens,
    temperature=temperature,
  )
  if not content:
    return None
  text = content.strip()
  # Handle fenced code blocks, if any
  if text.startswith("```"):
    text = text.lstrip("`")
    if text.lower().startswith("json"):
      text = text[4:]
    if "```" in text:
      text = text.split("```", 1)[0]
    text = text.strip()
  try:
    return json.loads(text)
  except Exception:
    return None

