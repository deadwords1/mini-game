/* VOIDRUN: Survivor Arena — upgraded visuals + summaries + chest + skill levels
   - No images, but nicer sprites (vector/pixel-ish)
   - Joystick RIGHT
   - Minimal HUD
   - Damage numbers + HP bars
   - Visible grenades + lightning + saw blades
   - Level summary modal + Stage chest modal
   - Lots more perks (levels scale power)
*/

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

let W = 360, H = 640, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize, { passive: true });
resize();

// ===== UI =====
const el = (id) => document.getElementById(id);
const ui = {
  hud: el("hud"),
  joyWrap: el("joyWrap"),
  joyBase: el("joyBase"),
  joyKnob: el("joyKnob"),
  dock: el("dock"),
  toast: el("toast"),

  hudStage: el("hudStage"),
  hudMap: el("hudMap"),
  hudTime: el("hudTime"),
  hudCoins: el("hudCoins"),
  hudGems: el("hudGems"),
  btnPause: el("btnPause"),

  hudHPText: el("hudHPText"),
  hudHPBar: el("hudHPBar"),
  hudXPText: el("hudXPText"),
  hudXPBar: el("hudXPBar"),

  screenMenu: el("screenMenu"),
  screenPause: el("screenPause"),
  pauseTitle: el("pauseTitle"),
  btnPlay: el("btnPlay"),
  btnShop: el("btnShop"),
  btnLoadout: el("btnLoadout"),
  btnReset: el("btnReset"),
  btnResume: el("btnResume"),
  btnToMenu: el("btnToMenu"),

  screenLevelUp: el("screenLevelUp"),
  upgradeGrid: el("upgradeGrid"),

  screenSummary: el("screenSummary"),
  sumTitle: el("sumTitle"),
  sumSub: el("sumSub"),
  sumGrid: el("sumGrid"),
  btnNext: el("btnNext"),

  screenChest: el("screenChest"),
  chest: el("chest"),
  chestHint: el("chestHint"),
  btnChestContinue: el("btnChestContinue"),

  screenShop: el("screenShop"),
  btnCloseShop: el("btnCloseShop"),
  shopCoins: el("shopCoins"),
  shopGems: el("shopGems"),
  shopMeta: el("shopMeta"),
  shopWeapons: el("shopWeapons"),
  shopCosmetics: el("shopCosmetics"),
  tabs: Array.from(document.querySelectorAll(".tab")),

  screenLoadout: el("screenLoadout"),
  btnCloseLoadout: el("btnCloseLoadout"),
  loadoutGrid: el("loadoutGrid"),

  dockShop: el("dockShop"),
  dockLoadout: el("dockLoadout"),
  dockSkills: el("dockSkills"),
  dockQuit: el("dockQuit"),

  menuCoins: el("menuCoins"),
  menuGems: el("menuGems"),
  menuProgress: el("menuProgress"),
};

function showToast(txt, ms = 1200) {
  if (!ui.toast) return;
  ui.toast.textContent = txt;
  ui.toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => ui.toast.classList.add("hidden"), ms);
}

// Move joystick to RIGHT (in case CSS not updated)
if (ui.joyWrap) {
  ui.joyWrap.style.left = "auto";
  ui.joyWrap.style.right = "14px";
}

// ===== Utils =====
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const lerp = (a, b, t) => a + (b - a) * t;

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

// ===== Save =====
const SAVE_KEY = "voidrun_save_v2";
const defaultSave = () => ({
  coins: 0, gems: 0,
  stage: 1, levelInStage: 1,
  unlockedWeapons: ["Pistol"],
  equippedWeapon: "Pistol",
  meta: { hp: 0, dmg: 0, firerate: 0, movespeed: 0, magnet: 0 },
  cosmetics: { owned: ["Blue"], auraOwned: ["None"], color: "Blue", aura: "None" }
});
let save = loadSave();

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const s = JSON.parse(raw);
    return { ...defaultSave(), ...s, meta: { ...defaultSave().meta, ...(s.meta || {}) }, cosmetics: { ...defaultSave().cosmetics, ...(s.cosmetics || {}) } };
  } catch {
    return defaultSave();
  }
}
function writeSave() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  updateMenuWallet();
}
function hardReset() {
  save = defaultSave();
  writeSave();
  showToast("Прогресс сброшен");
}

function updateMenuWallet() {
  if (ui.menuCoins) ui.menuCoins.textContent = `🪙 ${save.coins}`;
  if (ui.menuGems) ui.menuGems.textContent = `💎 ${save.gems}`;
  if (ui.menuProgress) ui.menuProgress.textContent = `Прогресс: Этап ${save.stage} · Уровень ${save.levelInStage}/5`;
  if (ui.shopCoins) ui.shopCoins.textContent = `🪙 ${save.coins}`;
  if (ui.shopGems) ui.shopGems.textContent = `💎 ${save.gems}`;
}
updateMenuWallet();

// ===== State =====
const STATE = { MENU: "menu", RUN: "run", PAUSE: "pause", LEVELUP: "levelup", SHOP: "shop", LOADOUT: "loadout", SUMMARY: "summary", CHEST: "chest" };
let state = STATE.MENU;

function setState(s) {
  state = s;

  if (ui.screenMenu) ui.screenMenu.classList.toggle("hidden", s !== STATE.MENU);
  if (ui.screenPause) ui.screenPause.classList.toggle("hidden", s !== STATE.PAUSE);
  if (ui.screenLevelUp) ui.screenLevelUp.classList.toggle("hidden", s !== STATE.LEVELUP);
  if (ui.screenShop) ui.screenShop.classList.toggle("hidden", s !== STATE.SHOP);
  if (ui.screenLoadout) ui.screenLoadout.classList.toggle("hidden", s !== STATE.LOADOUT);
  if (ui.screenSummary) ui.screenSummary.classList.toggle("hidden", s !== STATE.SUMMARY);
  if (ui.screenChest) ui.screenChest.classList.toggle("hidden", s !== STATE.CHEST);

  const inRun = (s === STATE.RUN || s === STATE.PAUSE || s === STATE.LEVELUP || s === STATE.SUMMARY || s === STATE.CHEST);
  if (ui.hud) ui.hud.classList.toggle("hidden", !inRun);
  if (ui.joyWrap) ui.joyWrap.classList.toggle("hidden", !inRun);
  if (ui.dock) ui.dock.classList.toggle("hidden", !inRun);
}

// ===== World / Maps =====
const MAPS = [
  { id: "fields", name: "Поля", palette: { grass: "#45c46f", grass2: "#38b15f", dirt: "#b58449", dirt2: "#9b6e3a", path: "#c9b48f", shadow: "rgba(0,0,0,.18)" } },
  { id: "desert", name: "Пустыня", palette: { grass: "#e9d8a6", grass2: "#e2c57d", dirt: "#c18c5d", dirt2: "#a86e44", path: "#f2e8c4", shadow: "rgba(0,0,0,.16)" } },
  { id: "snow", name: "Снега", palette: { grass: "#dbeafe", grass2: "#bfdbfe", dirt: "#93c5fd", dirt2: "#60a5fa", path: "#eef2ff", shadow: "rgba(0,0,0,.14)" } },
  { id: "toxic", name: "Токсик", palette: { grass: "#1f2937", grass2: "#111827", dirt: "#16a34a", dirt2: "#15803d", path: "#065f46", shadow: "rgba(0,0,0,.25)" } },
];

function mapForStage(stage) {
  // cycle maps by stage
  return MAPS[(stage - 1) % MAPS.length];
}

const world = {
  camX: 0, camY: 0,
  mapName: "Поля",
  mapPalette: MAPS[0].palette,
  arena: false,
  arenaR: 560
};

// ===== Player / Run =====
const player = {
  x: 0, y: 0,
  r: 16,
  hp: 100, maxHp: 100,
  baseDmg: 8,
  baseFire: 0.18,
  baseSpeed: 240,
  magnet: 0,
  weapon: "Pistol",

  coins: 0, gems: 0, kills: 0,
  totalDamage: 0,
  takenDamage: 0,

  run: {}
};

const xp = { cur: 0, need: 10, level: 1 };
let runTime = 0;

// Entities
const enemies = [];
const bullets = [];
const drops = [];
const fx = [];
const floaters = []; // damage numbers etc

