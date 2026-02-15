"""AI-powered personalized experience suggestions for short-term budget."""
import os
import json
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from app.services.user_context import get_user_financial_history

GEMINI_TIMEOUT_SECONDS = 20


def _call_gemini_for_experiences(context: str, location: str, remaining_budget_dollars: float) -> list[dict]:
    """Call Gemini with user context, return list of experience dicts."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or os.environ.get("BACKBOARD_API_KEY")
    if not api_key:
        return []
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        loc_hint = f" Focus on experiences in or near: {location}." if location else " Suggest experiences for a general urban area."
        prompt = (
            "Given this user's financial picture and profile, generate 8-12 personalized experience suggestions "
            "they could do with their short-term budget. "
            f"Their remaining short-term budget this month is approximately ${remaining_budget_dollars:.0f}." + loc_hint + "\n\n"
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
            "Context:\n" + context
        )
        response = client.models.generate_content(model="gemini-1.5-flash", contents=prompt)
        text = (response.text or "").strip()
        text = text.removeprefix("```json").removeprefix("```").strip().removesuffix("```").strip()
        out = json.loads(text)
        if isinstance(out, list):
            # Normalize and validate each experience
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
        return []
    except Exception:
        return []


def generate_experiences(user_id: int, location: str, budget_cents: int) -> list[dict]:
    """
    Generate personalized experiences for the user.
    Returns list of experience dicts. Uses timeout to avoid hanging on slow/blocked Gemini.
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
    executor = ThreadPoolExecutor(max_workers=1)
    try:
        future = executor.submit(
            _call_gemini_for_experiences, context, location or "", remaining_dollars
        )
        return future.result(timeout=GEMINI_TIMEOUT_SECONDS)
    except FuturesTimeoutError:
        return []
    except Exception:
        return []
    finally:
        executor.shutdown(wait=False)
