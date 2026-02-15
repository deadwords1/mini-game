/* VOIDRUN: Survivor Arena (v2 clean build)
   - Mobile first, GitHub Pages ready
   - Joystick RIGHT, autoshoot
   - Skill levels (pick 1/3 on XP levelup)
   - Visible saws/grenades/lightning/drone/shield
   - Damage numbers, enemy HP bars, player HP bar
   - Stage system: 5 levels per stage, level 5 = boss + ult
   - Level summary modal
   - Stage chest with roulette (closeable + continue)
   - Shop: center categories -> category list (meta/weapons/pets/cosmetics)
   - Persistent progress via localStorage
   - Background flicker fix (snap camera ints for background)
*/

(() => {
  "use strict";

  // ===== Canvas =====
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

    banner: el("banner"),

    dock: el("dock"),
    dockShop: el("dockShop"),
    dockUpgrades: el("dockUpgrades"),
    dockLoadout: el("dockLoadout"),
    dockQuit: el("dockQuit"),

    joyWrap: el("joyWrap"),
    joyBase: el("joyBase"),
    joyKnob: el("joyKnob"),

    toast: el("toast"),

    screenMenu: el("screenMenu"),
    menuProgress: el("menuProgress"),
    menuCoins: el("menuCoins"),
    menuGems: el("menuGems"),
    btnPlay: el("btnPlay"),
    btnShop: el("btnShop"),
    btnLoadout: el("btnLoadout"),
    btnReset: el("btnReset"),

    screenPause: el("screenPause"),
    pauseTitle: el("pauseTitle"),
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
    btnChestClose: el("btnChestClose"),
    chest: el("chest"),
    chestHint: el("chestHint"),
    btnChestContinue: el("btnChestContinue"),

    screenShop: el("screenShop"),
    btnCloseShop: el("btnCloseShop"),
    shopCoins: el("shopCoins"),
    shopGems: el("shopGems"),
    shopHome: el("shopHome"),
    shopCategory: el("shopCategory"),
    shopTitle: el("shopTitle"),
    shopList: el("shopList"),
    btnShopBack: el("btnShopBack"),
    catMeta: el("catMeta"),
    catWeapons: el("catWeapons"),
    catPets: el("catPets"),
    catCosmetics: el("catCosmetics"),

    screenLoadout: el("screenLoadout"),
    btnCloseLoadout: el("btnCloseLoadout"),
    loadoutGrid: el("loadoutGrid"),
  };

  function showToast(text, ms = 1200) {
    ui.toast.textContent = text;
    ui.toast.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => ui.toast.classList.add("hidden"), ms);
  }

  // ===== Utils =====
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };
  const lerp = (a, b, t) => a + (b - a) * t;

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  // ===== Save =====
  const SAVE_KEY = "voidrun_survivor_v2_clean";
  const defaultSave = () => ({
    coins: 0, gems: 0,
    stage: 1, levelInStage: 1,

    unlockedWeapons: ["Pistol"],
    equippedWeapon: "Pistol",

    meta: { hp: 0, dmg: 0, firerate: 0, movespeed: 0, magnet: 0 },

    cosmetics: { owned: ["Blue"], color: "Blue" },

    pets: { owned: [], equipped: "None" }
  });

  let save = loadSave();
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      const s = JSON.parse(raw);
      const d = defaultSave();
      return {
        ...d, ...s,
        meta: { ...d.meta, ...(s.meta || {}) },
        cosmetics: { ...d.cosmetics, ...(s.cosmetics || {}) },
        pets: { ...d.pets, ...(s.pets || {}) }
      };
    } catch {
      return defaultSave();
    }
  }

  function writeSave() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    updateWalletUI();
  }

  function hardReset() {
    save = defaultSave();
    writeSave();
    showToast("Прогресс сброшен");
  }

  function updateWalletUI() {
    ui.menuCoins.textContent = `🪙 ${save.coins}`;
    ui.menuGems.textContent = `💎 ${save.gems}`;
    ui.menuProgress.textContent = `Прогресс: Этап ${save.stage} · Уровень ${save.levelInStage}/5`;

    ui.shopCoins.textContent = `🪙 ${save.coins}`;
    ui.shopGems.textContent = `💎 ${save.gems}`;
  }
  updateWalletUI();

  // ===== State =====
  const STATE = {
    MENU: "menu",
    RUN: "run",
    PAUSE: "pause",
    LEVELUP: "levelup",
    SUMMARY: "summary",
    CHEST: "chest",
    SHOP: "shop",
    LOADOUT: "loadout"
  };
  let state = STATE.MENU;

  function setState(s) {
    state = s;

    ui.screenMenu.classList.toggle("hidden", s !== STATE.MENU);
    ui.screenPause.classList.toggle("hidden", s !== STATE.PAUSE);
    ui.screenLevelUp.classList.toggle("hidden", s !== STATE.LEVELUP);
    ui.screenSummary.classList.toggle("hidden", s !== STATE.SUMMARY);
    ui.screenChest.classList.toggle("hidden", s !== STATE.CHEST);
    ui.screenShop.classList.toggle("hidden", s !== STATE.SHOP);
    ui.screenLoadout.classList.toggle("hidden", s !== STATE.LOADOUT);

    const inRun = (s === STATE.RUN || s === STATE.PAUSE || s === STATE.LEVELUP || s === STATE.SUMMARY || s === STATE.CHEST);
    ui.hud.classList.toggle("hidden", !inRun);
    ui.dock.classList.toggle("hidden", !inRun);
    ui.joyWrap.classList.toggle("hidden", !inRun);

    // Banner hidden by default if not run
    if (!inRun) ui.banner.classList.add("hidden");
  }

  // ===== Maps (nice backgrounds) =====
  const MAPS = [
    { id: "fields", name: "Поля", palette: { grass: "#6bd66f", grass2: "#59c963", dirt: "#b5884c", dirt2: "#9a6b38", path: "#d6c199" } },
    { id: "desert", name: "Пустыня", palette: { grass: "#f1dea8", grass2: "#e8cd7a", dirt: "#c09064", dirt2: "#a87448", path: "#f7ecc7" } },
    { id: "snow", name: "Снега", palette: { grass: "#e8f1ff", grass2: "#cfe1ff", dirt: "#96c0ff", dirt2: "#6ea4ff", path: "#ffffff" } },
    { id: "toxic", name: "Токсик", palette: { grass: "#1f2937", grass2: "#111827", dirt: "#22c55e", dirt2: "#16a34a", path: "#0b3d2e" } },
  ];
  function mapForStage(stage) {
    return MAPS[(stage - 1) % MAPS.length];
  }

  const world = {
    camX: 0, camY: 0,
    mapName: "Поля",
    mapPalette: MAPS[0].palette,
    arena: false,
    arenaR: 560
  };

  // ===== Content data =====
  const WEAPONS = {
    Pistol: { name: "Пистолет", baseDmg: 8, fire: 0.18, speed: 740, spread: 0.00, bullets: 1, pierce: 0, col: "#111827" },
    SMG: { name: "SMG", baseDmg: 6, fire: 0.11, speed: 800, spread: 0.08, bullets: 1, pierce: 0, col: "#0f766e" },
    Shotgun: { name: "Дробовик", baseDmg: 6, fire: 0.45, speed: 680, spread: 0.33, bullets: 5, pierce: 0, col: "#a16207" },
    Laser: { name: "Лазер", baseDmg: 11, fire: 0.25, speed: 980, spread: 0.02, bullets: 1, pierce: 2, col: "#1d4ed8" },
  };

  const WEAPON_ITEMS = [
    { id: "SMG", costC: 2600, desc: "Быстро стреляет, меньше урон." },
    { id: "Shotgun", costC: 3400, desc: "Залп дробью, сильный контроль." },
    { id: "Laser", costG: 25, desc: "Пробивает врагов, сильный урон." },
  ];

  const META_ITEMS = [
    { key: "hp", name: "Живучесть", desc: "+10 HP навсегда", costC: 450, max: 25 },
    { key: "dmg", name: "Урон", desc: "+4% урона навсегда", costC: 550, max: 35 },
    { key: "firerate", name: "Темп огня", desc: "+3% скорострельности навсегда", costC: 600, max: 35 },
    { key: "movespeed", name: "Скорость", desc: "+3% скорость навсегда", costC: 520, max: 30 },
    { key: "magnet", name: "Магнит", desc: "+10% радиус подбора", costC: 420, max: 25 },
  ];

  const COS_COLORS = [
    { id: "Blue", name: "Синий", priceC: 0, col: "#2563eb" },
    { id: "Red", name: "Красный", priceC: 450, col: "#ef4444" },
    { id: "Green", name: "Зелёный", priceC: 450, col: "#22c55e" },
    { id: "Violet", name: "Фиолет", priceC: 650, col: "#a78bfa" },
    { id: "Gold", name: "Золото", priceG: 18, col: "#f59e0b" },
  ];

  const RARITY = {
    Common: { w: 55, col: "#9ca3af", name: "Обычный" },
    Uncommon: { w: 25, col: "#22c55e", name: "Необычный" },
    Rare: { w: 12, col: "#3b82f6", name: "Редкий" },
    Legendary: { w: 6, col: "#f59e0b", name: "Легендарный" },
    Mythic: { w: 2, col: "#a78bfa", name: "Мифический" },
  };

  const PETS = [
    { id: "cat", name: "Кот", rar: "Common", coin: 0.05, dmg: 0.00 },
    { id: "dog", name: "Пёс", rar: "Common", coin: 0.03, dmg: 0.03 },
    { id: "owl", name: "Сова", rar: "Uncommon", coin: 0.08, dmg: 0.02 },
    { id: "fox", name: "Лиса", rar: "Uncommon", coin: 0.05, dmg: 0.06 },
    { id: "wolf", name: "Волк", rar: "Rare", coin: 0.06, dmg: 0.10 },
    { id: "tiger", name: "Тигр", rar: "Legendary", coin: 0.10, dmg: 0.15 },
    { id: "dragon", name: "Дракон", rar: "Mythic", coin: 0.15, dmg: 0.22 },
  ];

  function ownsWeapon(id) { return save.unlockedWeapons.includes(id); }
  function petOwned(id) { return save.pets.owned.includes(id); }

  function rarityPick(list) {
    let sum = 0;
    for (const it of list) sum += (RARITY[it.rar]?.w ?? 1);
    let r = Math.random() * sum;
    for (const it of list) {
      r -= (RARITY[it.rar]?.w ?? 1);
      if (r <= 0) return it;
    }
    return list[list.length - 1];
  }

  function petBuff() {
    const id = save.pets.equipped;
    if (!id || id === "None") return { coin: 0, dmg: 0 };
    const p = PETS.find(x => x.id === id);
    if (!p) return { coin: 0, dmg: 0 };
    return { coin: p.coin, dmg: p.dmg };
  }

  // ===== Player / run =====
  const player = {
    x: 0, y: 0, r: 16,
    hp: 100, maxHp: 100,
    baseDmg: 8, baseFire: 0.18, baseSpeed: 250,
    magnet: 1,
    weapon: "Pistol",

    coins: 0, gems: 0, kills: 0,
    totalDamage: 0,
    takenDamage: 0,

    run: {}
  };

  const xp = { cur: 0, need: 10, level: 1 };
  let runTime = 0;

  // Entities arrays
  const enemies = [];
  const bullets = [];
  const drops = [];
  const fx = [];
  const floaters = [];

  // ===== Skills =====
  function initRunSkills() {
    player.run = {
      dmgLv: 0, fireLv: 0, spdLv: 0, hpLv: 0, regenLv: 0, magnetLv: 0,
      critLv: 0, vampLv: 0, armorLv: 0,
      sawLv: 0, grenadeLv: 0, lightningLv: 0, droneLv: 0, shieldLv: 0, frostLv: 0,
      pierceLv: 0, multiLv: 0, boomLv: 0,
    };
  }

  function skillPool() {
    const r = player.run;
    return [
      { id: "DMG", name: "Урон", desc: "Больше урона", lvl: () => r.dmgLv, max: 10, apply: () => r.dmgLv++ },
      { id: "FIRE", name: "Темп огня", desc: "Стреляешь чаще", lvl: () => r.fireLv, max: 10, apply: () => r.fireLv++ },
      { id: "SPD", name: "Скорость", desc: "Бегаешь быстрее", lvl: () => r.spdLv, max: 8, apply: () => r.spdLv++ },
      { id: "HP", name: "Макс HP", desc: "+HP на уровень", lvl: () => r.hpLv, max: 10, apply: () => { r.hpLv++; const add = 18; player.maxHp += add; player.hp += add; } },
      { id: "REGEN", name: "Реген", desc: "Лечит со временем", lvl: () => r.regenLv, max: 8, apply: () => r.regenLv++ },
      { id: "MAG", name: "Магнит", desc: "Подбор дальше", lvl: () => r.magnetLv, max: 10, apply: () => r.magnetLv++ },
      { id: "CRIT", name: "Криты", desc: "Шанс крита", lvl: () => r.critLv, max: 10, apply: () => r.critLv++ },
      { id: "VAMP", name: "Вампиризм", desc: "Хил от урона", lvl: () => r.vampLv, max: 8, apply: () => r.vampLv++ },
      { id: "ARM", name: "Броня", desc: "Меньше урона", lvl: () => r.armorLv, max: 10, apply: () => r.armorLv++ },

      { id: "SAW", name: "Пилы", desc: "Пилы вокруг тебя", lvl: () => r.sawLv, max: 10, apply: () => r.sawLv++ },
      { id: "GREN", name: "Гранаты", desc: "Взрывы по толпе", lvl: () => r.grenadeLv, max: 10, apply: () => r.grenadeLv++ },
      { id: "LIT", name: "Молния", desc: "Бьёт по врагам", lvl: () => r.lightningLv, max: 10, apply: () => r.lightningLv++ },
      { id: "DRONE", name: "Дрон", desc: "Доп. стрельба", lvl: () => r.droneLv, max: 10, apply: () => r.droneLv++ },
      { id: "SHIELD", name: "Щит", desc: "Блок удара", lvl: () => r.shieldLv, max: 8, apply: () => r.shieldLv++ },
      { id: "FROST", name: "Лёд", desc: "Замедляет рядом", lvl: () => r.frostLv, max: 8, apply: () => r.frostLv++ },

      { id: "PIERCE", name: "Пробитие", desc: "Пули пробивают", lvl: () => r.pierceLv, max: 6, apply: () => r.pierceLv++ },
      { id: "MULTI", name: "Мульти-выстрел", desc: "+пули", lvl: () => r.multiLv, max: 6, apply: () => r.multiLv++ },
      { id: "BOOM", name: "Взрыв пуль", desc: "Малый AoE", lvl: () => r.boomLv, max: 6, apply: () => r.boomLv++ },
    ];
  }

  function pickUpgrades3() {
    const pool = skillPool().filter(s => s.lvl() < s.max);
    if (pool.length <= 0) {
      return [
        { id: "HEAL", name: "❤ Хил", desc: "Восстановить HP", lvl: () => 0, max: 999, apply: () => { player.hp = Math.min(player.maxHp, player.hp + 45); } },
        { id: "COIN", name: "🪙 Монеты", desc: "+монеты", lvl: () => 0, max: 999, apply: () => { player.coins += 80; } },
        { id: "XP", name: "XP", desc: "+XP", lvl: () => 0, max: 999, apply: () => { xp.cur += 10; } },
      ];
    }
    const picks = [];
    while (picks.length < 3 && pool.length > 0) {
      picks.push(pool.splice(randi(0, pool.length - 1), 1)[0]);
    }
    while (picks.length < 3) {
      picks.push({ id: "HEAL", name: "❤ Хил", desc: "Восстановить HP", lvl: () => 0, max: 999, apply: () => { player.hp = Math.min(player.maxHp, player.hp + 35); } });
    }
    return picks;
  }

  // ===== Combat multipliers =====
  function dmgMultiplier() {
    const meta = 1 + (save.meta.dmg * 0.04);
    const run = 1 + (player.run.dmgLv * 0.15);
    const pet = 1 + petBuff().dmg;
    return meta * run * pet;
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
  function critChance() { return clamp(player.run.critLv * 0.05, 0, 0.45); }
  function armorReduction() { return clamp(player.run.armorLv * 0.05, 0, 0.45); }
  function vampPercent() { return clamp(player.run.vampLv * 0.03, 0, 0.25); }

  // ===== Enemy system =====
  function enemyTier(stage, levelInStage) {
    const t = (stage - 1) * 5 + (levelInStage - 1);
    const baseHp = 26 + t * 7;
    const baseSp = 86 + t * 2.7;
    const baseDmg = 12 + t * 1.25;

    const roll = Math.random();
    if (roll < 0.60) return { kind: "grunt", hp: baseHp, sp: baseSp, dmg: baseDmg, r: 16, col: "#f3f4f6", xp: 1 };
    if (roll < 0.85) return { kind: "brute", hp: baseHp * 2.3, sp: baseSp * 0.70, dmg: baseDmg * 1.4, r: 21, col: "#fb923c", xp: 2 };
    return { kind: "runner", hp: baseHp * 0.95, sp: baseSp * 1.35, dmg: baseDmg * 0.95, r: 14, col: "#22c55e", xp: 2 };
  }

  function bossTier(stage) {
    const t = (stage - 1) * 5 + 4;
    return {
      kind: "boss",
      hp: 520 + t * 110,
      sp: 78 + t * 2.0,
      dmg: 22 + t * 2.2,
      r: 40,
      col: "#ef4444",
      xp: 14,
      ultCd: 6.0,
      ultTimer: 2.0
    };
  }

  // ===== Stage/Level flow =====
  const levelWave = { t: 0, spawnT: 0, done: false, boss: null, bossSpawned: false };
  const runSummary = { xpPicked: 0, coinsPicked: 0, gemsPicked: 0, kills: 0, damage: 0 };

  function resetSummary() {
    runSummary.xpPicked = 0;
    runSummary.coinsPicked = 0;
    runSummary.gemsPicked = 0;
    runSummary.kills = 0;
    runSummary.damage = 0;
  }

  // ===== Banner + Danger =====
  let bannerT = 0;
  let bannerText = "";
  let dangerT = 0;

  function showBanner(text, sec = 2.8) {
    bannerText = text;
    bannerT = sec;
    ui.banner.textContent = text;
    ui.banner.classList.remove("hidden");
  }

  // ===== Reset level runtime =====
  function resetLevelRuntime() {
    runTime = 0;
    xp.cur = 0; xp.need = 10; xp.level = 1;

    player.coins = 0; player.gems = 0; player.kills = 0;
    player.totalDamage = 0; player.takenDamage = 0;

    enemies.length = 0;
    bullets.length = 0;
    drops.length = 0;
    fx.length = 0;
    floaters.length = 0;

    resetSummary();

    const m = mapForStage(save.stage);
    world.mapName = m.name;
    world.mapPalette = m.palette;

    world.arena = (save.levelInStage % 2 === 0);
    world.arenaR = 560;

    levelWave.t = 0;
    levelWave.spawnT = 0;
    levelWave.done = false;
    levelWave.boss = null;
    levelWave.bossSpawned = false;

    player.weapon = save.equippedWeapon;
    const w = WEAPONS[player.weapon];
    player.baseDmg = w.baseDmg;
    player.baseFire = w.fire;
    player.baseSpeed = 250;

    player.maxHp = 100 + (save.meta.hp * 10);
    player.hp = player.maxHp;

    player.magnet = 1 + (save.meta.magnet * 0.10);

    initRunSkills();

    player.x = 0; player.y = 0;
    world.camX = 0; world.camY = 0;

    bannerT = 0; dangerT = 0;
    ui.banner.classList.add("hidden");

    showToast(`Этап ${save.stage} · Уровень ${save.levelInStage}/5`, 1000);
  }

  function startGame() {
    resetLevelRuntime();
    setState(STATE.RUN);
  }

  // ===== Spawning =====
  function spawnAtEdge() {
    const ang = rand(0, Math.PI * 2);
    const d = rand(560, 820);
    return { x: player.x + Math.cos(ang) * d, y: player.y + Math.sin(ang) * d };
  }

  function spawnEnemy(stage, levelInStage) {
    const p = spawnAtEdge();
    const t = enemyTier(stage, levelInStage);
    enemies.push({
      x: p.x, y: p.y,
      hp: t.hp, maxHp: t.hp,
      sp: t.sp, dmg: t.dmg, r: t.r,
      kind: t.kind, col: t.col, xp: t.xp,
      hitFlash: 0, slow: 0
    });
  }

  function spawnBoss(stage) {
    const p = spawnAtEdge();
    const b = bossTier(stage);
    const e = {
      x: p.x, y: p.y,
      hp: b.hp, maxHp: b.hp,
      sp: b.sp, dmg: b.dmg, r: b.r,
      kind: "boss", col: b.col, xp: b.xp,
      ultCd: b.ultCd, ultTimer: b.ultTimer,
      hitFlash: 0, slow: 0
    };
    enemies.push(e);
    levelWave.boss = e;
  }

  function doSpawn(dt) {
    levelWave.t += dt;
    levelWave.spawnT -= dt;

    const diff = (save.stage - 1) * 5 + (save.levelInStage - 1);
    const isBossLevel = (save.levelInStage === 5);
    const spawnInterval = clamp(1.08 - diff * 0.03, 0.22, 1.08);

    if (!isBossLevel) {
      if (levelWave.spawnT <= 0) {
        levelWave.spawnT = spawnInterval;
        const n = randi(1, 2 + Math.floor(diff / 4));
        for (let i = 0; i < n; i++) spawnEnemy(save.stage, save.levelInStage);
      }
      const targetTime = 55 + diff * 6;
      if (levelWave.t >= targetTime) levelWave.done = true;
    } else {
      if (!levelWave.bossSpawned && levelWave.t > 6) {
        levelWave.bossSpawned = true;
        spawnBoss(save.stage);

        showBanner("⚠️ БОСС ПОЯВИЛСЯ ⚠️", 3.0);
        dangerT = 10.0;
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

    if (Math.random() < 0.72) {
      const n = randi(1, 2);
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), d = rand(0, 18);
        drops.push({ type: "coin", x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: rand(-55, 55), vy: rand(-55, 55), r: 6, col: "#f59e0b", val: randi(1, 3) });
      }
    }

    if (Math.random() < 0.16) {
      drops.push({ type: "gem", x, y, vx: rand(-45, 45), vy: rand(-45, 45), r: 7, col: "#60a5fa", val: 1 });
    }
  }

  function pickupDrops(dt) {
    const baseMag = 120;
    const mag = baseMag * player.magnet * (1 + player.run.magnetLv * 0.10);
    const mag2 = mag * mag;

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];

      // friction
      d.vx *= Math.pow(0.25, dt);
      d.vy *= Math.pow(0.25, dt);
      d.x += d.vx * dt;
      d.y += d.vy * dt;

      // pull if in range
      const dd = dist2(player.x, player.y, d.x, d.y);
      if (dd < mag2) {
        const dx = player.x - d.x, dy = player.y - d.y;
        const dist = Math.hypot(dx, dy) || 1;
        const pull = clamp((mag - dist) / mag, 0, 1);
        d.x += (dx / dist) * (520 * pull) * dt;
        d.y += (dy / dist) * (520 * pull) * dt;
      }

      // pickup
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
          const mult = 1 + petBuff().coin;
          const add = Math.max(1, Math.floor(d.val * mult));
          player.coins += add;
          runSummary.coinsPicked += add;
        } else if (d.type === "gem") {
          player.gems += d.val;
          runSummary.gemsPicked += d.val;
        }
        drops.splice(i, 1);
      }
    }
  }

  // ===== Targeting =====
  function nearestEnemy() {
    let best = null, bestD = 1e18;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const d = dist2(player.x, player.y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // ===== Floaters =====
  function spawnFloater(x, y, text, col = "#fff", big = false) {
    floaters.push({ x, y, vx: rand(-15, 15), vy: -55 - (big ? 25 : 0), t: 0.9, text, col, big });
  }

  // ===== Bullets =====
  function spawnBullet(x, y, dirx, diry, dmg, speed, pierce, col, rad = 3.0) {
    bullets.push({ x, y, vx: dirx * speed, vy: diry * speed, r: rad, dmg, pierce, col, life: 2.2 });
  }

  function dealDamage(e, dmg, isAoE = false) {
    if (e.hp <= 0) return;

    e.hitFlash = 0.10;

    let final = dmg;
    let crit = false;
    if (!isAoE && Math.random() < critChance()) {
      final *= 2;
      crit = true;
    }

    e.hp -= final;
    player.totalDamage += final;
    runSummary.damage += final;

    spawnFloater(e.x, e.y - e.r - 10, `${Math.floor(final)}`, crit ? "#fbbf24" : "#ffffff", crit);

    const vamp = vampPercent();
    if (vamp > 0) {
      const heal = final * vamp * 0.20;
      player.hp = Math.min(player.maxHp, player.hp + heal);
    }

    if (e.hp <= 0) {
      e.hp = 0;
      spawnDrops(e.x, e.y, e.xp);
      player.kills++;
      runSummary.kills++;
    }
  }

  function applyExplosion(x, y, r, dmg) {
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const rr = r + e.r;
      if (dist2(x, y, e.x, e.y) < rr * rr) dealDamage(e, dmg, true);
    }
    fx.push({ type: "boom", x, y, t: 0.22, r, col: "#f59e0b" });
  }

  let shotCd = 0;
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
    const bulletsN = w.bullets + addMulti;
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

      // cull
      if (world.arena) {
        const dd = Math.hypot(b.x, b.y);
        if (dd > world.arenaR + 170) { bullets.splice(i, 1); continue; }
      }

      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const rr = e.r + b.r;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          dealDamage(e, b.dmg, false);

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

  // ===== Actives =====
  let droneCd = 0;
  let grenadeCd = 0;
  let lightningCd = 0;
  let shieldCd = 0;
  let shieldReady = false;

  function sawUpdate(dt) {
    const lv = player.run.sawLv;
    if (lv <= 0) return;

    const count = clamp(2 + Math.floor(lv / 2), 2, 8);
    const radius = 44 + lv * 7;
    const spin = 2.1 + lv * 0.18;
    const dmg = (10 + lv * 5) * dmgMultiplier();

    for (let i = 0; i < count; i++) {
      const a = runTime * spin + i * (Math.PI * 2 / count);
      const sx = player.x + Math.cos(a) * radius;
      const sy = player.y + Math.sin(a) * radius;

      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const rr = e.r + 12;
        if (dist2(sx, sy, e.x, e.y) < rr * rr) dealDamage(e, dmg * dt, true);
      }

      fx.push({ type: "saw", x: sx, y: sy, t: 0.02, r: 11, spin: runTime * 9 + i });
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
      fx.push({ type: "zap", x: t.x, y: t.y, t: 0.20 });
      fx.push({ type: "bolt", x0: player.x, y0: player.y, x1: t.x, y1: t.y, t: 0.12 });
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
    spawnBullet(player.x, player.y, nx, ny, dmg, 860, 0, "#2563eb", 2.8);
    fx.push({ type: "drone", x: player.x + nx * 18, y: player.y + ny * 18, t: 0.12 });
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
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < radius + e.r) {
        const slow = clamp(0.18 + lv * 0.05, 0.18, 0.65);
        e.slow = Math.max(e.slow, slow);
        fx.push({ type: "frost", x: e.x, y: e.y, t: 0.05 });
      }
    }
  }

  // ===== Enemy update =====
  function damagePlayer(amount) {
    if (amount <= 0) return;

    amount *= (1 - armorReduction());

    if (player.run.shieldLv > 0 && shieldReady) {
      shieldReady = false;
      fx.push({ type: "shield", x: player.x, y: player.y, t: 0.30 });
      spawnFloater(player.x, player.y - 28, "BLOCK", "#93c5fd", true);
      return;
    }

    player.hp -= amount;
    player.takenDamage += amount;
    fx.push({ type: "hit", x: player.x, y: player.y, t: 0.16 });
    spawnFloater(player.x, player.y - 28, `-${Math.floor(amount)}`, "#ef4444", false);

    if (player.hp <= 0) {
      player.hp = 0;
      finishLevelLose();
    }
  }

  function updateEnemies(dt) {
    for (const e of enemies) {
      if (e.hp <= 0) continue;

      // slow decay
      e.slow *= Math.pow(0.10, dt);
      const slowMul = 1 - clamp(e.slow, 0, 0.75);

      if (e.kind === "boss") {
        e.ultTimer -= dt;
        if (e.ultTimer <= 0) {
          e.ultTimer = e.ultCd;
          const n = randi(4, 7);
          for (let i = 0; i < n; i++) spawnEnemy(save.stage, 4);
          fx.push({ type: "bossUlt", x: e.x, y: e.y, t: 0.45 });
          showBanner("⚠️ УЛЬТА БОССА: ПОДКРЕПЛЕНИЕ!", 2.0);
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

      const rr = player.r + e.r;
      if (dist2(player.x, player.y, e.x, e.y) < rr * rr) damagePlayer(e.dmg * dt);

      e.hitFlash = Math.max(0, e.hitFlash - dt);
    }
  }

  function cleanupDeadEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].hp <= 0) enemies.splice(i, 1);
  }

  // ===== FX update =====
  function updateFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];

      if (f.type === "grenade") {
        f.t -= dt;
        if (f.t <= 0) {
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

  // ===== Level Up UI =====
  let pendingUpgrades = [];
  function openLevelUp() {
    if (state !== STATE.RUN) return;

    pendingUpgrades = pickUpgrades3();
    ui.upgradeGrid.innerHTML = "";

    pendingUpgrades.forEach(u => {
      const lv = u.lvl();
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="cardTitle">${u.name} <span class="badge">LV ${lv}/${u.max}</span></div>
        <div class="cardDesc">${u.desc}</div>
        <div class="cardRow">
          <div class="chip">Выбор</div>
          <button class="btn small primary">Взять</button>
        </div>
      `;
      card.querySelector("button").addEventListener("click", () => {
        u.apply();
        setState(STATE.RUN);
        showToast(`Взято: ${u.name}`);
      });
      ui.upgradeGrid.appendChild(card);
    });

    setState(STATE.LEVELUP);
  }

  // ===== Finish level =====
  function openSummary(win) {
    setState(STATE.SUMMARY);
    ui.sumTitle.textContent = win ? "Уровень пройден ✅" : "Поражение ❌";
    ui.sumSub.textContent = `Этап ${save.stage} · Уровень ${save.levelInStage}/5`;

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
        <div class="cardDesc" style="font-size:18px;font-weight:1000;margin-top:6px;color:#eaf0ff">${it.v}</div>
      `;
      ui.sumGrid.appendChild(d);
    }
  }

  function finishLevelWin() {
    // add run wallet to save
    save.coins += player.coins;
    save.gems += player.gems;
    writeSave();

    const wasBossLevel = (save.levelInStage === 5);

    if (!wasBossLevel) {
      save.levelInStage += 1;
      writeSave();
      openSummary(true);
    } else {
      // stage complete => next stage + chest
      save.stage += 1;
      save.levelInStage = 1;
      writeSave();
      openSummary(true);
    }
  }

  function finishLevelLose() {
    // partial keep
    save.coins += Math.floor(player.coins * 0.65);
    save.gems += Math.floor(player.gems * 0.65);
    writeSave();

    // back to first level of stage
    save.levelInStage = 1;
    writeSave();

    openSummary(false);
  }

  // ===== Chest roulette =====
  let chestOpened = false;
  let chestSpinning = false;

  function chestRewardRoll() {
    const roll = Math.random();
    if (roll < 0.58) {
      const c = randi(260, 650) + save.stage * 60;
      return { type: "coins", label: `🪙 +${c}`, apply: () => { save.coins += c; } };
    }
    if (roll < 0.82) {
      const g = randi(2, 7);
      return { type: "gems", label: `💎 +${g}`, apply: () => { save.gems += g; } };
    }
    if (roll < 0.92) {
      const keys = ["hp", "dmg", "firerate", "movespeed", "magnet"];
      const k = keys[randi(0, keys.length - 1)];
      return { type: "meta", label: `🔧 Мета +1 (${k})`, apply: () => { save.meta[k] = (save.meta[k] ?? 0) + 1; } };
    }
    const p = rarityPick(PETS);
    return {
      type: "pet",
      label: `🐾 ${p.name} (${RARITY[p.rar].name})`,
      apply: () => {
        if (!petOwned(p.id)) save.pets.owned.push(p.id);
        if (!save.pets.equipped || save.pets.equipped === "None") save.pets.equipped = p.id;
      }
    };
  }

  async function playChestRoulette(finalReward) {
    chestSpinning = true;
    ui.chest.classList.add("opening");
    ui.btnChestContinue.disabled = true;
    ui.btnChestContinue.textContent = "Крутим...";
    ui.chestHint.textContent = "🎰 Крутим...";

    const dur = 2.4;
    const start = performance.now();
    const picks = [];
    for (let i = 0; i < 14; i++) picks.push(chestRewardRoll().label);
    picks[picks.length - 1] = finalReward.label;

    let idx = 0;
    return new Promise((resolve) => {
      const step = (t) => {
        const p = clamp((t - start) / (dur * 1000), 0, 1);
        const speed = 18 * (1 - p) + 2;
        if (Math.random() < (speed / 60)) idx = Math.min(idx + 1, picks.length - 1);

        ui.chestHint.textContent = `🎰 ${picks[idx]}`;

        if (p >= 1) {
          ui.chest.classList.remove("opening");
          ui.chest.classList.add("opened");
          setTimeout(() => ui.chest.classList.remove("opened"), 400);
          chestSpinning = false;
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function openChestScreen() {
    chestOpened = false;
    chestSpinning = false;
    ui.chest.classList.remove("opening");
    ui.chest.classList.remove("opened");
    ui.chestHint.textContent = "Готово к открытию";
    ui.btnChestContinue.disabled = true;
    ui.btnChestContinue.textContent = "Открой сундук";
    setState(STATE.CHEST);
  }

  // ===== Movement / joystick =====
  const joy = { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0, mag: 0 };

  function setJoyKnob(dx, dy) {
    const max = 50;
    const m = Math.hypot(dx, dy);
    const k = m > max ? max / m : 1;
    const nx = dx * k, ny = dy * k;
    ui.joyKnob.style.left = `${27 + nx}px`;
    ui.joyKnob.style.top = `${27 + ny}px`;
  }

  ui.joyBase.addEventListener("pointerdown", (e) => {
    joy.active = true;
    joy.id = e.pointerId;
    ui.joyBase.setPointerCapture(joy.id);

    const r = ui.joyBase.getBoundingClientRect();
    joy.baseX = r.left + r.width / 2;
    joy.baseY = r.top + r.height / 2;
    joy.dx = 0; joy.dy = 0; joy.mag = 0;
    setJoyKnob(0, 0);
  }, { passive: false });

  ui.joyBase.addEventListener("pointermove", (e) => {
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
  ui.joyBase.addEventListener("pointerup", joyEnd, { passive: false });
  ui.joyBase.addEventListener("pointercancel", joyEnd, { passive: false });

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

    if (player.run.regenLv > 0) {
      const regen = (0.35 + player.run.regenLv * 0.18) * dt;
      player.hp = Math.min(player.maxHp, player.hp + regen);
    }
  }

  // ===== Draw coordinate =====
  function worldToScreen(x, y) {
    const sx = W / 2 + (x - world.camX);
    const sy = H / 2 + (y - world.camY);
    return { sx, sy };
  }

  // ===== Drawing =====
  function drawHPBarAt(sx, sy, w, h, p, colFill) {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(sx - w / 2, sy, w, h);
    ctx.fillStyle = colFill;
    ctx.fillRect(sx - w / 2, sy, w * clamp(p, 0, 1), h);
  }

  function heroColor() {
    return (COS_COLORS.find(c => c.id === save.cosmetics.color)?.col) || "#2563eb";
  }

  function drawMapBackground() {
    const p = world.mapPalette;

    ctx.fillStyle = p.grass;
    ctx.fillRect(0, 0, W, H);

    // FIX flicker: snap camera for background math
    const camX = Math.floor(world.camX);
    const camY = Math.floor(world.camY);

    // checker tiles
    const tile = 80;
    const ox = ((-camX) % tile + tile) % tile;
    const oy = ((-camY) % tile + tile) % tile;

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = p.grass2;
    for (let x = ox - tile; x <= W + tile; x += tile) {
      for (let y = oy - tile; y <= H + tile; y += tile) {
        const ix = Math.floor((x - ox) / tile);
        const iy = Math.floor((y - oy) / tile);
        if (((ix + iy) & 1) === 0) ctx.fillRect(x, y, tile, tile);
      }
    }
    ctx.globalAlpha = 1;

    // dirt stripes
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = p.path;
    const bandH = 34;
    const step = 140;
    const shift = (camY >> 1) % step;
    for (let i = 0; i < 8; i++) {
      const y = ((i * step + shift) % (H + 200)) - 100;
      ctx.fillRect(0, y, W, bandH);
    }
    ctx.globalAlpha = 1;

    // arena ring
    if (world.arena) {
      ctx.save();
      ctx.translate(W / 2 - camX, H / 2 - camY);
      ctx.strokeStyle = "rgba(0,0,0,.18)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(camX, camY, world.arenaR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawHero() {
    const { sx, sy } = worldToScreen(player.x, player.y);
    const col = heroColor();

    // shadow
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.ellipse(sx, sy + 18, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.fillStyle = col;
    roundRectFill(sx - 15, sy - 18, 30, 34, 10);

    // head
    ctx.fillStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.arc(sx, sy - 28, 10, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    ctx.fillStyle = "#111827";
    ctx.fillRect(sx - 6, sy - 30, 3, 2);
    ctx.fillRect(sx + 3, sy - 30, 3, 2);

    // legs
    ctx.fillStyle = "#111827";
    ctx.fillRect(sx - 13, sy + 10, 10, 12);
    ctx.fillRect(sx + 3, sy + 10, 10, 12);

    // arms
    ctx.fillStyle = col;
    ctx.fillRect(sx - 24, sy - 7, 9, 14);
    ctx.fillRect(sx + 15, sy - 7, 9, 14);

    // gun pointing to nearest
    const t = nearestEnemy();
    let ang = 0;
    if (t) ang = Math.atan2(t.y - player.y, t.x - player.x);
    const gx = sx + Math.cos(ang) * 18;
    const gy = sy + Math.sin(ang) * 8;

    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(ang);
    ctx.fillStyle = "#0b1022";
    roundRectFill(-4, -3, 18, 6, 3);
    ctx.fillStyle = "rgba(255,255,255,.65)";
    ctx.fillRect(8, -2, 6, 1);
    ctx.restore();

    // hp bar above hero
    const hpP = player.hp / player.maxHp;
    drawHPBarAt(sx, sy - 52, 64, 7, hpP, hpP > 0.35 ? "#22c55e" : "#ef4444");

    // pet dot
    const eqPet = PETS.find(p => p.id === save.pets.equipped);
    if (eqPet) {
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = RARITY[eqPet.rar].col;
      ctx.beginPath();
      ctx.arc(sx + 18, sy - 28, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEnemy(e) {
    const { sx, sy } = worldToScreen(e.x, e.y);
    const flash = e.hitFlash > 0 ? 0.65 : 0;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,.16)";
    ctx.beginPath();
    ctx.ellipse(sx, sy + e.r + 8, e.r * 0.9, e.r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.fillStyle = flash ? "#ffffff" : e.col;
    roundRectFill(sx - e.r, sy - e.r, e.r * 2, e.r * 2, 10);

    // face
    ctx.fillStyle = "#111827";
    if (e.kind === "boss") {
      ctx.fillRect(sx - 12, sy - 10, 24, 6);
      ctx.fillRect(sx - 10, sy + 2, 20, 5);
    } else {
      ctx.fillRect(sx - 7, sy - 6, 3, 2);
      ctx.fillRect(sx + 4, sy - 6, 3, 2);
      ctx.fillRect(sx - 5, sy + 4, 10, 2);
    }

    // stick/baton
    ctx.save();
    ctx.translate(sx + e.r - 6, sy + 2);
    ctx.rotate(-0.6);
    ctx.fillStyle = "#111827";
    ctx.fillRect(-2, -10, 4, 22);
    ctx.restore();

    // hp bar
    const p = e.hp / e.maxHp;
    drawHPBarAt(sx, sy - e.r - 14, 60, 6, p, e.kind === "boss" ? "#ef4444" : "#22c55e");
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
    ctx.fillStyle = "rgba(0,0,0,.35)";
    if (d.type === "coin") ctx.fillRect(sx - 2, sy - 4, 4, 8);
    if (d.type === "gem") ctx.fillRect(sx - 3, sy - 3, 6, 6);
    if (d.type === "xp") ctx.fillRect(sx - 3, sy - 1, 6, 2);
  }

  function drawSawFx(f) {
    const { sx, sy } = worldToScreen(f.x, f.y);
    const r = f.r;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(f.spin);

    // disc
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

    // hub
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
        ctx.strokeStyle = "#93c5fd";
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
        ctx.strokeStyle = "#93c5fd";
        ctx.lineWidth = 3;

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
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(sx, sy, 54 * (1 - f.t / 0.45) + 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (f.type === "shield") {
        const { sx, sy } = worldToScreen(f.x, f.y);
        ctx.save();
        ctx.globalAlpha = clamp(f.t / 0.30, 0, 1);
        ctx.strokeStyle = "#93c5fd";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(sx, sy, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (f.type === "drone") {
        const { sx, sy } = worldToScreen(f.x, f.y);
        ctx.save();
        ctx.globalAlpha = clamp(f.t / 0.12, 0, 1);
        ctx.fillStyle = "#60a5fa";
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (f.type === "frost") {
        const { sx, sy } = worldToScreen(f.x, f.y);
        ctx.save();
        ctx.globalAlpha = 0.20;
        ctx.fillStyle = "#bfdbfe";
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
        ctx.restore();
      } else if (f.type === "saw") {
        drawSawFx(f);
      } else if (f.type === "grenade") {
        const { sx, sy } = worldToScreen(f.x, f.y);
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.arc(sx, sy, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(sx + 6, sy - 6, 3, 0, Math.PI * 2);
        ctx.fill();

        const p = clamp(f.t / 0.60, 0, 1);
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, 16, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2) * p);
        ctx.stroke();

        ctx.globalAlpha = 0.10;
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, f.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (f.type === "hit") {
        const { sx, sy } = worldToScreen(f.x, f.y);
        ctx.save();
        ctx.globalAlpha = clamp(f.t / 0.16, 0, 1);
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(sx, sy, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
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

  function roundRectFill(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // ===== HUD update =====
  function updateHUD() {
    ui.hudStage.textContent = `Этап ${save.stage} · ${save.levelInStage}/5`;
    ui.hudMap.textContent = `${world.mapName}${world.arena ? " · Арена" : ""}`;
    ui.hudTime.textContent = fmtTime(runTime);
    ui.hudCoins.textContent = `🪙 ${player.coins}`;
    ui.hudGems.textContent = `💎 ${player.gems}`;

    const hpP = player.hp / player.maxHp;
    ui.hudHPText.textContent = `${Math.floor(player.hp)}/${Math.floor(player.maxHp)}`;
    ui.hudHPBar.style.width = `${Math.floor(clamp(hpP, 0, 1) * 100)}%`;

    const xpP = xp.cur / xp.need;
    ui.hudXPText.textContent = `LV ${xp.level} · ${xp.cur}/${xp.need}`;
    ui.hudXPBar.style.width = `${Math.floor(clamp(xpP, 0, 1) * 100)}%`;
  }

  // ===== Summary bookkeeping =====
  function resetLevelCounters() {
    runSummary.xpPicked = 0;
    runSummary.coinsPicked = 0;
    runSummary.gemsPicked = 0;
    runSummary.kills = 0;
    runSummary.damage = 0;
  }

  // ===== Boss danger / banner timers =====
  function updateBannerDanger(dt) {
    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0) ui.banner.classList.add("hidden");
    }
    if (dangerT > 0) dangerT -= dt;
  }

  // ===== Main loop =====
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
      updateBannerDanger(dt);

      // finish condition
      if (levelWave.done) {
        finishLevelWin();
        requestAnimationFrame(tick);
        return;
      }

      // draw
      drawMapBackground();
      for (const d of drops) drawDrop(d);
      for (const b of bullets) drawBullet(b);
      for (const e of enemies) if (e.hp > 0) drawEnemy(e);
      drawHero();
      drawFx();
      drawFloaters();

      // danger overlay
      if (dangerT > 0) {
        const pulse = 0.12 + 0.10 * Math.sin(runTime * 12);
        ctx.save();
        ctx.globalAlpha = clamp(pulse * (dangerT / 10), 0, 0.22);
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      updateHUD();
    } else if (state === STATE.MENU) {
      // simple animated menu background
      world.camX = Math.sin(now / 1400) * 120;
      world.camY = Math.cos(now / 1700) * 120;

      const m = mapForStage(save.stage);
      world.mapPalette = m.palette;
      world.mapName = m.name;

      drawMapBackground();
      player.x = 0; player.y = 0;
      drawHero();
    } else {
      // paused screens still draw last scene-ish
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

  // ===== Shop rendering =====
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

  let shopView = "home"; // home | meta | weapons | pets | cosmetics

  function openShopHome() {
    shopView = "home";
    ui.shopHome.classList.remove("hidden");
    ui.shopCategory.classList.add("hidden");
    ui.shopList.innerHTML = "";
    updateWalletUI();
  }

  function openShopCategory(view, title) {
    shopView = view;
    ui.shopTitle.textContent = title;
    ui.shopHome.classList.add("hidden");
    ui.shopCategory.classList.remove("hidden");
    ui.shopList.innerHTML = "";
    updateWalletUI();

    if (view === "meta") renderShopMeta();
    if (view === "weapons") renderShopWeapons();
    if (view === "pets") renderShopPets();
    if (view === "cosmetics") renderShopCosmetics();
  }

  function renderShopMeta() {
    META_ITEMS.forEach(it => {
      const lv = save.meta[it.key] ?? 0;
      const maxed = lv >= it.max;
      const can = save.coins >= it.costC;
      ui.shopList.appendChild(shopCard({
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
          openShopCategory("meta", "Прокачка");
          showToast("Куплено ✅");
        }
      }));
    });
  }

  function renderShopWeapons() {
    WEAPON_ITEMS.forEach(w => {
      const owned = ownsWeapon(w.id);
      const canPay = w.costG ? save.gems >= w.costG : save.coins >= w.costC;
      const priceText = owned ? "Уже куплено" : (w.costG ? `💎 ${w.costG}` : `🪙 ${w.costC}`);
      const btnText = owned ? (save.equippedWeapon === w.id ? "Выбрано" : "Выбрать") : (canPay ? "Купить" : "Не хватает");

      ui.shopList.appendChild(shopCard({
        title: `Оружие: ${WEAPONS[w.id].name}`,
        desc: w.desc,
        badge: owned ? "OK" : "NEW",
        priceText,
        btnText,
        disabled: (!owned && !canPay),
        onClick: () => {
          if (owned) {
            save.equippedWeapon = w.id;
            writeSave();
            openShopCategory("weapons", "Оружие");
            showToast("Выбрано ✅");
            return;
          }
          if (!canPay) return;
          if (w.costG) save.gems -= w.costG; else save.coins -= w.costC;
          save.unlockedWeapons.push(w.id);
          save.equippedWeapon = w.id;
          writeSave();
          openShopCategory("weapons", "Оружие");
          showToast("Оружие куплено ✅");
        }
      }));
    });
  }

  function renderShopCosmetics() {
    COS_COLORS.forEach(c => {
      const owned = save.cosmetics.owned.includes(c.id);
      const can = c.priceG ? save.gems >= c.priceG : save.coins >= c.priceC;
      const priceText = owned ? "Уже куплено" : (c.priceG ? `💎 ${c.priceG}` : `🪙 ${c.priceC}`);
      const btnText = owned ? (save.cosmetics.color === c.id ? "Надето" : "Надеть") : (can ? "Купить" : "Не хватает");

      ui.shopList.appendChild(shopCard({
        title: `Цвет: ${c.name}`,
        desc: `Визуально меняет героя (без статов).`,
        badge: owned ? "OK" : "NEW",
        priceText,
        btnText,
        disabled: (!owned && !can),
        onClick: () => {
          if (owned) {
            save.cosmetics.color = c.id;
            writeSave();
            openShopCategory("cosmetics", "Косметика");
            showToast("Надето ✅");
            return;
          }
          if (!can) return;
          if (c.priceG) save.gems -= c.priceG; else save.coins -= c.priceC;
          save.cosmetics.owned.push(c.id);
          save.cosmetics.color = c.id;
          writeSave();
          openShopCategory("cosmetics", "Косметика");
          showToast("Куплено ✅");
        }
      }));
    });
  }

  function renderShopPets() {
    const spinCostC = 1200;
    const spinCostG = 6;

    ui.shopList.appendChild(shopCard({
      title: "🎰 Рулетка питомцев",
      desc: "Крутка даёт питомца. Редкость случайная. (Можно повтор)",
      badge: "SPIN",
      priceText: `🪙 ${spinCostC} или 💎 ${spinCostG}`,
      btnText: (save.coins >= spinCostC || save.gems >= spinCostG) ? "Крутить" : "Не хватает",
      disabled: !(save.coins >= spinCostC || save.gems >= spinCostG),
      onClick: () => {
        if (save.coins >= spinCostC) save.coins -= spinCostC;
        else if (save.gems >= spinCostG) save.gems -= spinCostG;
        else return;

        const p = rarityPick(PETS);
        if (!petOwned(p.id)) save.pets.owned.push(p.id);
        if (!save.pets.equipped || save.pets.equipped === "None") save.pets.equipped = p.id;

        writeSave();
        showToast(`Выпал: ${p.name} (${RARITY[p.rar].name})`, 1600);
        openShopCategory("pets", "Питомцы");
      }
    }));

    PETS.forEach(p => {
      const owned = petOwned(p.id);
      const eq = save.pets.equipped === p.id;
      const r = RARITY[p.rar];

      ui.shopList.appendChild(shopCard({
        title: `🐾 ${p.name}`,
        desc: `Редкость: <b style="color:${r.col}">${r.name}</b> · Буст: 🪙 +${Math.floor(p.coin * 100)}% · ⚔️ +${Math.floor(p.dmg * 100)}%`,
        badge: owned ? (eq ? "НАДЕТ" : "ЕСТЬ") : "LOCK",
        priceText: owned ? "Уже получен" : "Только из рулетки",
        btnText: owned ? (eq ? "Надет" : "Надеть") : "Недоступно",
        disabled: !owned || eq,
        onClick: () => {
          save.pets.equipped = p.id;
          writeSave();
          openShopCategory("pets", "Питомцы");
          showToast("Питомец надет ✅");
        }
      }));
    });
  }

  // ===== Loadout =====
  function renderLoadout() {
    ui.loadoutGrid.innerHTML = "";

    // weapon
    const wcard = document.createElement("div");
    wcard.className = "card";
    wcard.innerHTML = `
      <div class="cardTitle">🔫 Оружие</div>
      <div class="cardDesc">Выбрано: <b>${WEAPONS[save.equippedWeapon].name}</b></div>
      <div class="cardRow">
        <div class="chip">Открой в магазине</div>
        <button class="btn small primary">Магазин</button>
      </div>
    `;
    wcard.querySelector("button").addEventListener("click", () => {
      openShopCategory("weapons", "Оружие");
      setState(STATE.SHOP);
    });
    ui.loadoutGrid.appendChild(wcard);

    // pet
    const eqPet = PETS.find(p => p.id === save.pets.equipped);
    const pcard = document.createElement("div");
    pcard.className = "card";
    pcard.innerHTML = `
      <div class="cardTitle">🐾 Питомец</div>
      <div class="cardDesc">${eqPet ? `Надет: <b>${eqPet.name}</b> · 🪙 +${Math.floor(eqPet.coin*100)}% · ⚔️ +${Math.floor(eqPet.dmg*100)}%` : "Не выбран"}</div>
      <div class="cardRow">
        <div class="chip">Открой в магазине</div>
        <button class="btn small primary">Магазин</button>
      </div>
    `;
    pcard.querySelector("button").addEventListener("click", () => {
      openShopCategory("pets", "Питомцы");
      setState(STATE.SHOP);
    });
    ui.loadoutGrid.appendChild(pcard);

    // cosmetics
    COS_COLORS.forEach(c => {
      const owned = save.cosmetics.owned.includes(c.id);
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="cardTitle">🎨 ${c.name} ${owned ? `<span class="badge">OK</span>` : `<span class="badge">LOCK</span>`}</div>
        <div class="cardDesc">Цвет героя</div>
        <div class="cardRow">
          <div class="chip"><span style="width:14px;height:14px;border-radius:6px;background:${c.col};display:inline-block"></span> ${owned ? "Доступно" : "Купи в магазине"}</div>
          <button class="btn small ${owned ? "primary" : ""}" ${owned ? "" : "disabled"}>${save.cosmetics.color === c.id ? "Надето" : "Надеть"}</button>
        </div>
      `;
      card.querySelector("button").addEventListener("click", () => {
        if (!owned) return;
        save.cosmetics.color = c.id;
        writeSave();
        renderLoadout();
        showToast("Надето ✅");
      });
      ui.loadoutGrid.appendChild(card);
    });
  }

  // ===== Level-up / Stage chest flow =====
  ui.btnNext.addEventListener("click", () => {
    // if we just completed stage (level reset to 1 after boss), show chest
    if (save.levelInStage === 1) {
      openChestScreen();
    } else {
      resetLevelRuntime();
      setState(STATE.RUN);
    }
  });

  ui.btnChestClose.addEventListener("click", () => {
    // allow closing chest screen safely
    chestOpened = false;
    chestSpinning = false;
    ui.chest.classList.remove("opening");
    setState(STATE.MENU);
    updateWalletUI();
  });

  ui.chest.addEventListener("click", async () => {
    if (chestOpened || chestSpinning) return;
    chestOpened = true;

    const reward = chestRewardRoll();
    await playChestRoulette(reward);

    reward.apply();
    writeSave();

    ui.chestHint.textContent = `🎁 Выпало: ${reward.label}`;
    ui.btnChestContinue.disabled = false;
    ui.btnChestContinue.textContent = "Продолжить";
    showToast("Сундук открыт 🎁", 1200);
  });

  ui.btnChestContinue.addEventListener("click", () => {
    if (chestSpinning) return;
    chestOpened = false;
    resetLevelRuntime();
    setState(STATE.RUN);
  });

  // ===== UI buttons =====
  ui.btnPlay.addEventListener("click", startGame);

  ui.btnPause.addEventListener("click", () => {
    if (state !== STATE.RUN) return;
    ui.pauseTitle.textContent = "Пауза";
    setState(STATE.PAUSE);
  });

  ui.btnResume.addEventListener("click", () => setState(STATE.RUN));
  ui.btnToMenu.addEventListener("click", () => { setState(STATE.MENU); updateWalletUI(); });

  ui.btnShop.addEventListener("click", () => {
    openShopHome();
    setState(STATE.SHOP);
  });

  ui.btnLoadout.addEventListener("click", () => {
    renderLoadout();
    setState(STATE.LOADOUT);
  });

  ui.btnCloseShop.addEventListener("click", () => {
    setState(STATE.MENU);
    updateWalletUI();
  });

  ui.btnCloseLoadout.addEventListener("click", () => {
    setState(STATE.MENU);
    updateWalletUI();
  });

  ui.btnReset.addEventListener("click", hardReset);

  // Dock
  ui.dockShop.addEventListener("click", () => { openShopHome(); setState(STATE.SHOP); });
  ui.dockLoadout.addEventListener("click", () => { renderLoadout(); setState(STATE.LOADOUT); });
  ui.dockQuit.addEventListener("click", () => { setState(STATE.MENU); updateWalletUI(); });
  ui.dockUpgrades.addEventListener("click", () => {
    const r = player.run;
    showToast(`Навыки: пилы ${r.sawLv} · гранаты ${r.grenadeLv} · молния ${r.lightningLv} · дрон ${r.droneLv} · щит ${r.shieldLv}`);
  });

  // Shop navigation
  ui.btnShopBack.addEventListener("click", openShopHome);
  ui.catMeta.addEventListener("click", () => openShopCategory("meta", "Прокачка"));
  ui.catWeapons.addEventListener("click", () => openShopCategory("weapons", "Оружие"));
  ui.catPets.addEventListener("click", () => openShopCategory("pets", "Питомцы"));
  ui.catCosmetics.addEventListener("click", () => openShopCategory("cosmetics", "Косметика"));

  // ===== On run finish: boss banner + danger =====
  function maybeBossSignals() {
    if (save.levelInStage === 5 && !levelWave.bossSpawned && levelWave.t > 6) {
      // handled inside doSpawn when boss spawns
    }
  }

  // ===== Run stats reset per level =====
  function resetPerLevelStats() {
    player.coins = 0;
    player.gems = 0;
    player.kills = 0;
    player.totalDamage = 0;
    player.takenDamage = 0;
    resetLevelCounters();
  }

  // ===== Summary proceed =====
  // already handled by btnNext

  // ===== Important: after boss killed we set levelInStage=1 (next stage), summary shows, then chest screen opens by btnNext =====

  // ===== LevelUp grid already done =====

  // ===== End-of-level triggers =====
  // called in finishLevelWin/Lose

  // ===== Update HUD values for wallet and progress in menu =====
  function updateMenuProgress() {
    ui.menuProgress.textContent = `Прогресс: Этап ${save.stage} · Уровень ${save.levelInStage}/5`;
  }

  // ===== Start states =====
  setState(STATE.MENU);
  updateMenuProgress();
  openShopHome();
  renderLoadout();

})();