// ===== Weapons =====
const WEAPONS = {
  Pistol: { name: "Пистолет", baseDmg: 8, fire: 0.18, speed: 700, pierce: 0, spread: 0, bullets: 1, col: "#111827" },
  SMG: { name: "SMG", baseDmg: 5, fire: 0.10, speed: 780, pierce: 0, spread: 0.08, bullets: 1, col: "#0f766e" },
  Shotgun: { name: "Дробовик", baseDmg: 6, fire: 0.45, speed: 650, pierce: 0, spread: 0.40, bullets: 5, col: "#a16207" },
  Laser: { name: "Лазер", baseDmg: 10, fire: 0.25, speed: 950, pierce: 2, spread: 0.02, bullets: 1, col: "#1d4ed8" },
};

// ===== Cosmetics =====
const COS_COLORS = [
  { id: "Blue", name: "Синий", priceC: 0, col: "#2563eb" },
  { id: "Red", name: "Красный", priceC: 450, col: "#ef4444" },
  { id: "Green", name: "Зелёный", priceC: 450, col: "#22c55e" },
  { id: "Violet", name: "Фиолет", priceC: 650, col: "#a78bfa" },
  { id: "Gold", name: "Золото", priceG: 18, col: "#f59e0b" },
];
const AURAS = [
  { id: "None", name: "Без ауры", priceC: 0 },
  { id: "Pulse", name: "Пульс", priceC: 900 },
  { id: "Halo", name: "Хало", priceG: 22 },
];

// ===== Shop =====
const META_ITEMS = [
  { key: "hp", name: "Живучесть", desc: "+10 HP навсегда", costC: 450, max: 25 },
  { key: "dmg", name: "Урон", desc: "+4% урона навсегда", costC: 550, max: 35 },
  { key: "firerate", name: "Темп огня", desc: "+3% скорострельности навсегда", costC: 600, max: 35 },
  { key: "movespeed", name: "Скорость", desc: "+3% скорость навсегда", costC: 520, max: 30 },
  { key: "magnet", name: "Магнит", desc: "+10% радиус подбора", costC: 420, max: 25 },
];

const WEAPON_ITEMS = [
  { id: "SMG", costC: 2600, desc: "Быстро стреляет, меньше урон." },
  { id: "Shotgun", costC: 3400, desc: "Залп дробью, сильный контроль." },
  { id: "Laser", costG: 25, desc: "Пробивает врагов, сильный урон." },
];

function ownsWeapon(id) { return save.unlockedWeapons.includes(id); }

function shopCard({ title, desc, badge, priceText, btnText, disabled, onClick }) {
  const d = document.createElement("div");
  d.className = "card";
  d.innerHTML = `
    <div class="cardTitle">${title} ${badge ? `<span class="badge">${badge}</span>` : ""}</div>
    <div class="cardDesc">${desc}</div>
    <div class="cardRow">
      <div class="chip">${priceText}</div>
      <button class="btn small ${disabled ? "" : "primary"}" ${disabled ? "disabled" : ""}>${btnText}</button>
    </div>
  `;
  d.querySelector("button").addEventListener("click", () => onClick?.());
  return d;
}

function renderShop() {
  updateMenuWallet();
  if (ui.shopMeta) ui.shopMeta.innerHTML = "";
  if (ui.shopWeapons) ui.shopWeapons.innerHTML = "";
  if (ui.shopCosmetics) ui.shopCosmetics.innerHTML = "";

  META_ITEMS.forEach(it => {
    const lv = save.meta[it.key] ?? 0;
    const maxed = lv >= it.max;
    const can = save.coins >= it.costC;
    ui.shopMeta?.appendChild(shopCard({
      title: it.name,
      desc: `${it.desc} · LVL ${lv}/${it.max}`,
      badge: maxed ? "MAX" : `LVL ${lv}`,
      priceText: maxed ? "🪙 MAX" : `🪙 ${it.costC}`,
      btnText: maxed ? "Макс" : (can ? "Купить" : "Не хватает"),
      disabled: maxed || !can,
      onClick: () => {
        if (maxed || !can) return;
        save.coins -= it.costC;
        save.meta[it.key] = (save.meta[it.key] ?? 0) + 1;
        writeSave();
        renderShop();
        showToast("Куплено ✅");
      }
    }));
  });

  WEAPON_ITEMS.forEach(w => {
    const owned = ownsWeapon(w.id);
    const canPay = w.costG ? save.gems >= w.costG : save.coins >= w.costC;
    const priceText = owned ? "Уже куплено" : (w.costG ? `💎 ${w.costG}` : `🪙 ${w.costC}`);
    const btnText = owned ? (save.equippedWeapon === w.id ? "Выбрано" : "Выбрать") : (canPay ? "Купить" : "Не хватает");

    ui.shopWeapons?.appendChild(shopCard({
      title: `Оружие: ${WEAPONS[w.id].name}`,
      desc: w.desc,
      badge: owned ? "Открыто" : "NEW",
      priceText,
      btnText,
      disabled: (!owned && !canPay),
      onClick: () => {
        if (owned) {
          save.equippedWeapon = w.id;
          writeSave();
          renderShop();
          showToast("Выбрано ✅");
          return;
        }
        if (!canPay) return;
        if (w.costG) save.gems -= w.costG; else save.coins -= w.costC;
        save.unlockedWeapons.push(w.id);
        save.equippedWeapon = w.id;
        writeSave();
        renderShop();
        showToast("Оружие куплено ✅");
      }
    }));
  });

  COS_COLORS.forEach(c => {
    const owned = save.cosmetics.owned.includes(c.id);
    const can = c.priceG ? save.gems >= c.priceG : save.coins >= c.priceC;
    const priceText = owned ? "Уже куплено" : (c.priceG ? `💎 ${c.priceG}` : `🪙 ${c.priceC}`);
    const btnText = owned ? (save.cosmetics.color === c.id ? "Надето" : "Надеть") : (can ? "Купить" : "Не хватает");

    ui.shopCosmetics?.appendChild(shopCard({
      title: `Цвет: ${c.name}`,
      desc: `Меняет стиль героя (без статов).`,
      badge: owned ? "OK" : "NEW",
      priceText,
      btnText,
      disabled: (!owned && !can),
      onClick: () => {
        if (owned) {
          save.cosmetics.color = c.id;
          writeSave(); renderShop();
          showToast("Надето ✅");
          return;
        }
        if (!can) return;
        if (c.priceG) save.gems -= c.priceG; else save.coins -= c.priceC;
        save.cosmetics.owned.push(c.id);
        save.cosmetics.color = c.id;
        writeSave(); renderShop();
        showToast("Куплено ✅");
      }
    }));
  });

  AURAS.forEach(a => {
    const owned = save.cosmetics.auraOwned.includes(a.id);
    const can = a.priceG ? save.gems >= a.priceG : save.coins >= a.priceC;
    const priceText = owned ? "Уже куплено" : (a.priceG ? `💎 ${a.priceG}` : `🪙 ${a.priceC}`);
    const btnText = owned ? (save.cosmetics.aura === a.id ? "Надето" : "Надеть") : (can ? "Купить" : "Не хватает");

    ui.shopCosmetics?.appendChild(shopCard({
      title: `Аура: ${a.name}`,
      desc: `Визуальный эффект вокруг героя.`,
      badge: owned ? "OK" : "NEW",
      priceText,
      btnText,
      disabled: (!owned && !can),
      onClick: () => {
        if (owned) {
          save.cosmetics.aura = a.id;
          writeSave(); renderShop();
          showToast("Надето ✅");
          return;
        }
        if (!can) return;
        if (a.priceG) save.gems -= a.priceG; else save.coins -= a.priceC;
        save.cosmetics.auraOwned.push(a.id);
        save.cosmetics.aura = a.id;
        writeSave(); renderShop();
        showToast("Куплено ✅");
      }
    }));
  });
}

