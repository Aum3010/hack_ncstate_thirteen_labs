"""Solana RPC service: fetch transactions for a wallet address."""
import os
import requests
from datetime import datetime


def _rpc_call(method: str, params: list):
    url = os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    r = requests.post(url, json=payload, timeout=30)
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(data["error"].get("message", "Solana RPC error"))
    return data.get("result")


def get_signatures_for_address(address: str, limit: int = 100):
    """Fetch transaction signatures for a Solana address."""
    params = [address, {"limit": min(limit, 100), "commitment": "confirmed"}]
    return _rpc_call("getSignaturesForAddress", params) or []


def get_transaction(signature: str):
    """Fetch full transaction details with jsonParsed encoding."""
    params = [signature, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}]
    return _rpc_call("getTransaction", params)


VALID_CATEGORIES = frozenset({"investments", "bill_payments", "short_term_goals"})


def _parse_memo_from_tx(tx) -> tuple[str, str] | None:
    """
    Find spl-memo instruction and parse as "category: description".
    Returns (category, description) or None if no valid memo.
    """
    tx_body = tx.get("transaction") or {}
    msg = tx_body.get("message") or {}
    instructions = msg.get("instructions") or []

    def extract_memo_text(instr: dict) -> str | None:
        if instr.get("program") != "spl-memo":
            return None
        parsed = instr.get("parsed")
        if parsed is None:
            return None
        if isinstance(parsed, str):
            return parsed.strip() or None
        if isinstance(parsed, dict):
            memo = parsed.get("memo") or (parsed.get("info") or {}).get("memo")
            if isinstance(memo, str):
                return memo.strip() or None
        return None

    for instr in instructions:
        memo_text = extract_memo_text(instr)
        if not memo_text:
            continue
        if ":" not in memo_text:
            continue
        category, _, desc = memo_text.partition(":")
        category = category.strip().lower()
        desc = desc.strip()
        if category in VALID_CATEGORIES and desc:
            return (category, desc)

    meta = tx.get("meta") or {}
    for inner in meta.get("innerInstructions") or []:
        for instr in inner.get("instructions") or []:
            memo_text = extract_memo_text(instr)
            if not memo_text:
                continue
            if ":" not in memo_text:
                continue
            category, _, desc = memo_text.partition(":")
            category = category.strip().lower()
            desc = desc.strip()
            if category in VALID_CATEGORIES and desc:
                return (category, desc)

    return None


def _sol_to_usd_cents(lamports: int) -> int:
    """Convert lamports to USD cents. Uses SOL_USD_CENTS env or default ~$200/SOL."""
    sol_usd_cents = int(os.environ.get("SOL_USD_CENTS", "20000"))  # 20000 = $200/SOL
    sol_amount = lamports / 1_000_000_000
    return int(sol_amount * sol_usd_cents)


def _parse_tx_balance_delta(tx, address: str) -> tuple[int, str | None]:
    """
    Parse transaction to get net SOL delta for the given address.
    Returns signed (amount_cents, description).
    Positive = received (influx), negative = spent (outflow).
    """
    meta = tx.get("meta")
    if not meta:
        return 0, None
    tx_body = tx.get("transaction") or {}
    msg = tx_body.get("message") or {}
    account_keys = msg.get("accountKeys") or []
    addresses = []
    for ak in account_keys:
        if isinstance(ak, dict):
            addresses.append(ak.get("pubkey", ""))
        else:
            addresses.append(str(ak))
    try:
        idx = addresses.index(address)
    except ValueError:
        return 0, None
    pre = meta.get("preBalances") or []
    post = meta.get("postBalances") or []
    if idx >= len(pre) or idx >= len(post):
        return 0, None
    pre_lamports = int(pre[idx])
    post_lamports = int(post[idx])
    delta_lamports = post_lamports - pre_lamports
    fee = int(meta.get("fee", 0))
    # Outgoing spend (negative amount)
    if delta_lamports < 0:
        spent_lamports = abs(delta_lamports) + (fee if idx == 0 else 0)
        amount_cents = _sol_to_usd_cents(spent_lamports)
        return -amount_cents, "Solana transfer out"
    # Incoming receive (positive amount)
    if delta_lamports > 0:
        received_lamports = delta_lamports
        amount_cents = _sol_to_usd_cents(received_lamports)
        return amount_cents, "Solana transfer in"
    return 0, None


def fetch_and_normalize_transactions(address: str, user_id: int, limit: int = 50):
    """
    Fetch Solana transactions for address and return list of dicts
    suitable for creating Transaction records.
    Only returns outgoing/spent transactions (positive amount_cents).
    """
    from app.models import Transaction

    sigs = get_signatures_for_address(address, limit=limit)
    existing = {
        t.external_id
        for t in Transaction.query.filter_by(user_id=user_id, source="solana").all()
    }
    new_txns = []
    for s in sigs:
        sig = s.get("signature")
        if not sig or sig in existing:
            continue
        if s.get("err"):
            continue
        try:
            tx = get_transaction(sig)
        except Exception:
            continue
        if not tx:
            continue
        amount_cents, desc = _parse_tx_balance_delta(tx, address)
        # Skip no-change entries
        if amount_cents == 0:
            continue
        memo_result = _parse_memo_from_tx(tx)
        if memo_result:
            category, description = memo_result
        else:
            # Default category based on direction
            if amount_cents > 0:
                category = "income"
                description = desc or "Solana transfer in"
            else:
                category = "investments"
                description = desc or "Solana transfer out"
        block_time = tx.get("blockTime")
        dt = datetime.utcfromtimestamp(block_time) if block_time else datetime.utcnow()
        new_txns.append({
            "user_id": user_id,
            "amount_cents": amount_cents,
            "currency": "USD",
            "category": category,
            "description": description,
            "source": "solana",
            "external_id": sig,
            "transaction_at": dt,
        })
        existing.add(sig)
    return new_txns
