from app import db
from datetime import datetime


class Goal(db.Model):
    __tablename__ = "goals"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    target_cents = db.Column(db.BigInteger, nullable=False)
    saved_cents = db.Column(db.BigInteger, default=0)
    category = db.Column(db.String(64), default="short_term")
    deadline = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "target_cents": self.target_cents,
            "target": self.target_cents / 100,
            "saved_cents": self.saved_cents,
            "saved": self.saved_cents / 100,
            "category": self.category,
            "deadline": self.deadline.isoformat() if self.deadline else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