function renderLoadout() {
  if (!ui.loadoutGrid) return;
  ui.loadoutGrid.innerHTML = "";

  COS_COLORS.forEach(c => {
    const owned = save.cosmetics.owned.includes(c.id);
    const d = document.createElement("div");
    d.className = "card";
    d.innerHTML = `
      <div class="cardTitle">${c.name} ${owned ? `<span class="badge">OK</span>` : `<span class="badge">LOCK</span>`}</div>
      <div class="cardDesc">Цвет героя</div>
      <div class="cardRow">
        <div class="chip" style="display:flex;gap:8px;align-items:center;">
          <span style="width:16px;height:16px;border-radius:6px;background:${c.col};display:inline-block;border:1px solid rgba(0,0,0,.25);"></span>
          ${owned ? "Доступно" : "Купи в магазине"}
        </div>
        <button class="btn small ${owned ? "primary" : ""}" ${owned ? "" : "disabled"}>${save.cosmetics.color === c.id ? "Надето" : "Надеть"}</button>
      </div>
    `;
    d.querySelector("button").addEventListener("click", () => {
      if (!owned) return;
      save.cosmetics.color = c.id;
      writeSave();
      renderLoadout();
      showToast("Надето ✅");
    });
    ui.loadoutGrid.appendChild(d);
  });

  AURAS.forEach(a => {
    const owned = save.cosmetics.auraOwned.includes(a.id);
    const d = document.createElement("div");
    d.className = "card";
    d.innerHTML = `
      <div class="cardTitle">Аура: ${a.name} ${owned ? `<span class="badge">OK</span>` : `<span class="badge">LOCK</span>`}</div>
      <div class="cardDesc">Визуальный эффект</div>
      <div class="cardRow">
        <div class="chip">${owned ? "Доступно" : "Купи в магазине"}</div>
        <button class="btn small ${owned ? "primary" : ""}" ${owned ? "" : "disabled"}>${save.cosmetics.aura === a.id ? "Надето" : "Надеть"}</button>
      </div>
    `;
    d.querySelector("button").addEventListener("click", () => {
      if (!owned) return;
      save.cosmetics.aura = a.id;
      writeSave();
      renderLoadout();
      showToast("Надето ✅");
    });
    ui.loadoutGrid.appendChild(d);
  });
}

// ===== Joystick =====
const joy = {
  active: false,
  id: null,
  baseX: 0, baseY: 0,
  dx: 0, dy: 0,
  mag: 0
};

function setJoyKnob(dx, dy) {
  if (!ui.joyKnob) return;
  const max = 50;
  const m = Math.hypot(dx, dy);
  const k = m > max ? max / m : 1;
  const nx = dx * k, ny = dy * k;
  ui.joyKnob.style.left = `${45 + nx}px`;
  ui.joyKnob.style.top = `${45 + ny}px`;
}

ui.joyBase?.addEventListener("pointerdown", (e) => {
  joy.active = true;
  joy.id = e.pointerId;
  ui.joyBase.setPointerCapture(joy.id);

  const r = ui.joyBase.getBoundingClientRect();
  joy.baseX = r.left + r.width / 2;
  joy.baseY = r.top + r.height / 2;
  joy.dx = 0; joy.dy = 0; joy.mag = 0;
  setJoyKnob(0, 0);
}, { passive: false });

ui.joyBase?.addEventListener("pointermove", (e) => {
  if (!joy.active || e.pointerId !== joy.id) return;
  const dx = e.clientX - joy.baseX;
  const dy = e.clientY - joy.baseY;
  joy.dx = dx; joy.dy = dy;
  const m = Math.hypot(dx, dy);
  joy.mag = clamp(m / 55, 0, 1);
  setJoyKnob(dx, dy);
}, { passive: false });

function joyEnd(e) {
  if (e.pointerId !== joy.id) return;
  joy.active = false; joy.id = null;
  joy.dx = 0; joy.dy = 0; joy.mag = 0;
  setJoyKnob(0, 0);
}
ui.joyBase?.addEventListener("pointerup", joyEnd, { passive: false });
ui.joyBase?.addEventListener("pointercancel", joyEnd, { passive: false });

// ===== Skills (levels) =====
function initRunSkills() {
  player.run = {
    dmgLv: 0,
    fireLv: 0,
    spdLv: 0,
    hpLv: 0,
    regenLv: 0,
    magnetLv: 0,
    critLv: 0,
    vampLv: 0,      // lifesteal
    armorLv: 0,     // reduce damage
    // actives
    sawLv: 0,
    grenadeLv: 0,
    lightningLv: 0,
    droneLv: 0,
    shieldLv: 0,
    frostLv: 0,     // slow aura
    // utility
    pierceLv: 0,
    multiLv: 0,
    boomLv: 0,      // explode on hit
  };
}

function skillPool() {
  return [
    { id: "DMG", name: "Урон", desc: "Больше урона", lvl: () => player.run.dmgLv, max: 10, apply: () => player.run.dmgLv++ },
    { id: "FIRE", name: "Темп огня", desc: "Стреляешь чаще", lvl: () => player.run.fireLv, max: 10, apply: () => player.run.fireLv++ },
    { id: "SPD", name: "Скорость", desc: "Бегаешь быстрее", lvl: () => player.run.spdLv, max: 8, apply: () => player.run.spdLv++ },
    { id: "HP", name: "Макс HP", desc: "+HP на уровень", lvl: () => player.run.hpLv, max: 10, apply: () => { player.run.hpLv++; const add = 18; player.maxHp += add; player.hp += add; } },
    { id: "REGEN", name: "Реген", desc: "Лечит со временем", lvl: () => player.run.regenLv, max: 8, apply: () => player.run.regenLv++ },
    { id: "MAG", name: "Магнит", desc: "Подбор дальше", lvl: () => player.run.magnetLv, max: 10, apply: () => player.run.magnetLv++ },
    { id: "CRIT", name: "Криты", desc: "Шанс крита", lvl: () => player.run.critLv, max: 10, apply: () => player.run.critLv++ },
    { id: "VAMP", name: "Вампиризм", desc: "Хил от урона", lvl: () => player.run.vampLv, max: 8, apply: () => player.run.vampLv++ },
    { id: "ARM", name: "Броня", desc: "Меньше урона", lvl: () => player.run.armorLv, max: 10, apply: () => player.run.armorLv++ },

    { id: "SAW", name: "Пилы", desc: "Пилы вокруг тебя", lvl: () => player.run.sawLv, max: 10, apply: () => player.run.sawLv++ },
    { id: "GREN", name: "Гранаты", desc: "Взрывы по толпе", lvl: () => player.run.grenadeLv, max: 10, apply: () => player.run.grenadeLv++ },
    { id: "LIT", name: "Молния", desc: "Бьёт по врагам", lvl: () => player.run.lightningLv, max: 10, apply: () => player.run.lightningLv++ },
    { id: "DRONE", name: "Дрон", desc: "Доп. стрельба", lvl: () => player.run.droneLv, max: 10, apply: () => player.run.droneLv++ },
    { id: "SHIELD", name: "Щит", desc: "Блок удара", lvl: () => player.run.shieldLv, max: 8, apply: () => player.run.shieldLv++ },
    { id: "FROST", name: "Лёд", desc: "Замедляет рядом", lvl: () => player.run.frostLv, max: 8, apply: () => player.run.frostLv++ },

    { id: "PIERCE", name: "Пробитие", desc: "Пули пробивают", lvl: () => player.run.pierceLv, max: 6, apply: () => player.run.pierceLv++ },
    { id: "MULTI", name: "Мульти-выстрел", desc: "+пули", lvl: () => player.run.multiLv, max: 6, apply: () => player.run.multiLv++ },
    { id: "BOOM", name: "Взрыв пуль", desc: "Малый AoE", lvl: () => player.run.boomLv, max: 6, apply: () => player.run.boomLv++ },
  ];
}

function pickUpgrades3() {
  const pool = skillPool().filter(s => s.lvl() < s.max);
  // if all maxed, still offer some basic ones (fallback)
  if (pool.length <= 0) return [
    { id: "COIN", name: "🪙 Бонус", desc: "+монеты", lvl: () => 0, max: 999, apply: () => { player.coins += 50; } },
    { id: "HEAL", name: "❤ Хил", desc: "Восстановить HP", lvl: () => 0, max: 999, apply: () => { player.hp = Math.min(player.maxHp, player.hp + 40); } },
    { id: "XP", name: "XP", desc: "+XP", lvl: () => 0, max: 999, apply: () => { xp.cur += 8; } }
  ];

  const picks = [];
  while (picks.length < 3 && pool.length > 0) {
    const i = randi(0, pool.length - 1);
    const s = pool.splice(i, 1)[0];
    picks.push(s);
  }
  // ensure 3
  while (picks.length < 3) {
    picks.push({ id: "HEAL", name: "❤ Хил", desc: "Восстановить HP", lvl: () => 0, max: 999, apply: () => { player.hp = Math.min(player.maxHp, player.hp + 35); } });
  }
  return picks;
}

