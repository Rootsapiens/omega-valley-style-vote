// Omega Valley: Joseph — levels, rooms and puzzles (design: ../JOSEPH_GAME.md).
// Spoken lines are the movie's own lines; the clip each comes from is in the comment.
// Other on-screen text is game interface only (names, hints), never story.
"use strict";
const { say, note, flag, has, give, take, play, wait } = E;

// ---------- items (16x16 pixel icons drawn in code) ----------
function px(c, col, pts) { c.fillStyle = col; for (const [x, y, w, h] of pts) c.fillRect(x, y, w || 1, h || 1); }
E.items = {
  stick: { name: "stick", icon: c => { px(c, "#6b4524", [[3, 12, 2, 2], [5, 10, 2, 2], [7, 8, 2, 2], [9, 6, 2, 2], [11, 4, 2, 2]]); px(c, "#8a5d33", [[4, 11], [6, 9], [8, 7], [10, 5], [12, 3]]); } },
  hay: { name: "hay", icon: c => { px(c, "#c9a24a", [[3, 6, 10, 7]]); px(c, "#e7c66a", [[4, 5, 2, 8], [8, 4, 2, 9], [11, 6, 1, 7]]); px(c, "#8d6a2a", [[3, 9, 10, 1]]); } },
  flashlight: { name: "flashlight", icon: c => { px(c, "#59606b", [[2, 7, 8, 3]]); px(c, "#8d96a3", [[2, 7, 8, 1]]); px(c, "#3b4048", [[10, 6, 2, 5]]); px(c, "#ffe58a", [[12, 7, 2, 3], [14, 6, 1, 5]]); } }
};

// ---------- small drawing helpers for puzzle overlays ----------
const hoof = (kind, col) => kind === "cloven"
  ? `<svg viewBox="0 0 60 60"><path d="M28 10c-8 0-14 9-14 22 0 10 5 17 12 17 2 0 3-2 3-4V12c0-1-0-2-1-2z" fill="${col}"/><path d="M32 10c8 0 14 9 14 22 0 10-5 17-12 17-2 0-3-2-3-4V12c0-1 0-2 1-2z" fill="${col}"/></svg>`
  : `<svg viewBox="0 0 60 60"><path d="M12 48c0-24 8-38 18-38s18 14 18 38h-8c0-18-4-30-10-30s-10 12-10 30z" fill="${col}"/></svg>`;
function choicePanel(title, help, options, correct) {
  return E.panel((p, close) => {
    const s = document.createElement("div"); s.className = "sheet";
    s.innerHTML = `<h3></h3><p></p><div class="choices"></div><div class="row"><button class="btn" data-x>Close</button></div>`;
    s.querySelector("h3").textContent = title; s.querySelector("p").textContent = help;
    const ch = s.querySelector(".choices");
    options.forEach((o, i) => {
      const b = document.createElement("button"); b.className = "choice";
      if (o.svg) b.innerHTML = o.svg; const t = document.createElement("div"); t.textContent = o.label; b.appendChild(t);
      b.onclick = () => close(i === correct);
      ch.appendChild(b);
    });
    s.querySelector("[data-x]").onclick = () => close(null);
    p.appendChild(s);
  });
}

// ---------- mind puzzles (one per level); each resolves true when solved ----------
function sheet(p, close, title, help) {
  const s = document.createElement("div"); s.className = "sheet";
  const h = document.createElement("h3"); h.textContent = title; s.appendChild(h);
  const t = document.createElement("p"); t.textContent = help; s.appendChild(t);
  const x = document.createElement("button"); x.className = "btn"; x.textContent = "Close"; x.onclick = () => close(false);
  p.appendChild(s);
  return { s, done: () => s.appendChild(x) };
}
function grid(n, size) { const g = document.createElement("div"); g.style.cssText = `display:grid;grid-template-columns:repeat(${n},1fr);gap:8px;width:min(100%,${size}px);margin:0 auto`; return g; }
function cell(txt) { const b = document.createElement("button"); b.className = "choice"; b.style.cssText = "aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:clamp(16px,3vw,34px);padding:0"; b.textContent = txt; return b; }

// L1: the herd's order. Watch which cows pass, then repeat the order.
E.puzzleHerd = () => E.panel((p, close) => {
  const { s, done } = sheet(p, close, "The order of the herd", "Watch the cows pass the gap, then tap them in the same order.");
  const cows = [["Brown", "#7a4a24"], ["Black", "#222"], ["White", "#ddd"], ["Spotted", "#a8835a"]];
  const seq = [0, 2, 1, 3, 2, 0];
  const g = grid(4, 520); s.appendChild(g);
  const bs = cows.map(([n, c], i) => { const b = cell(n); b.style.borderBottom = `10px solid ${c}`; b.disabled = true; g.appendChild(b); return b; });
  const msg = document.createElement("p"); s.appendChild(msg); done();
  let at = 0;
  const show = async () => {
    bs.forEach(b => b.disabled = true); msg.textContent = "Watch…";
    for (const i of seq) { bs[i].classList.add("ok"); await E.wait(600); bs[i].classList.remove("ok"); await E.wait(200); }
    msg.textContent = "Your turn."; at = 0; bs.forEach(b => b.disabled = false);
  };
  bs.forEach((b, i) => b.onclick = () => {
    if (seq[at] !== i) { msg.textContent = "Wrong cow. Watch again."; show(); return; }
    if (++at === seq.length) close(true);
  });
  setTimeout(show, 500);
});

