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
 * Hard cap: 10 sends per run.
 */
import { readFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const MAX_SENDS = 10;
const FROM = process.env.ROGUE_FROM_EMAIL || "01@roguemodern.com";
const TENANT = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

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
const items = JSON.parse(readFileSync(absolute, "utf8"));
if (!Array.isArray(items)) fail("Outbox must be a JSON array");

const batch = items.slice(0, MAX_SENDS);
if (batch.length === 0) fail("Outbox is empty");

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
      subject: item.subject,
      body: {
        contentType: "Text",
        content: item.bodyText,
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
  if (!item.to || !item.subject || !item.bodyText) {
    console.warn("Skipping incomplete item:", item);
    continue;
  }
  await sendMail(token, item);
  logSend(item);
  sent += 1;
  console.log(`Sent ${sent}/${batch.length}: ${item.to} (${item.business || ""})`);
}

console.log(`Done. Sent ${sent} email(s). Cap is ${MAX_SENDS}.`);
