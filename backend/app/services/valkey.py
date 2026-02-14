import os

_redis = None


def get_redis():
    global _redis
    if _redis is None:
        try:
            import redis
            url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
            _redis = redis.from_url(url, decode_responses=True)
        except Exception:
            _redis = None
    return _redis


def orderbook_get(symbol="SOL/USDC"):
    r = get_redis()
    if not r:
        return None
    try:
        data = r.get(f"orderbook:{symbol}")
        if data:
            import json
            return json.loads(data)
    except Exception:
        pass
    return None


def orderbook_set(symbol, data):
    r = get_redis()
    if not r:
        return False
    try:
        import json
        r.setex(f"orderbook:{symbol}", 60, json.dumps(data))
        return True
    except Exception:
        return False