// L2: the latched gate. Lights Out: tapping a stud flips it and its neighbours; make all studs dark.
E.puzzleLatch = () => E.panel((p, close) => {
  const { s, done } = sheet(p, close, "The gate latch", "Tapping a stud flips it and the studs beside it. Make every stud dark.");
  const on = [1, 0, 1, 0, 0, 0, 1, 0, 1];   // solvable: tap the four corners
  const g = grid(3, 300); s.appendChild(g);
  const bs = on.map(() => cell(""));
  const paint = () => bs.forEach((b, i) => { b.style.background = on[i] ? "#e9a24c" : "#241b16"; b.setAttribute("aria-label", "stud " + (i + 1) + (on[i] ? " lit" : " dark")); });
  bs.forEach((b, i) => { g.appendChild(b); b.onclick = () => {
    const r = Math.floor(i / 3), c = i % 3;
    for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 3 && cc >= 0 && cc < 3) on[rr * 3 + cc] ^= 1; }
    paint(); if (on.every(v => !v)) setTimeout(() => close(true), 300);
  }; });
  paint(); done();
});

// L3: the drawer. Slide the tiles into order 1-8.
E.puzzleSlide = () => E.panel((p, close) => {
  const { s, done } = sheet(p, close, "The stuck drawer", "Slide the tiles into order, 1 to 8, with the gap last.");
  let t = [1, 2, 3, 4, 0, 6, 7, 5, 8];   // a few moves from solved
  const g = grid(3, 300); s.appendChild(g);
  const draw = () => { g.replaceChildren(...t.map((v, i) => { const b = cell(v ? String(v) : ""); if (!v) b.style.visibility = "hidden";
    b.onclick = () => { const z = t.indexOf(0); const near = Math.abs(z - i) === 3 || (Math.abs(z - i) === 1 && Math.floor(z / 3) === Math.floor(i / 3));
      if (!near) return; [t[z], t[i]] = [t[i], t[z]]; draw(); if (t.join() === "1,2,3,4,5,6,7,8,0") setTimeout(() => close(true), 300); };
    return b; })); };
  draw(); done();
});

// L4: moving the stones. Tower of Hanoi with three stones: move the pile to the far bank.
E.puzzleHanoi = () => E.panel((p, close) => {
  const { s, done } = sheet(p, close, "Moving the stones", "Move the whole pile to the right spot. One stone at a time, never a bigger stone on a smaller one. Tap a pile to lift, tap another to drop.");
  const pegs = [[3, 2, 1], [], []]; let held = null;
  const g = grid(3, 520); s.appendChild(g);
  const msg = document.createElement("p"); s.appendChild(msg);
  const draw = () => { g.replaceChildren(...pegs.map((pg, i) => { const b = cell(""); b.style.flexDirection = "column-reverse"; b.style.justifyContent = "flex-start"; b.style.aspectRatio = "3/4";
    pg.forEach(sz => { const d = document.createElement("div"); d.style.cssText = `height:18%;width:${30 + sz * 22}%;background:#8d8577;border-radius:6px;margin:2px auto`; b.appendChild(d); });
    if (held === i) b.classList.add("ok");
    b.setAttribute("aria-label", ["Left", "Middle", "Right"][i] + " pile, " + pg.length + " stones");
    b.onclick = () => {
      if (held === null) { if (pg.length) held = i; }
      else { const top = pegs[held][pegs[held].length - 1];
        if (!pg.length || pg[pg.length - 1] > top) { pg.push(pegs[held].pop()); } else msg.textContent = "A bigger stone can't go on a smaller one.";
        held = null; }
      draw(); if (pegs[2].length === 3) setTimeout(() => close(true), 300);
    }; return b; })); };
  draw(); s.appendChild(msg); done();
});

// L5: the root paths. Rotate the root tiles so light runs from the left edge to the right edge.
E.puzzleRoots = () => E.panel((p, close) => {
  const { s, done } = sheet(p, close, "The root paths", "Tap the root pieces to turn them. Make one unbroken path from the light (top left) to the way out (bottom right).");
  // 2 rows x 4. Light enters top-left from the left, leaves bottom-right to the right.
  const SHAPES = { s: ["━", "┃"], c: ["┗", "┏", "┓", "┛"] };
  const tiles = [["s", 1, 0], ["c", 0, 2], null, null,
                 null, ["c", 2, 0], ["s", 1, 0], ["s", 1, 0]];   // [type, current turn, solved turn]
  const g = grid(4, 480); s.appendChild(g);
  const draw = () => { g.replaceChildren(...tiles.map((t, i) => {
    const b = cell(t ? SHAPES[t[0]][t[1]] : ""); b.style.color = "#e7c66a";
    if (i === 0) b.style.borderLeft = "6px solid #ffe58a";
    if (i === 7) b.style.borderRight = "6px solid #ffe58a";
    if (!t) { b.disabled = true; b.style.opacity = ".35"; return b; }
    b.setAttribute("aria-label", "root piece " + (i + 1));
    b.onclick = () => { t[1] = (t[1] + 1) % SHAPES[t[0]].length; draw();
      if (tiles.every(x => !x || x[1] === x[2])) setTimeout(() => close(true), 400); };
    return b; })); };
  draw(); done();
});

