"""User financial history: merged onboarding_answers + profile_questionnaire for pipeline consumers."""

from app.models import User


def get_user_financial_history(user_id: int) -> dict:
    """
    Load user and return merged dict of onboarding_answers and profile_questionnaire.
    Single source for orchestrator, Backboard ingest, and future agents.
    """
    user = User.query.get(user_id)
    if not user:
        return {}
    onboarding = user.onboarding_answers or {}
    profile = user.profile_questionnaire or {}
    return {
        "onboarding_answers": onboarding,
        "profile_questionnaire": profile,
    }
