"""Smart Allocation Optimizer: AI portfolio coach for staking vs liquidity vs stable yield."""
import json
import os
from math import sqrt

from flask import Blueprint, jsonify, request

from app.routes.auth import get_current_user_id
from app.services.llm_client import json_from_groq

optimizer_bp = Blueprint("optimizer", __name__)


def _base_asset_params():
    """
    Simple baseline assumptions for expected return and volatility (annualized) by bucket.
    Values are illustrative, not advice.
    """
    return {
        "staked": {"exp_return": 0.10, "vol": 0.60},
        "liquid": {"exp_return": 0.02, "vol": 0.10},
        "stable": {"exp_return": 0.05, "vol": 0.20},
    }


def _compute_portfolio_metrics(alloc: dict) -> dict:
    """Compute naive expected return and a simple volatility proxy for a 3-bucket allocation."""
    params = _base_asset_params()
    w_staked = (alloc.get("staked_pct", 0) or 0) / 100.0
    w_liquid = (alloc.get("liquid_pct", 0) or 0) / 100.0
    w_stable = (alloc.get("stable_pct", 0) or 0) / 100.0

    er = (
        w_staked * params["staked"]["exp_return"]
        + w_liquid * params["liquid"]["exp_return"]
        + w_stable * params["stable"]["exp_return"]
    )
    # Simplified risk: weighted vol with zero correlation assumption
    vol = sqrt(
        (w_staked * params["staked"]["vol"]) ** 2
        + (w_liquid * params["liquid"]["vol"]) ** 2
        + (w_stable * params["stable"]["vol"]) ** 2
    )
    # Rough drawdown proxy (~2.5x vol, purely illustrative)
    drawdown = 2.5 * vol
    return {
        "expected_return": er,
        "risk_vol": vol,
        "risk_drawdown": drawdown,
    }


def _fallback_optimize(current: dict, risk_profile: str) -> dict:
    """Deterministic heuristic if LLM is unavailable."""
    cur_metrics = _compute_portfolio_metrics(current)
    staked = current.get("staked_pct", 0)
    liquid = current.get("liquid_pct", 0)
    stable = current.get("stable_pct", 0)

    if risk_profile == "conservative":
        # More to stable / liquid, less staked
        target = {
            "staked_pct": max(staked - 10, 10),
            "liquid_pct": min(liquid + 5, 40),
            "stable_pct": 100,
        }
        target["stable_pct"] = max(0, target["stable_pct"] - target["staked_pct"] - target["liquid_pct"])
    elif risk_profile == "aggressive":
        # Tilt into staked
        target = {
            "staked_pct": min(staked + 12, 80),
            "liquid_pct": max(liquid, 10),
            "stable_pct": 100,
        }
        target["stable_pct"] = max(0, target["stable_pct"] - target["staked_pct"] - target["liquid_pct"])
    else:
        # Balanced: moderate staked, some stable
        total = staked + liquid + stable
        if total <= 0:
            target = {"staked_pct": 50, "liquid_pct": 20, "stable_pct": 30}
        else:
            target = {
                "staked_pct": min(max(staked, 40), 70),
                "liquid_pct": min(max(liquid, 10), 30),
                "stable_pct": 100,
            }
            target["stable_pct"] = max(0, target["stable_pct"] - target["staked_pct"] - target["liquid_pct"])

    opt_metrics = _compute_portfolio_metrics(target)
    explanation = (
        "Based on your risk profile, this allocation tilts more into yield sources "
        "with better risk-adjusted return while keeping a liquid buffer for volatility."
    )
    return {
        "current": {
            "allocation": current,
            **cur_metrics,
        },
        "optimized": {
            "allocation": target,
            **opt_metrics,
        },
        "explanation": explanation,
    }