// ---------- levels ----------
E.levels = [
  { title: "Level 1 · The herd leaves", sub: "Dawn", clip: "intro", start: "valley_road", entry: "start" },
  { title: "Level 2 · The village talks", sub: "The same day", start: "church_steps", entry: "start" },
  { title: "Level 3 · Home", sub: "Evening", start: "yard", entry: "start" },
  { title: "Level 4 · Past the stream", sub: "Morning", start: "rock_cleft", entry: "start" },
  { title: "Level 5 · Inside the mountain", sub: "", start: "root_tunnel", entry: "start" }
];

const R = E.rooms;

// ===== Level 1 =====
R.valley_road = {
  id: "valley_road",
  floor: [[600, 1075], [1520, 1075], [1400, 860], [1260, 760], [1000, 760], [900, 860]],
  scale: [[760, 0.5], [1075, 1.15]],
  entries: { start: [1040, 1000, 1], from_gap: [1140, 790, -1] },
  hotspots: [
    { id: "prints", name: "hoofprints", rect: [760, 880, 520, 150], walk: [1000, 1000],
      use: async () => {
        flag("seen_prints", true);
        await choicePanel("Hoofprints on the road", "Fresh prints, all going the same way. Remember their shape.",
          [{ svg: hoof("cloven", "#3a2a1c"), label: "Road" }], -1);
      } }
  ],
  exits: [{ name: "Into the valley", rect: [960, 690, 380, 100], walk: [1130, 780], to: "stone_gap", entry: "start" }]
};

R.stone_gap = {
  id: "stone_gap",
  floor: [[380, 1075], [1560, 1075], [1500, 770], [1150, 680], [800, 680], [480, 770]],
  scale: [[680, 0.38], [1075, 1.15]],
  entries: { start: [960, 1010, -1], from_cliff: [960, 700, 1] },
  onEnter: async () => {
    if (!flag("herd_gone")) { flag("herd_gone", true); await play("herd_leaves"); }
  },
  hotspots: [
    { id: "stick", name: "stick", rect: [560, 930, 220, 90], walk: [700, 990], when: () => !flag("got_stick"),
      use: async () => { flag("got_stick", true); give("stick"); } },
    { id: "trail_l", name: "left trail", rect: [480, 700, 360, 150], walk: [640, 800], use: async () => trails() },
    { id: "trail_r", name: "right trail", rect: [1120, 700, 380, 150], walk: [1300, 800], use: async () => trails() }
  ],
  exits: [
    { name: "Follow the trail", rect: [820, 560, 300, 110], walk: [960, 690], to: "cliff_road", entry: "start", when: () => flag("trail_found") },
    { name: "Back down the road", rect: [700, 1010, 520, 70], walk: [960, 1060], to: "valley_road", entry: "from_gap" }
  ]
};
async function trails() {
  if (!flag("seen_prints")) { note("Look at the hoofprints on the road first."); return; }
  if (!flag("herd_order")) { if (await E.puzzleHerd() !== true) return; flag("herd_order", true); }
  const ok = await choicePanel("Which trail did the herd take?", "Pick the trail with the same prints as the road.",
    [{ svg: hoof("horse", "#5a4a3a"), label: "Left trail" }, { svg: hoof("cloven", "#3a2a1c"), label: "Right trail" }], 1);
  if (ok === true) { flag("trail_found", true); note("This way: through the gap."); }
  else if (ok === false) note("Not the same prints.");
}

R.cliff_road = {
  id: "cliff_road",
  floor: [[60, 1060], [1880, 1060], [1880, 900], [1500, 820], [900, 790], [420, 770], [60, 800]],
  scale: [[770, 0.9], [1060, 1.3]],
  entries: { start: [1700, 960, -1] },
  npcs: [{ id: "friend", name: "Friend", sprite: 1, x: 790, y: 820, flip: false,
    talk: async () => { await say("Friend", "Get on, we'll find them."); flag("friend_talked", true); } }],   // M775
  hotspots: [
    { id: "bike", name: "motorbike", rect: [470, 590, 260, 230], walk: [700, 840],
      use: async () => {
        if (!flag("friend_talked")) { note("Talk to your friend first."); return; }
        await play("walk_home"); await E.level(1);
      } }
  ],
  exits: [{ name: "Back to the stone gap", rect: [1780, 760, 140, 300], walk: [1820, 940], to: "stone_gap", entry: "from_cliff" }]
};

