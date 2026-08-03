import { isContactConfigured, submitLead } from "./contact.js";

const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* —— Nav —— */
const nav = document.getElementById("nav");
const hero = document.querySelector(".hero");
const navMenu = document.getElementById("nav-menu");
const navDrawer = document.getElementById("nav-drawer");

function syncNav() {
  if (!nav || !hero) return;
  nav.classList.toggle("is-solid", window.scrollY > hero.offsetHeight - 88);
}

function closeDrawer() {
  if (!navDrawer || !navMenu) return;
  navDrawer.hidden = true;
  navDrawer.classList.remove("is-open");
  navMenu.setAttribute("aria-expanded", "false");
  document.body.classList.remove("nav-open");
}

function openDrawer() {
  if (!navDrawer || !navMenu) return;
  navDrawer.hidden = false;
  navDrawer.classList.add("is-open");
  navMenu.setAttribute("aria-expanded", "true");
  document.body.classList.add("nav-open");
}

closeDrawer();

syncNav();
window.addEventListener("scroll", syncNav, { passive: true });
window.addEventListener("resize", () => {
  syncNav();
  if (window.matchMedia("(min-width: 901px)").matches) closeDrawer();
});

if (navMenu && navDrawer) {
  navMenu.addEventListener("click", () => {
    if (navDrawer.hidden) openDrawer();
    else closeDrawer();
  });
  navDrawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeDrawer));
}

