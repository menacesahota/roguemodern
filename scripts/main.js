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

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* —— Brain node network (hero) —— */
const brainCanvas = document.getElementById("brain-canvas");

if (brainCanvas) {
  const ctx = brainCanvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0;
  let h = 0;
  let nodes = [];
  let links = [];
  let pulses = [];
  let raf = 0;
  let t0 = performance.now();

  // Normalised brain silhouette anchors (two lobes)
  const anchors = [
    [0.22, 0.38], [0.18, 0.28], [0.2, 0.18], [0.28, 0.12], [0.38, 0.1],
    [0.46, 0.16], [0.5, 0.28], [0.54, 0.16], [0.62, 0.1], [0.72, 0.12],
    [0.8, 0.18], [0.82, 0.28], [0.78, 0.38], [0.84, 0.48], [0.8, 0.58],
    [0.74, 0.68], [0.66, 0.76], [0.58, 0.82], [0.5, 0.78], [0.42, 0.82],
    [0.34, 0.76], [0.26, 0.68], [0.2, 0.58], [0.16, 0.48],
    [0.3, 0.32], [0.36, 0.24], [0.42, 0.34], [0.34, 0.44], [0.28, 0.52],
    [0.36, 0.58], [0.44, 0.5], [0.42, 0.66], [0.34, 0.7],
    [0.7, 0.32], [0.64, 0.24], [0.58, 0.34], [0.66, 0.44], [0.72, 0.52],
    [0.64, 0.58], [0.56, 0.5], [0.58, 0.66], [0.66, 0.7],
    [0.5, 0.42], [0.48, 0.54], [0.52, 0.54], [0.5, 0.64],
  ];

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function build() {
    nodes = anchors.map(([nx, ny], i) => {
      const jitter = 0.012;
      return {
        id: i,
        bx: nx + (Math.random() - 0.5) * jitter,
        by: ny + (Math.random() - 0.5) * jitter,
        ox: (Math.random() - 0.5) * Math.PI * 2,
        oy: (Math.random() - 0.5) * Math.PI * 2,
        amp: 3 + Math.random() * 5,
        r: 1.6 + Math.random() * 1.8,
        x: 0,
        y: 0,
      };
    });

    links = [];
    for (let i = 0; i < nodes.length; i++) {
      const candidates = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(nodes[i].bx - nodes[j].bx, nodes[i].by - nodes[j].by);
        if (d < 0.22) candidates.push({ j, d });
      }
      candidates.sort((a, b) => a.d - b.d);
      for (const c of candidates.slice(0, 3)) {
        const a = Math.min(i, c.j);
        const b = Math.max(i, c.j);
        if (!links.some((l) => l.a === a && l.b === b)) {
          links.push({ a, b });
        }
      }
    }

    pulses = Array.from({ length: 6 }, () => ({
      link: Math.floor(Math.random() * links.length),
      t: Math.random(),
      speed: 0.18 + Math.random() * 0.28,
    }));
  }

  function resize() {
    w = brainCanvas.clientWidth;
    h = brainCanvas.clientHeight;
    brainCanvas.width = Math.floor(w * dpr);
    brainCanvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function place(t) {
    const padX = w * 0.06;
    const padY = h * 0.08;
    const bw = w - padX * 2;
    const bh = h - padY * 2;
    for (const n of nodes) {
      const drift = reduceMotion ? 0 : 1;
      n.x = padX + n.bx * bw + Math.sin(t * 0.9 + n.ox) * n.amp * drift;
      n.y = padY + n.by * bh + Math.cos(t * 0.8 + n.oy) * n.amp * 0.85 * drift;
    }
  }

  function frame(now) {
    const t = (now - t0) / 1000;
    place(t);
    ctx.clearRect(0, 0, w, h);

    // Soft lobe glow
    const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.45, w * 0.42);
    g.addColorStop(0, "rgba(200,240,106,0.07)");
    g.addColorStop(1, "rgba(200,240,106,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.lineWidth = 1;
    for (const link of links) {
      const a = nodes[link.a];
      const b = nodes[link.b];
      const d = dist(a, b);
      const alpha = Math.max(0.08, 0.42 - d / 280);
      ctx.strokeStyle = `rgba(243,244,241,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    if (!reduceMotion) {
      for (const p of pulses) {
        p.t += p.speed * 0.016;
        if (p.t > 1) {
          p.t = 0;
          p.link = Math.floor(Math.random() * links.length);
          p.speed = 0.18 + Math.random() * 0.28;
        }
        const link = links[p.link];
        if (!link) continue;
        const a = nodes[link.a];
        const b = nodes[link.b];
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        ctx.fillStyle = "rgba(200,240,106,0.95)";
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(200,240,106,0.2)";
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const n of nodes) {
      const pulse = reduceMotion ? 0.7 : 0.55 + Math.sin(t * 1.6 + n.ox) * 0.35;
      ctx.fillStyle = `rgba(200,240,106,${0.25 * pulse})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(243,244,241,${0.55 + pulse * 0.35})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!reduceMotion) raf = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", () => {
    resize();
    if (reduceMotion) frame(performance.now());
  });

  if (reduceMotion) {
    frame(performance.now());
  } else {
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
}

/* —— Scroll reveals —— */
const revealEls = document.querySelectorAll(
  ".stance-text, .stance-points, .section-head, .system, .steps li, .proof-grid > div, .start-copy, .start-form, .connect-copy, .connect-panel, .faq-list details"
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

/* —— Subscribe form —— */
const subForm = document.getElementById("subscribe-form");
const subStatus = document.getElementById("subscribe-status");
const subSubmit = document.getElementById("subscribe-submit");

if (subForm && subStatus && subSubmit) {
  if (!isContactConfigured()) {
    subStatus.textContent = "signal offline";
    subStatus.classList.add("is-err");
    subSubmit.disabled = true;
  }

  subForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const honeypot = subForm.elements.namedItem("company");
    if (honeypot && String(honeypot.value || "").trim()) {
      subStatus.textContent = "subscribed";
      subStatus.classList.remove("is-err");
      subStatus.classList.add("is-ok");
      subForm.reset();
      return;
    }

    const email = document.getElementById("subscribe-email").value;
    const local = String(email || "").split("@")[0] || "Subscriber";

    subSubmit.disabled = true;
    subStatus.textContent = "sending…";
    subStatus.classList.remove("is-ok", "is-err");

    try {
      await submitLead({ name: `Subscribe · ${local}`, email });
      subForm.reset();
      subStatus.textContent = "you're on the list";
      subStatus.classList.add("is-ok");
    } catch (err) {
      subStatus.textContent = err?.message || "subscribe failed";
      subStatus.classList.add("is-err");
    } finally {
      subSubmit.disabled = !isContactConfigured();
    }
  });
}