// ===== Level 2 =====
const CLUES = {
  farms: { who: "Villager", text: "Three farms lost animals last night and nobody came to explain" },   // M220
  mountain: { who: "Villager", text: "My cows walk toward the mountain by themselves" },              // M223
  cave: { who: "Farmer", text: "Until the entrance. … The cave." }                                    // M669
};
R.church_steps = {
  id: "church_steps",
  floor: [[0, 1075], [1920, 1075], [1920, 920], [1500, 730], [1180, 580], [1060, 580], [930, 770], [0, 905]],
  scale: [[580, 0.38], [1075, 1.2]],
  entries: { start: [1300, 980, -1], from_lane: [1110, 610, -1] },
  npcs: [
    { id: "oldman", name: "Villager", sprite: 2, x: 430, y: 890, scale: 1.0,
      talk: async () => { await say("Villager", CLUES.farms.text); E.addNote("farms"); } },   // M220
    { id: "woman", name: "Villager", sprite: 3, x: 590, y: 900, scale: 1.0, flip: true }
  ],
  exits: [{ name: "Up the lane", rect: [1000, 500, 300, 150], walk: [1120, 600],
    run: async () => {
      if (!flag("latch_open")) { if (await E.puzzleLatch() !== true) return; flag("latch_open", true); }
      await E.goto("village_lane", "from_church");
    } }]
};
R.village_lane = {
  id: "village_lane",
  floor: [[240, 1075], [1500, 1075], [1380, 720], [1080, 610], [960, 580], [860, 600], [700, 720], [480, 900]],
  scale: [[580, 0.34], [1075, 1.25]],
  entries: { from_church: [600, 1030, 1] },
  npcs: [
    { id: "woman2", name: "Villager", sprite: 3, x: 820, y: 720,
      talk: async () => {
        await say("Villager", "My cows walk toward the mountain by themselves");   // M223
        await say("Farmer", "Mine, too.");                                          // M223
        E.addNote("mountain");
      } },
    { id: "farmer", name: "Farmer", sprite: 4, x: 1120, y: 860,
      talk: async () => {   // M669
        await say("Farmer", "Three nights ago, I followed one of the cows. It walked out of its pen by itself. Straight there.");
        await say("Moreno", "You followed it?");
        await say("Farmer", "Until the entrance.");
        await say("Moreno", "What entrance?");
        await say("Farmer", "The cave.");
        await say("Moreno", "And then?");
        await say("Farmer", "I heard hooves. Thousands of hooves.");
        E.addNote("cave");
      } },
    { id: "moreno", name: "Moreno", sprite: 5, x: 1330, y: 900, flip: true,
      talk: async () => { note("He is listening to the farmer."); } }
  ],
  hotspots: [],
  exits: [
    { name: "Back to the church", rect: [100, 980, 420, 100], walk: [520, 1040], to: "church_steps", entry: "from_lane" },
    { name: "Go home", rect: [1500, 900, 420, 180], walk: [1440, 1040], when: () => true,
      run: async () => {
        if (!flag("notebook_done")) { note(E.st.notes.length < 3 ? "Listen to the villagers first." : "Open the notebook and put the clues together."); return; }
        await E.level(2);
      } }
  ]
};
E.openNotebook = async () => {
  const notes = E.st.notes.map(k => CLUES[k]);
  if (E.st.notes.length < 3 || flag("notebook_done")) {
    await E.panel((p, close) => {
      const s = document.createElement("div"); s.className = "sheet";
      const h = document.createElement("h3"); h.textContent = "Notebook"; s.appendChild(h);
      for (const n of notes) { const q = document.createElement("p"); q.textContent = n.who + ": “" + n.text + "”"; s.appendChild(q); }
      if (notes.length < 3) { const q = document.createElement("p"); q.textContent = (3 - notes.length) + " more to hear in the village."; s.appendChild(q); }
      const b = document.createElement("button"); b.className = "btn"; b.textContent = "Close"; b.onclick = () => close(); s.appendChild(b);
      p.appendChild(s);
    });
    return;
  }
  const Q = [["When did the animals go?", "farms"], ["Which way do they walk?", "mountain"], ["Where do they go in?", "cave"]];
  for (const [q, key] of Q) {
    const keys = ["farms", "mountain", "cave"];
    const ok = await choicePanel("Notebook", q, keys.map(k => ({ label: CLUES[k].who + ": “" + CLUES[k].text + "”" })), keys.indexOf(key));
    if (ok !== true) { if (ok === false) note("That clue doesn't answer it."); return; }
  }
  flag("notebook_done", true);
  note("Notebook complete. Go home.");
};

