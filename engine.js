// Omega Valley: Joseph — a small pixel point-and-click engine.
// Rooms are 640x360 pixel art shown 3x on a 1920x1080 canvas. Everything in the world is drawn
// on the low-res canvas so it stays on the pixel grid; text and UI are drawn on top at full size.
// Game content (rooms, puzzles, lines) lives in game.js and talks to the engine through `E`.
"use strict";
const W = 1920, H = 1080, S = 3;
const E = window.E = {
  rooms: {}, levels: [], items: {},
  st: { level: 0, room: null, flags: {}, inv: [], notes: [] },
  img: {}, sel: null, busy: false
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const lo = document.createElement("canvas"); lo.width = W / S; lo.height = H / S;
const lx = lo.getContext("2d");
const ui = document.getElementById("ui");

// ---------- assets ----------
function loadImage(src) {
  return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}
async function loadJSON(src) { try { const r = await fetch(src); return r.ok ? r.json() : null; } catch (e) { return null; } }

// ---------- Joseph ----------
const J = E.joseph = { x: 900, y: 900, tx: 900, ty: 900, side: 1, dist: 0, moving: false, path: null, onArrive: null, hidden: false };
const SPEED = 330, STRIDE = 366;

// ---------- geometry ----------
function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function nearestFloor(room, x, y) {
  const poly = room.floor;
  if (inside(poly, x, y)) return [x, y];
  let best = [x, y], bd = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const px = ax + t * dx, py = ay + t * dy, d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bd) { bd = d; best = [px, py]; }
  }
  // nudge towards the floor's centre so the point is truly inside
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return [best[0] + (cx - best[0]) * 0.03, best[1] + (cy - best[1]) * 0.03];
}
function scaleAt(room, y) {
  const [[y0, s0], [y1, s1]] = room.scale;
  const t = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
  return s0 + (s1 - s0) * t;
}
const inRect = (r, x, y) => x >= r[0] && y >= r[1] && x <= r[0] + r[2] && y <= r[1] + r[3];

// ---------- script helpers (game.js uses these with await) ----------
let sayResolve = null, line = null;
E.say = (who, text) => new Promise(res => { line = { who, text }; sayResolve = res; });
E.note = (text, ms = 2200) => { E.toast = { text, until: performance.now() + ms }; };
E.wait = ms => new Promise(r => setTimeout(r, ms));
E.flag = (k, v) => { if (v === undefined) return !!E.st.flags[k]; E.st.flags[k] = v; save(); };
E.has = id => E.st.inv.includes(id);
E.give = id => { if (!E.has(id)) E.st.inv.push(id); E.note("Got: " + E.items[id].name); save(); };
E.take = id => { E.st.inv = E.st.inv.filter(i => i !== id); if (E.sel === id) E.sel = null; save(); };
E.addNote = (id) => { if (!E.st.notes.includes(id)) E.st.notes.push(id); save(); };
E.walkTo = (x, y) => new Promise(res => {
  const room = E.rooms[E.st.room];
  [J.tx, J.ty] = nearestFloor(room, x, y);
  J.onArrive = res;
});
E.goto = async (roomId, entry) => {
  const room = E.rooms[roomId];
  E.st.room = roomId;
  const p = room.entries[entry || Object.keys(room.entries)[0]];
  J.x = J.tx = p[0]; J.y = J.ty = p[1]; J.side = p[2] || J.side; J.onArrive = null;
  E.npcs = (room.npcs || []).map(n => Object.assign({}, n));
  save();
  if (room.onEnter) { E.busy = true; try { await room.onEnter(); } finally { E.busy = false; } }
};
E.npc = id => (E.npcs || []).find(n => n.id === id);
E.level = async (n) => {
  E.st.level = n;
  const L = E.levels[n];
  await E.card(L.title, L.sub);
  if (L.clip) await E.play(L.clip);
  await E.goto(L.start, L.entry);
};

// ---------- overlays: the click that opened one must not also press its buttons ----------
function showOverlay(el) { el.dataset.shown = String(performance.now()); el.hidden = false; }
document.addEventListener("click", ev => {
  const o = ev.target.closest && ev.target.closest(".overlay");
  if (o && performance.now() - Number(o.dataset.shown || 0) < 400) { ev.stopPropagation(); ev.preventDefault(); }
}, true);

