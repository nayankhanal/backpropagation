// Backpropagation scrollytelling — dark "neural lab" build.
// The SVG network is re-rendered per scroll step from a config table.

const SVG = "http://www.w3.org/2000/svg";
const svg = document.getElementById("net");

const W = 70;
const SH = 26;

const NODES = {
  n6: { cx: 200, cy: 130, num: 6, yLabel: "y_output", xLabel: "x6" },
  n4: { cx: 120, cy: 380, num: 4, yLabel: "y4", xLabel: "x4" },
  n5: { cx: 300, cy: 380, num: 5, yLabel: "y5", xLabel: "x5" },
  n2: { cx: 120, cy: 630, num: 2, yLabel: "y2", xLabel: "x2" },
  n3: { cx: 300, cy: 630, num: 3, yLabel: "y3", xLabel: "x3" },
  n1: { cx: 200, cy: 880, num: 1, yLabel: "y1", xLabel: "x_input" },
};

const EDGES = [
  { from: "n1", to: "n2", label: "w12" },
  { from: "n1", to: "n3", label: "w13" },
  { from: "n2", to: "n4", label: "w24" },
  { from: "n2", to: "n5", label: "w25" },
  { from: "n3", to: "n4", label: "w34" },
  { from: "n3", to: "n5", label: "w35" },
  { from: "n4", to: "n6", label: "w46" },
  { from: "n5", to: "n6", label: "w56" },
];

const E_NODE = { cx: 380, cy: 130 };
const TARGET = { cx: 380, cy: 880 };

// luminous semantic palette (works on dark and light); pale = same hue, low alpha
const COL = { y: "#fb7185", x: "#38bdf8", dedy: "#4ade80", dedx: "#fbbf24" };
const DW = "#c084fc";
const PALE = "26"; // ~15% alpha hex suffix
const INK = "#0b0e13"; // text on a solid luminous fill

const STEPS = {
  1:  { mode: "hidden" },
  2:  { mode: "plain" },
  3:  { mode: "stacked" },
  4:  { mode: "stacked", ends: true },
  5:  { mode: "stacked", ends: true, filled: ["n1"], hi: ["y:n1", "x:n1", "target"] },
  6:  { mode: "stacked", ends: true, filled: ["n1", "n2", "n3"], hi: ["x:n2", "wl:w12"] },
  7:  { mode: "stacked", ends: true, filled: ["n1", "n2", "n3"], hi: ["y:n2", "x:n2"] },
  8:  { mode: "stacked", ends: true, filled: "all" },
  9:  { mode: "stacked", ends: true, filled: "all", dw: "pale", hiDw: "all" },
  10: { mode: "backprop", ends: true, filled: "all", dw: "pale", de: "pale", hiDe: "all" },
  11: { mode: "backprop", ends: true, filled: "all", dw: "pale", de: "pale",
        solidDe: ["dedy:n6"], hi: ["dedy:n6"] },
  12: { mode: "backprop", ends: true, filled: "all", dw: "pale", de: "pale",
        solidDe: ["dedy:n6", "dedx:n6"], hi: ["dedx:n6"] },
  13: { mode: "backprop", ends: true, filled: "all", dw: "pale", de: "pale",
        solidDe: ["dedy:n6", "dedx:n6"], solidDw: ["w46"], hi: ["dw:w46", "y:n4"] },
  14: { mode: "backprop", ends: true, filled: "all", dw: "pale", de: "pale",
        solidDe: ["dedy:n6", "dedx:n6", "dedy:n4"], solidDw: ["w46"], hi: ["dedy:n4", "dw:w46"] },
  15: { mode: "backprop", ends: true, filled: "all", dw: "solid", de: "solid" },
  16: { mode: "backprop", ends: true, filled: "all", dw: "solid", de: "solid" },
};

function el(tag, attrs = {}, text) {
  const n = document.createElementNS(SVG, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text !== undefined) n.textContent = text;
  return n;
}