@optimizer_bp.route("/optimize", methods=["POST"])
def optimize():
    """Optimize staking vs liquid vs stable yield allocation using LLM (Groq/Gemini) plus simple metrics."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401

    data = request.get_json() or {}
    current = data.get("current") or {}
    risk_profile = (data.get("risk_profile") or "balanced").lower().strip()
    if risk_profile not in ("conservative", "balanced", "aggressive"):
        risk_profile = "balanced"

    # Normalize and cap current allocation
    staked = max(0.0, float(current.get("staked_pct", 0)))
    liquid = max(0.0, float(current.get("liquid_pct", 0)))
    stable = max(0.0, float(current.get("stable_pct", 0)))
    total = staked + liquid + stable
    if total <= 0:
        staked, liquid, stable = 50.0, 20.0, 30.0
        total = 100.0
    # Normalize to sum ~100
    staked = staked / total * 100.0
    liquid = liquid / total * 100.0
    stable = max(0.0, 100.0 - staked - liquid)
    current_norm = {
        "staked_pct": staked,
        "liquid_pct": liquid,
        "stable_pct": stable,
    }

    cur_metrics = _compute_portfolio_metrics(current_norm)

    provider = (os.environ.get("LLM_PROVIDER") or "").lower().strip()

    metrics = {
        "current_allocation": current_norm,
        "current_expected_return": cur_metrics["expected_return"],
        "current_risk_vol": cur_metrics["risk_vol"],
        "current_risk_drawdown": cur_metrics["risk_drawdown"],
        "risk_profile": risk_profile,
    }

    system_prompt = (
        "You are a crypto portfolio optimizer for a retail user interface. "
        "You act like a reinforcement-learning style policy optimizer but respond once per request. "
        "Your goal is to maximize expected growth while respecting a drawdown constraint based on risk profile: "
        "conservative ~20% max drawdown, balanced ~30%, aggressive ~40%+. "
        "You must propose a new allocation across staked, liquid, and stable yield buckets."
    )
    user_prompt = (
        "Here is the current state as JSON:\n"
        f"{json.dumps(metrics)}\n\n"
        "Propose a new allocation in JSON only (no markdown) with structure:\n"
        "{\n"
        '  "optimized_allocation": {\n'
        '    "staked_pct": number,\n'
        '    "liquid_pct": number,\n'
        '    "stable_pct": number\n'
        "  },\n"
        '  "expected_return_current": number,  // annual, you may reuse or adjust\n'
        '  "expected_return_optimized": number,\n'
        '  "risk_current": number,  // drawdown or vol proxy\n'
        '  "risk_optimized": number,\n'
        '  "explanation": string  // 2-3 sentences: why you chose this, where risk moved\n'
        "}\n"
        "Percentages should sum to ~100. Follow the risk profile constraint: do not exceed the drawdown budget."
    )

    # Groq path when selected
    if provider == "groq":
        out = json_from_groq(system_prompt, user_prompt)
        if isinstance(out, dict) and isinstance(out.get("optimized_allocation"), dict):
            opt_alloc = out["optimized_allocation"]
            result = {
                "current": {
                    "allocation": current_norm,
                    "expected_return": out.get("expected_return_current", cur_metrics["expected_return"]),
                    "risk": out.get("risk_current", cur_metrics["risk_drawdown"]),
                },
                "optimized": {
                    "allocation": {
                        "staked_pct": opt_alloc.get("staked_pct", current_norm["staked_pct"]),
                        "liquid_pct": opt_alloc.get("liquid_pct", current_norm["liquid_pct"]),
                        "stable_pct": opt_alloc.get("stable_pct", current_norm["stable_pct"]),
                    },
                    "expected_return": out.get("expected_return_optimized"),
                    "risk": out.get("risk_optimized"),
                },
                "explanation": out.get("explanation", ""),
            }
            return jsonify(result)

    # Gemini / Backboard path if keys present
    api_key = (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("BACKBOARD_API_KEY")
    )
    if api_key:
        try:
            import google.generativeai as genai

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = (
                system_prompt
                + "\n\n"
                + user_prompt
                + "\n\nRespond with JSON only, no markdown."
            )
            response = model.generate_content(prompt)
            text = (response.text or "").strip()
            if text.startswith("```"):
                text = text.lstrip("`")
                if text.lower().startswith("json"):
                    text = text[4:]
                if "```" in text:
                    text = text.split("```", 1)[0]
                text = text.strip()
            out = json.loads(text)
            if isinstance(out, dict) and isinstance(out.get("optimized_allocation"), dict):
                opt_alloc = out["optimized_allocation"]
                result = {
                    "current": {
                        "allocation": current_norm,
                        "expected_return": out.get("expected_return_current", cur_metrics["expected_return"]),
                        "risk": out.get("risk_current", cur_metrics["risk_drawdown"]),
                    },
                    "optimized": {
                        "allocation": {
                            "staked_pct": opt_alloc.get("staked_pct", current_norm["staked_pct"]),
                            "liquid_pct": opt_alloc.get("liquid_pct", current_norm["liquid_pct"]),
                            "stable_pct": opt_alloc.get("stable_pct", current_norm["stable_pct"]),
                        },
                        "expected_return": out.get("expected_return_optimized"),
                        "risk": out.get("risk_optimized"),
                    },
                    "explanation": out.get("explanation", ""),
                }
                return jsonify(result)
        except Exception:
            pass

    # Fallback deterministic optimizer
    result = _fallback_optimize(current_norm, risk_profile)
    # Map into the same shape
    return jsonify(
        {
            "current": {
                "allocation": result["current"]["allocation"],
                "expected_return": result["current"]["expected_return"],
                "risk": result["current"]["risk_drawdown"]
                if "risk_drawdown" in result["current"]
                else _compute_portfolio_metrics(result["current"]["allocation"])["risk_drawdown"],
            },
            "optimized": {
                "allocation": result["optimized"]["allocation"],
                "expected_return": result["optimized"]["expected_return"],
                "risk": result["optimized"]["risk_drawdown"]
                if "risk_drawdown" in result["optimized"]
                else _compute_portfolio_metrics(result["optimized"]["allocation"])["risk_drawdown"],
            },
            "explanation": result["explanation"],
        }
    )