// ---------- cutscenes ----------
E.play = (name) => new Promise(res => {
  const box = document.getElementById("cut"), v = document.getElementById("cutv");
  let done = false;
  const end = () => { if (done) return; done = true; v.pause(); v.removeAttribute("src"); v.load(); box.hidden = true; res(); };
  v.innerHTML = "";
  for (const [ext, type] of [["webm", "video/webm"], ["mp4", "video/mp4"]]) {
    const s = document.createElement("source"); s.src = "video/" + name + "." + ext; s.type = type; v.appendChild(s);
  }
  v.onended = end; v.onerror = end;
  v.lastElementChild.onerror = end;   // every source failed: skip, as the main game does
  document.getElementById("skip").onclick = end;
  E.skipCut = end;
  showOverlay(box);
  v.load();
  v.play().catch(() => { v.muted = true; v.play().catch(end); });
});
E.card = (title, sub) => new Promise(res => {
  const c = document.getElementById("card");
  c.querySelector("h2").textContent = title;
  c.querySelector("p").textContent = sub || "";
  showOverlay(c);
  let gone = false;
  const go = () => { if (gone) return; gone = true; c.hidden = true; c.onclick = null; res(); };
  c.onclick = go;
  setTimeout(go, 3200);
});

// ---------- panels (puzzle screens built from DOM) ----------
E.panel = (build) => new Promise(res => {
  const p = document.getElementById("panel");
  p.replaceChildren();
  const close = (v) => { p.hidden = true; p.replaceChildren(); res(v); };
  build(p, close);
  showOverlay(p);
  const first = p.querySelector("button"); if (first) first.focus();
});

// ---------- save ----------
function save() { try { localStorage.setItem("joseph_save", JSON.stringify(E.st)); } catch (e) { } }
function loadSave() { try { return JSON.parse(localStorage.getItem("joseph_save") || "null"); } catch (e) { return null; } }

// ---------- input ----------
let mouse = { x: -1, y: -1 };
function toGame(ev) {
  const r = canvas.getBoundingClientRect();
  return [(ev.clientX - r.left) * W / r.width, (ev.clientY - r.top) * H / r.height];
}
function npcBox(n) {
  const room = E.rooms[E.st.room], s = (n.scale || scaleAt(room, n.y)), c = E.npcSheet.cells[n.sprite];
  const w = c.w * S * s, h = c.h * S * s;
  return [n.x - w / 2, n.y - h, w, h];
}
function hit(x, y) {
  const room = E.rooms[E.st.room];
  for (const n of (E.npcs || []).slice().sort((a, b) => b.y - a.y)) if (!n.hidden && inRect(npcBox(n), x, y)) return { kind: "npc", o: n };
  for (const h of room.hotspots || []) if ((!h.when || h.when()) && inRect(h.rect, x, y)) return { kind: "hs", o: h };
  for (const e of room.exits || []) if ((!e.when || e.when()) && inRect(e.rect, x, y)) return { kind: "exit", o: e };
  return null;
}
canvas.addEventListener("mousemove", ev => { mouse = toGame(ev); });
canvas.addEventListener("mouseleave", () => { mouse = { x: -1, y: -1 }; });
canvas.addEventListener("contextmenu", ev => ev.preventDefault());
canvas.addEventListener("pointerdown", async ev => {
  const [x, y] = toGame(ev);
  if (line) { const r = sayResolve; line = null; sayResolve = null; r && r(); return; }
  if (E.busy || !E.st.room) return;
  if (ev.button === 2) { E.sel = null; return; }
  const h = hit(x, y);
  const room = E.rooms[E.st.room];
  if (!h) { [J.tx, J.ty] = nearestFloor(room, x, y); J.onArrive = null; return; }
  const o = h.o, item = E.sel;
  const at = o.walk || (h.kind === "npc" ? [o.x + (J.x < o.x ? -110 : 110), o.y] : [o.rect[0] + o.rect[2] / 2, o.rect[1] + o.rect[3]]);
  E.busy = true;
  try {
    if (!o.noWalk) await E.walkTo(at[0], at[1]);
    if (h.kind === "npc") J.side = o.x >= J.x ? 1 : -1;
    if (h.kind === "exit") { if (o.run) await o.run(); else await E.goto(o.to, o.entry); }
    else if (item && o.use) { await o.use(item); }
    else if (item) { E.note("That doesn't work."); }
    else if (h.kind === "npc" && o.talk) await o.talk();
    else if (o.use) await o.use(null);
    else if (o.look) await o.look();
  } finally { E.busy = false; E.sel = item && E.has(item) ? E.sel : null; }
});
addEventListener("keydown", ev => {
  if (ev.key === "Escape" && !document.getElementById("cut").hidden && E.skipCut) E.skipCut();
  if (ev.key === " " && line) { const r = sayResolve; line = null; sayResolve = null; r && r(); ev.preventDefault(); }
  if (ev.key === "Tab" && E.st.room) { E.showAll = true; ev.preventDefault(); }
});
addEventListener("keyup", ev => { if (ev.key === "Tab") E.showAll = false; });

