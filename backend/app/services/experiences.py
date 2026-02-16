"""AI-powered personalized experience suggestions for short-term budget.

Uses Backboard API: create assistant, create thread, send message (data=content per docs), parse JSON.
Requires BACKBOARD_API_KEY.
"""
import json
import logging
import os

import requests

from app.services.user_context import get_user_financial_history

logger = logging.getLogger(__name__)

BASE_URL = "https://app.backboard.io/api"


def _backboard_completion(prompt: str, api_key: str) -> str | None:
    """Single Backboard completion per docs: assistant -> thread -> message with data=content."""
    headers = {"X-API-Key": api_key, "Content-Type": "application/json"}
    base = (os.environ.get("BACKBOARD_API_BASE") or BASE_URL).rstrip("/")

    # 1) Create assistant (or use existing)
    assistant_id = os.environ.get("BACKBOARD_ASSISTANT_ID")
    if not assistant_id:
        r = requests.post(
            f"{base}/assistants",
            headers=headers,
            json={
                "name": "Experiences",
                "system_prompt": "You respond only with valid JSON. No markdown, no code fences.",
            },
            timeout=30,
        )
        if not r.ok:
            logger.warning("Backboard assistants: %s %s", r.status_code, (r.text or "")[:300])
            return None
        assistant_id = r.json().get("assistant_id")
    if not assistant_id:
        return None

    # 2) Create thread
    r = requests.post(
        f"{base}/assistants/{assistant_id}/threads",
        headers=headers,
        json={},
        timeout=30,
    )
    if not r.ok:
        logger.warning("Backboard threads: %s %s", r.status_code, (r.text or "")[:300])
        return None
    thread_id = r.json().get("thread_id")
    if not thread_id:
        return None

    # 3) Send message — docs: data={"content": "Hello!", "stream": "false"}
    r = requests.post(
        f"{base}/threads/{thread_id}/messages",
        headers={"X-API-Key": api_key},
        data={"content": prompt, "stream": "false"},
        timeout=60,
    )
    if not r.ok:
        logger.warning("Backboard messages: %s %s", r.status_code, (r.text or "")[:300])
        return None
    out = r.json()
    return out.get("content") or out.get("text") or out.get("response")


def _call_backboard_for_experiences(
    context: str, location: str, remaining_budget_dollars: float
) -> tuple[list[dict], str]:
    api_key = os.environ.get("BACKBOARD_API_KEY", "")
    if not api_key or not api_key.strip():
        logger.warning("Experiences: BACKBOARD_API_KEY not set.")
        return [], "no_api_key"

    loc_hint = (
        f" Focus on experiences in or near: {location}." if location else " Suggest experiences for a general urban area."
    )
    prompt = (
        "Given this user's financial picture and profile, generate 8-12 personalized experience suggestions "
        "they could do with their short-term budget. "
        f"Their remaining short-term budget this month is approximately ${remaining_budget_dollars:.0f}."
        + loc_hint
        + "\n\n"
        "Respond with valid JSON array only, no markdown. Each object must have:\n"
        '- "name": string (short title)\n'
        '- "description": string (1-2 sentences)\n'
        '- "estimated_cost": number (USD)\n'
        '- "price_tier": "free" | "$" | "$$" | "$$$" (free=0, $=under 25, $$=25-75, $$$=75+)\n'
        '- "category": "food" | "entertainment" | "outdoors" | "culture" | "wellness" | "social"\n'
        '- "why_recommended": string (why this fits them)\n'
        '- "lat": number (approximate latitude for map)\n'
        '- "lng": number (approximate longitude for map)\n'
        "Include a mix of price tiers. Use real or plausible places. "
        "Coordinates should be valid for the location if provided, otherwise use a major US city center.\n\n"
        "Context:\n"
        + context
    )

    text = _backboard_completion(prompt, api_key)
    if not text:
        return [], "api_error"

    text = text.removeprefix("```json").removeprefix("```").strip().removesuffix("```").strip()
    try:
        out = json.loads(text)
    except json.JSONDecodeError:
        return [], "api_error"
    if not isinstance(out, list):
        return [], "api_error"

    result = []
    for exp in out[:16]:
        if not isinstance(exp, dict):
            continue
        name = exp.get("name")
        if not name:
            continue
        cost = exp.get("estimated_cost", 0)
        tier = exp.get("price_tier", "$")
        if cost == 0 and tier != "free":
            tier = "free"
        result.append({
            "name": str(name)[:100],
            "description": str(exp.get("description", ""))[:300],
            "estimated_cost": float(cost) if cost else 0,
            "price_tier": tier if tier in ("free", "$", "$$", "$$$") else "$",
            "category": str(exp.get("category", "entertainment"))[:50],
            "why_recommended": str(exp.get("why_recommended", ""))[:200],
            "lat": float(exp.get("lat", 40.7128)),
            "lng": float(exp.get("lng", -74.0060)),
        })
    return result, "ok"


def generate_experiences(user_id: int, location: str | None, budget_cents: int) -> tuple[list[dict], str]:
    history = get_user_financial_history(user_id)
    lines = []
    onboarding = history.get("onboarding_answers") or {}
    profile = history.get("profile_questionnaire") or {}
    if onboarding:
        lines.append("Onboarding: " + json.dumps(onboarding))
    if profile:
        lines.append("Profile: " + json.dumps(profile))
    if not lines:
        lines.append("No profile data.")
    context = "\n".join(lines)
    remaining_dollars = budget_cents / 100.0
    if remaining_dollars <= 0:
        remaining_dollars = 50.0
    try:
        return _call_backboard_for_experiences(context, location or "", remaining_dollars)
    except Exception as e:
        logger.warning("Experiences failed: %s", e)
        return [], "api_error"
