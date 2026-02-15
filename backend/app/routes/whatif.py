"""Scenario intelligence: Monte Carlo net worth futures + AI coach."""
import json
import math
import os
import random
from statistics import quantiles

from flask import Blueprint, jsonify, request

from app.routes.auth import get_current_user_id
from app.services.llm_client import json_from_groq

whatif_bp = Blueprint("whatif", __name__)


def _percentiles(values, probs):
    if not values:
        return {f"p{int(p * 100)}": 0.0 for p in probs}
    # statistics.quantiles expects probabilities in (0, 1)
    qs = quantiles(values, n=100, method="inclusive")
    out = {}
    for p in probs:
        idx = max(min(int(p * 100) - 1, len(qs) - 1), 0)
        out[f"p{int(p * 100)}"] = qs[idx]
    return out


def _run_monte_carlo(
    monthly_investment: float,
    extra_loan_payment: float,
    horizon_years: int,
    simulations: int = 500,
):
    """
    Simple Monte Carlo on top of the deterministic loan/investment structure
    used in the frontend, with stochastic returns.
    """
    months = horizon_years * 12

    # Annualized drift/vol for equity-like portfolio
    annual_return = 0.07
    annual_vol = 0.15
    monthly_drift = (1 + annual_return) ** (1 / 12) - 1
    monthly_vol = annual_vol / math.sqrt(12)

    net_worth_ends = []
    liquidity_months = []
    payoff_samples = []

    for _ in range(simulations):
        invest_balance = 0.0
        loan_balance = 10_000.0  # mirrors LOAN_PRINCIPAL in frontend
        liquid_reserve = 3_000.0  # simple liquidity proxy
        payoff_month = None

        for _m in range(1, months + 1):
            # Random monthly return draw
            z = random.gauss(0, 1)
            r = monthly_drift + monthly_vol * z

            # Loan payments
            baseline_payment = 250.0 if loan_balance > 0 else 0.0  # LOAN_MIN_PAYMENT
            scenario_payment = baseline_payment + (extra_loan_payment if loan_balance > 0 else 0.0)

            # Contributions into investments
            invest_flow = monthly_investment + (scenario_payment if loan_balance <= 0 else 0.0)
            invest_balance = invest_balance * (1 + r) + max(invest_flow, 0.0)

            # Loan interest and principal reduction
            if loan_balance > 0:
                interest = loan_balance * (0.10 / 12)  # LOAN_ANNUAL_RATE
                principal = max(scenario_payment - interest, 0.0)
                loan_balance = max(loan_balance - principal, 0.0)
                if loan_balance <= 0 and payoff_month is None:
                    payoff_month = _m

            # Simple liquidity: treat a portion of invest_balance as liquid, minus some spending
            liquid_reserve = max(liquid_reserve * (1 + 0.01) + monthly_investment * 0.2 - 400, 0.0)

        net_worth_end = invest_balance - loan_balance
        net_worth_ends.append(net_worth_end)
        # Liquidity buffer in months: assume average monthly expenses of 2k
        liquidity_months.append(liquid_reserve / 2000 if liquid_reserve > 0 else 0.0)
        payoff_samples.append(payoff_month)

    pct = _percentiles(net_worth_ends, [0.1, 0.5, 0.9])

    avg_liquidity = sum(liquidity_months) / len(liquidity_months) if liquidity_months else 0.0
    stress_p10 = _percentiles(liquidity_months, [0.1])["p10"]
    stress_prob = (
        sum(1 for m in liquidity_months if m < 6.0) / len(liquidity_months)
        if liquidity_months
        else 0.0
    )

    payoff_months = [m for m in payoff_samples if m is not None]
    debt_freedom_years = (
        (sum(payoff_months) / len(payoff_months)) / 12.0 if payoff_months else float(horizon_years)
    )

    # Build a simple histogram for a distribution curve
    buckets = 20
    if net_worth_ends:
        vmin, vmax = min(net_worth_ends), max(net_worth_ends)
    else:
        vmin = vmax = 0.0
    if vmax == vmin:
        vmax = vmin + 1.0
    width = (vmax - vmin) / buckets
    hist = [0] * buckets
    for v in net_worth_ends:
        idx = int((v - vmin) / width)
        if idx >= buckets:
            idx = buckets - 1
        hist[idx] += 1
    dist = []
    for i, count in enumerate(hist):
        center = vmin + (i + 0.5) * width
        dist.append({"net_worth": center, "count": count})

    return {
        "distribution": dist,
        "percentiles": {
            "p10": pct["p10"],
            "p50": pct["p50"],
            "p90": pct["p90"],
        },
        "liquidity": {
            "avg_months": avg_liquidity,
            "p10_months": stress_p10,
        },
        "debt_freedom_years": debt_freedom_years,
        "assumptions": {
            "annual_return": annual_return,
            "annual_vol": annual_vol,
            "simulations": simulations,
            "horizon_years": horizon_years,
        },
    }


def _fallback_coach(core: dict, monthly_investment: float) -> dict:
    # Very simple savings-rate proxy and narrative
    income_proxy = monthly_investment + 1000.0
    savings_rate = (monthly_investment / income_proxy) if income_proxy > 0 else 0.0
    savings_rate_pct = round(savings_rate * 100)
    liq_p10 = core["liquidity"]["p10_months"]
    tone = "balanced"
    if savings_rate_pct >= 40 and liq_p10 >= 6:
        tone = "strong"
    elif liq_p10 < 3:
        tone = "caution"
    headline = f"Savings rate around {savings_rate_pct}% with a {liq_p10:.1f}-month buffer."
    commentary = (
        f"At this level, your savings rate is roughly {savings_rate_pct}%. "
        f"That materially accelerates long-term wealth build, but your emergency cushion sits near {liq_p10:.1f} months. "
        "If that feels thin, consider nudging a bit more into cash until you reach 6+ months of runway."
    )
    return {
        "headline": headline,
        "commentary": commentary,
        "savings_rate_pct": savings_rate_pct,
        "liquidity_months": liq_p10,
        "tone": tone,
    }


