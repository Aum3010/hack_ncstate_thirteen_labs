"""AI-powered personalized experience suggestions for short-term budget.

Uses bare-bones Gemini REST API (requests) - requires GEMINI_API_KEY or GOOGLE_API_KEY.
"""
import logging
import os
import json
import requests

from app.services.user_context import get_user_financial_history

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
GEMINI_TIMEOUT = 25


def _call_gemini_rest(prompt: str, api_key: str) -> str | None:
    """Call Gemini REST API, return generated text or None on failure."""
    if not api_key:
        return None
    try:
        url = f"{GEMINI_URL}?key={api_key}"
        r = requests.post(
            url,
            json={"contents": [{"parts": [{"text": prompt}]}]},
            headers={"Content-Type": "application/json"},
            timeout=GEMINI_TIMEOUT,
        )
        if not r.ok:
            logger.warning("Gemini API error: status=%s body=%s", r.status_code, (r.text or "")[:300])
            return None
        data = r.json()
        candidates = data.get("candidates") or []
        if not candidates:
            return None
        parts = (candidates[0].get("content") or {}).get("parts") or []
        if not parts:
            return None
        return (parts[0].get("text") or "").strip()
    except requests.exceptions.RequestException as e:
        logger.warning("Gemini API request failed: %s", e)
        return None
    except Exception as e:
        logger.warning("Gemini API parse failed: %s", e)
        return None


def _call_gemini_for_experiences(
    context: str, location: str, remaining_budget_dollars: float
) -> list[dict]:
    """Call Gemini with user context, return list of experience dicts."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        logger.info("Experiences: no GEMINI_API_KEY or GOOGLE_API_KEY set")
        return []
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
    text = _call_gemini_rest(prompt, api_key)
    if not text:
        return []
    try:
        text = text.removeprefix("```json").removeprefix("```").strip().removesuffix("```").strip()
        out = json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning("Experiences: failed to parse Gemini JSON: %s", e)
        return []
    if not isinstance(out, list):
        return []
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
    return result


def generate_experiences(user_id: int, location: str | None, budget_cents: int) -> list[dict]:
    """
    Generate personalized experiences for the user.
    Returns list of experience dicts. Uses Gemini REST API directly.
    """
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
        remaining_dollars = 50.0  # fallback for empty budget
    try:
        return _call_gemini_for_experiences(context, location or "", remaining_dollars)
    except Exception as e:
        logger.warning("Experiences generation failed: %s", e)
        return []
