"""disconnected_wallets table for Phantom reconnect

Revision ID: 005_disconnected_wallets
Revises: 004_backboard_thread_id
Create Date: 2026-02-15

"""
from alembic import op
import sqlalchemy as sa


revision = "005_disconnected_wallets"
down_revision = "004_backboard_thread_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # If the table already exists (e.g. created manually or from a previous run),
    # skip creation to keep the migration idempotent.
    inspector = sa.inspect(conn)
    if "disconnected_wallets" in inspector.get_table_names():
        return

    op.create_table(
        "disconnected_wallets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("address", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("disconnected_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("address"),
    )
    op.create_index(op.f("ix_disconnected_wallets_address"), "disconnected_wallets", ["address"], unique=True)
    op.create_index(op.f("ix_disconnected_wallets_user_id"), "disconnected_wallets", ["user_id"], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if "disconnected_wallets" in inspector.get_table_names():
        op.drop_index(op.f("ix_disconnected_wallets_user_id"), table_name="disconnected_wallets")
        op.drop_index(op.f("ix_disconnected_wallets_address"), table_name="disconnected_wallets")
        op.drop_table("disconnected_wallets")