// ===== Enemy system =====
function enemyTier(stage, levelInStage) {
  const t = (stage - 1) * 5 + (levelInStage - 1);
  const baseHp = 24 + t * 7;
  const baseSp = 80 + t * 2.8;
  const baseDmg = 10 + t * 1.2;

  const roll = Math.random();
  if (roll < 0.60) return { kind: "grunt", hp: baseHp, sp: baseSp, dmg: baseDmg, r: 16, col: "#f3f4f6", xp: 1, face: ":-|" };
  if (roll < 0.85) return { kind: "brute", hp: baseHp * 2.3, sp: baseSp * 0.70, dmg: baseDmg * 1.4, r: 20, col: "#fb923c", xp: 2, face: ">:(" };
  return { kind: "runner", hp: baseHp * 0.9, sp: baseSp * 1.35, dmg: baseDmg * 0.9, r: 14, col: "#22c55e", xp: 2, face: "o_o" };
}

function bossTier(stage) {
  const t = (stage - 1) * 5 + 4;
  return {
    kind: "boss",
    hp: 520 + t * 110,
    sp: 78 + t * 2.0,
    dmg: 22 + t * 2.2,
    r: 38,
    col: "#ef4444",
    xp: 12,
    ultCd: 6.0,
    ultTimer: 2.2,
    face: "BOSS"
  };
}

// ===== Run flow =====
const levelWave = {
  t: 0,
  spawnT: 0,
  done: false,
  boss: null,
  bossSpawned: false,
};

const runSummary = {
  xpPicked: 0,
  coinsPicked: 0,
  gemsPicked: 0,
  kills: 0,
  damage: 0,
};

function resetSummary() {
  runSummary.xpPicked = 0;
  runSummary.coinsPicked = 0;
  runSummary.gemsPicked = 0;
  runSummary.kills = 0;
  runSummary.damage = 0;
}

function resetLevelRuntime() {
  runTime = 0;
  xp.cur = 0; xp.need = 10; xp.level = 1;

  player.coins = 0; player.gems = 0; player.kills = 0;
  player.totalDamage = 0;
  player.takenDamage = 0;

  enemies.length = 0;
  bullets.length = 0;
  drops.length = 0;
  fx.length = 0;
  floaters.length = 0;

  resetSummary();

  // set map
  const m = mapForStage(save.stage);
  world.mapName = m.name;
  world.mapPalette = m.palette;

  // arena alternation
  world.arena = (save.levelInStage % 2 === 0);
  world.arenaR = 560;

  // wave reset
  levelWave.t = 0;
  levelWave.spawnT = 0;
  levelWave.done = false;
  levelWave.boss = null;
  levelWave.bossSpawned = false;

  // player base stats from meta + weapon
  player.weapon = save.equippedWeapon;
  const w = WEAPONS[player.weapon];
  player.baseDmg = w.baseDmg;
  player.baseFire = w.fire;
  player.baseSpeed = 240;

  player.maxHp = 100 + (save.meta.hp * 10);
  player.hp = player.maxHp;

  player.magnet = 1 + (save.meta.magnet * 0.10);

  initRunSkills();

  // apply meta into run baseline
  // (meta dmg/firerate/movespeed are multipliers inside compute functions)
  player.x = 0; player.y = 0;
  world.camX = 0; world.camY = 0;

  showToast(`Этап ${save.stage} · Уровень ${save.levelInStage}/5`, 1200);
}

function startGame() {
  resetLevelRuntime();
  if (ui.pauseTitle) ui.pauseTitle.textContent = "Пауза";
  setState(STATE.RUN);
}

function gameOver() {
  if (ui.pauseTitle) ui.pauseTitle.textContent = "Поражение";
  setState(STATE.PAUSE);
}

function stageCompleted() {
  setState(STATE.CHEST);
  if (ui.chestHint) ui.chestHint.textContent = "Нажми на сундук, чтобы открыть";
  if (ui.chest) {
    ui.chest.classList.remove("opened");
  }
}

function openSummary(win) {
  setState(STATE.SUMMARY);
  if (ui.sumTitle) ui.sumTitle.textContent = win ? "Уровень пройден ✅" : "Поражение ❌";
  if (ui.sumSub) ui.sumSub.textContent = `Этап ${save.stage} · Уровень ${save.levelInStage}/5`;

  if (!ui.sumGrid) return;
  ui.sumGrid.innerHTML = "";

  const items = [
    { k: "XP", v: runSummary.xpPicked },
    { k: "Убийства", v: runSummary.kills },
    { k: "Монеты", v: runSummary.coinsPicked },
    { k: "Гемы", v: runSummary.gemsPicked },
    { k: "Урон", v: Math.floor(runSummary.damage) },
    { k: "Получено урона", v: Math.floor(player.takenDamage) },
  ];

  for (const it of items) {
    const d = document.createElement("div");
    d.className = "card";
    d.innerHTML = `
      <div class="cardTitle">${it.k}</div>
      <div class="cardDesc" style="font-size:18px;font-weight:1000;margin-top:4px;">${it.v}</div>
    `;
    ui.sumGrid.appendChild(d);
  }
}

function finishLevelWin() {
  // add run loot to save
  save.coins += player.coins;
  save.gems += player.gems;

  writeSave();

  // progress
  const wasLevel5 = (save.levelInStage === 5);

  if (!wasLevel5) {
    save.levelInStage += 1;
    writeSave();
    openSummary(true);
  } else {
    // stage complete -> next stage + chest
    save.stage += 1;
    save.levelInStage = 1;
    writeSave();
    openSummary(true);
    // after summary -> chest
    // handled by btnNext
  }
}

function finishLevelLose() {
  // add run loot anyway (like a bit), optional: only 50%
  save.coins += Math.floor(player.coins * 0.65);
  save.gems += Math.floor(player.gems * 0.65);
  writeSave();

  // back to first level of stage
  save.levelInStage = 1;
  writeSave();

  openSummary(false);
}

// ===== Combat compute (skill levels => power) =====
function dmgMultiplier() {
  const meta = 1 + (save.meta.dmg * 0.04);
  const run = 1 + (player.run.dmgLv * 0.15);
  return meta * run;
}
function fireMultiplier() {
  const meta = 1 + (save.meta.firerate * 0.03);
  const run = 1 + (player.run.fireLv * 0.12);
  return meta * run;
}
function speedMultiplier() {
  const meta = 1 + (save.meta.movespeed * 0.03);
  const run = 1 + (player.run.spdLv * 0.10);
  return meta * run;
}
function critChance() {
  return clamp(player.run.critLv * 0.05, 0, 0.45);
}
function armorReduction() {
  return clamp(player.run.armorLv * 0.05, 0, 0.45);
}
function vampPercent() {
  return clamp(player.run.vampLv * 0.03, 0, 0.25);
}

// ===== Spawning =====
function spawnAtEdge() {
  const angle = rand(0, Math.PI * 2);
  const d = rand(560, 820);
  return { x: player.x + Math.cos(angle) * d, y: player.y + Math.sin(angle) * d };
}

function spawnEnemy(stage, levelInStage) {
  const p = spawnAtEdge();
  const t = enemyTier(stage, levelInStage);
  enemies.push({
    x: p.x, y: p.y,
    vx: 0, vy: 0,
    hp: t.hp,
    maxHp: t.hp,
    sp: t.sp,
    dmg: t.dmg,
    r: t.r,
    kind: t.kind,
    col: t.col,
    xp: t.xp,
    face: t.face,
    hitFlash: 0,
    slow: 0
  });
}

function spawnBoss(stage) {
  const p = spawnAtEdge();
  const b = bossTier(stage);
  const e = {
    x: p.x, y: p.y,
    vx: 0, vy: 0,
    hp: b.hp, maxHp: b.hp,
    sp: b.sp,
    dmg: b.dmg,
    r: b.r,
    kind: "boss",
    col: b.col,
    xp: b.xp,
    face: b.face,
    ultCd: b.ultCd,
    ultTimer: b.ultTimer,
    hitFlash: 0,
    slow: 0
  };
  enemies.push(e);
  levelWave.boss = e;
}

