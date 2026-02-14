from app import db
from datetime import datetime


class Wallet(db.Model):
    __tablename__ = "wallets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    address = db.Column(db.String(64), nullable=False, unique=True, index=True)
    chain = db.Column(db.String(32), default="solana")
    label = db.Column(db.String(128), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "address": self.address,
            "chain": self.chain,
            "label": self.label,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