function subText(x, y, str, colorCss, anchor = "middle", size = 12) {
  const t = el("text", { x, y, "text-anchor": anchor, "font-size": size, style: "fill:" + colorCss });
  const m = str.match(/^(.*?)(_input|_output|_target|\d+)$/);
  if (m) {
    t.appendChild(el("tspan", {}, m[1]));
    t.appendChild(el("tspan", { "font-size": size - 3, dy: "3" }, m[2].replace("_", "")));
  } else {
    t.textContent = str;
  }
  return t;
}

function isFilled(cfg, id) {
  return cfg.filled === "all" || (Array.isArray(cfg.filled) && cfg.filled.includes(id));
}

function nodeSegs(id, cfg) {
  const node = NODES[id];
  const segs = [{ key: "y:" + id, kind: "y", label: node.yLabel }];
  if (cfg.mode === "backprop" && id !== "n1") {
    segs.push({ key: "dedy:" + id, kind: "dedy", label: "dE/dy" + node.num });
    segs.push({ key: "dedx:" + id, kind: "dedx", label: "dE/dx" + node.num });
  }
  if (id === "n1") segs.push({ key: "blank:n1", kind: "blank", label: "" });
  segs.push({ key: "x:" + id, kind: "x", label: node.xLabel });
  return segs;
}

function nodeGeom(id, cfg) {
  const node = NODES[id];
  if (cfg.mode === "plain") {
    const h = 3 * SH;
    return { plain: true, top: node.cy - h / 2, bottom: node.cy + h / 2, h };
  }
  const segs = nodeSegs(id, cfg);
  const h = segs.length * SH;
  const top = node.cy - h / 2;
  return { segs, h, top, bottom: top + h };
}

// returns {fill, solid} for a segment
function segStyle(kind, id, cfg, solidSet) {
  if (kind === "blank") return { fill: "var(--bg-elev)", solid: false };
  if (kind === "y") { const s = isFilled(cfg, id); return { fill: s ? COL.y : COL.y + PALE, solid: s }; }
  if (kind === "x") { const s = isFilled(cfg, id); return { fill: s ? COL.x : COL.x + PALE, solid: s }; }
  const solid = cfg.de === "solid" || solidSet.has(kind + ":" + id);
  return { fill: solid ? COL[kind] : COL[kind] + PALE, solid };
}

// which edges show a flowing signal, and in which direction
function flowFor(cfg, step) {
  const map = {};
  if (step >= 5 && step <= 8) {
    for (const e of EDGES) if (isFilled(cfg, e.from)) map[e.label] = "up";
  } else if (step >= 11) {
    for (const e of EDGES) {
      if (step >= 15) map[e.label] = "down";
      else if ((cfg.solidDw || []).includes(e.label)) map[e.label] = "down";
    }
  }
  return map;
}