function doSpawn(dt) {
  levelWave.t += dt;
  levelWave.spawnT -= dt;

  const diff = (save.stage - 1) * 5 + (save.levelInStage - 1);
  const isBossLevel = (save.levelInStage === 5);
  const spawnInterval = clamp(1.10 - diff * 0.03, 0.22, 1.10);

  if (!isBossLevel) {
    if (levelWave.spawnT <= 0) {
      levelWave.spawnT = spawnInterval;
      const n = randi(1, 2 + Math.floor(diff / 4));
      for (let i = 0; i < n; i++) spawnEnemy(save.stage, save.levelInStage);
    }

    // win condition: survive time
    const targetTime = 55 + diff * 6;
    if (levelWave.t >= targetTime) levelWave.done = true;
  } else {
    if (!levelWave.bossSpawned && levelWave.t > 6) {
      levelWave.bossSpawned = true;
      spawnBoss(save.stage);
      showToast("БОСС 😈", 1200);
    }
    if (levelWave.spawnT <= 0) {
      levelWave.spawnT = clamp(spawnInterval * 0.85, 0.18, 0.8);
      const n = randi(1, 2 + Math.floor(diff / 5));
      for (let i = 0; i < n; i++) spawnEnemy(save.stage, 4);
    }
    if (levelWave.bossSpawned && levelWave.boss && levelWave.boss.hp <= 0) levelWave.done = true;
  }
}

// ===== Drops =====
function spawnDrops(x, y, xpCount) {
  for (let i = 0; i < xpCount; i++) {
    const a = rand(0, Math.PI * 2), d = rand(0, 18);
    drops.push({ type: "xp", x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: rand(-40, 40), vy: rand(-40, 40), r: 6, col: "#22c55e", val: 1 });
  }
  if (Math.random() < 0.70) {
    const n = randi(1, 2);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), d = rand(0, 18);
      drops.push({ type: "coin", x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: rand(-55, 55), vy: rand(-55, 55), r: 6, col: "#f59e0b", val: randi(1, 3) });
    }
  }
  if (Math.random() < 0.15) {
    drops.push({ type: "gem", x, y, vx: rand(-45, 45), vy: rand(-45, 45), r: 7, col: "#60a5fa", val: 1 });
  }
}

function pickupDrops(dt) {
  const baseMag = 120;
  const mag = baseMag * player.magnet * (1 + player.run.magnetLv * 0.10);
  const mag2 = mag * mag;

  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];

    d.vx *= Math.pow(0.3, dt);
    d.vy *= Math.pow(0.3, dt);
    d.x += d.vx * dt;
    d.y += d.vy * dt;

    const dd = dist2(player.x, player.y, d.x, d.y);

    if (dd < mag2) {
      const dx = player.x - d.x, dy = player.y - d.y;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = clamp((mag - dist) / mag, 0, 1);
      d.x += (dx / dist) * (520 * pull) * dt;
      d.y += (dy / dist) * (520 * pull) * dt;
    }

    if (dd < (player.r + d.r + 6) ** 2) {
      if (d.type === "xp") {
        xp.cur += d.val;
        runSummary.xpPicked += d.val;
        while (xp.cur >= xp.need) {
          xp.cur -= xp.need;
          xp.level++;
          xp.need = Math.floor(xp.need * 1.22 + 3);
          openLevelUp();
        }
      } else if (d.type === "coin") {
        player.coins += d.val;
        runSummary.coinsPicked += d.val;
      } else if (d.type === "gem") {
        player.gems += d.val;
        runSummary.gemsPicked += d.val;
      }
      drops.splice(i, 1);
    }
  }
}

// ===== Bullets / Damage =====
function nearestEnemy() {
  let best = null, bestD = 1e18;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const d = dist2(player.x, player.y, e.x, e.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function spawnFloater(x, y, text, col = "#ffffff", big = false) {
  floaters.push({ x, y, vx: rand(-15, 15), vy: -55 - (big ? 25 : 0), t: 0.9, text, col, big });
}

function spawnBullet(x, y, dirx, diry, dmg, speed, pierce, col, rad = 3.2) {
  bullets.push({ x, y, vx: dirx * speed, vy: diry * speed, r: rad, dmg, pierce, col, life: 2.2 });
}

function applyExplosion(x, y, r, dmg) {
  const r2 = r * r;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const rr = (r + e.r);
    if (dist2(x, y, e.x, e.y) < rr * rr) {
      dealDamage(e, dmg, true);
    }
  }
  fx.push({ type: "boom", x, y, t: 0.22, r, col: "#f59e0b" });
}

function dealDamage(e, dmg, isAoE = false) {
  if (e.hp <= 0) return;

  e.hitFlash = 0.10;

  // crit
  let final = dmg;
  let crit = false;
  if (!isAoE && Math.random() < critChance()) {
    final *= 2;
    crit = true;
  }

  e.hp -= final;
  player.totalDamage += final;
  runSummary.damage += final;

  spawnFloater(e.x, e.y - e.r - 8, `${Math.floor(final)}`, crit ? "#fbbf24" : "#ffffff", crit);

  // vamp
  const vamp = vampPercent();
  if (vamp > 0) {
    const heal = final * vamp * 0.20; // softer so not broken
    player.hp = Math.min(player.maxHp, player.hp + heal);
  }

  if (e.hp <= 0) {
    e.hp = 0;
    spawnDrops(e.x, e.y, e.xp);
    player.kills++;
    runSummary.kills++;
  }
}

let shotCd = 0;
let droneCd = 0;
let grenadeCd = 0;
let lightningCd = 0;
let shieldCd = 0;
let shieldReady = false;

function autoShoot(dt) {
  shotCd -= dt;
  if (shotCd > 0) return;

  const w = WEAPONS[player.weapon];
  const fire = w.fire / fireMultiplier();
  shotCd = fire;

  const t = nearestEnemy();
  if (!t) return;

  const dx = t.x - player.x, dy = t.y - player.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d, ny = dy / d;

  const addMulti = player.run.multiLv;
  const bulletsN = w.bullets + addMulti; // big effect
  const baseAng = Math.atan2(ny, nx);
  const spread = w.spread + addMulti * 0.05;

  const dmg = player.baseDmg * dmgMultiplier();
  const pierce = w.pierce + player.run.pierceLv;

  for (let i = 0; i < bulletsN; i++) {
    const off = (bulletsN === 1) ? 0 : (i - (bulletsN - 1) / 2);
    const ang = baseAng + off * spread;
    const dirx = Math.cos(ang), diry = Math.sin(ang);
    spawnBullet(player.x, player.y, dirx, diry, dmg, w.speed, pierce, w.col, 3.0);
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (world.arena) {
      const dd = Math.hypot(b.x, b.y);
      if (dd > world.arenaR + 150) { bullets.splice(i, 1); continue; }
    }

    // collisions
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const rr = e.r + b.r;
      if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
        dealDamage(e, b.dmg, false);

        // boom perk
        if (player.run.boomLv > 0) {
          const r = 38 + player.run.boomLv * 6;
          const dmg = b.dmg * (0.35 + player.run.boomLv * 0.06);
          applyExplosion(b.x, b.y, r, dmg);
        }

        if (b.pierce > 0) b.pierce--;
        else b.life = 0;
        break;
      }
    }

    if (b.life <= 0) bullets.splice(i, 1);
  }
}

// ===== Actives visuals: saw / grenade / lightning / frost / drone =====
function sawUpdate(dt) {
  const lv = player.run.sawLv;
  if (lv <= 0) return;

  const count = clamp(1 + Math.floor(lv / 2) + 1, 2, 8);
  const radius = 46 + lv * 7;
  const spin = 2.2 + lv * 0.18;
  const dmg = (10 + lv * 5) * dmgMultiplier();

  for (let i = 0; i < count; i++) {
    const a = runTime * spin + i * (Math.PI * 2 / count);
    const sx = player.x + Math.cos(a) * radius;
    const sy = player.y + Math.sin(a) * radius;

    // damage by proximity
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const rr = e.r + 12;
      if (dist2(sx, sy, e.x, e.y) < rr * rr) {
        dealDamage(e, dmg * dt, true);
      }
    }

    // draw saw as fx marker
    fx.push({ type: "saw", x: sx, y: sy, t: 0.02, r: 11, spin: runTime * 9 + i, col: "#e5e7eb" });
  }
}

function grenadeUpdate(dt) {
  const lv = player.run.grenadeLv;
  if (lv <= 0) return;

  grenadeCd -= dt;
  if (grenadeCd > 0) return;

  grenadeCd = clamp(2.2 - lv * 0.12, 0.9, 2.2);

  const t = nearestEnemy();
  if (!t) return;

  const gx = t.x + rand(-30, 30);
  const gy = t.y + rand(-30, 30);
  const delay = clamp(0.60 - lv * 0.03, 0.30, 0.60);
  const radius = 74 + lv * 10;
  const dmg = (36 + lv * 12) * dmgMultiplier();

  fx.push({ type: "grenade", x: gx, y: gy, t: delay, r: radius, dmg });
}

