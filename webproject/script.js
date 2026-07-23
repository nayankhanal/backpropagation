// Backpropagation scrollytelling clone
// The SVG network is fully re-rendered on each scroll step from a per-step config.

const SVG = "http://www.w3.org/2000/svg";
const svg = document.getElementById("net");

const W = 70;   // node width
const SH = 26;  // segment height

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

const COL = {
  y:    { solid: "#e06666", pale: "#f4cccc" },
  x:    { solid: "#4a90d9", pale: "#cfe2f3" },
  dedy: { solid: "#6aa84f", pale: "#d9ead3" },
  dedx: { solid: "#e69138", pale: "#fce5cd" },
};
const DW = { solid: "#8e7cc3", pale: "#ede8f6" };

// Per-step configuration. mode: hidden | plain | stacked | backprop.
// filled: "all" or list of node ids that show solid (reached in forward pass).
// dw / de: "pale" | "solid" (base level); solidDw / solidDe promote specific keys.
// hi: keys to blink. hiDw:"all" / hiDe:"all" blink every dw box / every de segment.
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

// Text with a numeric / word subscript split out (e.g. "y_output", "x6", "dE/dy4").
function subText(x, y, str, fill, anchor = "middle", size = 12) {
  const t = el("text", { x, y, "text-anchor": anchor, "font-size": size, fill });
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

// Build the stacked segment list for a node given the mode.
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

function segFill(kind, id, cfg, solidSet) {
  if (kind === "blank") return "#fff";
  if (kind === "y") return COL.y[isFilled(cfg, id) ? "solid" : "pale"];
  if (kind === "x") return COL.x[isFilled(cfg, id) ? "solid" : "pale"];
  // dedy / dedx
  const base = cfg.de === "solid" ? "solid" : "pale";
  const level = base === "solid" || solidSet.has(kind + ":" + id) ? "solid" : "pale";
  return COL[kind][level];
}

function render(step) {
  svg.innerHTML = "";
  const cfg = STEPS[step] || STEPS[1];
  if (cfg.mode === "hidden") return;

  const geom = {};
  for (const id in NODES) geom[id] = nodeGeom(id, cfg);

  // set of keys to blink
  const hi = new Set(cfg.hi || []);
  if (cfg.hiDw === "all") EDGES.forEach((e) => hi.add("dw:" + e.label));
  if (cfg.hiDe === "all")
    ["n6", "n4", "n5", "n2", "n3"].forEach((id) => { hi.add("dedy:" + id); hi.add("dedx:" + id); });
  const solidDe = new Set(cfg.solidDe || []);
  const solidDw = new Set(cfg.solidDw || []);

  // ---- edges ----
  for (const e of EDGES) {
    const a = NODES[e.from], b = NODES[e.to];
    const x1 = a.cx, y1 = geom[e.from].top;
    const x2 = b.cx, y2 = geom[e.to].bottom;
    svg.appendChild(el("line", { x1, y1, x2, y2, class: "edge" }));
    const lx = x1 + (x2 - x1) * 0.34, ly = y1 + (y2 - y1) * 0.34;
    if (hi.has("wl:" + e.label))
      svg.appendChild(el("rect", { x: lx - 15, y: ly - 12, width: 30, height: 18, rx: 2,
        fill: "#fff", class: "blink" }));
    svg.appendChild(subText(lx, ly, e.label, "#666", "middle", 12));
  }

  // arrows to E (E only exists once the error function is introduced)
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
      const cls = "seg" + (hi.has("dw:" + e.label) ? " blink" : "");
      svg.appendChild(el("rect", { x: mx - 22, y: my - 11, width: 44, height: 22, rx: 2,
        fill: DW[solid ? "solid" : "pale"], stroke: "#8e7cc3", "stroke-width": "1", class: cls }));
      svg.appendChild(el("text", { x: mx, y: my + 4, "text-anchor": "middle",
        "font-size": "11", fill: solid ? "#fff" : "#5b4a9e" }, "dE/dw"));
    }
  }

  // ---- nodes ----
  for (const id in NODES) {
    const node = NODES[id], g = geom[id];

    if (g.plain) {
      svg.appendChild(el("rect", { x: node.cx - W / 2, y: g.top, width: W, height: g.h, rx: 3,
        fill: "#fff", stroke: "#888", "stroke-width": "1.2" }));
      svg.appendChild(el("text", { x: node.cx, y: node.cy + 7, "text-anchor": "middle",
        "font-size": "22", fill: "#333" }, String(node.num)));
      continue;
    }

    g.segs.forEach((s, i) => {
      const y = g.top + i * SH;
      const fill = segFill(s.kind, id, cfg, solidDe);
      const solidText = (s.kind === "y" || s.kind === "x") ? isFilled(cfg, id)
        : (cfg.de === "solid" || solidDe.has(s.kind + ":" + id));
      const cls = "seg" + (hi.has(s.key) ? " blink" : "");
      svg.appendChild(el("rect", { x: node.cx - W / 2, y, width: W, height: SH,
        fill, stroke: "#9a9a9a", "stroke-width": "1", class: cls }));
      if (s.label)
        svg.appendChild(subText(node.cx, y + SH / 2 + 4, s.label, solidText ? "#fff" : "#333"));
    });

    // outer border
    svg.appendChild(el("rect", { x: node.cx - W / 2, y: g.top, width: W, height: g.h, rx: 3,
      fill: "none", stroke: "#666", "stroke-width": "1.2" }));

    // activation circle (not on the input node)
    if (id !== "n1") {
      const fy = g.bottom - SH;
      svg.appendChild(el("circle", { cx: node.cx - W / 2, cy: fy, r: 10,
        fill: "#fff", stroke: "#666", "stroke-width": "1" }));
      svg.appendChild(el("text", { x: node.cx - W / 2, y: fy + 4, "text-anchor": "middle",
        "font-size": "11", "font-style": "italic", fill: "#333" }, "f"));
    }
  }

  // ---- E node & y_target (only after the error function is introduced) ----
  if (cfg.ends) {
    svg.appendChild(el("circle", { cx: E_NODE.cx, cy: E_NODE.cy, r: 16,
      fill: "#fff", stroke: "#666", "stroke-width": "1.2" }));
    svg.appendChild(el("text", { x: E_NODE.cx, y: E_NODE.cy + 5, "text-anchor": "middle",
      "font-size": "14", fill: "#333" }, "E"));
    const cls = "seg" + (hi.has("target") ? " blink" : "");
    svg.appendChild(el("rect", { x: TARGET.cx - W / 2, y: TARGET.cy - SH / 2, width: W, height: SH,
      rx: 3, fill: COL.y.solid, stroke: "#666", "stroke-width": "1.2", class: cls }));
    svg.appendChild(subText(TARGET.cx, TARGET.cy + 4, "y_target", "#fff"));
  }
}

// ---- scroll driver ----
const steps = Array.from(document.querySelectorAll(".step"));
let current = -1;

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const n = Number(entry.target.dataset.step);
        steps.forEach((s) => s.classList.toggle("active", s === entry.target));
        if (n !== current) { current = n; render(n); }
      }
    });
  },
  { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
);
steps.forEach((s) => observer.observe(s));

render(1);

// ---- typeset all math with KaTeX (vendored locally, works offline) ----
(function renderMath() {
  if (!window.katex) return;
  const macros = {
    "\\gr": "\\textcolor{#4f8a35}",
    "\\am": "\\textcolor{#c9791a}",
    "\\bl": "\\textcolor{#2f74c0}",
    "\\rd": "\\textcolor{#cf4b4b}",
    "\\pu": "\\textcolor{#6f5bb0}",
  };
  document.querySelectorAll("[data-tex]").forEach((elm) => {
    try {
      katex.render(elm.getAttribute("data-tex"), elm, {
        displayMode: elm.hasAttribute("data-display"),
        throwOnError: false,
        macros,
      });
    } catch (e) {
      elm.textContent = elm.getAttribute("data-tex");
    }
  });
})();
