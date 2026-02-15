"""Tracks wallet addresses that were disconnected so Phantom re-login can reconnect to the same user."""
from app import db
from datetime import datetime


class DisconnectedWallet(db.Model):
    __tablename__ = "disconnected_wallets"

    id = db.Column(db.Integer, primary_key=True)
    address = db.Column(db.String(64), nullable=False, unique=True, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    disconnected_at = db.Column(db.DateTime, default=datetime.utcnow)