function lightningUpdate(dt) {
  const lv = player.run.lightningLv;
  if (lv <= 0) return;

  lightningCd -= dt;
  if (lightningCd > 0) return;
  lightningCd = clamp(2.0 - lv * 0.12, 0.65, 2.0);

  const k = clamp(1 + Math.floor(lv / 2), 1, 6);
  const alive = enemies.filter(e => e.hp > 0);
  alive.sort((a, b) => dist2(player.x, player.y, a.x, a.y) - dist2(player.x, player.y, b.x, b.y));
  const targets = alive.slice(0, k);

  const dmg = (22 + lv * 10) * dmgMultiplier();
  for (const t of targets) {
    dealDamage(t, dmg, true);
    fx.push({ type: "zap", x: t.x, y: t.y, t: 0.20, col: "#93c5fd" });
    fx.push({ type: "bolt", x0: player.x, y0: player.y, x1: t.x, y1: t.y, t: 0.12, col: "#93c5fd" });
  }
}

function droneUpdate(dt) {
  const lv = player.run.droneLv;
  if (lv <= 0) return;

  droneCd -= dt;
  if (droneCd > 0) return;
  droneCd = clamp(0.95 - lv * 0.07, 0.28, 0.95);

  const t = nearestEnemy();
  if (!t) return;

  const dx = t.x - player.x, dy = t.y - player.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d, ny = dy / d;

  const dmg = (6 + lv * 3.2) * dmgMultiplier();
  spawnBullet(player.x, player.y, nx, ny, dmg, 820, 0, "#2563eb", 2.8);

  // tiny drone pulse marker
  fx.push({ type: "drone", x: player.x + nx * 18, y: player.y + ny * 18, t: 0.12, col: "#60a5fa" });
}

function shieldUpdate(dt) {
  const lv = player.run.shieldLv;
  if (lv <= 0) { shieldReady = false; return; }

  shieldCd -= dt;
  if (shieldCd <= 0) {
    shieldCd = clamp(7 - lv * 0.65, 2.5, 7);
    shieldReady = true;
  }
}

function frostUpdate(dt) {
  const lv = player.run.frostLv;
  if (lv <= 0) return;
  const radius = 110 + lv * 12;

  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const rr = radius + e.r;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < rr) {
      const slow = clamp(0.18 + lv * 0.05, 0.18, 0.65);
      e.slow = Math.max(e.slow, slow);
      fx.push({ type: "frost", x: e.x, y: e.y, t: 0.05, col: "#bfdbfe" });
    }
  }
}

// ===== Player damage / enemy update =====
function damagePlayer(amount) {
  if (amount <= 0) return;

  // armor
  amount *= (1 - armorReduction());

  if (player.run.shieldLv > 0 && shieldReady) {
    shieldReady = false;
    fx.push({ type: "shield", x: player.x, y: player.y, t: 0.30, col: "#93c5fd" });
    spawnFloater(player.x, player.y - 28, "BLOCK", "#93c5fd", true);
    return;
  }

  player.hp -= amount;
  player.takenDamage += amount;
  fx.push({ type: "hit", x: player.x, y: player.y, t: 0.16, col: "#ef4444" });
  spawnFloater(player.x, player.y - 28, `-${Math.floor(amount)}`, "#ef4444", false);

  if (player.hp <= 0) {
    player.hp = 0;
    finishLevelLose();
  }
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.hp <= 0) continue;

    // decay slow
    e.slow *= Math.pow(0.10, dt);
    const slowMul = 1 - clamp(e.slow, 0, 0.75);

    // boss ult
    if (e.kind === "boss") {
      e.ultTimer -= dt;
      if (e.ultTimer <= 0) {
        e.ultTimer = e.ultCd;
        // ult: spawn extra enemies around player
        const n = randi(4, 7);
        for (let i = 0; i < n; i++) spawnEnemy(save.stage, 4);
        fx.push({ type: "bossUlt", x: e.x, y: e.y, t: 0.45, col: "#ef4444" });
      }
    }

    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = e.sp * slowMul;
    e.x += (dx / d) * sp * dt;
    e.y += (dy / d) * sp * dt;

    if (world.arena) {
      const dd = Math.hypot(e.x, e.y);
      if (dd > world.arenaR) {
        const k = world.arenaR / dd;
        e.x *= k; e.y *= k;
      }
    }

    // collision damage
    const rr = player.r + e.r;
    if (dist2(player.x, player.y, e.x, e.y) < rr * rr) {
      damagePlayer(e.dmg * dt);
    }

    e.hitFlash = Math.max(0, e.hitFlash - dt);
  }
}

function cleanupDeadEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].hp > 0) continue;
    enemies.splice(i, 1);
  }
}

// ===== FX update (grenade explode, etc) =====
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];

    if (f.type === "grenade") {
      f.t -= dt;
      if (f.t <= 0) {
        // explode
        applyExplosion(f.x, f.y, f.r, f.dmg);
        fx.splice(i, 1);
      }
      continue;
    }

    f.t -= dt;
    if (f.t <= 0) fx.splice(i, 1);
  }
}

function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t -= dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vy += 30 * dt;
    if (f.t <= 0) floaters.splice(i, 1);
  }
}

// ===== Level-up UI =====
let pendingUpgrades = [];
function openLevelUp() {
  if (state !== STATE.RUN) return;
  pendingUpgrades = pickUpgrades3();

  if (!ui.upgradeGrid) return;

  ui.upgradeGrid.innerHTML = "";
  pendingUpgrades.forEach(u => {
    const lv = u.lvl();
    const d = document.createElement("div");
    d.className = "card";
    d.innerHTML = `
      <div class="cardTitle">${u.name} <span class="badge">LV ${lv}/${u.max}</span></div>
      <div class="cardDesc">${u.desc}</div>
      <div class="cardRow">
        <div class="chip">Выбрать</div>
        <button class="btn small primary">Взять</button>
      </div>
    `;
    d.querySelector("button").addEventListener("click", () => {
      u.apply();
      setState(STATE.RUN);
      showToast(`Взято: ${u.name}`);
    });
    ui.upgradeGrid.appendChild(d);
  });

  setState(STATE.LEVELUP);
}

// ===== Player movement / camera =====
function updatePlayer(dt) {
  const speed = player.baseSpeed * speedMultiplier();
  const len = Math.hypot(joy.dx, joy.dy);
  let nx = 0, ny = 0;
  if (joy.active && len > 6) { nx = joy.dx / len; ny = joy.dy / len; }

  player.x += nx * speed * joy.mag * dt;
  player.y += ny * speed * joy.mag * dt;

  if (world.arena) {
    const d = Math.hypot(player.x, player.y);
    if (d > world.arenaR) {
      const k = world.arenaR / d;
      player.x *= k; player.y *= k;
    }
  }

  world.camX = player.x;
  world.camY = player.y;

  // regen
  if (player.run.regenLv > 0) {
    const regen = (0.35 + player.run.regenLv * 0.18) * dt;
    player.hp = Math.min(player.maxHp, player.hp + regen);
  }
}

// ===== Coordinate transform =====
function worldToScreen(x, y) {
  const sx = W / 2 + (x - world.camX);
  const sy = H / 2 + (y - world.camY);
  return { sx, sy };
}

// ===== Drawing helpers =====
function drawHPBarAt(sx, sy, w, h, p, colFill) {
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(sx - w / 2, sy, w, h);
  ctx.fillStyle = colFill;
  ctx.fillRect(sx - w / 2, sy, w * clamp(p, 0, 1), h);
}