// ===== Level 3 =====
R.yard = {
  id: "yard",
  floor: [[0, 1075], [1920, 1075], [1920, 760], [1760, 610], [1560, 540], [1450, 560], [1500, 660], [900, 740], [0, 780]],
  scale: [[540, 0.55], [1075, 1.25]],
  entries: { start: [700, 1000, 1], from_kitchen: [1500, 600, 1] },
  npcs: [{ id: "cow", name: "cow", sprite: 6, x: 420, y: 930, flip: false,
    tick: (dt, n) => { if (n.follow) { const tx = E.joseph.x - 150 * E.joseph.side, ty = E.joseph.y; const d = Math.hypot(tx - n.x, ty - n.y); if (d > 40) { n.x += (tx - n.x) / d * 180 * dt; n.y += (ty - n.y) / d * 180 * dt; n.flip = tx < n.x; } } },
    talk: async () => { note("She keeps looking at the mountain."); },
    use: async (item) => {
      if (item !== "hay") { note("She needs something to eat."); return; }
      E.npc("cow").follow = true; note("She follows the hay.");
    } }],
  hotspots: [
    { id: "hay", name: "hay in the shed", rect: [1610, 300, 120, 230], walk: [1700, 640], when: () => !flag("got_hay"),
      use: async () => { flag("got_hay", true); give("hay"); } },
    { id: "barn", name: "shed door", rect: [1740, 330, 180, 240], walk: [1800, 680], when: () => !flag("cow_kept"),
      use: async () => {
        const cow = E.npc("cow");
        if (!cow || !cow.follow) { note("The cow has to come with you."); return; }
        cow.follow = false; cow.hidden = true; take("hay"); flag("cow_kept", true);
        note("The barn door is shut. The last cow stays.");
      } }
  ],
  onEnter: async () => { if (flag("cow_kept")) { const c = E.npc("cow"); if (c) c.hidden = true; } },
  exits: [{ name: "Kitchen door", rect: [1340, 250, 140, 270], walk: [1500, 590], to: "kitchen", entry: "start" }]
};
R.kitchen = {
  id: "kitchen",
  floor: [[300, 1075], [1600, 1075], [1500, 860], [500, 860]],
  scale: [[860, 1.05], [1075, 1.3]],
  entries: { start: [1350, 1000, -1] },
  npcs: [{ id: "mom", name: "Mom", sprite: 0, x: 760, y: 900,
    talk: async () => {
      if (!flag("cow_kept")) { note("First make sure the last cow stays in the barn."); return; }
      // M019, M599, M011, M701
      await say("Joseph", "Mom, I saw all our cows leaving. I tried to pull them back. In the end we had only one cow left. She was stuck in the barn. I'm keeping my eyes on her.");
      await say("Joseph", "Mom, why do they all look at the mountain? Even when I called them, they didn't hear me. They walked like they knew the way.");
      await say("Mom", "Joseph, what exactly did you see?");
      await say("Joseph", "I think the mountain is calling them.");
      await say("Joseph", "Mom, it's not happening to any human. These animals, they want to talk. They're not even afraid.");
      await say("Mom", "Do not go past the stream.");
      await say("Joseph", "The cow went past the stream yesterday. I saw her.");
      flag("talked_mom", true);
    } }],
  hotspots: [
    { id: "flashlight", name: "flashlight", rect: [180, 520, 200, 130], walk: [520, 900], when: () => !flag("got_light"),
      use: async () => {
        if (!flag("drawer_open")) { if (await E.puzzleSlide() !== true) return; flag("drawer_open", true); }
        flag("got_light", true); give("flashlight");
      } }
  ],
  exits: [
    { name: "Yard", rect: [1680, 300, 240, 700], walk: [1500, 1000], to: "yard", entry: "from_kitchen", when: () => !flag("talked_mom") },
    { name: "Outside (night)", rect: [1680, 300, 240, 700], walk: [1500, 1000], to: "fence_night", entry: "start",
      when: () => flag("talked_mom"),
      run: async () => { if (!has("flashlight")) { note("Take the flashlight with you."); return; } await E.goto("fence_night", "start"); } }
  ]
};
R.fence_night = {
  id: "fence_night",
  floor: [[0, 1075], [1920, 1075], [1920, 1000], [1000, 930], [0, 890]],
  scale: [[890, 1.1], [1075, 1.3]],
  entries: { start: [1500, 1030, -1] },
  hotspots: [
    { id: "valley", name: "the valley", rect: [0, 200, 1920, 560], walk: [1100, 990],
      use: async (item) => {
        if (item !== "flashlight") { note("Too dark to see the cow's way."); return; }
        flag("trail_lit", true); note("Hoofprints shine down the slope, past the stream.");
        await wait(2500);
        await play("night"); await E.level(3);
      } }
  ],
  over: (c, t) => {
    if (!flag("trail_lit")) return;
    c.fillStyle = "rgba(255,226,140,0.85)";
    // hoofprints down the snowy slope below the fence, towards the stream in the valley
    for (let i = 0; i < 16; i++) { const x = 360 + i * 12, y = 236 - i * 4 + Math.sin(i) * 2; c.fillRect(Math.round(x), Math.round(y), 2, 2); c.fillRect(Math.round(x) + 3, Math.round(y), 2, 2); }
  },
  exits: []
};

