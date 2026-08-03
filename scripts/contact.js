const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export function isContactConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function submitLead({ name, email, source = "website" }) {
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

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/inbound`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: cleanName,
      email: cleanEmail,
      source,
      user_agent: navigator.userAgent?.slice(0, 280) || null,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Signal failed (${res.status}).`);
  }
}