function drawMapBackground() {
  const p = world.mapPalette;
  // grass base
  ctx.fillStyle = p.grass;
  ctx.fillRect(0, 0, W, H);

  // tile-ish noise
  const tile = 80;
  const ox = ((-world.camX) % tile + tile) % tile;
  const oy = ((-world.camY) % tile + tile) % tile;

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = p.grass2;
  for (let x = ox - tile; x <= W + tile; x += tile) {
    for (let y = oy - tile; y <= H + tile; y += tile) {
      if (((x / tile + y / tile) | 0) % 2 === 0) {
        ctx.fillRect(x, y, tile, tile);
      }
    }
  }
  ctx.globalAlpha = 1;

  // dirt path bands
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = p.path;
  for (let i = 0; i < 8; i++) {
    const y = ((i * 140 + (world.camY * 0.25)) % (H + 200)) - 100;
    ctx.fillRect(0, y, W, 34);
  }
  ctx.globalAlpha = 1;

  // arena ring
  if (world.arena) {
    const dx = -world.camX;
    const dy = -world.camY;
    ctx.save();
    ctx.translate(W / 2 + dx, H / 2 + dy);
    ctx.strokeStyle = "rgba(0,0,0,.20)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, world.arenaR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ===== Sprite-like drawings (no images) =====
function heroColor() {
  return (COS_COLORS.find(c => c.id === save.cosmetics.color)?.col) || "#2563eb";
}

function drawHero() {
  const { sx, sy } = worldToScreen(player.x, player.y);
  const col = heroColor();
  const aura = save.cosmetics.aura || "None";

  // shadow
  ctx.fillStyle = world.mapPalette.shadow;
  ctx.beginPath();
  ctx.ellipse(sx, sy + 18, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // aura
  if (aura === "Pulse") {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, 26 + Math.sin(runTime * 5) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (aura === "Halo") {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(sx, sy, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // body (hoodie-ish)
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.roundRect(sx - 14, sy - 18, 28, 32, 10);
  ctx.fill();

  // head
  ctx.fillStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.arc(sx, sy - 26, 10, 0, Math.PI * 2);
  ctx.fill();

  // eyes (red)
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(sx - 6, sy - 28, 3, 2);
  ctx.fillRect(sx + 3, sy - 28, 3, 2);

  // pants
  ctx.fillStyle = "#111827";
  ctx.fillRect(sx - 13, sy + 10, 10, 12);
  ctx.fillRect(sx + 3, sy + 10, 10, 12);

  // stripes adidas
  ctx.fillStyle = "rgba(255,255,255,.65)";
  ctx.fillRect(sx - 12, sy + 12, 1, 10);
  ctx.fillRect(sx - 9, sy + 12, 1, 10);
  ctx.fillRect(sx - 6, sy + 12, 1, 10);

  // arms
  ctx.fillStyle = col;
  ctx.fillRect(sx - 22, sy - 8, 8, 14);
  ctx.fillRect(sx + 14, sy - 8, 8, 14);

  // gun direction
  const t = nearestEnemy();
  let ang = 0;
  if (t) ang = Math.atan2(t.y - player.y, t.x - player.x);
  const gx = sx + Math.cos(ang) * 18;
  const gy = sy + Math.sin(ang) * 8;

  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(ang);
  // weapon
  ctx.fillStyle = "#0b1022";
  ctx.beginPath();
  ctx.roundRect(-4, -3, 18, 6, 3);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(8, -2, 6, 1);
  ctx.restore();

  // player HP bar over head
  const hpP = player.hp / player.maxHp;
  drawHPBarAt(sx, sy - 48, 56, 7, hpP, hpP > 0.35 ? "#22c55e" : "#ef4444");
}

function drawEnemy(e) {
  const { sx, sy } = worldToScreen(e.x, e.y);
  const flash = e.hitFlash > 0 ? 0.6 : 0;

  // shadow
  ctx.fillStyle = world.mapPalette.shadow;
  ctx.beginPath();
  ctx.ellipse(sx, sy + e.r + 8, e.r * 0.9, e.r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
  ctx.fillStyle = flash ? "#ffffff" : e.col;
  ctx.beginPath();
  ctx.roundRect(sx - e.r, sy - e.r, e.r * 2, e.r * 2, 10);
  ctx.fill();

  // face
  ctx.fillStyle = "#111827";
  if (e.kind === "boss") {
    ctx.fillRect(sx - 12, sy - 10, 24, 6);
    ctx.fillRect(sx - 10, sy + 2, 20, 5);
  } else {
    // eyes
    ctx.fillRect(sx - 7, sy - 6, 3, 2);
    ctx.fillRect(sx + 4, sy - 6, 3, 2);
    // mouth
    ctx.fillRect(sx - 5, sy + 4, 10, 2);
  }

  // baton for police vibe (still abstract)
  ctx.fillStyle = "#111827";
  ctx.save();
  ctx.translate(sx + e.r - 6, sy + 2);
  ctx.rotate(-0.6);
  ctx.fillRect(-2, -10, 4, 22);
  ctx.restore();

  // hp bar
  const p = e.hp / e.maxHp;
  drawHPBarAt(sx, sy - e.r - 14, 56, 6, p, e.kind === "boss" ? "#ef4444" : "#22c55e");

  // slow indicator
  if (e.slow > 0.12) {
    ctx.save();
    ctx.globalAlpha = clamp(e.slow, 0.15, 0.6);
    ctx.strokeStyle = "#bfdbfe";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, e.r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBullet(b) {
  const { sx, sy } = worldToScreen(b.x, b.y);
  ctx.fillStyle = b.col;
  ctx.beginPath();
  ctx.arc(sx, sy, b.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawDrop(d) {
  const { sx, sy } = worldToScreen(d.x, d.y);
  ctx.fillStyle = d.col;
  ctx.beginPath();
  ctx.arc(sx, sy, d.r, 0, Math.PI * 2);
  ctx.fill();
  // icon-ish
  ctx.fillStyle = "rgba(0,0,0,.35)";
  if (d.type === "coin") ctx.fillRect(sx - 2, sy - 4, 4, 8);
  if (d.type === "gem") ctx.fillRect(sx - 3, sy - 3, 6, 6);
  if (d.type === "xp") ctx.fillRect(sx - 3, sy - 1, 6, 2);
}

function drawSawFx(f) {
  const { sx, sy } = worldToScreen(f.x, f.y);
  const r = f.r;

  // metal disk
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(f.spin);
  ctx.fillStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // teeth
  ctx.fillStyle = "#9ca3af";
  for (let i = 0; i < 10; i++) {
    ctx.rotate((Math.PI * 2) / 10);
    ctx.beginPath();
    ctx.moveTo(r - 2, 0);
    ctx.lineTo(r + 5, 2);
    ctx.lineTo(r + 5, -2);
    ctx.closePath();
    ctx.fill();
  }

  // center
  ctx.fillStyle = "#6b7280";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawFx() {
  for (const f of fx) {
    if (f.type === "boom") {
      const { sx, sy } = worldToScreen(f.x, f.y);
      ctx.save();
      ctx.globalAlpha = clamp(f.t / 0.22, 0, 1);
      ctx.strokeStyle = f.col;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(sx, sy, f.r * (1 - f.t / 0.22), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (f.type === "zap") {
      const { sx, sy } = worldToScreen(f.x, f.y);
      ctx.save();
      ctx.globalAlpha = clamp(f.t / 0.20, 0, 1);
      ctx.strokeStyle = f.col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 24);
      ctx.lineTo(sx, sy + 24);
      ctx.stroke();
      ctx.restore();
    } else if (f.type === "bolt") {
      const { sx: x0, sy: y0 } = worldToScreen(f.x0, f.y0);
      const { sx: x1, sy: y1 } = worldToScreen(f.x1, f.y1);
      ctx.save();
      ctx.globalAlpha = clamp(f.t / 0.12, 0, 1);
      ctx.strokeStyle = f.col;
      ctx.lineWidth = 3;

      // jagged lightning
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      const seg = 5;
      for (let i = 1; i < seg; i++) {
        const t = i / seg;
        const x = lerp(x0, x1, t) + rand(-10, 10);
        const y = lerp(y0, y1, t) + rand(-10, 10);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.restore();
    } else if (f.type === "bossUlt") {
      const { sx, sy } = worldToScreen(f.x, f.y);
      ctx.save();
      ctx.globalAlpha = clamp(f.t / 0.45, 0, 1);
      ctx.strokeStyle = f.col;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(sx, sy, 52 * (1 - f.t / 0.45) + 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (f.type === "shield") {
      const { sx, sy } = worldToScreen(f.x, f.y);
      ctx.save();
      ctx.globalAlpha = clamp(f.t / 0.30, 0, 1);
      ctx.strokeStyle = f.col;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(sx, sy, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (f.type === "drone") {
      const { sx, sy } = worldToScreen(f.x, f.y);
      ctx.save();
      ctx.globalAlpha = clamp(f.t / 0.12, 0, 1);
      ctx.fillStyle = f.col;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (f.type === "frost") {
      const { sx, sy } = worldToScreen(f.x, f.y);
      ctx.save();
      ctx.globalAlpha = 0.20;
      ctx.fillStyle = f.col;
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
      ctx.restore();
    } else if (f.type === "saw") {
      drawSawFx(f);
    } else if (f.type === "grenade") {
      // show grenade target
      const { sx, sy } = worldToScreen(f.x, f.y);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fill();

      // fuse spark
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(sx + 6, sy - 6, 3, 0, Math.PI * 2);
      ctx.fill();

      // countdown ring
      const p = clamp(f.t / 0.60, 0, 1);
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, 16, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2) * p);
      ctx.stroke();

      // radius hint
      ctx.globalAlpha = 0.10;
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, f.r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  // frost aura ring
  if (player.run.frostLv > 0) {
    const { sx, sy } = worldToScreen(player.x, player.y);
    const r = 110 + player.run.frostLv * 12;
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = "#bfdbfe";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawFloaters() {
  for (const f of floaters) {
    const { sx, sy } = worldToScreen(f.x, f.y);
    ctx.save();
    ctx.globalAlpha = clamp(f.t / 0.9, 0, 1);
    ctx.fillStyle = f.col;
    ctx.font = `${f.big ? 16 : 14}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText(f.text, sx, sy);
    ctx.restore();
  }
}

// ===== HUD update =====
function updateHUD() {
  if (!ui.hudStage) return;

  ui.hudStage.textContent = `Этап ${save.stage} · ${save.levelInStage}/5`;
  ui.hudMap.textContent = `${world.mapName}${world.arena ? " · Арена" : ""}`;
  ui.hudTime.textContent = fmtTime(runTime);
  ui.hudCoins.textContent = `🪙 ${player.coins}`;
  ui.hudGems.textContent = `💎 ${player.gems}`;

  // HP bar
  const hpP = player.hp / player.maxHp;
  if (ui.hudHPText) ui.hudHPText.textContent = `${Math.floor(player.hp)}/${Math.floor(player.maxHp)}`;
  if (ui.hudHPBar) ui.hudHPBar.style.width = `${Math.floor(clamp(hpP, 0, 1) * 100)}%`;

  // XP bar
  const xpP = xp.cur / xp.need;
  if (ui.hudXPText) ui.hudXPText.textContent = `LV ${xp.level} · ${xp.cur}/${xp.need}`;
  if (ui.hudXPBar) ui.hudXPBar.style.width = `${Math.floor(clamp(xpP, 0, 1) * 100)}%`;
}

// ===== Main update loop =====
let prev = performance.now();

function tick(now) {
  const dt = clamp((now - prev) / 1000, 0.008, 0.05);
  prev = now;

  if (state === STATE.RUN) {
    runTime += dt;

    updatePlayer(dt);
    doSpawn(dt);

    autoShoot(dt);
    droneUpdate(dt);
    grenadeUpdate(dt);
    lightningUpdate(dt);
    shieldUpdate(dt);
    frostUpdate(dt);
    sawUpdate(dt);

    updateBullets(dt);
    updateEnemies(dt);
    updateFx(dt);
    updateFloaters(dt);
    pickupDrops(dt);
    cleanupDeadEnemies();

    // win check
    if (levelWave.done) {
      // stop gameplay and show summary
      finishLevelWin();
      return requestAnimationFrame(tick);
    }

    // draw
    drawMapBackground();
    // drops
    for (const d of drops) drawDrop(d);
    // bullets
    for (const b of bullets) drawBullet(b);
    // enemies
    for (const e of enemies) if (e.hp > 0) drawEnemy(e);
    // hero
    drawHero();
    // fx
    drawFx();
    // floaters
    drawFloaters();

    updateHUD();
  } else if (state === STATE.MENU) {
    // animated menu background
    world.camX = Math.sin(now / 1400) * 120;
    world.camY = Math.cos(now / 1700) * 120;
    world.mapPalette = mapForStage(save.stage).palette;
    world.mapName = mapForStage(save.stage).name;
    drawMapBackground();

    // preview hero
    player.x = 0; player.y = 0;
    drawHero();
  } else {
    // paused / levelup / shop / etc: still show last frame-ish
    drawMapBackground();
    for (const d of drops) drawDrop(d);
    for (const b of bullets) drawBullet(b);
    for (const e of enemies) if (e.hp > 0) drawEnemy(e);
    drawHero();
    drawFx();
    drawFloaters();
    updateHUD();
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ===== UI EVENTS =====
ui.btnPlay?.addEventListener("click", () => startGame());
ui.btnPause?.addEventListener("click", () => {
  if (state !== STATE.RUN) return;
  if (ui.pauseTitle) ui.pauseTitle.textContent = "Пауза";
  setState(STATE.PAUSE);
});
ui.btnResume?.addEventListener("click", () => {
  if (ui.pauseTitle && ui.pauseTitle.textContent === "Поражение") {
    // retry same level
    resetLevelRuntime();
    setState(STATE.RUN);
    return;
  }
  setState(STATE.RUN);
});
ui.btnToMenu?.addEventListener("click", () => {
  setState(STATE.MENU);
  updateMenuWallet();
});
ui.btnShop?.addEventListener("click", () => {
  renderShop();
  setState(STATE.SHOP);
});
ui.btnLoadout?.addEventListener("click", () => {
  renderLoadout();
  setState(STATE.LOADOUT);
});
ui.btnReset?.addEventListener("click", () => hardReset());

ui.btnCloseShop?.addEventListener("click", () => { setState(STATE.MENU); updateMenuWallet(); });
ui.btnCloseLoadout?.addEventListener("click", () => { setState(STATE.MENU); updateMenuWallet(); });

ui.tabs?.forEach(t => {
  t.addEventListener("click", () => {
    ui.tabs.forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    const tab = t.dataset.tab;
    ui.shopMeta?.classList.toggle("hidden", tab !== "meta");
    ui.shopWeapons?.classList.toggle("hidden", tab !== "weapons");
    ui.shopCosmetics?.classList.toggle("hidden", tab !== "cosmetics");
  });
});

ui.dockShop?.addEventListener("click", () => { renderShop(); setState(STATE.SHOP); });
ui.dockLoadout?.addEventListener("click", () => { renderLoadout(); setState(STATE.LOADOUT); });
ui.dockSkills?.addEventListener("click", () => {
  const s = player.run;
  showToast(`Навыки: пилы ${s.sawLv} · гранаты ${s.grenadeLv} · молния ${s.lightningLv} · дрон ${s.droneLv} · щит ${s.shieldLv}`);
});
ui.dockQuit?.addEventListener("click", () => { setState(STATE.MENU); updateMenuWallet(); });

ui.btnNext?.addEventListener("click", () => {
  // after summary: if level just finished and it was stage completion (we advanced stage)
  // detect: if we just finished level 5 -> we already advanced stage and set levelInStage=1
  // show chest after stage advance
  if (save.levelInStage === 1) {
    stageCompleted();
  } else {
    // next level start (skills reset each level)
    resetLevelRuntime();
    setState(STATE.RUN);
  }
});

// Chest logic
let chestOpened = false;
ui.chest?.addEventListener("click", () => {
  if (chestOpened) return;
  chestOpened = true;

  // random rewards
  const roll = Math.random();
  let msg = "";
  if (roll < 0.65) {
    const c = randi(250, 600) + save.stage * 40;
    save.coins += c;
    msg = `Сундук: +🪙 ${c}`;
  } else if (roll < 0.90) {
    const g = randi(2, 6);
    save.gems += g;
    msg = `Сундук: +💎 ${g}`;
  } else {
    // bonus meta upgrade (random)
    const keys = ["hp", "dmg", "firerate", "movespeed", "magnet"];
    const k = keys[randi(0, keys.length - 1)];
    save.meta[k] = (save.meta[k] ?? 0) + 1;
    msg = `Сундук: +мета прокачка (${k})`;
  }

  writeSave();
  if (ui.chestHint) ui.chestHint.textContent = msg;
  showToast("Сундук открыт 🎁", 1200);
});

ui.btnChestContinue?.addEventListener("click", () => {
  chestOpened = false;
  // start new stage level 1
  resetLevelRuntime();
  setState(STATE.RUN);
});

// ===== INIT =====
setState(STATE.MENU);
renderShop();

// If your CSS uses custom roundRect not supported, ensure polyfill:
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
   }
