import { isContactConfigured, submitLead } from "./contact.js";

const canvas = document.getElementById("web");
const ctx = canvas.getContext("2d");
const nodesRoot = document.getElementById("nodes");
const panel = document.getElementById("panel");
const panelClose = document.getElementById("panel-close");
const panelKicker = document.getElementById("panel-kicker");
const panelTitle = document.getElementById("panel-title");
const panelBody = document.getElementById("panel-body");
const panelMeta = document.getElementById("panel-meta");
const panelLinks = document.getElementById("panel-links");
const metaId = document.getElementById("meta-id");
const metaLoad = document.getElementById("meta-load");
const metaLinks = document.getElementById("meta-links");
const readout = document.getElementById("readout");
const readoutCoords = document.getElementById("readout-coords");
const readoutNear = document.getElementById("readout-near");
const readoutDist = document.getElementById("readout-dist");
const statNodes = document.getElementById("stat-nodes");
const statStatus = document.getElementById("stat-status");
const statClock = document.getElementById("stat-clock");
const statTraffic = document.getElementById("stat-traffic");
const coreSub = document.getElementById("core-sub");
const toast = document.getElementById("toast");
const muteBtn = document.getElementById("mute");
const bootLine = document.getElementById("boot-line");
const bootBar = document.getElementById("boot-bar");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const NODE_DATA = [
  {
    label: "sites",
    id: "n.04",
    kicker: "surface",
    title: "Websites",
    body: "Strip the clutter. Build something that feels alive and easy to run.",
    links: ["voice", "flare", "craft"],
    load: 0.62,
  },
  {
    label: "flow",
    id: "n.11",
    kicker: "systems",
    title: "Automation",
    body: "Quotes, follow-ups, handoffs — moving without you chasing them.",
    links: ["inbox", "orbit", "pulse"],
    load: 0.78,
  },
  {
    label: "signal",
    id: "n.07",
    kicker: "media",
    title: "AI media",
    body: "Images, posts, presence. A rhythm instead of a scramble.",
    links: ["voice", "sites", "flare"],
    load: 0.54,
  },
  {
    label: "inbox",
    id: "n.02",
    kicker: "ops",
    title: "Quiet ops",
    body: "Turn noise into a calm loop. Less tab-hopping. More done.",
    links: ["flow", "memory", "orbit"],
    load: 0.71,
  },
  {
    label: "voice",
    id: "n.09",
    kicker: "brand",
    title: "Tone",
    body: "Sound like yourselves — just sharper, clearer, current.",
    links: ["sites", "signal", "craft"],
    load: 0.41,
  },
  {
    label: "memory",
    id: "n.15",
    kicker: "data",
    title: "Memory",
    body: "Keep what matters searchable. Stop rebuilding from scratch.",
    links: ["inbox", "orbit", "flow"],
    load: 0.49,
  },
  {
    label: "craft",
    id: "n.03",
    kicker: "make",
    title: "Craft",
    body: "Not templates. Actual care in the details people feel.",
    links: ["sites", "voice", "flare"],
    load: 0.58,
  },
  {
    label: "orbit",
    id: "n.12",
    kicker: "connect",
    title: "Orbit",
    body: "Wire the pieces so nothing important floats alone.",
    links: ["flow", "inbox", "memory"],
    load: 0.66,
  },
  {
    label: "flare",
    id: "n.01",
    kicker: "launch",
    title: "Launch",
    body: "Go live without the usual ceremony of fear.",
    links: ["sites", "signal", "craft"],
    load: 0.37,
  },
  {
    label: "pulse",
    id: "n.18",
    kicker: "always-on",
    title: "Pulse",
    body: "Small systems that keep working after the call ends.",
    links: ["flow", "orbit", "inbox"],
    load: 0.83,
  },
];

const audio = {
  ctx: null,
  muted: false,
  unlocked: false,
};

