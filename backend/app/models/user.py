from app import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=True, index=True)
    username = db.Column(db.String(80), unique=True, nullable=True, index=True)
    password_hash = db.Column(db.String(255), nullable=True)
    presage_user_id = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    wallets = db.relationship("Wallet", backref="user", lazy="dynamic", foreign_keys="Wallet.user_id")
    transactions = db.relationship("Transaction", backref="user", lazy="dynamic")
    bills = db.relationship("Bill", backref="user", lazy="dynamic")
    document_refs = db.relationship("DocumentRef", backref="user", lazy="dynamic")

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "has_wallet": any(w.address for w in self.wallets),
            "has_presage": bool(self.presage_user_id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
