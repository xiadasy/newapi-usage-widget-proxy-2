# NewAPI 用量挂件（中转版）

目标：解决 Scriptable 直连 `api.chshapi.cn` 出现 TLS/令牌识别问题。

方案：用 GitHub Actions 在云端定时拉取 NewAPI 统计数据 → 写入仓库 `data/widget_data.json` → Scriptable 挂件只读取 raw JSON。

## 你会得到什么
- 一个 GitHub 仓库（Actions 每 15 分钟更新一次 JSON）
- 一个 Scriptable 挂件脚本（只请求 GitHub raw，不再直连 NewAPI）

## GitHub Actions 需要的 Secrets / Variables
### Secrets
- `NEWAPI_API_KEY`：你的 `sk-...` key

### Variables（可不填）
- `NEWAPI_BASE_URL`：默认 `https://api.chshapi.cn`
- `VERIFY_TLS`：默认 `true`；如果 Actions 里也握手失败，可改 `false`

## JSON 输出字段
`data/widget_data.json` 示例：
```json
{
  "updated_at": "2026-04-22T12:00:00Z",
  "base_url": "https://api.chshapi.cn",
  "status": { "quota_per_unit": 500000, "quota_display_type": "USD", "usd_exchange_rate": 1, "custom_currency_exchange_rate": 1, "custom_currency_symbol": "¤" },
  "usage": { "total_granted": 0, "total_used": 0, "total_available": 0, "unlimited_quota": false, "expires_at": 0 },
  "stats": { "today_quota": 0, "month_quota": 0 }
}
```

## Scriptable 挂件
- 把 `DATA_URL` 改成你仓库 raw 地址即可。

> 你把 repo 建好后，把 raw 链接发我，我可以帮你把挂件脚本里的 DATA_URL 直接改好。
