/**
 * Save personalised Rogue cold emails as Outlook drafts (not sent).
 * Requires Graph Application permission: Mail.ReadWrite (+ admin consent)
 *
 * Usage: node outreach/save-drafts.mjs outreach/outbox/YYYY-MM-DD-drafts.json
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FROM = process.env.ROGUE_FROM_EMAIL || "01@roguemodern.com";
const TENANT = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIGNATURE_HTML = readFileSync(resolve(__dirname, "email-signature.html"), "utf8")
  .replace(/^\uFEFF/, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .trim();

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!TENANT || !CLIENT_ID || !CLIENT_SECRET) {
  fail("Missing Azure env. See outreach/M365-SETUP.md");
}

const path = process.argv[2];
if (!path) fail("Usage: node outreach/save-drafts.mjs <outbox.json>");

const items = JSON.parse(readFileSync(resolve(path), "utf8").replace(/^\uFEFF/, ""));
if (!Array.isArray(items) || items.length === 0) fail("Outbox empty");

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeDashes(text) {
  return String(text)
    .replaceAll("\u2014", "-")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2212", "-");
}

function textToHtmlBody(text) {
  return normalizeDashes(text)
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      let lines = escapeHtml(block).replaceAll("\n", "<br />\n");
      lines = lines.replace(/\bYES\b/g, "<strong>YES</strong>");
      return `<p style="margin:0 0 14px 0;font-family:'Space Grotesk','Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111111;">${lines}</p>`;
    })
    .join("\n");
}

function buildHtml(item) {
  const body = textToHtmlBody(item.bodyText);
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
  </head><body style="margin:0;padding:0;background:#ffffff;">
  <div style="max-width:560px;padding:8px 4px 24px 4px;">${body}
  <div style="height:22px;line-height:22px;font-size:1px;">&nbsp;</div>
  ${SIGNATURE_HTML}</div></body></html>`;
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
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }
  );
  const data = await res.json();
  if (!res.ok) fail(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function createDraft(token, item) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(FROM)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: normalizeDashes(item.subject),
        body: { contentType: "HTML", content: buildHtml(item) },
        toRecipients: [{ emailAddress: { address: item.to } }],
        isDraft: true,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${item.to}: ${res.status} ${err}`);
  }
  return res.json();
}

const token = await getToken();
let n = 0;
for (const item of items.slice(0, 10)) {
  if (!item.to || !item.subject || !item.bodyText) {
    console.warn("Skip incomplete", item);
    continue;
  }
  const draft = await createDraft(token, item);
  n += 1;
  console.log(`Draft ${n}: ${item.business} -> ${item.to} (${draft.id})`);
}
console.log(`Done. ${n} draft(s) in ${FROM} Drafts folder.`);
