"""LLM-powered portfolio services: allocation generation and spending analysis."""
import json
import logging
import os

logger = logging.getLogger(__name__)


def _call_backboard(prompt):
    """Send a prompt to Backboard/Gemini and return the text response, or None."""
    api_key = os.environ.get("BACKBOARD_API_KEY", "")
    if not api_key:
        return None
    try:
        import requests

        base_url = os.environ.get("BACKBOARD_API_BASE", "https://app.backboard.io/api").rstrip("/")
        headers = {"X-API-Key": api_key, "Content-Type": "application/json"}

        assistant_id = os.environ.get("BACKBOARD_ASSISTANT_ID")
        if not assistant_id:
            r = requests.post(
                f"{base_url}/assistants",
                headers=headers,
                json={
                    "name": "Portfolio Advisor",
                    "system_prompt": (
                        "You are a financial portfolio advisor. You always respond with valid JSON. "
                        "Never include markdown formatting or code fences in your response."
                    ),
                },
                timeout=30,
            )
            if not r.ok:
                logger.warning("Backboard create assistant failed: %s", r.status_code)
                return None
            assistant_id = r.json().get("assistant_id")

        if not assistant_id:
            return None

        r = requests.post(
            f"{base_url}/assistants/{assistant_id}/threads",
            headers=headers,
            json={},
            timeout=30,
        )
        if not r.ok:
            return None
        thread_id = r.json().get("thread_id")
        if not thread_id:
            return None

        msg_headers = {"X-API-Key": api_key}
        r = requests.post(
            f"{base_url}/threads/{thread_id}/messages",
            headers=msg_headers,
            data={"stream": "false"},
            files=[("content", (None, prompt))],
            timeout=60,
        )
        if not r.ok:
            return None
        out = r.json()
        return out.get("content") or out.get("text") or out.get("response")
    except Exception as e:
        logger.exception("Backboard call failed: %s", e)
        return None


def _parse_json_response(text):
    """Try to extract JSON from an LLM response that may contain markdown fences."""
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


def generate_allocation(goal, risk_tolerance="balanced"):
    """Ask LLM to generate portfolio allocation categories + percentages for a goal.

    Returns a dict: {"categories": [{"name": str, "percentage": int, "color": str}]}
    or None if unavailable.
    """
    prompt = (
        f"The user wants to invest/save for: {goal}\n"
        f"Risk tolerance: {risk_tolerance}\n\n"
        "Generate a portfolio allocation with 4-6 investment categories and percentage allocations "
        "that sum to 100. For each category provide a hex color code.\n\n"
        "Respond ONLY with valid JSON in this exact format, no other text:\n"
        '{"categories": [{"name": "Category Name", "percentage": 30, "color": "#hex"}]}'
    )
    text = _call_backboard(prompt)
    parsed = _parse_json_response(text)
    if parsed and "categories" in parsed:
        return parsed
    # Fallback: return a sensible default
    return {
        "categories": [
            {"name": "US Stocks", "percentage": 40, "color": "#00d4ff"},
            {"name": "International Stocks", "percentage": 20, "color": "#ff2d92"},
            {"name": "Bonds", "percentage": 20, "color": "#00ff88"},
            {"name": "Real Estate", "percentage": 10, "color": "#f59e0b"},
            {"name": "Cash / Savings", "percentage": 10, "color": "#8b5cf6"},
        ]
    }


def analyze_spending(transactions, goals):
    """Ask LLM to analyze spending patterns and suggest reductions.

    Returns a dict: {"suggestions": [{"category": str, "message": str, "save_amount": float}]}
    or None if unavailable.
    """
    if not transactions:
        return {"suggestions": [{"category": "general", "message": "Add transactions to get personalized spending analysis.", "save_amount": 0}]}

    # Build a spending summary for the LLM
    from collections import defaultdict
    by_cat = defaultdict(float)
    for t in transactions:
        cat = t.get("category") or "other"
        by_cat[cat] += (t.get("amount_cents") or 0) / 100

    spending_lines = [f"  {cat}: ${amt:.2f}" for cat, amt in sorted(by_cat.items(), key=lambda x: -x[1])]
    spending_text = "\n".join(spending_lines)

    goals_text = "No goals set."
    if goals:
        goals_lines = []
        for g in goals:
            target = g.get("target", g.get("target_cents", 0) / 100 if g.get("target_cents") else 0)
            saved = g.get("saved", g.get("saved_cents", 0) / 100 if g.get("saved_cents") else 0)
            goals_lines.append(f"  {g.get('name')}: ${saved:.2f} / ${target:.2f}")
        goals_text = "\n".join(goals_lines)

    prompt = (
        f"User's recent spending by category:\n{spending_text}\n\n"
        f"User's savings goals:\n{goals_text}\n\n"
        "Analyze spending and provide 2-4 specific suggestions to reduce spending and redirect "
        "savings toward their goals. For each suggestion include the category, a short message, "
        "and estimated monthly savings amount.\n\n"
        "Respond ONLY with valid JSON in this exact format, no other text:\n"
        '{"suggestions": [{"category": "category_name", "message": "Specific advice", "save_amount": 50.00}]}'
    )
    text = _call_backboard(prompt)
    parsed = _parse_json_response(text)
    if parsed and "suggestions" in parsed:
        return parsed
    # Fallback based on actual spending data
    suggestions = []
    sorted_cats = sorted(by_cat.items(), key=lambda x: -x[1])
    for cat, amt in sorted_cats[:3]:
        reduction = round(amt * 0.15, 2)
        suggestions.append({
            "category": cat,
            "message": f"Consider reducing {cat} spending by 15% to save ${reduction:.2f}/month.",
            "save_amount": reduction,
        })
    return {"suggestions": suggestions} if suggestions else {"suggestions": []}


def generate_description(title, tech_stack=None, existing_description=None):
    """Generate a professional portfolio project description using Backboard/Gemini."""
    prompt_parts = [
        "Generate a concise, professional portfolio description (2-3 sentences) for a software project.",
        f"Project title: {title}",
    ]
    if tech_stack:
        prompt_parts.append(f"Technologies used: {tech_stack}")
    if existing_description:
        prompt_parts.append(f"Current description to improve: {existing_description}")
    prompt_parts.append(
        "Write in third person. Focus on what the project does, its technical highlights, "
        "and its value. Be specific and avoid generic filler."
    )
    return _call_backboard("\n".join(prompt_parts))
