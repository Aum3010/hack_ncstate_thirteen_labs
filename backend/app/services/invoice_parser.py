"""Parse invoice PDF/image using Gemini vision. Extract structured data."""
import os
import json
import re
import base64


def parse_invoice_with_gemini(file_content: bytes, file_name: str) -> dict | None:
    """
    Use Gemini vision to extract invoice fields.
    Returns dict with: amount, due_date, merchant, line_items (list of {description, amount}).
    Returns None if API key not set or parsing fails.
    """
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or os.environ.get("BACKBOARD_API_KEY")
    if not api_key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        fn = (file_name or "").lower()
        if fn.endswith(".pdf"):
            mime = "application/pdf"
        elif fn.endswith((".jpg", ".jpeg")):
            mime = "image/jpeg"
        else:
            mime = "image/png"
        part = {
            "inline_data": {"mime_type": mime, "data": base64.b64encode(file_content).decode()}
        }
        prompt = (
            "Extract the following from this invoice/bill document. Respond with valid JSON only, no markdown. "
            'Use this exact structure: {"amount": number or null, "due_date": "YYYY-MM-DD" or null, '
            '"merchant": string or null, "line_items": [{"description": string, "amount": number}] or []}. '
            "Amount should be the total in USD. If no amount found, use null."
        )
        response = model.generate_content([prompt, part])
        text = (response.text or "").strip()
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        return json.loads(text)
    except Exception:
        return None
