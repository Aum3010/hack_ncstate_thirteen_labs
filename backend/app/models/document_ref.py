from app import db
from datetime import datetime


class DocumentRef(db.Model):
    __tablename__ = "document_refs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    doc_type = db.Column(db.String(32), nullable=False)
    backboard_id = db.Column(db.String(255), nullable=True, index=True)
    file_name = db.Column(db.String(255), nullable=True)
    metadata_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "doc_type": self.doc_type,
            "backboard_id": self.backboard_id,
            "file_name": self.file_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
