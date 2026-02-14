from app import db
from datetime import datetime


class Card(db.Model):
    __tablename__ = "cards"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    last_four = db.Column(db.String(4), nullable=False)
    label = db.Column(db.String(128), nullable=True)
    statement_due_day = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "last_four": self.last_four,
            "label": self.label,
            "statement_due_day": self.statement_due_day,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