def _llm_coach(core: dict, monthly_investment: float, extra_loan_payment: float) -> dict:
    provider = (os.environ.get("LLM_PROVIDER") or "").lower().strip()

    # Derived metrics shared with the model
    income_proxy = monthly_investment + 1000.0
    savings_rate = (monthly_investment / income_proxy) if income_proxy > 0 else 0.0
    savings_rate_pct = round(savings_rate * 100)
    liq = core["liquidity"]
    pct = core["percentiles"]
    assump = core["assumptions"]

    base = _fallback_coach(core, monthly_investment)

    metrics = {
        "monthly_investment": monthly_investment,
        "extra_loan_payment": extra_loan_payment,
        "savings_rate_pct": savings_rate_pct,
        "liquidity_p10_months": liq["p10_months"],
        "liquidity_avg_months": liq["avg_months"],
        "liquidity_stress_prob": liq.get("stress_prob", 0.0),
        "net_worth_p10": pct["p10"],
        "net_worth_p50": pct["p50"],
        "net_worth_p90": pct["p90"],
        "horizon_years": assump["horizon_years"],
    }

    system_prompt = (
        "You are a live, context-aware financial coach for an interactive dashboard. "
        "Given the user's scenario metrics, you must output short, structured commentary in JSON only. "
        "Do not ask questions or mention being an AI; speak directly about tradeoffs between savings rate and liquidity."
    )
    user_prompt = (
        "Here is the current slider state and Monte Carlo summary as JSON:\n"
        f"{json.dumps(metrics)}\n\n"
        "Return a single JSON object only, no markdown, with keys:\n"
        '{\n'
        '  "headline": string,\n'
        '  "commentary": string,\n'
        '  "savings_rate_pct": number,\n'
        '  "liquidity_months": number,\n'
        '  "tone": "strong" | "balanced" | "caution"\n'
        "}\n"
        "Keep it concrete and quantitative. Highlight when liquidity falls below ~6 months."
    )

    # Groq path (JSON helper) when explicitly selected
    if provider == "groq":
        out = json_from_groq(system_prompt, user_prompt)
        if not isinstance(out, dict):
            return base
        return {
            "headline": out.get("headline") or base["headline"],
            "commentary": out.get("commentary") or base["commentary"],
            "savings_rate_pct": out.get("savings_rate_pct") or base["savings_rate_pct"],
            "liquidity_months": out.get("liquidity_months") or base["liquidity_months"],
            "tone": out.get("tone") or base["tone"],
        }

    # Gemini path: use GEMINI_API_KEY / GOOGLE_API_KEY / BACKBOARD_API_KEY if available
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
                + "\n\nRespond with a single JSON object only, no markdown."
            )
            response = model.generate_content(prompt)
            text = (response.text or "").strip()
            # Strip optional code fences
            if text.startswith("```"):
                text = text.lstrip("`")
                if text.lower().startswith("json"):
                    text = text[4:]
                if "```" in text:
                    text = text.split("```", 1)[0]
                text = text.strip()
            out = json.loads(text)
            if isinstance(out, dict):
                return {
                    "headline": out.get("headline") or base["headline"],
                    "commentary": out.get("commentary") or base["commentary"],
                    "savings_rate_pct": out.get("savings_rate_pct") or base["savings_rate_pct"],
                    "liquidity_months": out.get("liquidity_months") or base["liquidity_months"],
                    "tone": out.get("tone") or base["tone"],
                }
        except Exception:
            # Fall through to base if Gemini fails
            pass

    # Default: simple deterministic coach
    return base


@whatif_bp.route("/scenario", methods=["POST"])
def scenario():
    """Return Monte Carlo distribution + percentile markers + AI coach commentary."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401

    data = request.get_json() or {}
    try:
        monthly_investment = float(data.get("monthlyInvestment", 450))
        extra_loan_payment = float(data.get("extraLoanPayment", 200))
        horizon_years = int(data.get("horizonYears", 10))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid input"}), 400

    horizon_years = max(1, min(horizon_years, 40))
    monthly_investment = max(0.0, monthly_investment)
    extra_loan_payment = max(0.0, extra_loan_payment)

    core = _run_monte_carlo(
        monthly_investment=monthly_investment,
        extra_loan_payment=extra_loan_payment,
        horizon_years=horizon_years,
        simulations=500,
    )
    coach = _llm_coach(core, monthly_investment, extra_loan_payment)
    core["coach"] = coach
    # For backwards compatibility/simple uses, also expose a flat explanation string
    core["explanation"] = coach["commentary"]
    return jsonify(core)


@whatif_bp.route("/config", methods=["GET"])
def config():
    """Expose non-sensitive LLM config so the What-If UI can show which model powers the coach."""
    # Only ever expose whether a key exists, never the key itself.
    provider = (os.environ.get("LLM_PROVIDER") or "").lower().strip() or "backboard"
    groq_model = os.environ.get("GROQ_MODEL") or "llama-3.1-8b-instant"
    has_groq_key = bool(os.environ.get("GROQ_API_KEY") or os.environ.get("GROQ_API_TOKEN"))
    return jsonify(
        {
            "provider": provider,
            "groq_model": groq_model,
            "groq_ready": provider == "groq" and has_groq_key,
        }
    )