// ---------- inventory bar + notebook button (DOM) ----------
function renderBar() {
  const bar = document.getElementById("inv");
  const key = JSON.stringify([E.st.inv, E.sel, E.st.notes.length]);
  if (bar.dataset.k === key) return;
  bar.dataset.k = key;
  bar.replaceChildren(...E.st.inv.map(id => {
    const b = document.createElement("button");
    b.className = "slot" + (E.sel === id ? " on" : "");
    b.title = E.items[id].name;
    b.setAttribute("aria-label", E.items[id].name + (E.sel === id ? " (selected)" : ""));
    const c = document.createElement("canvas"); c.width = 16; c.height = 16;
    E.items[id].icon(c.getContext("2d"));
    b.appendChild(c);
    b.onclick = () => { E.sel = E.sel === id ? null : id; };
    return b;
  }));
  document.getElementById("nb").hidden = !E.st.notes.length;
}

// ---------- drawing ----------
function drawSprite(sheet, meta, idx, x, y, s, flip) {
  const c = meta.cells ? meta.cells[idx] : { x: idx * meta.cell_w, y: 0, w: meta.cell_w, h: meta.cell_h, ax: meta.anchor_x, ay: meta.anchor_y };
  const w = Math.max(1, Math.round(c.w * s)), h = Math.max(1, Math.round(c.h * s));
  const px = Math.round(x / S), py = Math.round(y / S);
  lx.save(); lx.translate(px, py); if (flip) lx.scale(-1, 1);
  lx.drawImage(sheet, c.x, c.y, c.w, c.h, -Math.round(c.ax * s), -Math.round(c.ay * s), w, h);
  lx.restore();
}
function shadow(x, y, s) {
  lx.fillStyle = "rgba(10,6,4,0.35)";
  lx.beginPath(); lx.ellipse(Math.round(x / S), Math.round(y / S), Math.max(2, Math.round(15 * s)), Math.max(1, Math.round(4 * s)), 0, 0, Math.PI * 2); lx.fill();
}
function update(dt) {
  if (!E.st.room) return;
  const room = E.rooms[E.st.room];
  const dx = J.tx - J.x, dy = J.ty - J.y, d = Math.hypot(dx, dy), s = scaleAt(room, J.y);
  if (d > 2) {
    J.moving = true;
    if (Math.abs(dx) > 1) J.side = dx > 0 ? 1 : -1;
    const step = Math.min(d, SPEED * Math.max(0.35, s) * dt);
    J.x += dx / d * step; J.y += dy / d * step; J.dist += step / Math.max(0.35, s);
  } else if (J.moving || J.onArrive) {
    J.moving = false;
    const f = J.onArrive; J.onArrive = null; f && f();
  }
  for (const n of E.npcs || []) if (n.tick) n.tick(dt, n);
}
function draw(t) {
  const room = E.st.room && E.rooms[E.st.room];
  lx.imageSmoothingEnabled = false;
  lx.fillStyle = "#000"; lx.fillRect(0, 0, lo.width, lo.height);
  if (room) {
    const bg = E.img["room_" + room.id];
    if (bg) lx.drawImage(bg, 0, 0, lo.width, lo.height);
    if (room.under) room.under(lx, t);
    const actors = (E.npcs || []).filter(n => !n.hidden).map(n => ({ y: n.y, draw: () => {
      const s = n.scale || scaleAt(room, n.y);
      shadow(n.x, n.y, s);
      drawSprite(E.npcImg, E.npcSheet, n.sprite, n.x, n.y + (n.bob ? Math.sin(t / 400) * 2 : 0), s, n.flip);
    } }));
    if (!J.hidden) actors.push({ y: J.y, draw: () => {
      const s = scaleAt(room, J.y), m = E.jMeta;
      const f = J.moving ? Math.floor(J.dist / (STRIDE / m.frames)) % m.frames : m.idle_frame;
      shadow(J.x, J.y, s);
      drawSprite(E.jImg, m, f, J.x, J.y, s, J.side < 0);
    } });
    actors.sort((a, b) => a.y - b.y).forEach(a => a.draw());
    if (room.over) room.over(lx, t);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lo, 0, 0, W, H);
  if (!room) return;
  // hover label / Tab = show everything you can use
  const labels = [];
  const h = mouse.x >= 0 && !line && !E.busy ? hit(mouse.x, mouse.y) : null;
  canvas.style.cursor = h ? (h.kind === "exit" ? "e-resize" : "pointer") : (E.sel ? "crosshair" : "default");
  if (E.showAll) {
    for (const hs of room.hotspots || []) if (!hs.when || hs.when()) labels.push([hs.name, hs.rect[0] + hs.rect[2] / 2, hs.rect[1] + hs.rect[3] / 2]);
    for (const ex of room.exits || []) if (!ex.when || ex.when()) labels.push([ex.name, ex.rect[0] + ex.rect[2] / 2, ex.rect[1] + ex.rect[3] / 2]);
    for (const n of E.npcs || []) if (!n.hidden) { const b = npcBox(n); labels.push([n.name, n.x, b[1] - 10]); }
  } else if (h) {
    const name = h.kind === "npc" ? h.o.name : h.o.name;
    labels.push([(E.sel ? "Use " + E.items[E.sel].name + " on " : "") + name, mouse.x, mouse.y - 34]);
  }
  ctx.font = "32px 'Pixelify Sans', 'Courier New', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const [txt, x, y] of labels) {
    const w = ctx.measureText(txt).width + 24, cx = Math.min(W - w / 2 - 8, Math.max(w / 2 + 8, x));
    ctx.fillStyle = "rgba(20,14,10,0.78)"; ctx.fillRect(cx - w / 2, y - 22, w, 44);
    ctx.fillStyle = "#f6e7c8"; ctx.fillText(txt, cx, y);
  }
  // spoken line
  const sub = document.getElementById("sub");
  if (line) {
    sub.hidden = false;
    sub.querySelector("b").textContent = line.who ? line.who : "";
    sub.querySelector("span").textContent = line.text;
  } else sub.hidden = true;
  const toast = document.getElementById("toast");
  if (E.toast && performance.now() < E.toast.until) { toast.hidden = false; toast.textContent = E.toast.text; } else toast.hidden = true;
  renderBar();
}
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  update(dt); draw(t);
  requestAnimationFrame(frame);
}

