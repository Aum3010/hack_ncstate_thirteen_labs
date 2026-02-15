"""Build user financial snapshot and ingest to Backboard for memory/RAG."""
import json
import logging
import os
import uuid
from datetime import datetime, timedelta

from app.services.user_context import get_user_financial_history

logger = logging.getLogger(__name__)

# Limits for snapshot size (plan: trim to last 90 days or 500 transactions)
MAX_TRANSACTIONS = 500
SNAPSHOT_DAYS = 90


def build_user_financial_snapshot(user_id: int) -> dict:
    """
    Load from DB: user partition_config, last N transactions (all sources),
    unpaid bills, goals, linked wallets. Return JSON-serializable structure.
    """
    from app.models import User, Transaction, Bill, Goal, Wallet

    user = User.query.get(user_id)
    if not user:
        return {}

    now = datetime.utcnow()
    cutoff = now - timedelta(days=SNAPSHOT_DAYS)

    transactions = (
        Transaction.query.filter(
            Transaction.user_id == user_id,
            Transaction.transaction_at >= cutoff,
        )
        .order_by(Transaction.transaction_at.desc())
        .limit(MAX_TRANSACTIONS)
        .all()
    )
    bills = Bill.query.filter_by(user_id=user_id).filter(Bill.paid_at.is_(None)).all()
    goals = Goal.query.filter_by(user_id=user_id).all()
    wallets = Wallet.query.filter_by(user_id=user_id).all()

    total_spend_cents = sum(abs(t.amount_cents) for t in transactions if t.amount_cents < 0)
    bill_total_cents = sum(b.amount_cents for b in bills)
    goal_target_cents = sum(g.target_cents for g in goals)
    goal_saved_cents = sum(g.saved_cents for g in goals)

    return {
        "user_id": user_id,
        "partition_config": user.get_partition_config(),
        "summary": {
            "total_spend_cents": total_spend_cents,
            "total_spend_dollars": round(total_spend_cents / 100, 2),
            "unpaid_bills_cents": bill_total_cents,
            "unpaid_bills_dollars": round(bill_total_cents / 100, 2),
            "goals_count": len(goals),
            "goal_target_cents": goal_target_cents,
            "goal_saved_cents": goal_saved_cents,
            "wallets_count": len(wallets),
            "snapshot_at": now.isoformat(),
        },
        "transactions": [t.to_dict() for t in transactions],
        "bills": [b.to_dict() for b in bills],
        "goals": [g.to_dict() for g in goals],
        "wallets": [w.to_dict() for w in wallets],
    }


def build_solana_snapshot(user_id: int) -> dict:
    """
    For each linked Solana wallet, fetch recent signatures and optionally
    full tx details; return a readable summary for ingest.
    """
    from app.models import Wallet
    from app.services.solana import get_signatures_for_address, get_transaction

    wallets = Wallet.query.filter_by(user_id=user_id, chain="solana").all()
    if not wallets:
        return {"user_id": user_id, "wallets": [], "recent_activity": []}

    recent_activity = []
    for w in wallets:
        try:
            sigs = get_signatures_for_address(w.address, limit=20)
        except Exception:
            sigs = []
        for s in sigs[:10]:
            sig = s.get("signature")
            if not sig or s.get("err"):
                continue
            block_time = s.get("blockTime")
            dt = (
                datetime.utcfromtimestamp(block_time).isoformat()
                if block_time
                else None
            )
            recent_activity.append({
                "wallet_address": w.address[:8] + "…",
                "signature": sig[:16] + "…",
                "block_time": dt,
            })

    return {
        "user_id": user_id,
        "wallets": [{"address": w.address[:8] + "…", "label": w.label} for w in wallets],
        "recent_activity": recent_activity,
    }


def ingest_user_context_to_backboard(user_id: int, api_key: str) -> str | None:
    """
    Serialize user financial snapshot + Solana summary to JSON, POST to
    Backboard documents API, store backboard_id in document_refs.
    Returns backboard_id or None on failure.
    """
    if not api_key:
        return None

    snapshot = build_user_financial_snapshot(user_id)
    solana = build_solana_snapshot(user_id)
    user_financial_history = get_user_financial_history(user_id)
    payload = {
        "financial_snapshot": snapshot,
        "solana_summary": solana,
        "user_financial_history": user_financial_history,
    }
    content = json.dumps(payload, default=str)
    file_name = f"user_financial_snapshot_{user_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.json"

    try:
        import requests

        url = os.environ.get(
            "BACKBOARD_INGEST_URL", "https://api.backboard.io/v1/documents"
        )
        # Backboard may accept user_id in form data for scoping; include if supported
        data = {"type": "user_financial_snapshot", "user_id": str(user_id)}
        r = requests.post(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (file_name, content.encode("utf-8"), "application/json")},
            data=data,
            timeout=30,
        )
        if not r.ok:
            logger.warning(
                "Backboard ingest failed: status=%s url=%s body=%s",
                r.status_code,
                url,
                (r.text or "")[:500],
            )
            return None
        resp = r.json()
        backboard_id = resp.get("id") or resp.get("document_id") or f"bk-{uuid.uuid4().hex[:12]}"
    except Exception as e:
        logger.warning("Backboard ingest error: %s", e, exc_info=True)
        return None

    # Persist ref in document_refs so we can track ingest
    from app import db
    from app.models import DocumentRef

    ref = DocumentRef(
        user_id=user_id,
        doc_type="user_financial_snapshot",
        backboard_id=backboard_id,
        file_name=file_name,
        metadata_json=json.dumps({"ingested_at": datetime.utcnow().isoformat()}),
    )
    db.session.add(ref)
    db.session.commit()
    return backboard_id
