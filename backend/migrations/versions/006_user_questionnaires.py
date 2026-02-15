"""onboarding_answers and profile_questionnaire on users (financial history)

Revision ID: 006_user_questionnaires
Revises: 005_disconnected_wallets
Create Date: 2026-02-15

"""
from alembic import op
import sqlalchemy as sa


revision = "006_user_questionnaires"
down_revision = "005_disconnected_wallets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_answers JSON"))
    conn.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_questionnaire JSON"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS profile_questionnaire"))
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS onboarding_answers"))
