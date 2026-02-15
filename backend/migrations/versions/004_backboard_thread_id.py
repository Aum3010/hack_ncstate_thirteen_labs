"""backboard_thread_id on users

Revision ID: 004_backboard_thread_id
Revises: 003_assistant_mode
Create Date: 2026-02-15

"""
from alembic import op
import sqlalchemy as sa


revision = "004_backboard_thread_id"
down_revision = "003_assistant_mode"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS backboard_thread_id VARCHAR(255)"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS backboard_thread_id"))
