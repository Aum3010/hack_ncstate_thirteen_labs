from flask import Blueprint, request, jsonify
from datetime import date, datetime
from app import db
from app.routes.auth import get_current_user_id
from app.models import DocumentRef, Bill, Transaction
from app.services.invoice_parser import parse_invoice_with_gemini
import os
import uuid
import json

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


@documents_bp.route("/parse-invoice", methods=["POST"])
def parse_invoice():
    """Upload invoice PDF/image, parse with LLM, create Bill and optionally Transaction."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "File required"}), 400
    content = f.read()
    parsed = parse_invoice_with_gemini(content, f.filename)
    if not parsed:
        return jsonify({"error": "Invoice parsing unavailable. Set GEMINI_API_KEY."}), 503
    amount_raw = parsed.get("amount")
    amount_cents = int(round(float(amount_raw or 0) * 100)) if amount_raw is not None else 0
    due_date_str = parsed.get("due_date")
    due_date = None
    if due_date_str:
        try:
            due_date = date.fromisoformat(due_date_str)
        except Exception:
            pass
    merchant = (parsed.get("merchant") or "Invoice").strip() or "Invoice"
    bill = Bill(
        user_id=uid,
        bill_type="invoice",
        name=merchant,
        amount_cents=amount_cents,
        currency="USD",
        due_date=due_date,
        is_recurring=False,
    )
    db.session.add(bill)
    db.session.flush()
    txn = Transaction(
        user_id=uid,
        amount_cents=amount_cents,
        currency="USD",
        category="bill_payments",
        description=f"Invoice: {merchant}",
        source="invoice_parsed",
    )
    db.session.add(txn)
    ref = DocumentRef(
        user_id=uid,
        doc_type="invoice",
        file_name=f.filename,
        metadata_json=json.dumps({"bill_id": bill.id, "parsed": parsed}),
    )
    db.session.add(ref)
    db.session.commit()
    return jsonify({
        "bill": bill.to_dict(),
        "transaction": txn.to_dict(),
        "document_ref": ref.to_dict(),
    }), 201