/* —— Brain network —— */
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

  function inBrain(x, y) {
    const left = ((x - 0.37) / 0.3) ** 2 + ((y - 0.44) / 0.36) ** 2 <= 1;
    const right = ((x - 0.63) / 0.3) ** 2 + ((y - 0.44) / 0.36) ** 2 <= 1;
    const bridge = ((x - 0.5) / 0.12) ** 2 + ((y - 0.42) / 0.28) ** 2 <= 1;
    const stem = ((x - 0.5) / 0.13) ** 2 + ((y - 0.78) / 0.15) ** 2 <= 1;
    const notch = ((x - 0.5) / 0.05) ** 2 + ((y - 0.14) / 0.08) ** 2 <= 1;
    return (left || right || bridge || stem) && !notch;
  }

  function sampleBrain(count) {
    const pts = [];
    let guard = 0;
    while (pts.length < count && guard < count * 40) {
      guard += 1;
      const x = 0.12 + Math.random() * 0.76;
      const y = 0.1 + Math.random() * 0.78;
      if (!inBrain(x, y)) continue;
      if (pts.some((p) => Math.hypot(p[0] - x, p[1] - y) < 0.045)) continue;
      pts.push([x, y]);
    }

    // densify outline ring
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      for (let r = 0.28; r <= 0.42; r += 0.04) {
        const x = 0.5 + Math.cos(a) * r * (0.85 + 0.2 * Math.cos(a * 2));
        const y = 0.46 + Math.sin(a) * r * 0.95;
        if (inBrain(x, y)) pts.push([x, y]);
      }
    }
    return pts;
  }

  function build() {
    const anchors = sampleBrain(56);
    nodes = anchors.map(([nx, ny], i) => ({
      id: i,
      bx: nx,
      by: ny,
      ox: Math.random() * Math.PI * 2,
      oy: Math.random() * Math.PI * 2,
      amp: 2.2 + Math.random() * 3.8,
      r: 1.4 + Math.random() * 1.7,
      x: 0,
      y: 0,
      hub: Math.random() > 0.82,
    }));

    links = [];
    for (let i = 0; i < nodes.length; i++) {
      const near = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(nodes[i].bx - nodes[j].bx, nodes[i].by - nodes[j].by);
        if (d < 0.18) near.push({ j, d });
      }
      near.sort((a, b) => a.d - b.d);
      for (const c of near.slice(0, nodes[i].hub ? 5 : 3)) {
        const a = Math.min(i, c.j);
        const b = Math.max(i, c.j);
        if (!links.some((l) => l.a === a && l.b === b)) links.push({ a, b, d: c.d });
      }
    }

    pulses = Array.from({ length: 9 }, () => ({
      link: Math.floor(Math.random() * links.length),
      t: Math.random(),
      speed: 0.22 + Math.random() * 0.35,
    }));
  }

  function resize() {
    w = brainCanvas.clientWidth;
    h = brainCanvas.clientHeight;
    if (w < 2 || h < 2) return;
    brainCanvas.width = Math.floor(w * dpr);
    brainCanvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function place(t) {
    const padX = w * 0.04;
    const padY = h * 0.02;
    const bw = w - padX * 2;
    const bh = h - padY * 2 - 18;
    const drift = reduceMotion ? 0 : 1;
    for (const n of nodes) {
      n.x = padX + n.bx * bw + Math.sin(t * 0.85 + n.ox) * n.amp * drift;
      n.y = padY + n.by * bh + Math.cos(t * 0.75 + n.oy) * n.amp * 0.8 * drift;
    }
  }

  function frame(now) {
    const t = (now - t0) / 1000;
    place(t);
    ctx.clearRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(w * 0.5, h * 0.42, 8, w * 0.5, h * 0.42, w * 0.48);
    glow.addColorStop(0, "rgba(200,240,106,0.1)");
    glow.addColorStop(0.55, "rgba(200,240,106,0.03)");
    glow.addColorStop(1, "rgba(200,240,106,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    for (const link of links) {
      const a = nodes[link.a];
      const b = nodes[link.b];
      const alpha = Math.max(0.05, 0.38 - link.d * 1.4);
      ctx.strokeStyle = `rgba(242,243,239,${alpha})`;
      ctx.lineWidth = link.d < 0.08 ? 1.15 : 0.85;
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
          p.speed = 0.22 + Math.random() * 0.35;
        }
        const link = links[p.link];
        if (!link) continue;
        const a = nodes[link.a];
        const b = nodes[link.b];
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        const trail = ctx.createRadialGradient(x, y, 0, x, y, 8);
        trail.addColorStop(0, "rgba(200,240,106,0.95)");
        trail.addColorStop(1, "rgba(200,240,106,0)");
        ctx.fillStyle = trail;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f7ffe8";
        ctx.beginPath();
        ctx.arc(x, y, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const n of nodes) {
      const pulse = reduceMotion ? 0.7 : 0.55 + Math.sin(t * 1.55 + n.ox) * 0.35;
      if (n.hub) {
        ctx.fillStyle = `rgba(200,240,106,${0.16 * pulse})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(200,240,106,${0.22 * pulse})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(242,243,239,${0.58 + pulse * 0.32})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.hub ? n.r * 1.15 : n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!reduceMotion) raf = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", () => {
    resize();
    if (reduceMotion) frame(performance.now());
  });

  if (reduceMotion) frame(performance.now());
  else {
    raf = requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else {
        t0 = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
  }
}

/* —— Scroll reveals —— */
const revealEls = document.querySelectorAll(
  ".stance-text, .stance-points li, .section-head, .system, .steps li, .proof-item, .proof-trades, .start-copy, .start-form, .connect-copy, .connect-panel, .faq-list details"
);
revealEls.forEach((el, i) => {
  el.classList.add("reveal");
  el.style.transitionDelay = `${Math.min(i % 4, 3) * 0.06}s`;
});

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
    { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("is-in"));
}

/* —— Forms —— */
function wireForm({ form, status, submit, getPayload }) {
  if (!form || !status || !submit) return;

  if (!isContactConfigured()) {
    status.textContent = "signal offline";
    status.classList.add("is-err");
    submit.disabled = true;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const honeypot = form.elements.namedItem("company");
    if (honeypot && String(honeypot.value || "").trim()) {
      status.textContent = "signal locked";
      status.classList.remove("is-err");
      status.classList.add("is-ok");
      form.reset();
      return;
    }

    submit.disabled = true;
    status.textContent = "sending…";
    status.classList.remove("is-ok", "is-err");

    try {
      await submitLead(getPayload());
      form.reset();
      status.textContent = form.id === "subscribe-form" ? "you're on the list" : "signal received - check your email";
      status.classList.add("is-ok");
    } catch (err) {
      status.textContent = err?.message || "signal failed";
      status.classList.add("is-err");
    } finally {
      submit.disabled = !isContactConfigured();
    }
  });
}

wireForm({
  form: document.getElementById("inbound-form"),
  status: document.getElementById("inbound-status"),
  submit: document.getElementById("inbound-submit"),
  getPayload: () => ({
    name: document.getElementById("inbound-name").value,
    email: document.getElementById("inbound-email").value,
    source: "website",
  }),
});

wireForm({
  form: document.getElementById("subscribe-form"),
  status: document.getElementById("subscribe-status"),
  submit: document.getElementById("subscribe-submit"),
  getPayload: () => {
    const email = document.getElementById("subscribe-email").value;
    const local = String(email || "").split("@")[0] || "Subscriber";
    return {
      name: `Subscribe · ${local}`,
      email,
      source: "subscribe",
    };
  },
});