// ===== Level 4 =====
const STONES = { cols: 3, rows: 4, path: [1, 0, 1, 2] };   // safe stone per row, bottom row first
R.rock_cleft = {
  id: "rock_cleft",
  floor: [[0, 1075], [1920, 1075], [1920, 760], [1150, 700], [930, 700], [700, 650], [0, 650]],
  scale: [[700, 0.45], [1075, 1.25]],
  entries: { start: [420, 1000, 1], cleft: [990, 760, 1] },
  npcs: [{ id: "cow2", name: "cow", sprite: 6, x: 1000, y: 712, hidden: true,
    talk: async () => cowFound(), use: async () => cowFound() }],
  hotspots: [
    { id: "stream", name: "stream", rect: [560, 740, 560, 330], walk: [470, 1000], when: () => !flag("crossed"),
      use: async (item) => stones(item) }
  ],
  onEnter: async () => { if (flag("crossed")) { const c = E.npc("cow2"); if (c) c.hidden = false; } },
  exits: [{ name: "Into the cleft", rect: [920, 560, 170, 150], walk: [990, 730], when: () => flag("cow_found"), to: "cave_mouth", entry: "start" }]
};
async function stones(item) {
  if (item !== "stick") { note("Test the stones with something before you step."); return; }
  if (!flag("stones_moved")) { if (await E.puzzleHanoi() !== true) return; flag("stones_moved", true); }
  const ok = await E.panel((p, close) => {
    const s = document.createElement("div"); s.className = "sheet";
    s.innerHTML = "<h3>The stream</h3><p>Step only on stones that will hold. The cow's hoofprints show the way. Start at the bottom.</p>";
    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:520px;margin:0 auto;width:100%";
    let row = 0;
    const btns = [];
    for (let r = STONES.rows - 1; r >= 0; r--) for (let c = 0; c < STONES.cols; c++) {
      const b = document.createElement("button"); b.className = "choice";
      b.style.cssText = "aspect-ratio:3/2;display:flex;align-items:center;justify-content:center;padding:6px";
      b.innerHTML = STONES.path[r] === c ? hoof("cloven", "#2c2018") : "";
      b.setAttribute("aria-label", "Stone row " + (r + 1) + ", " + ["left", "middle", "right"][c]);
      b.onclick = () => {
        if (r !== row) { note("Start at the bottom row and go up one row at a time."); return; }
        if (STONES.path[r] !== c) { note("Splash! Back to the bank."); row = 0; btns.forEach(x => x.classList.remove("ok")); return; }
        b.classList.add("ok"); row++;
        if (row === STONES.rows) setTimeout(() => close(true), 400);
      };
      btns.push(b); grid.appendChild(b);
    }
    s.appendChild(grid);
    const x = document.createElement("button"); x.className = "btn"; x.textContent = "Close"; x.onclick = () => close(false); s.appendChild(x);
    p.appendChild(s);
  });
  if (!ok) return;
  flag("crossed", true);
  E.joseph.x = E.joseph.tx = 1100; E.joseph.y = E.joseph.ty = 790;
  const c = E.npc("cow2"); if (c) c.hidden = false;
  note("Across. The cow is at the rock.");
}
async function cowFound() {
  if (flag("cow_found")) return;
  await say("Joseph", "There you are.");   // M410
  flag("cow_found", true);
  await play("there_you_are");
  await E.goto("cave_mouth", "start");
}
R.cave_mouth = {
  id: "cave_mouth",
  floor: [[200, 1060], [1700, 1060], [1200, 800], [1000, 700], [700, 700], [560, 800]],
  scale: [[700, 0.4], [1060, 1.25]],
  entries: { start: [850, 720, 1] },
  hotspots: [
    { id: "tunnel", name: "deeper into the dark", rect: [300, 960, 1300, 120], walk: [960, 1000],
      use: async (item) => {
        if (item !== "flashlight") { note("It is pitch dark in there."); return; }
        await E.level(4);
      } }
  ],
  exits: []
};

