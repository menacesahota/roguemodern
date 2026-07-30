/**
 * Send personalised Rogue cold emails via Microsoft Graph (app-only).
 *
 * Required env:
 *   AZURE_TENANT_ID
 *   AZURE_CLIENT_ID
 *   AZURE_CLIENT_SECRET
 *   ROGUE_FROM_EMAIL=01@roguemodern.com
 *
 * Usage:
 *   node outreach/send-graph.mjs outreach/outbox/2026-07-30.json
 *
 * Outbox JSON shape:
 * [
 *   {
 *     "to": "info@example.com",
 *     "subject": "...",
 *     "bodyText": "...",
 *     "business": "Example Ltd"
 *   }
 * ]
 *
 * Hard cap: 10 sends per run. Appends HTML signature automatically.
 */
import { readFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_SENDS = 10;
const FROM = process.env.ROGUE_FROM_EMAIL || "01@roguemodern.com";
const TENANT = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIGNATURE_HTML = readFileSync(
  resolve(__dirname, "email-signature.html"),
  "utf8"
)
  .replace(/^\uFEFF/, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .trim();

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!TENANT || !CLIENT_ID || !CLIENT_SECRET) {
  fail(
    "Missing AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET. See outreach/M365-SETUP.md"
  );
}

const outboxPath = process.argv[2];
if (!outboxPath) fail("Usage: node outreach/send-graph.mjs <outbox.json>");

const absolute = resolve(outboxPath);
const items = JSON.parse(
  readFileSync(absolute, "utf8").replace(/^\uFEFF/, "")
);
if (!Array.isArray(items)) fail("Outbox must be a JSON array");

const batch = items.slice(0, MAX_SENDS);
if (batch.length === 0) fail("Outbox is empty");

function normalizeDashes(text) {
  return String(text)
    .replaceAll("\u2014", "-") // em dash —
    .replaceAll("\u2013", "-") // en dash –
    .replaceAll("\u2212", "-") // minus −
    .replaceAll("\u2010", "-") // hyphen ‐
    .replaceAll("\u2011", "-"); // non-breaking hyphen
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textToHtmlBody(text) {
  const parts = normalizeDashes(text)
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      let lines = escapeHtml(block).replaceAll("\n", "<br />\n");
      // Bold the call-to-action YES (word boundary, case-sensitive as written)
      lines = lines.replace(/\bYES\b/g, "<strong>YES</strong>");
      return `<p style="margin:0 0 14px 0;font-family:'Space Grotesk','Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111111;font-weight:400;">${lines}</p>`;
    })
    .join("\n");
  return parts;
}

function buildHtml(item) {
  const body = item.bodyHtml
    ? normalizeDashes(item.bodyHtml)
    : textToHtmlBody(stripTrailingPlainSignature(item.bodyText));
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
  <!--[if !mso]><!-->
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Space Grotesk','Segoe UI',Arial,Helvetica,sans-serif;color:#111111;">
  <div style="max-width:560px;padding:8px 4px 24px 4px;">
    ${body}
    <div style="height:22px;line-height:22px;font-size:1px;">&nbsp;</div>
    ${SIGNATURE_HTML}
  </div>
</body>
</html>`;
}

function stripTrailingPlainSignature(text) {
  return normalizeDashes(text)
    .replace(/\r\n/g, "\n")
    .replace(/\n*[-—]\s*\n+Mani[\s\S]*$/i, "")
    .trimEnd();
}

async function getToken() {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );
  const data = await res.json();
  if (!res.ok) fail(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function sendMail(token, item) {
  const payload = {
    message: {
      subject: normalizeDashes(item.subject),
      body: {
        contentType: "HTML",
        content: buildHtml(item),
      },
      toRecipients: [
        {
          emailAddress: { address: item.to },
        },
      ],
      from: {
        emailAddress: {
          address: FROM,
          name: "Mani · Rogue",
        },
      },
    },
    saveToSentItems: true,
  };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(FROM)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Send failed for ${item.to}: ${res.status} ${err}`);
  }
}

function logSend(item) {
  const logDir = resolve("outreach/logs");
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const line = [
    new Date().toISOString(),
    item.business || "",
    item.to,
    item.subject.replaceAll(",", " "),
    "sent",
  ].join(",");
  appendFileSync(resolve(logDir, "sends.csv"), line + "\n");
}

const token = await getToken();
let sent = 0;

for (const item of batch) {
  if (!item.to || !item.subject || !(item.bodyText || item.bodyHtml)) {
    console.warn("Skipping incomplete item:", item);
    continue;
  }
  await sendMail(token, item);
  logSend(item);
  sent += 1;
  console.log(`Sent ${sent}/${batch.length}: ${item.to} (${item.business || ""})`);
}

console.log(`Done. Sent ${sent} email(s). Cap is ${MAX_SENDS}.`);
