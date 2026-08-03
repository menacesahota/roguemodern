import { isContactConfigured, submitLead } from "./contact.js";

const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());

const nav = document.querySelector(".nav");
const hero = document.querySelector(".hero");
function syncNav() {
  if (!nav || !hero) return;
  const past = window.scrollY > hero.offsetHeight - 80;
  nav.classList.toggle("is-solid", past);
}
syncNav();
window.addEventListener("scroll", syncNav, { passive: true });
window.addEventListener("resize", syncNav);

/* —— Hero field (subtle drifting nodes) —— */
const canvas = document.getElementById("hero-field");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canvas && !reduceMotion) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0;
  let h = 0;
  let nodes = [];
  let raf = 0;
  let t0 = performance.now();

  function resize() {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(18, Math.floor((w * h) / 48000));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: 1 + Math.random() * 1.6,
    }));
  }

  function frame(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);

    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -20) n.x = w + 20;
      if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20;
      if (n.y > h + 20) n.y = -20;
    }

    ctx.strokeStyle = "rgba(243,244,241,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 140 * 140) {
          const alpha = 1 - Math.sqrt(d2) / 140;
          ctx.globalAlpha = alpha * 0.55;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    for (const n of nodes) {
      const pulse = 0.55 + Math.sin(t * 1.4 + n.x * 0.01) * 0.25;
      ctx.fillStyle = `rgba(200,240,106,${0.35 * pulse})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(243,244,241,0.55)";
      ctx.beginPath();
      ctx.arc(n.x, n.y, Math.max(0.7, n.r * 0.45), 0, Math.PI * 2);
      ctx.fill();
    }

    raf = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  raf = requestAnimationFrame(frame);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
    }
  });
}

/* —— Scroll reveals —— */
const revealEls = document.querySelectorAll(
  ".stance-text, .stance-points, .section-head, .system, .steps li, .proof-grid > div, .start-copy, .start-form, .faq-list details"
);
revealEls.forEach((el) => el.classList.add("reveal"));

if (!reduceMotion && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("is-in"));
}

/* —— Inbound form —— */
const form = document.getElementById("inbound-form");
const statusEl = document.getElementById("inbound-status");
const submitBtn = document.getElementById("inbound-submit");

if (form && statusEl && submitBtn) {
  if (!isContactConfigured()) {
    statusEl.textContent = "signal offline";
    statusEl.classList.add("is-err");
    submitBtn.disabled = true;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const honeypot = form.elements.namedItem("company");
    if (honeypot && String(honeypot.value || "").trim()) {
      statusEl.textContent = "signal locked";
      statusEl.classList.remove("is-err");
      statusEl.classList.add("is-ok");
      form.reset();
      return;
    }

    const name = document.getElementById("inbound-name").value;
    const email = document.getElementById("inbound-email").value;

    submitBtn.disabled = true;
    statusEl.textContent = "sending…";
    statusEl.classList.remove("is-ok", "is-err");

    try {
      await submitLead({ name, email });
      form.reset();
      statusEl.textContent = "signal received - check your email";
      statusEl.classList.add("is-ok");
    } catch (err) {
      statusEl.textContent = err?.message || "signal failed";
      statusEl.classList.add("is-err");
    } finally {
      submitBtn.disabled = !isContactConfigured();
    }
  });
}