// ===== Level 5 =====
const ROOTS = [[450, 420], [1230, 140], [1710, 600]];   // centres of the three root clusters (left wall, ceiling, right wall)
const SEQ = [0, 2, 1, 2];
R.root_tunnel = {
  id: "root_tunnel",
  floor: [[450, 1075], [1700, 1075], [1550, 850], [1440, 730], [1300, 730], [1100, 850]],
  scale: [[730, 0.4], [1075, 1.2]],
  entries: { start: [1000, 1030, 1], back: [1370, 760, -1] },
  hotspots: ROOTS.map(([x, y], i) => ({ id: "roots" + i, name: "roots", rect: [x - 140, y - 140, 280, 280], noWalk: true,
    use: async (item) => rootPress(i, item) })),
  under: null,
  over: (c, t) => {
    const g = E.glow;
    if (g && performance.now() < g.until) {
      const [x, y] = ROOTS[g.i];
      const r = 26 + Math.sin(t / 80) * 3;
      const grd = c.createRadialGradient(x / 3, y / 3, 2, x / 3, y / 3, r);
      grd.addColorStop(0, "rgba(255,190,90,0.9)"); grd.addColorStop(1, "rgba(255,150,40,0)");
      c.fillStyle = grd; c.beginPath(); c.arc(x / 3, y / 3, r, 0, Math.PI * 2); c.fill();
    }
    // roots grown across the far opening until the puzzle is solved
    if (!flag("roots_open")) { c.fillStyle = "rgba(70,48,28,0.95)"; for (let i = 0; i < 8; i++) c.fillRect(448 + i * 6 + (i % 2), 135 + (i % 3) * 4, 3, 105 - (i % 3) * 8); }
  },
  onEnter: async () => { if (!flag("roots_open")) { await wait(600); await showSeq(); } },
  exits: [{ name: "Deeper in", rect: [1300, 400, 220, 320], walk: [1370, 745], when: () => flag("roots_open"), to: "great_hall", entry: "start" }]
};
let pressed = [];
async function showSeq() {
  note("Watch the roots.");
  for (const i of SEQ) { E.glow = { i, until: performance.now() + 700 }; await wait(950); }
  E.glow = null; pressed = [];
}
async function rootPress(i, item) {
  if (flag("roots_open")) return;
  if (item !== "flashlight") { note("The roots shrink from light."); return; }
  E.glow = { i, until: performance.now() + 400 };
  if (SEQ[pressed.length] !== i) { note("The roots close again."); await wait(700); await showSeq(); return; }
  pressed.push(i);
  if (pressed.length === SEQ.length) { flag("roots_open", true); note("The roots pull back. A way opens."); }
}
R.great_hall = {
  id: "great_hall",
  floor: [[300, 1075], [1620, 1075], [1400, 760], [520, 760]],
  scale: [[760, 0.7], [1075, 1.2]],
  entries: { start: [960, 1020, 1] },
  hotspots: [],
  exits: [{ name: "Towards the light", rect: [760, 440, 400, 300], walk: [960, 780],
            run: async () => {
              if (!flag("paths_lit")) { if (await E.puzzleRoots() !== true) return; flag("paths_lit", true); }
              await E.goto("root_chamber", "start");
            } },
          { name: "Back", rect: [700, 1020, 520, 60], walk: [960, 1060], to: "root_tunnel", entry: "back" }]
};
const ANIMALS = [[570, 820], [1260, 700], [1560, 665], [1720, 665]];   // feet of: horse, horse, deer, the cow
const MINE = 3;
R.root_chamber = {
  id: "root_chamber",
  floor: [[300, 1075], [1650, 1075], [1500, 800], [1400, 700], [1100, 660], [860, 660], [640, 760]],
  scale: [[660, 0.45], [1075, 1.15]],
  entries: { start: [960, 1030, 1] },
  onEnter: async () => { if (!flag("saw_all")) { flag("saw_all", true); await play("all_here"); } },
  hotspots: ANIMALS.map(([x, y], i) => ({ id: "animal" + i, name: "wooden animal", rect: [x - (i === 0 ? 260 : 110), y - (i === 0 ? 260 : 150), i === 0 ? 420 : 200, i === 0 ? 270 : 160], walk: [x + (x < 960 ? 200 : -180), y + 90],
    use: async (item) => {
      if (item === "flashlight") { note(i === MINE ? "This one is warm. Its side moves." : "Cold wood."); return; }
      if (item !== "hay") { note("Is one of them yours?"); return; }
      if (i !== MINE) { note("Cold wood."); return; }
      await say("Joseph", "They're all here.");   // M413
      await play("ending");
      await E.card("Omega Valley: Joseph", "The end, for now.");
      document.getElementById("menu").hidden = false;
    } })),
  over: (c, t) => {
    if (E.sel !== "flashlight") return;
    const [x, y] = ANIMALS[MINE];
    c.fillStyle = `rgba(255,200,120,${0.18 + 0.12 * Math.sin(t / 300)})`;
    c.fillRect(Math.round(x / 3) - 18, Math.round(y / 3) - 36, 36, 26);
  },
  exits: []
};

// Level 3's hay is used up at the barn; Level 5 needs hay again: the kitchen hay basket refills it.
R.kitchen.hotspots.push({ id: "basket", name: "hay basket", rect: [1180, 860, 200, 140], walk: [1250, 1010], when: () => flag("cow_kept") && !has("hay"),
  use: async () => give("hay") });

