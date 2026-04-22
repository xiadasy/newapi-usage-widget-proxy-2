// ============================================================
// NewAPI 用量挂件（中转版：读 GitHub raw JSON）
//
// 你只需要改 DATA_URL
// ============================================================

const DATA_URL = "https://raw.githubusercontent.com/<你的用户名>/<你的仓库名>/main/data/widget_data.json";

const TIMEOUT_SECONDS = 15;

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function renderNumber(n) {
  const x = num(n);
  if (Math.abs(x) >= 1e9) return (x / 1e9).toFixed(2) + "B";
  if (Math.abs(x) >= 1e6) return (x / 1e6).toFixed(2) + "M";
  if (Math.abs(x) >= 1e3) return (x / 1e3).toFixed(1) + "K";
  return String(Math.round(x));
}

function getDisplayConfig(statusObj) {
  return {
    quotaPerUnit: num(statusObj?.quota_per_unit, 500000),
    type: statusObj?.quota_display_type || "USD",
    usdRate: num(statusObj?.usd_exchange_rate, 1),
    customRate: num(statusObj?.custom_currency_exchange_rate, 1),
    customSymbol: statusObj?.custom_currency_symbol || "¤"
  };
}

function formatQuota(quota, cfg, digits = 2) {
  const q = num(quota);
  if (cfg.type === "TOKENS") {
    return renderNumber(q) + " Tokens";
  }

  const quotaPerUnit = cfg.quotaPerUnit > 0 ? cfg.quotaPerUnit : 500000;
  const usd = q / quotaPerUnit;

  if (cfg.type === "CNY") {
    return "¥" + (usd * cfg.usdRate).toFixed(digits);
  }

  if (cfg.type === "CUSTOM") {
    return cfg.customSymbol + (usd * cfg.customRate).toFixed(digits);
  }

  return "$" + usd.toFixed(digits);
}

function colorForRatio(ratio) {
  if (ratio <= 0.1) return new Color("#ff453a");
  if (ratio <= 0.2) return new Color("#ff9f0a");
  return new Color("#30d158");
}

function drawBar(widget, ratio, color, width, height) {
  const bg = widget.addStack();
  bg.size = new Size(width, height);
  bg.cornerRadius = height / 2;
  bg.backgroundColor = new Color("#ffffff", 0.12);
  bg.layoutHorizontally();

  const fill = bg.addStack();
  const safeRatio = Math.max(0, Math.min(1, ratio));
  const fillWidth = Math.max(height, Math.min(width, width * safeRatio));
  fill.size = new Size(fillWidth, height);
  fill.cornerRadius = height / 2;
  fill.backgroundColor = color;
}

function lineKV(parent, label, value, strong = false) {
  const row = parent.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  const l = row.addText(label);
  l.font = Font.systemFont(11);
  l.textColor = new Color("#9ca3af");

  row.addSpacer();

  const v = row.addText(value);
  v.font = strong ? Font.semiboldSystemFont(12) : Font.systemFont(11);
  v.textColor = new Color("#f9fafb");
}

async function fetchData() {
  const req = new Request(DATA_URL + "?t=" + Date.now());
  req.method = "GET";
  req.timeoutInterval = TIMEOUT_SECONDS;
  req.headers = { "Accept": "application/json", "Cache-Control": "no-store" };
  return await req.loadJSON();
}

