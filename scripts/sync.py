import os, json, datetime, ssl
import urllib.request

BASE_URL = (os.environ.get("NEWAPI_BASE_URL") or "https://api.chshapi.cn").strip().rstrip("/")
API_KEY = os.environ.get("NEWAPI_API_KEY", "").strip()
VERIFY_TLS = os.environ.get("VERIFY_TLS", "true").lower() not in ("0", "false", "no")

if not API_KEY:
    raise SystemExit("Missing NEWAPI_API_KEY secret")

def normalize_token(k: str) -> str:
    s = (k or "").strip()
    if s.lower().startswith("bearer "):
        s = s.split(None, 1)[1]
    if s.startswith("sk-"):
        s = s[3:]
    # Some deployments append suffix like -iphone; server uses the first segment
    if "-" in s:
        s = s.split("-", 1)[0]
    return s

TOKEN = normalize_token(API_KEY)

ctx = ssl.create_default_context()
if not VERIFY_TLS:
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

UA = "Mozilla/5.0 (compatible; newapi-widget-sync/1.0)"

def get_json(path: str, auth: bool = False):
    url = BASE_URL + path
    req = urllib.request.Request(url, method="GET")
    req.add_header("User-Agent", UA)
    req.add_header("Accept", "application/json")
    req.add_header("Cache-Control", "no-store")
    if auth:
        req.add_header("Authorization", f"Bearer {TOKEN}")
    with urllib.request.urlopen(req, context=ctx, timeout=25) as resp:
        data = resp.read().decode("utf-8", "ignore")
    return json.loads(data)


def sum_log_quota(logs, start_ts: int) -> int:
    s = 0
    for item in logs or []:
        try:
            created_at = int(item.get("created_at", 0))
            log_type = int(item.get("type", 0))
            quota = int(item.get("quota", 0))
        except Exception:
            continue
        if created_at >= start_ts and log_type == 2 and quota > 0:
            s += quota
    return s


def main():
    status = get_json("/api/status", auth=False)
    usage = get_json("/api/usage/token", auth=True)
    logs = get_json("/api/log/token", auth=True)

    if not (isinstance(usage, dict) and usage.get("code") is True and isinstance(usage.get("data"), dict)):
        raise SystemExit(f"usage unexpected: {usage}")
    if not (isinstance(logs, dict) and logs.get("success") is True and isinstance(logs.get("data"), list)):
        raise SystemExit(f"logs unexpected: {logs}")

    now = datetime.datetime.utcnow()
    today = datetime.datetime(now.year, now.month, now.day)
    month = datetime.datetime(now.year, now.month, 1)
    today_ts = int(today.timestamp())
    month_ts = int(month.timestamp())

    today_quota = sum_log_quota(logs["data"], today_ts)
    month_quota = sum_log_quota(logs["data"], month_ts)

    out = {
        "updated_at": now.replace(microsecond=0).isoformat() + "Z",
        "base_url": BASE_URL,
        "status": status.get("data") if isinstance(status, dict) else {},
        "usage": {
            "total_granted": int(usage["data"].get("total_granted", 0)),
            "total_used": int(usage["data"].get("total_used", 0)),
            "total_available": int(usage["data"].get("total_available", 0)),
            "unlimited_quota": bool(usage["data"].get("unlimited_quota", False)),
            "expires_at": int(usage["data"].get("expires_at", 0))
        },
        "stats": {
            "today_quota": int(today_quota),
            "month_quota": int(month_quota)
        }
    }

    os.makedirs("data", exist_ok=True)
    with open("data/widget_data.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
