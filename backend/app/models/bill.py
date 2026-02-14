from app import db
from datetime import datetime


class Bill(db.Model):
    __tablename__ = "bills"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    bill_type = db.Column(db.String(32), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    amount_cents = db.Column(db.BigInteger, nullable=False)
    currency = db.Column(db.String(8), default="USD")
    due_day = db.Column(db.Integer, nullable=True)
    due_date = db.Column(db.Date, nullable=True)
    is_recurring = db.Column(db.Boolean, default=False)
    frequency = db.Column(db.String(16), default="monthly")
    reminder_days_before = db.Column(db.Integer, default=3)
    paid_at = db.Column(db.DateTime, nullable=True)
    card_last_four = db.Column(db.String(4), nullable=True)
    minimum_payment_cents = db.Column(db.BigInteger, nullable=True)
    statement_due_day = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "bill_type": self.bill_type,
            "name": self.name,
            "amount_cents": self.amount_cents,
            "amount": self.amount_cents / 100,
            "currency": self.currency,
            "due_day": self.due_day,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "is_recurring": self.is_recurring,
            "frequency": self.frequency,
            "reminder_days_before": self.reminder_days_before,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "card_last_four": self.card_last_four,
            "minimum_payment_cents": self.minimum_payment_cents,
            "statement_due_day": self.statement_due_day,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