async function buildWidget(j) {
  const family = config.widgetFamily || "medium";
  const cfg = getDisplayConfig(j?.status);

  const total = num(j?.usage?.total_granted, 0);
  const used = num(j?.usage?.total_used, 0);
  const remaining = num(j?.usage?.total_available, Math.max(0, total - used));
  const unlimited = !!j?.usage?.unlimited_quota;

  const today = num(j?.stats?.today_quota, 0);
  const month = num(j?.stats?.month_quota, 0);

  const ratio = unlimited ? 1 : (total > 0 ? remaining / total : 0);
  const mainColor = unlimited ? new Color("#60a5fa") : colorForRatio(ratio);

  const w = new ListWidget();
  w.backgroundColor = new Color("#111827");
  w.setPadding(14, 14, 14, 14);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  w.url = "scriptable:///run/" + encodeURIComponent(Script.name());

  const top = w.addStack();
  top.layoutHorizontally();
  top.centerAlignContent();

  const title = top.addText("NewAPI · 用量");
  title.font = Font.semiboldSystemFont(12);
  title.textColor = new Color("#9ca3af");

  top.addSpacer();
  const badge = top.addText(unlimited ? "无限" : ((ratio * 100).toFixed(0) + "%"));
  badge.font = Font.mediumSystemFont(11);
  badge.textColor = mainColor;

  w.addSpacer(8);

  const mainText = w.addText(unlimited ? "∞" : formatQuota(remaining, cfg));
  mainText.font = Font.boldSystemFont(family === "small" ? 24 : 30);
  mainText.textColor = mainColor;

  const sub = w.addText(unlimited ? `已用 ${formatQuota(used, cfg)}` : `剩余 / 总量 ${formatQuota(total, cfg)}`);
  sub.font = Font.systemFont(11);
  sub.textColor = new Color("#9ca3af");

  w.addSpacer(8);
  drawBar(w, ratio, mainColor, family === "small" ? 140 : family === "large" ? 320 : 290, 6);
  w.addSpacer(10);

  if (family === "small") {
    const s1 = w.addText(`总 ${formatQuota(total, cfg)} · 已用 ${formatQuota(used, cfg)}`);
    s1.font = Font.systemFont(10);
    s1.textColor = new Color("#d1d5db");

    const s2 = w.addText(`今日 ${formatQuota(today, cfg)} · 本月 ${formatQuota(month, cfg)}`);
    s2.font = Font.systemFont(10);
    s2.textColor = new Color("#9ca3af");
  } else {
    lineKV(w, "总额度", formatQuota(total, cfg), true);
    w.addSpacer(4);
    lineKV(w, "已用额度", formatQuota(used, cfg));
    w.addSpacer(4);
    lineKV(w, "剩余额度", unlimited ? "∞" : formatQuota(remaining, cfg));
    w.addSpacer(4);
    lineKV(w, "今日使用", formatQuota(today, cfg));
    w.addSpacer(4);
    lineKV(w, "本月使用", formatQuota(month, cfg));
  }

  w.addSpacer();
  const updatedAt = j?.updated_at ? String(j.updated_at).replace('T',' ').replace('Z','') : "";
  const ts = w.addText("更新 " + (updatedAt || new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })));
  ts.font = Font.systemFont(9);
  ts.textColor = new Color("#6b7280");
  ts.rightAlignText();

  return w;
}

function errorWidget(msg) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#111827");
  w.setPadding(14, 14, 14, 14);
  w.refreshAfterDate = new Date(Date.now() + 10 * 60 * 1000);

  const t = w.addText("❌ NewAPI 用量");
  t.font = Font.boldSystemFont(14);
  t.textColor = new Color("#ef4444");
  w.addSpacer(6);

  const m = w.addText(String(msg || "请求失败").slice(0, 200));
  m.font = Font.systemFont(10);
  m.textColor = new Color("#9ca3af");

  w.addSpacer();
  const tip = w.addText("请检查 DATA_URL 是否为 raw.githubusercontent.com 链接");
  tip.font = Font.systemFont(9);
  tip.textColor = new Color("#6b7280");
  return w;
}

async function main() {
  let widget;
  try {
    if (!DATA_URL.includes("raw.githubusercontent.com")) {
      throw new Error("DATA_URL 还没改成你的 GitHub raw 地址");
    }
    const j = await fetchData();
    widget = await buildWidget(j);
  } catch (e) {
    widget = errorWidget(e.message || String(e));
  }

  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else {
    const fam = args.widgetParameter || "medium";
    if (fam === "small") await widget.presentSmall();
    else if (fam === "large") await widget.presentLarge();
    else await widget.presentMedium();
  }
  Script.complete();
}

await main();
