// ===== Canvas setup =====
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let W = 360, H = 640;
let DPR = 1;

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize, { passive: true });
resize();

// ===== Helpers =====
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ===== Cannon drawing (code only) =====
function drawCannon(ctx, x, y, s = 1, options = {}) {
  const color = options.color ?? "#3A86FF";   // основной цвет
  const body  = options.body  ?? "#2B2B2B";   // корпус
  const metal = options.metal ?? "#ECECEC";   // металл (стволы)
  const wheel = options.wheel ?? "#3A3A3A";   // колёса
  const shadow = "rgba(0,0,0,.25)";

  const w = 72 * s;
  const baseH = 18 * s;
  const turret = 34 * s;
  const barrelW = 12 * s;
  const barrelH = 26 * s;

  ctx.save();
  ctx.translate(x, y);

  // тень
  ctx.fillStyle = "rgba(0,0,0,.12)";
  ctx.beginPath();
  ctx.ellipse(0, 20 * s, 40 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // колёса
  for (const sign of [-1, 1]) {
    const wx = sign * 20 * s;
    const wy = 16 * s;

    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(wx, wy + 2 * s, 12 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = wheel;
    ctx.beginPath();
    ctx.arc(wx, wy, 12 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.65)";
    ctx.beginPath();
    ctx.arc(wx, wy, 5.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // основание
  ctx.fillStyle = body;
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 14 * s;
  roundRect(ctx, -w / 2, -6 * s, w, baseH, 10 * s);
  ctx.fill();
  ctx.shadowBlur = 0;

  // турель
  ctx.fillStyle = color;
  roundRect(ctx, -turret / 2, -42 * s, turret, turret, 12 * s);
  ctx.fill();

  // ствол
  ctx.fillStyle = metal;
  roundRect(ctx, -barrelW / 2, -64 * s, barrelW, barrelH, 8 * s);
  ctx.fill();

  // обводка
  ctx.strokeStyle = "rgba(0,0,0,.12)";
  ctx.lineWidth = 2 * s;
  roundRect(ctx, -w / 2, -6 * s, w, baseH, 10 * s);
  ctx.stroke();

  // блик на турели
  ctx.fillStyle = "rgba(255,255,255,.30)";
  roundRect(ctx, -turret / 2 + 6 * s, -42 * s + 6 * s, turret - 12 * s, 8 * s, 6 * s);
  ctx.fill();

  ctx.restore();
}

// ===== Game state =====
const GROUND_H = 90;

const player = {
  x: W / 2,
  y: H - GROUND_H - 12,
  targetX: null,
  speedFollow: 0.55,     // скорость следования за пальцем
  cannons: 1,            // потом апгрейд +пушка
};

const bullets = []; // {x,y,vy,r}
let lastShot = 0;
let fireMs = 120;  // скорострельность (мс)
let bulletSpeed = 950; // px/sec

// ===== Touch control =====
let dragging = false;
let pid = null;

canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  pid = e.pointerId;
  try { canvas.setPointerCapture(pid); } catch {}
  player.targetX = e.clientX;
}, { passive: false });

canvas.addEventListener("pointermove", (e) => {
  if (!dragging || e.pointerId !== pid) return;
  player.targetX = e.clientX;
}, { passive: false });

function endDrag(e) {
  if (e.pointerId !== pid) return;
  dragging = false;
  pid = null;
  player.targetX = null;
}
canvas.addEventListener("pointerup", endDrag, { passive: false });
canvas.addEventListener("pointercancel", endDrag, { passive: false });

// ===== Shooting =====
function shoot(timeMs) {
  if (timeMs - lastShot < fireMs) return;
  lastShot = timeMs;

  const n = player.cannons;
  const spread = 16; // px spread

  for (let i = 0; i < n; i++) {
    const k = (n === 1) ? 0 : (i - (n - 1) / 2);
    bullets.push({
      x: player.x + k * spread,
      y: player.y - 60,
      vy: -bulletSpeed,
      r: 3.2
    });
  }
}

// ===== Update / Draw =====
let prev = performance.now();

function update(dt, tMs) {
  // move player
  const minX = 30;
  const maxX = W - 30;

  if (player.targetX !== null) {
    const target = clamp(player.targetX, minX, maxX);
    player.x += (target - player.x) * player.speedFollow;
  } else {
    // если палец отпустил — стоит
  }

  player.x = clamp(player.x, minX, maxX);

  // shoot
  shoot(tMs);

  // bullets move
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.y += b.vy * dt;
    if (b.y < -50) bullets.splice(i, 1);
  }
}

function draw() {
  // sky
  ctx.fillStyle = "#87CEFA";
  ctx.fillRect(0, 0, W, H);

  // ground
  ctx.fillStyle = "#34C759";
  ctx.fillRect(0, H - GROUND_H, W, GROUND_H);

  // bullets
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.95)";
  ctx.shadowColor = "rgba(255,255,255,.55)";
  ctx.shadowBlur = 10;
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // cannon
  drawCannon(ctx, player.x, player.y, 1.0, {
    color: "#3A86FF",
    body: "#2B2B2B",
    metal: "#EDEDED"
  });

  // UI text
  ctx.fillStyle = "rgba(0,0,0,.65)";
  ctx.font = "800 14px system-ui";
  ctx.fillText("Пушка кодом ✅  |  Зажми и веди пальцем", 14, 24);
}

function loop(tMs) {
  const dt = clamp((tMs - prev) / 1000, 0.008, 0.05);
  prev = tMs;

  // refresh sizes if orientation changed
  if (W !== window.innerWidth || H !== window.innerHeight) resize();
  player.y = H - GROUND_H - 12;

  update(dt, tMs);
  draw();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
