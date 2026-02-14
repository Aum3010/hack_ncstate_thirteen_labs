from app import db
from datetime import datetime


class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    amount_cents = db.Column(db.BigInteger, nullable=False)
    currency = db.Column(db.String(8), default="USD")
    category = db.Column(db.String(64), nullable=True)
    description = db.Column(db.String(512), nullable=True)
    source = db.Column(db.String(32), nullable=True)
    external_id = db.Column(db.String(255), nullable=True, index=True)
    transaction_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "amount_cents": self.amount_cents,
            "amount": self.amount_cents / 100,
            "currency": self.currency,
            "category": self.category,
            "description": self.description,
            "source": self.source,
            "transaction_at": self.transaction_at.isoformat() if self.transaction_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