function render(step) {
  svg.innerHTML = "";
  const cfg = STEPS[step] || STEPS[1];
  if (cfg.mode === "hidden") return;

  const geom = {};
  for (const id in NODES) geom[id] = nodeGeom(id, cfg);

  const hi = new Set(cfg.hi || []);
  if (cfg.hiDw === "all") EDGES.forEach((e) => hi.add("dw:" + e.label));
  if (cfg.hiDe === "all")
    ["n6", "n4", "n5", "n2", "n3"].forEach((id) => { hi.add("dedy:" + id); hi.add("dedx:" + id); });
  const solidDe = new Set(cfg.solidDe || []);
  const solidDw = new Set(cfg.solidDw || []);
  const flow = flowFor(cfg, step);

  // ---- edges (+ flowing signal overlay) ----
  for (const e of EDGES) {
    const a = NODES[e.from], b = NODES[e.to];
    const x1 = a.cx, y1 = geom[e.from].top;
    const x2 = b.cx, y2 = geom[e.to].bottom;
    svg.appendChild(el("line", { x1, y1, x2, y2, class: "edge" }));
    if (flow[e.label])
      svg.appendChild(el("line", { x1, y1, x2, y2,
        class: "flow" + (flow[e.label] === "down" ? " rev" : "") }));
    const lx = x1 + (x2 - x1) * 0.34, ly = y1 + (y2 - y1) * 0.34;
    if (hi.has("wl:" + e.label))
      svg.appendChild(el("rect", { x: lx - 15, y: ly - 12, width: 30, height: 18, rx: 2,
        fill: "var(--bg-elev)", class: "blink" }));
    svg.appendChild(subText(lx, ly, e.label, "var(--text-dim)", "middle", 12));
  }

  // arrows to E
  if (cfg.ends) {
    svg.appendChild(el("line", { x1: NODES.n6.cx + W / 2, y1: NODES.n6.cy,
      x2: E_NODE.cx - 16, y2: E_NODE.cy, class: "edge" }));
    svg.appendChild(el("line", { x1: TARGET.cx, y1: TARGET.cy - 14,
      x2: E_NODE.cx, y2: E_NODE.cy + 16, class: "edge" }));
  }

  // ---- dE/dw boxes ----
  if (cfg.dw) {
    for (const e of EDGES) {
      const a = NODES[e.from], b = NODES[e.to];
      const mx = (a.cx + b.cx) / 2, my = (geom[e.from].top + geom[e.to].bottom) / 2;
      const solid = cfg.dw === "solid" || solidDw.has(e.label);
      const cls = "nseg" + (hi.has("dw:" + e.label) ? " blink" : "");
      svg.appendChild(el("rect", { x: mx - 22, y: my - 11, width: 44, height: 22, rx: 3,
        fill: solid ? DW : DW + PALE, stroke: DW, "stroke-width": "1", class: cls }));
      svg.appendChild(el("text", { x: mx, y: my + 4, "text-anchor": "middle",
        "font-size": "11", style: "fill:" + (solid ? INK : "var(--text-dim)") }, "dE/dw"));
    }
  }

  // ---- nodes ----
  for (const id in NODES) {
    const node = NODES[id], g = geom[id];

    if (g.plain) {
      svg.appendChild(el("rect", { x: node.cx - W / 2, y: g.top, width: W, height: g.h, rx: 4,
        fill: "var(--bg-elev)", class: "nborder" }));
      svg.appendChild(el("text", { x: node.cx, y: node.cy + 7, "text-anchor": "middle",
        "font-size": "22", style: "fill:var(--text)" }, String(node.num)));
      continue;
    }

    g.segs.forEach((s, i) => {
      const y = g.top + i * SH;
      const st = segStyle(s.kind, id, cfg, solidDe);
      const cls = "nseg" + (hi.has(s.key) ? " blink" : "");
      svg.appendChild(el("rect", { x: node.cx - W / 2, y, width: W, height: SH,
        fill: st.fill, class: cls }));
      if (s.label)
        svg.appendChild(subText(node.cx, y + SH / 2 + 4, s.label, st.solid ? INK : "var(--text-dim)"));
    });

    svg.appendChild(el("rect", { x: node.cx - W / 2, y: g.top, width: W, height: g.h, rx: 4,
      class: "nborder" }));

    if (id !== "n1") {
      const fy = g.bottom - SH;
      svg.appendChild(el("circle", { cx: node.cx - W / 2, cy: fy, r: 10, class: "fc" }));
      svg.appendChild(el("text", { x: node.cx - W / 2, y: fy + 4, "text-anchor": "middle",
        "font-size": "11", "font-style": "italic", style: "fill:var(--text-dim)" }, "f"));
    }
  }

  // ---- E node & y_target ----
  if (cfg.ends) {
    svg.appendChild(el("circle", { cx: E_NODE.cx, cy: E_NODE.cy, r: 16, class: "ecirc" }));
    svg.appendChild(el("text", { x: E_NODE.cx, y: E_NODE.cy + 5, "text-anchor": "middle",
      "font-size": "14", style: "fill:var(--text)" }, "E"));
    const cls = "nseg" + (hi.has("target") ? " blink" : "");
    svg.appendChild(el("rect", { x: TARGET.cx - W / 2, y: TARGET.cy - SH / 2, width: W, height: SH,
      rx: 3, fill: COL.y, class: cls }));
    svg.appendChild(subText(TARGET.cx, TARGET.cy + 4, "y_target", INK));
  }
}