// ---------- boot ----------
E.boot = async () => {
  const [jImg, jMeta, npcImg, npcSheet] = await Promise.all([
    loadImage("sprites/joseph.png"), loadJSON("sprites/joseph.json"), loadImage("sprites/npcs.png"), loadJSON("sprites/npcs.json")]);
  Object.assign(E, { jImg, jMeta, npcImg, npcSheet });
  await Promise.all(Object.keys(E.rooms).map(async id => { E.img["room_" + id] = await loadImage("rooms/" + id + ".png"); }));
  requestAnimationFrame(frame);
  const saved = loadSave();
  const menu = document.getElementById("menu");
  document.getElementById("cont").hidden = !(saved && saved.room);
  menu.hidden = false;
  document.getElementById("newg").onclick = async () => {
    menu.hidden = true; E.st = { level: 0, room: null, flags: {}, inv: [], notes: [] }; save();
    E.busy = true; try { await E.level(0); } finally { E.busy = false; }
  };
  document.getElementById("cont").onclick = async () => {
    menu.hidden = true; E.st = Object.assign({ flags: {}, inv: [], notes: [] }, saved);
    const r = E.st.room; E.st.room = null;
    E.busy = true; try { await E.goto(r); } finally { E.busy = false; }
  };
  document.getElementById("nb").onclick = () => E.openNotebook && E.openNotebook();
};
