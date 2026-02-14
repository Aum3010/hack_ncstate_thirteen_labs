from flask import Blueprint, request, jsonify
from app import db
from app.routes.auth import get_current_user_id
from app.models import DocumentRef
import os
import uuid

documents_bp = Blueprint("documents", __name__)


def backboard_ingest(file_content, file_name, doc_type, api_key):
    """Stub: ingest to Backboard when API key is set. Return backboard_id or None."""
    if not api_key:
        return f"stub-{uuid.uuid4().hex[:12]}"
    try:
        import requests
        url = os.environ.get("BACKBOARD_INGEST_URL", "https://api.backboard.io/v1/documents")
        r = requests.post(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (file_name or "upload", file_content)},
            data={"type": doc_type},
            timeout=30,
        )
        if r.ok:
            data = r.json()
            return data.get("id") or data.get("document_id") or f"bk-{uuid.uuid4().hex[:12]}"
    except Exception:
        pass
    return f"stub-{uuid.uuid4().hex[:12]}"


@documents_bp.route("/", methods=["GET"])
def list_documents():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    refs = DocumentRef.query.filter_by(user_id=uid).order_by(DocumentRef.created_at.desc()).all()
    return jsonify({"documents": [r.to_dict() for r in refs]})


@documents_bp.route("/upload", methods=["POST"])
def upload():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    f = request.files.get("file")
    doc_type = request.form.get("doc_type", "statement")
    if not f or not f.filename:
        return jsonify({"error": "File required"}), 400
    content = f.read()
    api_key = os.environ.get("BACKBOARD_API_KEY", "")
    backboard_id = backboard_ingest(content, f.filename, doc_type, api_key)
    ref = DocumentRef(
        user_id=uid,
        doc_type=doc_type,
        backboard_id=backboard_id,
        file_name=f.filename,
    )
    db.session.add(ref)
    db.session.commit()
    return jsonify(ref.to_dict()), 201
