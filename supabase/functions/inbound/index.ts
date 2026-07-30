// Supabase Edge Function: inbound lead + email notify/confirm via Microsoft Graph
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const FROM = Deno.env.get("ROGUE_FROM_EMAIL") || "01@roguemodern.com";
const NOTIFY_TO = Deno.env.get("ROGUE_NOTIFY_EMAIL") || FROM;
const TENANT = Deno.env.get("AZURE_TENANT_ID") || "";
const CLIENT_ID = Deno.env.get("AZURE_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("AZURE_CLIENT_SECRET") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function graphToken() {
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
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Graph token failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

async function sendMail(
  token: string,
  to: string,
  subject: string,
  html: string,
  text: string,
) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(FROM)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: to } }],
          from: {
            emailAddress: { address: FROM, name: "Mani · Rogue" },
          },
        },
        saveToSentItems: true,
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Send failed (${to}): ${res.status} ${err}`);
  }
  // keep text path available for logs / future multipart
  void text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const payload = await req.json();
    const name = String(payload?.name || "").trim();
    const email = String(payload?.email || "").trim().toLowerCase();
    const honeypot = String(payload?.company || "").trim();
    const userAgent = String(payload?.user_agent || "").slice(0, 280);

    if (honeypot) return json(200, { ok: true }); // silent bot trap

    if (!name || name.length > 120) {
      return json(400, { error: "Enter your name." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return json(400, { error: "Enter a valid email." });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Server not configured." });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { error: insertError } = await supabase.from("leads").insert({
      name,
      email,
      source: "website",
      user_agent: userAgent || null,
    });
    if (insertError) {
      return json(500, { error: insertError.message || "Could not save lead." });
    }

    if (!TENANT || !CLIENT_ID || !CLIENT_SECRET) {
      // Lead saved; mail not wired yet
      return json(200, { ok: true, mailed: false });
    }

    const token = await graphToken();
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);

    await sendMail(
      token,
      NOTIFY_TO,
      `Inbound: ${name}`,
      `<div style="font-family:'Space Grotesk',Segoe UI,Arial,sans-serif;color:#111;font-size:15px;line-height:1.55;">
        <p style="margin:0 0 12px 0;">New inbound from the Rogue site.</p>
        <p style="margin:0 0 6px 0;"><strong>Name</strong><br>${safeName}</p>
        <p style="margin:0 0 6px 0;"><strong>Email</strong><br><a href="mailto:${safeEmail}">${safeEmail}</a></p>
      </div>`,
      `New inbound\nName: ${name}\nEmail: ${email}\n`,
    );

    await sendMail(
      token,
      email,
      "Signal received - Rogue",
      `<div style="font-family:'Space Grotesk',Segoe UI,Arial,sans-serif;color:#111;font-size:15px;line-height:1.55;">
        <p style="margin:0 0 14px 0;">Hi ${safeName},</p>
        <p style="margin:0 0 14px 0;">Got it. Mani from Rogue here - we'll reply to this email shortly.</p>
        <p style="margin:0 0 14px 0;">If anything's urgent, just reply to this message.</p>
        <p style="margin:0;">-<br>Mani<br>Rogue<br>01@roguemodern.com</p>
      </div>`,
      `Hi ${name},\n\nGot it. Mani from Rogue here - we'll reply to this email shortly.\n\n-\nMani\nRogue\n01@roguemodern.com\n`,
    );

    return json(200, { ok: true, mailed: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signal failed.";
    return json(500, { error: message });
  }
});
