"""goals and partition_config

Revision ID: 002_goals_partition
Revises: 001_initial
Create Date: 2026-02-14

"""
from alembic import op
import sqlalchemy as sa


revision = "002_goals_partition"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use IF NOT EXISTS so migration is idempotent if schema was partially applied
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS partition_config JSON"))
    conn.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false"))
    conn.execute(sa.text("UPDATE users SET onboarding_completed = true WHERE onboarding_completed IS NULL"))

    # Goals table - use CREATE TABLE IF NOT EXISTS
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS goals (
            id SERIAL NOT NULL,
            user_id INTEGER NOT NULL,
            name VARCHAR(255) NOT NULL,
            target_cents BIGINT NOT NULL,
            saved_cents BIGINT DEFAULT 0,
            category VARCHAR(64) DEFAULT 'short_term',
            deadline DATE,
            created_at TIMESTAMP WITHOUT TIME ZONE,
            updated_at TIMESTAMP WITHOUT TIME ZONE,
            PRIMARY KEY (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_goals_user_id ON goals (user_id)"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_goals_user_id"))
    conn.execute(sa.text("DROP TABLE IF EXISTS goals"))
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS onboarding_completed"))
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS partition_config"))
