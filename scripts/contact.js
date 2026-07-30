const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export function isContactConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function submitLead({ name, email }) {
  if (!isContactConfigured()) {
    throw new Error("Signal offline - Supabase is not configured.");
  }

  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!cleanName || cleanName.length > 120) {
    throw new Error("Enter your name.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Enter a valid email.");
  }

  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/leads`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      name: cleanName,
      email: cleanEmail,
      source: "website",
      user_agent: navigator.userAgent?.slice(0, 280) || null,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Signal failed (${res.status}).`);
  }
}