// ---- side rail ----
const RAIL_TITLES = {
  1: "Intro", 2: "Network", 3: "Activation", 4: "Error function",
  5: "Forward: input", 6: "Forward: hidden", 7: "Forward: activate", 8: "Forward: output",
  9: "Update rule", 10: "Store derivatives", 11: "Back: output", 12: "Back: chain rule",
  13: "Back: weights", 14: "Back: full circle", 15: "Back: repeat", 16: "The end",
};
const PHASES = {
  2: "Setup", 3: "Setup", 4: "Setup",
  5: "Forward pass", 6: "Forward pass", 7: "Forward pass", 8: "Forward pass",
  9: "Gradients", 10: "Gradients",
  11: "Backward pass", 12: "Backward pass", 13: "Backward pass", 14: "Backward pass",
  15: "Backward pass", 16: "Done",
};

const steps = Array.from(document.querySelectorAll(".step"));
const railButtons = {};

(function buildChrome() {
  // step kickers ("STEP 03 · Forward pass")
  steps.forEach((sec) => {
    const n = Number(sec.dataset.step);
    if (n === 1) return;
    const h2 = sec.querySelector("h2");
    if (!h2) return;
    const k = document.createElement("p");
    k.className = "kicker";
    k.textContent = "Step " + String(n - 1).padStart(2, "0") + " · " + PHASES[n];
    h2.parentNode.insertBefore(k, h2);
  });

  // rail dots
  const rail = document.getElementById("rail");
  steps.forEach((sec) => {
    const n = Number(sec.dataset.step);
    const b = document.createElement("button");
    b.dataset.title = RAIL_TITLES[n];
    b.addEventListener("click", () => sec.scrollIntoView({ behavior: "smooth", block: "center" }));
    rail.appendChild(b);
    railButtons[n] = b;
  });

  // theme toggle
  const btn = document.getElementById("themeBtn");
  const saved = localStorage.getItem("bp-theme");
  if (saved === "light") { document.documentElement.setAttribute("data-theme", "light"); btn.textContent = "Dark"; }
  btn.addEventListener("click", () => {
    const light = document.documentElement.getAttribute("data-theme") === "light";
    if (light) { document.documentElement.removeAttribute("data-theme"); btn.textContent = "Light"; localStorage.setItem("bp-theme", "dark"); }
    else { document.documentElement.setAttribute("data-theme", "light"); btn.textContent = "Dark"; localStorage.setItem("bp-theme", "light"); }
  });

  // top scroll progress
  const bar = document.getElementById("progressTop");
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + "%";
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

function setRailActive(n) {
  for (const k in railButtons) railButtons[k].classList.toggle("active", Number(k) === n);
}

// ---- scroll driver ----
let current = -1;
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const n = Number(entry.target.dataset.step);
        steps.forEach((s) => s.classList.toggle("active", s === entry.target));
        setRailActive(n);
        if (n !== current) { current = n; render(n); }
      }
    });
  },
  { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
);
steps.forEach((s) => observer.observe(s));

render(1);
setRailActive(1);

// ---- typeset math with KaTeX (vendored locally, works offline) ----
(function renderMath() {
  if (!window.katex) return;
  const macros = {
    "\\gr": "\\textcolor{#34d17f}",
    "\\am": "\\textcolor{#f0b429}",
    "\\bl": "\\textcolor{#4aa8f0}",
    "\\rd": "\\textcolor{#fb7185}",
    "\\pu": "\\textcolor{#b98cf5}",
  };
  document.querySelectorAll("[data-tex]").forEach((elm) => {
    try {
      katex.render(elm.getAttribute("data-tex"), elm, {
        displayMode: elm.hasAttribute("data-display"),
        throwOnError: false, macros,
      });
    } catch (e) { elm.textContent = elm.getAttribute("data-tex"); }
  });
})();