// ---------- password "sina": Joseph plays the whole game by himself ----------
// Type sina anywhere (or in the menu's password box). Walking, talking, puzzles and cutscenes
// all run on their own; lines move on after a pause. Esc stops it.
(function () {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const P = () => document.getElementById("panel");
  let stopped = false;
  const live = () => { if (stopped) throw new Error("stopped"); };
  async function openWait() { for (let i = 0; i < 60 && P().hidden; i++) await sleep(100); await sleep(700); }
  async function tap(i, ms = 450) { live(); const b = P().querySelectorAll(".choice")[i]; if (b) b.click(); await sleep(ms); }
  async function walkTo(x, y) { live(); await E.walkTo(x, y); }
  const at = (room, kind, id) => (E.rooms[room][kind] || []).find(h => h.id === id || h.name === id);
  async function use(room, id, item) { const h = at(room, "hotspots", id); E.sel = item || null; await walkTo(...(h.walk || [h.rect[0] + h.rect[2] / 2, h.rect[1] + h.rect[3]])); await sleep(300); const p = h.use(item || null); return p; }
  async function talk(id) { const n = E.npc(id); await walkTo(n.x + (E.joseph.x < n.x ? -110 : 110), n.y); E.joseph.side = n.x >= E.joseph.x ? 1 : -1; await n.talk(); }
  async function exit(room, name) { const e = at(room, "exits", name); await walkTo(...e.walk); return e.run ? e.run() : E.goto(e.to, e.entry); }
  async function run() {
    E.auto = true; stopped = false;
    document.getElementById("menu").hidden = true;
    E.st = { level: 0, room: null, flags: {}, inv: [], notes: [] };
    E.note("Password accepted: Joseph plays by himself. Esc stops.", 3500);
    const pump = setInterval(() => {   // lines move on by themselves, cards close by themselves
      if (!document.getElementById("sub").hidden && performance.now() - (E.lineAt || 0) > 2600) { E.lineAt = performance.now(); document.getElementById("game").dispatchEvent(new PointerEvent("pointerdown", { button: 0 })); }
      if (document.getElementById("sub").hidden) E.lineAt = performance.now();
    }, 200);
    E.busy = true;
    try {
      await E.level(0);
      // Level 1
      let p = use("valley_road", "prints"); await openWait(); P().querySelector("[data-x]").click(); await p;
      await exit("valley_road", "Into the valley");
      await use("stone_gap", "stick");
      p = use("stone_gap", "trail_r");
      await openWait(); for (let i = 0; i < 100 && !/Your turn/.test(P().textContent); i++) await sleep(100);
      for (const i of [0, 2, 1, 3, 2, 0]) await tap(i, 500);
      await openWait(); await tap(1); await p;
      await exit("stone_gap", "Follow the trail");
      await talk("friend");
      await use("cliff_road", "bike");
      // Level 2
      await talk("oldman");
      p = exit("church_steps", "Up the lane"); await openWait(); for (const i of [0, 2, 6, 8]) await tap(i, 600); await p;
      await talk("woman2"); await talk("farmer");
      p = E.openNotebook(); for (const i of [0, 1, 2]) { await openWait(); await tap(i, 700); } await p;
      await exit("village_lane", "Go home");
      // Level 3
      await use("yard", "hay");
      E.sel = "hay"; await walkTo(E.npc("cow").x + 120, E.npc("cow").y); await E.npc("cow").use("hay");
      await use("yard", "barn");
      await exit("yard", "Kitchen door");
      await talk("mom");
      p = use("kitchen", "flashlight"); await openWait(); await tap(7, 700); await tap(8, 700); await p;
      await use("kitchen", "basket");
      await exit("kitchen", "Outside (night)");
      await use("fence_night", "valley", "flashlight");
      // Level 4
      p = use("rock_cleft", "stream", "stick"); await openWait();
      for (const [a, b] of [[0, 2], [0, 1], [2, 1], [0, 2], [1, 0], [1, 2], [0, 2]]) { await tap(a, 350); await tap(b, 500); }
      for (const [r, c] of [[0, 1], [1, 0], [2, 1], [3, 2]]) { if (r === 0) await openWait(); await tap((3 - r) * 3 + c, 600); }
      await p;
      const cow = E.npc("cow2"); await walkTo(cow.x + 90, cow.y + 40); await cow.talk();
      await use("cave_mouth", "tunnel", "flashlight");
      // Level 5
      await sleep(4500);
      E.sel = "flashlight"; for (const i of [0, 2, 1, 2]) { await at("root_tunnel", "hotspots", "roots" + i).use("flashlight"); await sleep(700); }
      await exit("root_tunnel", "Deeper in");
      p = exit("great_hall", "Towards the light"); await openWait(); for (const i of [0, 1, 1, 5, 5, 6, 7]) await tap(i, 450); await p;
      await use("root_chamber", "animal3", "hay");
    } catch (e) { if (!stopped) console.error(e); }
    finally { clearInterval(pump); E.auto = false; E.busy = false; E.sel = null; }
  }
  E.autoplay = run;
  let typed = "";
  addEventListener("keydown", ev => {
    if (ev.key === "Escape" && E.auto) { stopped = true; E.note("Stopped. You play now.", 2500); return; }
    if (ev.target && ev.target.id === "pw") return;
    if (ev.key.length === 1) { typed = (typed + ev.key.toLowerCase()).slice(-4); if (typed === "sina" && !E.auto) { typed = ""; run(); } }
  });
  const pw = document.getElementById("pw");
  if (pw) pw.addEventListener("keydown", ev => {
    if (ev.key !== "Enter") return;
    if (pw.value.trim().toLowerCase() === "sina") { pw.value = ""; run(); } else { pw.value = ""; pw.placeholder = "Wrong password"; }
  });
})();
document.getElementById("pwgo") && (document.getElementById("pwgo").onclick = () => {
  const pw = document.getElementById("pw");
  if (pw.value.trim().toLowerCase() === "sina") { pw.value = ""; E.autoplay(); } else { pw.value = ""; pw.placeholder = "Wrong password"; }
});