const state = {
  w: 0,
  h: 0,
  dpr: 1,
  nodes: [],
  packets: [],
  ambient: [],
  t: 0,
  selected: -1,
  hovered: -1,
  traffic: 0,
  boot: 0,
  ready: false,
  parallax: { x: 0, y: 0, tx: 0, ty: 0 },
  mouse: { x: 0, y: 0, active: false },
  chromeTimer: null,
  drag: {
    index: -1,
    pointerId: null,
    moved: false,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
  },
};

function pad(n, size = 2) {
  return String(Math.floor(n)).padStart(size, "0");
}

function ensureAudio() {
  if (audio.ctx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audio.ctx = new Ctx();
}

function tone(freq, dur = 0.08, type = "sine", gain = 0.03) {
  if (audio.muted || reduceMotion) return;
  ensureAudio();
  if (!audio.ctx) return;
  if (audio.ctx.state === "suspended") audio.ctx.resume();

  const t0 = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const g = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(audio.ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function play(kind) {
  switch (kind) {
    case "hover":
      tone(640, 0.05, "sine", 0.015);
      break;
    case "click":
      tone(420, 0.07, "triangle", 0.03);
      tone(840, 0.05, "sine", 0.012);
      break;
    case "drag":
      tone(180, 0.09, "sine", 0.02);
      break;
    case "open":
      tone(520, 0.1, "triangle", 0.028);
      tone(780, 0.12, "sine", 0.018);
      break;
    case "boot":
      tone(220, 0.12, "sine", 0.02);
      break;
    default:
      break;
  }
}

function showToast(message) {
  toast.hidden = false;
  toast.textContent = message;
  toast.classList.add("is-on");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => {
    toast.classList.remove("is-on");
  }, 2200);
}

function revealChrome() {
  document.body.classList.add("is-chrome");
  window.clearTimeout(state.chromeTimer);
  state.chromeTimer = window.setTimeout(() => {
    if (state.selected < 0 && state.drag.index < 0) {
      document.body.classList.remove("is-chrome");
    }
  }, 2200);
}

function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.w = window.innerWidth;
  state.h = window.innerHeight;
  canvas.width = Math.floor(state.w * state.dpr);
  canvas.height = Math.floor(state.h * state.dpr);
  canvas.style.width = `${state.w}px`;
  canvas.style.height = `${state.h}px`;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  buildNodes();
  seedAmbient();
}

function seedAmbient() {
  state.ambient = [];
  const labeled = labeledNodes();
  for (let i = 0; i < 18; i++) {
    const from = Math.floor(Math.random() * labeled.length);
    let to = Math.floor(Math.random() * labeled.length);
    if (to === from) to = (to + 1) % labeled.length;
    state.ambient.push({
      from,
      to,
      progress: Math.random(),
      speed: 0.08 + Math.random() * 0.12,
      viaCore: Math.random() > 0.55,
    });
  }
}

function buildNodes() {
  const cx = state.w / 2;
  const cy = state.h / 2;
  const spread = Math.min(state.w, state.h) * (state.w < 720 ? 0.34 : 0.4);
  const prevSelected = state.selected >= 0 ? state.nodes[state.selected]?.label : null;

  nodesRoot.innerHTML = "";
  state.nodes = [];

  // Asymmetric constellation — not a ring
  const LAYOUT = [
    { x: -0.62, y: -0.18 },
    { x: -0.28, y: -0.48 },
    { x: 0.18, y: -0.55 },
    { x: 0.58, y: -0.32 },
    { x: 0.72, y: 0.08 },
    { x: 0.42, y: 0.42 },
    { x: -0.05, y: 0.52 },
    { x: -0.48, y: 0.38 },
    { x: -0.72, y: 0.05 },
    { x: 0.08, y: 0.08 },
  ];

  NODE_DATA.forEach((data, i) => {
    const slot = LAYOUT[i % LAYOUT.length];
    const jitter = ((i * 17) % 7) * 0.01;
    const x = cx + (slot.x + jitter) * spread * (state.w / Math.min(state.w, state.h)) * 0.85;
    const y = cy + (slot.y - jitter * 0.6) * spread;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "node";
    el.style.transitionDelay = `${0.05 + i * 0.04}s`;
    el.innerHTML = `
      <span class="node-dot" aria-hidden="true"></span>
      <span class="node-copy">
        <span class="node-id">${data.id}</span>
        <span>${data.label}</span>
      </span>
    `;

    el.addEventListener("pointerenter", () => {
      if (!state.ready) return;
      state.hovered = i;
      play("hover");
      updateStatus();
    });
    el.addEventListener("pointerleave", () => {
      if (state.hovered === i && state.drag.index !== i) {
        state.hovered = -1;
        updateStatus();
      }
    });
    el.addEventListener("focus", () => {
      state.hovered = i;
      updateStatus();
    });
    el.addEventListener("blur", () => {
      if (state.hovered === i) {
        state.hovered = -1;
        updateStatus();
      }
    });
    el.addEventListener("pointerdown", (e) => {
      if (!state.ready || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      ensureAudio();
      const node = state.nodes[i];
      state.drag.index = i;
      state.drag.pointerId = e.pointerId;
      state.drag.moved = false;
      state.drag.startX = e.clientX;
      state.drag.startY = e.clientY;
      state.drag.offsetX = e.clientX - node.x;
      state.drag.offsetY = e.clientY - node.y;
      state.hovered = i;
      node.vx = 0;
      node.vy = 0;
      pinHome(node);
      el.classList.add("is-dragging");
      el.setPointerCapture(e.pointerId);
      play("drag");
      revealChrome();
      updateStatus();
    });
    el.addEventListener("pointermove", (e) => {
      if (state.drag.index !== i || state.drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - state.drag.startX;
      const dy = e.clientY - state.drag.startY;
      if (Math.hypot(dx, dy) > 6) state.drag.moved = true;
      else return;

      const node = state.nodes[i];
      const padN = 28;
      node.x = Math.min(state.w - padN, Math.max(padN, e.clientX - state.drag.offsetX));
      node.y = Math.min(state.h - padN, Math.max(padN, e.clientY - state.drag.offsetY));
      node.vx = 0;
      node.vy = 0;
      syncNodeElements();
    });
    el.addEventListener("pointerup", (e) => {
      if (state.drag.index !== i || state.drag.pointerId !== e.pointerId) return;
      finishDrag(i, !state.drag.moved);
    });
    el.addEventListener("pointercancel", (e) => {
      if (state.drag.index !== i || state.drag.pointerId !== e.pointerId) return;
      finishDrag(i, false);
    });

    nodesRoot.appendChild(el);

    state.nodes.push({
      ...data,
      el,
      homeX: x,
      homeY: y,
      x,
      y,
      vx: 0,
      vy: 0,
      phase: i * 0.7,
      size: 3.2,
      pulse: 0.3 + (i % 4) * 0.15,
      ghost: false,
      index: i,
    });
  });

  // Scattered field points — cloud, not a ring
  const extras = 40;
  for (let i = 0; i < extras; i++) {
    const seed = i * 127.1;
    const rx = ((Math.sin(seed) * 0.5 + 0.5) * 2 - 1) * spread * 1.15;
    const ry = ((Math.cos(seed * 1.3) * 0.5 + 0.5) * 2 - 1) * spread * 0.9;
    // Keep a soft hole around the core word
    const distCore = Math.hypot(rx, ry);
    const scale = distCore < spread * 0.22 ? 1.8 : 1;
    const x = cx + rx * scale * (0.55 + ((i * 13) % 10) / 20);
    const y = cy + ry * scale * (0.55 + ((i * 7) % 10) / 20);
    state.nodes.push({
      label: "",
      id: "",
      el: null,
      homeX: x,
      homeY: y,
      x,
      y,
      vx: 0,
      vy: 0,
      phase: i * 0.45,
      size: 1 + (i % 4) * 0.45,
      pulse: 0.2 + (i % 5) * 0.1,
      ghost: true,
      index: NODE_DATA.length + i,
    });
  }

  state.selected = prevSelected
    ? state.nodes.findIndex((n) => n.label === prevSelected)
    : -1;

  if (state.selected >= 0) {
    state.nodes[state.selected].el?.classList.add("is-active");
  }

  statNodes.textContent = `${pad(NODE_DATA.length)} live`;
  syncNodeElements();
}

function pinHome(node) {
  node.homeX = node.x;
  node.homeY = node.y;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function labeledNodes() {
  return state.nodes.filter((n) => !n.ghost);
}

function findByLabel(label) {
  return state.nodes.findIndex((n) => n.label === label);
}

function focusIndex() {
  if (state.drag.index >= 0) return state.drag.index;
  if (state.selected >= 0) return state.selected;
  if (state.hovered >= 0) return state.hovered;
  return -1;
}

function finishDrag(index, shouldOpen) {
  const node = state.nodes[index];
  if (node) {
    pinHome(node);
    node.el?.classList.remove("is-dragging");
  }
  state.drag.index = -1;
  state.drag.pointerId = null;
  updateStatus();
  if (shouldOpen) openNode(index);
}

function openNode(index) {
  const node = state.nodes[index];
  if (!node || node.ghost) return;

  node.vx = 0;
  node.vy = 0;
  pinHome(node);

  state.nodes.forEach((n) => n.el?.classList.remove("is-active"));
  state.selected = index;
  node.el.classList.add("is-active");

  panelKicker.textContent = `${node.kicker} · ${node.id}`;
  panelTitle.textContent = node.title;
  panelBody.textContent = node.body;
  metaId.textContent = node.id;
  metaLoad.textContent = `${Math.round(node.load * 100)}%`;
  metaLinks.textContent = String(node.links.length);
  panelLinks.textContent = `linked · ${node.links.join(" / ")}`;
  panelMeta.hidden = false;
  panelLinks.hidden = false;
  panel.classList.add("is-open");

  for (let i = 0; i < 5; i++) {
    state.packets.push({
      from: index,
      progress: -i * 0.12,
      speed: 0.4 + Math.random() * 0.25,
    });
  }

  play("open");
  revealChrome();
  updateStatus();
}

function closePanel() {
  state.nodes.forEach((n) => n.el?.classList.remove("is-active"));
  state.selected = -1;
  panel.classList.remove("is-open");
  panelKicker.textContent = "select a node";
  panelTitle.textContent = "The web";
  panelBody.textContent = "Everything Rogue touches lives out here. Drag a point. Open one.";
  panelMeta.hidden = true;
  panelLinks.hidden = true;
  state.packets = [];
  updateStatus();
}

function updateStatus() {
  if (!state.ready) {
    statStatus.textContent = "booting";
    coreSub.textContent = "sys.web // booting";
    return;
  }
  if (state.drag.index >= 0) {
    const n = state.nodes[state.drag.index];
    statStatus.textContent = `dragging · ${n.label}`;
    coreSub.textContent = `sys.web // reshape · ${n.id}`;
  } else if (state.selected >= 0) {
    const n = state.nodes[state.selected];
    statStatus.textContent = `inspect · ${n.label}`;
    coreSub.textContent = `sys.web // ${n.id} · linked`;
  } else if (state.hovered >= 0) {
    const n = state.nodes[state.hovered];
    statStatus.textContent = `focus · ${n.label}`;
    coreSub.textContent = `sys.web // ${n.id}`;
  } else {
    statStatus.textContent = "idle · listening";
    coreSub.textContent = "sys.web // active";
  }
}

function syncNodeElements() {
  const px = state.parallax.x;
  const py = state.parallax.y;
  for (const node of state.nodes) {
    if (!node.el) continue;
    const depth = 0.45;
    node.el.style.transform = `translate(${node.x - 12 + px * depth}px, ${node.y + py * depth}px) translateY(-50%)`;
  }
}

function nearestLabeled(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const node of labeledNodes()) {
    const d = Math.hypot(node.x - x, node.y - y);
    if (d < bestD) {
      bestD = d;
      best = node;
    }
  }
  return { node: best, d: bestD };
}

function updateReadout() {
  if (!state.mouse.active || !state.ready) {
    readout.classList.remove("is-on");
    return;
  }
  readout.classList.add("is-on");
  readoutCoords.textContent = `x ${pad(state.mouse.x, 3)} · y ${pad(state.mouse.y, 3)}`;
  const near = nearestLabeled(state.mouse.x, state.mouse.y);
  if (near.node) {
    readoutNear.textContent = `nearest ${near.node.label}`;
    readoutDist.textContent = `dist ${Math.round(near.d)}`;
  }
}

function update(dt) {
  const cx = state.w / 2;
  const cy = state.h / 2;

  state.parallax.x += (state.parallax.tx - state.parallax.x) * 0.06;
  state.parallax.y += (state.parallax.ty - state.parallax.y) * 0.06;

  if (!state.ready) {
    state.boot = Math.min(1, state.boot + dt * (reduceMotion ? 2.5 : 0.45));
    bootBar.style.width = `${Math.round(state.boot * 100)}%`;
    if (state.boot > 0.25) bootLine.textContent = "mapping field…";
    if (state.boot > 0.55) bootLine.textContent = "linking nodes…";
    if (state.boot > 0.8) bootLine.textContent = "online";
    if (state.boot >= 1) finishBoot();
  }

  const holding = state.hovered >= 0 || state.selected >= 0 || state.drag.index >= 0;
  state.t += reduceMotion || !state.ready ? 0 : holding ? dt * 0.1 : dt * 0.42;

  for (let i = 0; i < state.nodes.length; i++) {
    const node = state.nodes[i];
    const locked =
      i === state.drag.index ||
      (!node.ghost && (i === state.selected || i === state.hovered));

    if (locked) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }

    if (!state.ready) continue;

    // Drift in place around each node's home — no orbital ring
    const amp = node.ghost ? 7 : 3.5;
    const targetX =
      node.homeX + Math.sin(state.t * 0.55 + node.phase) * amp * (node.ghost ? 1.4 : 1);
    const targetY =
      node.homeY + Math.cos(state.t * 0.42 + node.phase * 1.1) * amp * (node.ghost ? 1.2 : 1);

    const spring = node.ghost ? 0.02 : 0.012;
    node.vx += (targetX - node.x) * spring;
    node.vy += (targetY - node.y) * spring;

    if (state.mouse.active && state.drag.index < 0) {
      const dx = state.mouse.x - node.x;
      const dy = state.mouse.y - node.y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = node.ghost ? 140 : 170;
      if (d < reach) {
        const force = (1 - d / reach) * (node.ghost ? 1.1 : 0.75);
        node.vx += (dx / d) * force;
        node.vy += (dy / d) * force;
      }
    }

    if (state.drag.index >= 0) {
      const dragged = state.nodes[state.drag.index];
      const dx = dragged.x - node.x;
      const dy = dragged.y - node.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 180) {
        const force = (1 - d / 180) * 0.55;
        node.vx += (dx / d) * force;
        node.vy += (dy / d) * force;
      }
    }

    node.vx *= 0.88;
    node.vy *= 0.88;
    node.x += node.vx;
    node.y += node.vy;

    const edge = 20;
    node.x = Math.min(state.w - edge, Math.max(edge, node.x));
    node.y = Math.min(state.h - edge, Math.max(edge, node.y));
  }

  state.packets = state.packets.filter((p) => {
    p.progress += p.speed * dt;
    return p.progress < 1.05;
  });

  let traffic = state.packets.length * 0.2;
  if (state.ready) {
    for (const p of state.ambient) {
      p.progress += p.speed * dt;
      if (p.progress > 1) {
        p.progress = 0;
        const labeled = labeledNodes();
        p.from = Math.floor(Math.random() * labeled.length);
        p.to = Math.floor(Math.random() * labeled.length);
        p.viaCore = Math.random() > 0.55;
      }
      traffic += 0.04;
    }
  }
  state.traffic += (traffic - state.traffic) * 0.05;
  statTraffic.textContent = `traffic ${state.traffic.toFixed(1)}`;

  syncNodeElements();
  updateReadout();
}

function finishBoot() {
  if (state.ready) return;
  state.ready = true;
  document.body.classList.remove("is-booting");
  document.body.classList.add("is-ready");
  play("boot");
  revealChrome();
  updateStatus();
}

function drawGrid(cx, cy, px, py) {
  ctx.save();
  ctx.translate(px * 0.15, py * 0.15);
  ctx.strokeStyle = "rgba(17, 17, 17, 0.035)";
  ctx.lineWidth = 1;
  const step = 48;
  for (let x = (cx % step) - step; x < state.w + step; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, -step);
    ctx.lineTo(x, state.h + step);
    ctx.stroke();
  }
  for (let y = (cy % step) - step; y < state.h + step; y += step) {
    ctx.beginPath();
    ctx.moveTo(-step, y);
    ctx.lineTo(state.w + step, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGuides(cx, cy, px, py) {
  ctx.save();
  ctx.translate(px * 0.25, py * 0.25);
  const base = Math.min(state.w, state.h);
  const boot = Math.min(1, state.boot * 1.15);

  // Fractured arcs — constellation scaffolding, not oval rings
  const arcs = [
    { r: base * 0.18, a0: -0.9, a1: 0.7 },
    { r: base * 0.28, a0: 1.1, a1: 2.8 },
    { r: base * 0.38, a0: -2.4, a1: -0.5 },
    { r: base * 0.48, a0: 0.2, a1: 1.6 },
    { r: base * 0.33, a0: 3.0, a1: 4.4 },
  ];

  for (const arc of arcs) {
    const r = arc.r * (0.4 + boot * 0.6);
    const sweep = (arc.a1 - arc.a0) * boot;
    ctx.beginPath();
    ctx.arc(cx, cy, r, arc.a0, arc.a0 + sweep);
    ctx.strokeStyle = "rgba(17, 17, 17, 0.07)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // End caps
    const x0 = cx + Math.cos(arc.a0) * r;
    const y0 = cy + Math.sin(arc.a0) * r;
    const x1 = cx + Math.cos(arc.a0 + sweep) * r;
    const y1 = cy + Math.sin(arc.a0 + sweep) * r;
    ctx.beginPath();
    ctx.arc(x0, y0, 1.5, 0, Math.PI * 2);
    ctx.arc(x1, y1, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(17, 17, 17, 0.12)";
    ctx.fill();
  }

  // Soft axis ticks through the field
  ctx.strokeStyle = "rgba(17, 17, 17, 0.045)";
  ctx.beginPath();
  ctx.moveTo(cx - base * 0.42 * boot, cy);
  ctx.lineTo(cx + base * 0.42 * boot, cy);
  ctx.moveTo(cx, cy - base * 0.3 * boot);
  ctx.lineTo(cx, cy + base * 0.3 * boot);
  ctx.stroke();

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, state.w, state.h);
  const cx = state.w / 2;
  const cy = state.h / 2;
  const px = state.parallax.x;
  const py = state.parallax.y;

  drawGrid(cx, cy, px, py);

  const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, Math.min(state.w, state.h) * 0.42);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.04)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, state.w, state.h);

  drawGuides(cx, cy, px, py);

  if (!state.ready && state.boot < 0.35) return;

  const focus = focusIndex();
  const focusNode = focus >= 0 ? state.nodes[focus] : null;
  const linkDist = Math.min(state.w, state.h) * 0.2;
  const ghostParallax = 0.55;

  if (focusNode && !focusNode.ghost) {
    for (const label of focusNode.links) {
      const idx = findByLabel(label);
      if (idx < 0) continue;
      const other = state.nodes[idx];
      ctx.beginPath();
      ctx.moveTo(focusNode.x + px * 0.45, focusNode.y + py * 0.45);
      ctx.lineTo(other.x + px * 0.45, other.y + py * 0.45);
      ctx.strokeStyle = "rgba(17, 17, 17, 0.3)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  for (let i = 0; i < state.nodes.length; i++) {
    for (let j = i + 1; j < state.nodes.length; j++) {
      const a = state.nodes[i];
      const b = state.nodes[j];
      const d = dist(a, b);
      if (d > linkDist) continue;
      const active = focus >= 0 && (i === focus || j === focus);
      const dim = focus >= 0 && !active ? 0.06 : 0.16;
      const alpha = (1 - d / linkDist) * (active ? 0.42 : dim);
      const ap = a.ghost ? ghostParallax : 0.45;
      const bp = b.ghost ? ghostParallax : 0.45;
      ctx.beginPath();
      ctx.moveTo(a.x + px * ap, a.y + py * ap);
      ctx.lineTo(b.x + px * bp, b.y + py * bp);
      ctx.strokeStyle = `rgba(17, 17, 17, ${alpha})`;
      ctx.lineWidth = active ? 1.2 : 1;
      ctx.stroke();
    }
  }

  for (let i = 0; i < state.nodes.length; i++) {
    const node = state.nodes[i];
    const d = dist(node, { x: cx, y: cy });
    const max = Math.min(state.w, state.h) * 0.45;
    if (d > max) continue;
    const active = i === focus;
    const alpha = (1 - d / max) * (node.ghost ? 0.045 : active ? 0.3 : focus >= 0 ? 0.05 : 0.11);
    const depth = node.ghost ? ghostParallax : 0.45;
    ctx.beginPath();
    ctx.moveTo(cx + px * 0.2, cy + py * 0.2);
    ctx.lineTo(node.x + px * depth, node.y + py * depth);
    ctx.strokeStyle = `rgba(17, 17, 17, ${alpha})`;
    ctx.lineWidth = active ? 1.5 : node.ghost ? 0.6 : 1;
    ctx.stroke();
  }

  for (const node of state.nodes) {
    if (!node.ghost) continue;
    const glow = 0.4 + Math.sin(state.t * 1.8 + node.phase) * 0.2;
    ctx.beginPath();
    ctx.arc(node.x + px * ghostParallax, node.y + py * ghostParallax, node.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(17, 17, 17, ${(focus >= 0 ? 0.08 : 0.16) + glow * 0.1})`;
    ctx.fill();
  }

  const labeled = labeledNodes();
  if (state.ready) {
    for (const p of state.ambient) {
      const a = labeled[p.from];
      const b = labeled[p.to];
      if (!a || !b) continue;
      let x;
      let y;
      if (p.viaCore) {
        if (p.progress < 0.5) {
          const t = p.progress / 0.5;
          x = a.x + (cx - a.x) * t;
          y = a.y + (cy - a.y) * t;
        } else {
          const t = (p.progress - 0.5) / 0.5;
          x = cx + (b.x - cx) * t;
          y = cy + (b.y - cy) * t;
        }
      } else {
        x = a.x + (b.x - a.x) * p.progress;
        y = a.y + (b.y - a.y) * p.progress;
      }
      ctx.beginPath();
      ctx.arc(x + px * 0.35, y + py * 0.35, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(17, 17, 17, ${focus >= 0 ? 0.18 : 0.35})`;
      ctx.fill();
    }
  }

  for (const packet of state.packets) {
    if (packet.progress < 0 || packet.progress > 1) continue;
    const node = state.nodes[packet.from];
    if (!node) continue;
    const x = node.x + (cx - node.x) * packet.progress;
    const y = node.y + (cy - node.y) * packet.progress;
    ctx.beginPath();
    ctx.arc(x + px * 0.35, y + py * 0.35, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(17, 17, 17, 0.85)";
    ctx.fill();
  }

  if (state.mouse.active && state.ready) {
    const mx = state.mouse.x;
    const my = state.mouse.y;
    ctx.strokeStyle = "rgba(17, 17, 17, 0.12)";
    ctx.beginPath();
    ctx.moveTo(mx - 10, my);
    ctx.lineTo(mx + 10, my);
    ctx.moveTo(mx, my - 10);
    ctx.lineTo(mx, my + 10);
    ctx.stroke();
  }
}

function tickClock() {
  const now = new Date();
  statClock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);

window.addEventListener("pointermove", (e) => {
  state.mouse.x = e.clientX;
  state.mouse.y = e.clientY;
  state.mouse.active = true;
  state.parallax.tx = (e.clientX / state.w - 0.5) * 28;
  state.parallax.ty = (e.clientY / state.h - 0.5) * 20;

  const nearEdge = e.clientY < 72 || e.clientY > state.h - 72;
  if (nearEdge) revealChrome();
});

window.addEventListener("pointerleave", () => {
  state.mouse.active = false;
  state.parallax.tx = 0;
  state.parallax.ty = 0;
});

document.addEventListener("click", (e) => {
  ensureAudio();
  if (
    e.target.closest(".node") ||
    e.target.closest(".panel") ||
    e.target.closest(".inbound") ||
    e.target.closest(".mute")
  ) {
    return;
  }
  if (state.selected >= 0) closePanel();
});

panelClose.addEventListener("click", closePanel);

muteBtn.addEventListener("click", () => {
  audio.muted = !audio.muted;
  muteBtn.setAttribute("aria-pressed", String(audio.muted));
  muteBtn.textContent = audio.muted ? "sound off" : "sound on";
  if (!audio.muted) play("click");
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePanel();
});

const inboundForm = document.getElementById("inbound-form");
const inboundStatus = document.getElementById("inbound-status");
const inboundSubmit = document.getElementById("inbound-submit");

if (inboundForm) {
  if (!isContactConfigured()) {
    inboundStatus.textContent = "signal offline";
    inboundStatus.classList.add("is-err");
    inboundSubmit.disabled = true;
  }

  inboundForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    ensureAudio();

    const honeypot = inboundForm.elements.namedItem("company");
    if (honeypot && String(honeypot.value || "").trim()) {
      inboundStatus.textContent = "signal locked";
      inboundStatus.classList.remove("is-err");
      inboundStatus.classList.add("is-ok");
      inboundForm.reset();
      return;
    }

    const name = document.getElementById("inbound-name").value;
    const email = document.getElementById("inbound-email").value;

    inboundSubmit.disabled = true;
    inboundStatus.textContent = "sending…";
    inboundStatus.classList.remove("is-ok", "is-err");

    try {
      await submitLead({ name, email });
      play("click");
      inboundForm.reset();
      inboundStatus.textContent = "signal received";
      inboundStatus.classList.add("is-ok");
      showToast("inbound locked - we'll reply by email");
    } catch (err) {
      inboundStatus.textContent = err?.message || "signal failed";
      inboundStatus.classList.add("is-err");
    } finally {
      inboundSubmit.disabled = !isContactConfigured();
    }
  });
}

resize();
tickClock();
setInterval(tickClock, 1000);
updateStatus();
requestAnimationFrame(frame);
