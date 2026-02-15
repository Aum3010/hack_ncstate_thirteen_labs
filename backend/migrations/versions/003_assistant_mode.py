"""assistant_mode on users

Revision ID: 003_assistant_mode
Revises: 002_goals_partition
Create Date: 2026-02-14

"""
from alembic import op
import sqlalchemy as sa


revision = "003_assistant_mode"
down_revision = "002_goals_partition"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS assistant_mode VARCHAR(32) DEFAULT 'balanced'"
    ))
    conn.execute(sa.text(
        "UPDATE users SET assistant_mode = 'balanced' WHERE assistant_mode IS NULL"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS assistant_mode"))
