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
    op.add_column("users", sa.Column("partition_config", sa.JSON(), nullable=True))
    op.add_column("users", sa.Column("onboarding_completed", sa.Boolean(), server_default="false", nullable=True))
    op.execute("UPDATE users SET onboarding_completed = true WHERE onboarding_completed IS NULL")

    op.create_table(
        "goals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("target_cents", sa.BigInteger(), nullable=False),
        sa.Column("saved_cents", sa.BigInteger(), server_default="0", nullable=True),
        sa.Column("category", sa.String(length=64), server_default="short_term", nullable=True),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_goals_user_id"), "goals", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_goals_user_id"), table_name="goals")
    op.drop_table("goals")
    op.drop_column("users", "onboarding_completed")
    op.drop_column("users", "partition_config")
