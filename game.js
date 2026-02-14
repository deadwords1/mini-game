/* VOIDRUN: Survivor Arena (no images) — mobile first
   - Stages: 5 levels per stage, boss on level 5
   - Infinite map + some Arena levels
   - Joystick movement, auto shooting
   - Drops: XP, coins, gems
   - Level-up: choose 1 of 3 skills
   - Run skills reset after each level
   - Meta shop + cosmetics + weapons saved in localStorage
*/

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

let W=360, H=640, DPR=1;
function resize(){
  DPR = Math.min(2, window.devicePixelRatio||1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W*DPR);
  canvas.height= Math.floor(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener("resize", resize, {passive:true});
resize();

// ===== UI refs =====
const el = (id)=>document.getElementById(id);
const ui = {
  hudTop: el("hudTop"),
  joyWrap: el("joyWrap"),
  joyBase: el("joyBase"),
  joyKnob: el("joyKnob"),
  dock: el("dock"),
  toast: el("toast"),

  hudStage: el("hudStage"),
  hudMode: el("hudMode"),
  hudHP: el("hudHP"),
  hudXP: el("hudXP"),
  hudCoins: el("hudCoins"),
  hudGems: el("hudGems"),
  hudTime: el("hudTime"),
  hudKills: el("hudKills"),
  btnPause: el("btnPause"),

  screenMenu: el("screenMenu"),
  screenPause: el("screenPause"),
  screenLevelUp: el("screenLevelUp"),
  upgradeGrid: el("upgradeGrid"),

  btnPlay: el("btnPlay"),
  btnShop: el("btnShop"),
  btnLoadout: el("btnLoadout"),
  btnReset: el("btnReset"),

  btnResume: el("btnResume"),
  btnToMenu: el("btnToMenu"),

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

function showToast(txt, ms=1200){
  ui.toast.textContent = txt;
  ui.toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>ui.toast.classList.add("hidden"), ms);
}

// ===== Utils =====
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const randi=(a,b)=>Math.floor(rand(a,b+1));
const dist2=(ax,ay,bx,by)=>{const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy;}
function fmtTime(s){
  const m = Math.floor(s/60);
  const ss= Math.floor(s%60);
  return `${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
}

// ===== Persistent save =====
const SAVE_KEY="voidrun_save_v1";
const defaultSave=()=>({
  coins:0, gems:0,
  stage:1, levelInStage:1, // 1..5
  unlockedWeapons:["Pistol"],
  equippedWeapon:"Pistol",
  meta: { // permanent boosts
    hp:0, dmg:0, firerate:0, movespeed:0, magnet:0
  },
  cosmetics: {
    owned:["Blue"],
    auraOwned:["None"],
    color:"Blue",
    aura:"None"
  }
});
let save = loadSave();
function loadSave(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return defaultSave();
    const s = JSON.parse(raw);
    return {...defaultSave(), ...s};
  }catch{ return defaultSave(); }
}
function writeSave(){
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  updateMenuWallet();
}
function hardReset(){
  save = defaultSave();
  writeSave();
  showToast("Прогресс сброшен");
}

function updateMenuWallet(){
  ui.menuCoins.textContent = `🪙 ${save.coins}`;
  ui.menuGems.textContent  = `💎 ${save.gems}`;
  ui.menuProgress.textContent = `Прогресс: Этап ${save.stage} · Уровень ${save.levelInStage}/5`;
  ui.shopCoins.textContent = `🪙 ${save.coins}`;
  ui.shopGems.textContent  = `💎 ${save.gems}`;
}

updateMenuWallet();

// ===== Game core state =====
const STATE = { MENU:"menu", RUN:"run", PAUSE:"pause", LEVELUP:"levelup", SHOP:"shop", LOADOUT:"loadout" };
let state = STATE.MENU;

const world = {
  camX:0, camY:0,
  arena:false,
  arenaR:520,
};

const player = {
  x:0, y:0,
  r:14,
  vx:0, vy:0,
  hp:100, maxHp:100,
  baseDmg:8,
  baseFire:0.18, // seconds
  baseSpeed:220,
  magnet:0,
  coins:0, gems:0,
  kills:0,
  weapon:"Pistol",
  // run skills
  run: {
    dmgMul:1,
    fireMul:1,
    speedMul:1,
    maxHpAdd:0,
    healOnPick:0,
    orbitSawLv:0,
    grenadeLv:0,
    lightningLv:0,
    droneLv:0,
    shieldLv:0,
    critLv:0,
  }
};

const xp = { cur:0, need:10, level:1 };
let runTime=0;

// Entities
const enemies=[];
const bullets=[];
const drops=[];
const fx=[];

// ===== Weapons & meta =====
const WEAPONS = {
  Pistol: { name:"Пистолет", baseDmg:8,  fire:0.18, speed:650, pierce:0, spread:0, bullets:1, color:"#e5e7eb" },
  SMG:    { name:"SMG",      baseDmg:5,  fire:0.10, speed:720, pierce:0, spread:0.10, bullets:1, color:"#a7f3d0" },
  Shotgun:{ name:"Дробовик", baseDmg:6,  fire:0.45, speed:620, pierce:0, spread:0.55, bullets:5, color:"#fde68a" },
  Laser:  { name:"Лазер",    baseDmg:10, fire:0.25, speed:900, pierce:2, spread:0.02, bullets:1, color:"#93c5fd" },
};

const COS_COLORS = [
  { id:"Blue",  name:"Синий",  priceC:0,  col:"#3b82f6" },
  { id:"Red",   name:"Красный",priceC:400,col:"#ef4444" },
  { id:"Green", name:"Зелёный",priceC:400,col:"#22c55e" },
  { id:"Violet",name:"Фиолет", priceC:600,col:"#a78bfa" },
  { id:"Gold",  name:"Золото", priceG:15, col:"#fbbf24" },
];

const AURAS = [
  { id:"None",  name:"Без ауры", priceC:0 },
  { id:"Pulse", name:"Пульс",    priceC:800 },
  { id:"Halo",  name:"Хало",     priceG:20 },
];

// ===== Skills pool (run-only) =====
function skillDefs(){
  // weights can be tuned
  return [
    { id:"DMG", name:"Урон +15%", desc:"+15% урона в этом забеге", apply:()=>player.run.dmgMul*=1.15 },
    { id:"FIRE", name:"Скорострельность +12%", desc:"+12% к скорости стрельбы", apply:()=>player.run.fireMul*=1.12 },
    { id:"SPD", name:"Скорость +10%", desc:"+10% скорость передвижения", apply:()=>player.run.speedMul*=1.10 },
    { id:"HP", name:"Макс HP +20", desc:"+20 максимального HP", apply:()=>{player.run.maxHpAdd+=20; player.maxHp+=20; player.hp+=20;} },
    { id:"HEAL", name:"Подхил от XP", desc:"+1 HP при подборе XP", apply:()=>player.run.healOnPick+=1 },
    { id:"SAW", name:"Пилы вокруг", desc:"Вращающиеся пилы наносят урон", apply:()=>player.run.orbitSawLv++ },
    { id:"GREN", name:"Гранаты", desc:"Кидаешь гранаты в толпу", apply:()=>player.run.grenadeLv++ },
    { id:"LIT", name:"Молния", desc:"Удар молнии по ближайшим", apply:()=>player.run.lightningLv++ },
    { id:"DRONE", name:"Дрон-пушка", desc:"Дрон стреляет отдельно", apply:()=>player.run.droneLv++ },
    { id:"SHIELD", name:"Щит", desc:"Поглощает удар раз в N сек", apply:()=>player.run.shieldLv++ },
    { id:"CRIT", name:"Криты", desc:"+шанс крита (х2)", apply:()=>player.run.critLv++ },
  ];
}

// ===== Enemy tiers =====
function enemyTemplate(stage, levelInStage){
  // difficulty scaling
  const t = (stage-1)*5 + (levelInStage-1);
  const baseHp = 20 + t*6;
  const baseSp = 90 + t*3;
  const baseD = 8 + t*1.2;
  // variants
  const roll = Math.random();
  if(roll < 0.65){
    return { type:"grunt", hp: baseHp, sp: baseSp, dmg: baseD, r:14, col:"#94a3b8", xp:1 };
  } else if(roll < 0.90){
    return { type:"brute", hp: baseHp*2.1, sp: baseSp*0.75, dmg: baseD*1.3, r:18, col:"#f97316", xp:2 };
  } else {
    return { type:"runner", hp: baseHp*0.85, sp: baseSp*1.35, dmg: baseD*0.9, r:12, col:"#22c55e", xp:2 };
  }
}

function bossTemplate(stage){
  const t = (stage-1)*5 + 4;
  return {
    type:"boss",
    hp: 450 + t*90,
    sp: 80 + t*2,
    dmg: 18 + t*2,
    r:34,
    col:"#ef4444",
    xp: 12,
    ultCd: 6.5,
    ultT: 2.5,
    ultTimer: 0
  };
}

// ===== Joystick =====
const joy = {
  active:false,
  id:null,
  baseX:0, baseY:0,
  dx:0, dy:0,
  mag:0
};

function setJoyKnob(dx,dy){
  const max = 50;
  const m = Math.hypot(dx,dy);
  const k = m>max ? max/m : 1;
  const nx = dx*k, ny = dy*k;
  ui.joyKnob.style.left = `${45 + nx}px`;
  ui.joyKnob.style.top  = `${45 + ny}px`;
}

ui.joyBase.addEventListener("pointerdown", (e)=>{
  joy.active=true;
  joy.id=e.pointerId;
  ui.joyBase.setPointerCapture(joy.id);
  const r = ui.joyBase.getBoundingClientRect();
  joy.baseX = r.left + r.width/2;
  joy.baseY = r.top + r.height/2;
  joy.dx=0; joy.dy=0; joy.mag=0;
  setJoyKnob(0,0);
}, {passive:false});

ui.joyBase.addEventListener("pointermove", (e)=>{
  if(!joy.active || e.pointerId!==joy.id) return;
  const dx = e.clientX - joy.baseX;
  const dy = e.clientY - joy.baseY;
  joy.dx=dx; joy.dy=dy;
  const m = Math.hypot(dx,dy);
  joy.mag = clamp(m/55, 0, 1);
  setJoyKnob(dx,dy);
}, {passive:false});

function joyEnd(e){
  if(e.pointerId!==joy.id) return;
  joy.active=false; joy.id=null;
  joy.dx=0; joy.dy=0; joy.mag=0;
  setJoyKnob(0,0);
}
ui.joyBase.addEventListener("pointerup", joyEnd, {passive:false});
ui.joyBase.addEventListener("pointercancel", joyEnd, {passive:false});

// ===== Shop content =====
const META_ITEMS = [
  { id:"meta_hp", name:"Живучесть", desc:"+10 HP навсегда", costC:450, max:20,
    level:()=>save.meta.hp, buy:()=>{ save.meta.hp++; } },
  { id:"meta_dmg", name:"Урон", desc:"+4% урона навсегда", costC:550, max:30,
    level:()=>save.meta.dmg, buy:()=>{ save.meta.dmg++; } },
  { id:"meta_fire", name:"Темп огня", desc:"+3% скорострельности навсегда", costC:600, max:30,
    level:()=>save.meta.firerate, buy:()=>{ save.meta.firerate++; } },
  { id:"meta_spd", name:"Скорость", desc:"+3% скорость навсегда", costC:520, max:25,
    level:()=>save.meta.movespeed, buy:()=>{ save.meta.movespeed++; } },
  { id:"meta_mag", name:"Магнит", desc:"+10% радиус подбора", costC:400, max:20,
    level:()=>save.meta.magnet, buy:()=>{ save.meta.magnet++; } },
];

const WEAPON_ITEMS = [
  { id:"SMG", costC:2600, desc:"Быстро стреляет, слабее урон." },
  { id:"Shotgun", costC:3400, desc:"Залп дробью, ближе — сильнее." },
  { id:"Laser", costG:25, desc:"Пробивает врагов, высокий урон." },
];

function ownsWeapon(id){ return save.unlockedWeapons.includes(id); }

function shopCard({title,desc,badge,priceText,btnText,disabled,onClick}){
  const d=document.createElement("div");
  d.className="card";
  d.innerHTML = `
    <div class="cardTitle">${title} ${badge?`<span class="badge">${badge}</span>`:""}</div>
    <div class="cardDesc">${desc}</div>
    <div class="cardPrice">
      <div class="pill">${priceText}</div>
      <button class="btn small ${disabled?"":"primary"}" ${disabled?"disabled":""}>${btnText}</button>
    </div>
  `;
  const b = d.querySelector("button");
  b.addEventListener("click", ()=>onClick?.());
  return d;
}

function renderShop(){
  updateMenuWallet();
  ui.shopMeta.innerHTML="";
  ui.shopWeapons.innerHTML="";
  ui.shopCosmetics.innerHTML="";

  // Meta upgrades
  META_ITEMS.forEach(it=>{
    const lv = it.level();
    const disabled = lv>=it.max || save.coins < it.costC;
    ui.shopMeta.appendChild(shopCard({
      title: it.name,
      desc: `${it.desc} · LVL ${lv}/${it.max}`,
      badge: lv>=it.max ? "MAX" : `LVL ${lv}`,
      priceText: lv>=it.max ? "🪙 MAX" : `🪙 ${it.costC}`,
      btnText: lv>=it.max ? "Макс" : (disabled ? "Не хватает" : "Купить"),
      disabled: lv>=it.max || save.coins < it.costC,
      onClick: ()=>{
        if(save.coins < it.costC || lv>=it.max) return;
        save.coins -= it.costC;
        it.buy();
        writeSave();
        renderShop();
        showToast("Куплено ✅");
      }
    }));
  });

  // Weapons
  WEAPON_ITEMS.forEach(w=>{
    const owned = ownsWeapon(w.id);
    const costText = w.costG ? `💎 ${w.costG}` : `🪙 ${w.costC}`;
    const canPay = w.costG ? save.gems>=w.costG : save.coins>=w.costC;

    ui.shopWeapons.appendChild(shopCard({
      title: `Оружие: ${WEAPONS[w.id].name}`,
      desc: w.desc,
      badge: owned ? "Открыто" : "Новое",
      priceText: owned ? "Уже куплено" : costText,
      btnText: owned ? (save.equippedWeapon===w.id ? "Выбрано" : "Выбрать") : (canPay ? "Купить" : "Не хватает"),
      disabled: (!owned && !canPay),
      onClick: ()=>{
        if(owned){
          save.equippedWeapon = w.id;
          writeSave();
          renderShop();
          showToast("Выбрано ✅");
          return;
        }
        if(!canPay) return;
        if(w.costG){ save.gems -= w.costG; } else { save.coins -= w.costC; }
        save.unlockedWeapons.push(w.id);
        save.equippedWeapon = w.id;
        writeSave();
        renderShop();
        showToast("Оружие куплено ✅");
      }
    }));
  });

  // Cosmetics (colors)
  COS_COLORS.forEach(c=>{
    const owned = save.cosmetics.owned.includes(c.id);
    const costText = c.priceG ? `💎 ${c.priceG}` : `🪙 ${c.priceC}`;
    const canPay = c.priceG ? save.gems>=c.priceG : save.coins>=c.priceC;

    ui.shopCosmetics.appendChild(shopCard({
      title: `Цвет: ${c.name}`,
      desc: `Меняет цвет героя. (без статов)`,
      badge: owned ? "Открыто" : "NEW",
      priceText: owned ? "Уже куплено" : costText,
      btnText: owned ? (save.cosmetics.color===c.id ? "Надето" : "Надеть") : (canPay ? "Купить" : "Не хватает"),
      disabled: (!owned && !canPay),
      onClick: ()=>{
        if(owned){
          save.cosmetics.color = c.id;
          writeSave();
          renderShop();
          showToast("Надето ✅");
          return;
        }
        if(!canPay) return;
        if(c.priceG){ save.gems -= c.priceG; } else { save.coins -= c.priceC; }
        save.cosmetics.owned.push(c.id);
        save.cosmetics.color = c.id;
        writeSave();
        renderShop();
        showToast("Куплено ✅");
      }
    }));
  });

  // Auras
  AURAS.forEach(a=>{
    const owned = save.cosmetics.auraOwned.includes(a.id);
    const costText = a.priceG ? `💎 ${a.priceG}` : `🪙 ${a.priceC}`;
    const canPay = a.priceG ? save.gems>=a.priceG : save.coins>=a.priceC;

    ui.shopCosmetics.appendChild(shopCard({
      title: `Аура: ${a.name}`,
      desc: `Визуальный эффект вокруг героя.`,
      badge: owned ? "Открыто" : "NEW",
      priceText: owned ? "Уже куплено" : costText,
      btnText: owned ? (save.cosmetics.aura===a.id ? "Надето" : "Надеть") : (canPay ? "Купить" : "Не хватает"),
      disabled: (!owned && !canPay),
      onClick: ()=>{
        if(owned){
          save.cosmetics.aura = a.id;
          writeSave();
          renderShop();
          showToast("Надето ✅");
          return;
        }
        if(!canPay) return;
        if(a.priceG){ save.gems -= a.priceG; } else { save.coins -= a.priceC; }
        save.cosmetics.auraOwned.push(a.id);
        save.cosmetics.aura = a.id;
        writeSave();
        renderShop();
        showToast("Куплено ✅");
      }
    }));
  });
}

function renderLoadout(){
  ui.loadoutGrid.innerHTML="";
  COS_COLORS.forEach(c=>{
    const owned = save.cosmetics.owned.includes(c.id);
    const d=document.createElement("div");
    d.className="card";
    d.innerHTML = `
      <div class="cardTitle">${c.name} ${owned?`<span class="badge">OK</span>`:`<span class="badge">LOCK</span>`}</div>
      <div class="cardDesc">Цвет героя</div>
      <div class="cardPrice">
        <div class="pill" style="display:flex;gap:8px;align-items:center;">
          <span style="width:18px;height:18px;border-radius:6px;background:${c.col};display:inline-block;"></span>
          ${owned ? "Доступно" : "Купи в магазине"}
        </div>
        <button class="btn small ${owned?"primary":""}" ${owned?"":"disabled"}>${save.cosmetics.color===c.id?"Надето":"Надеть"}</button>
      </div>
    `;
    d.querySelector("button").addEventListener("click", ()=>{
      if(!owned) return;
      save.cosmetics.color=c.id;
      writeSave();
      renderLoadout();
      showToast("Надето ✅");
    });
    ui.loadoutGrid.appendChild(d);
  });

  AURAS.forEach(a=>{
    const owned = save.cosmetics.auraOwned.includes(a.id);
    const d=document.createElement("div");
    d.className="card";
    d.innerHTML = `
      <div class="cardTitle">${a.name} ${owned?`<span class="badge">OK</span>`:`<span class="badge">LOCK</span>`}</div>
      <div class="cardDesc">Аура героя</div>
      <div class="cardPrice">
        <div class="pill">${owned ? "Доступно" : "Купи в магазине"}</div>
        <button class="btn small ${owned?"primary":""}" ${owned?"":"disabled"}>${save.cosmetics.aura===a.id?"Надето":"Надеть"}</button>
      </div>
    `;
    d.querySelector("button").addEventListener("click", ()=>{
      if(!owned) return;
      save.cosmetics.aura=a.id;
      writeSave();
      renderLoadout();
      showToast("Надето ✅");
    });
    ui.loadoutGrid.appendChild(d);
  });
}

// ===== Navigation helpers =====
function setState(s){
  state=s;
  // screens
  ui.screenMenu.classList.toggle("hidden", s!==STATE.MENU);
  ui.screenPause.classList.toggle("hidden", s!==STATE.PAUSE);
  ui.screenLevelUp.classList.toggle("hidden", s!==STATE.LEVELUP);
  ui.screenShop.classList.toggle("hidden", s!==STATE.SHOP);
  ui.screenLoadout.classList.toggle("hidden", s!==STATE.LOADOUT);

  // in-game UI
  const inRun = (s===STATE.RUN || s===STATE.PAUSE || s===STATE.LEVELUP);
  ui.hudTop.classList.toggle("hidden", !inRun);
  ui.joyWrap.classList.toggle("hidden", !inRun);
  ui.dock.classList.toggle("hidden", !inRun);
}

// ===== Level / stage flow =====
function resetRunStats(){
  player.coins = 0; player.gems = 0;
  player.kills = 0;
  runTime=0;
  xp.cur=0; xp.need=10; xp.level=1;

  // base from weapon + meta
  player.weapon = save.equippedWeapon;
  const w = WEAPONS[player.weapon];
  player.baseDmg = w.baseDmg;
  player.baseFire= w.fire;
  player.maxHp = 100 + save.meta.hp*10;
  player.hp = player.maxHp;

  player.magnet = (save.meta.magnet*0.10);

  // reset run skills
  player.run = {
    dmgMul: 1 + save.meta.dmg*0.04,
    fireMul: 1 + save.meta.firerate*0.03,
    speedMul: 1 + save.meta.movespeed*0.03,
    maxHpAdd:0,
    healOnPick:0,
    orbitSawLv:0,
    grenadeLv:0,
    lightningLv:0,
    droneLv:0,
    shieldLv:0,
    critLv:0,
  };

  world.camX=0; world.camY=0;
  player.x=0; player.y=0;
  enemies.length=0; bullets.length=0; drops.length=0; fx.length=0;

  // decide mode
  world.arena = (save.levelInStage % 2 === 0); // 2,4 = arena
  world.arenaR = 520;

  levelWave.t=0;
  levelWave.spawnT=0;
  levelWave.boss=null;
  levelWave.bossSpawned=false;
  levelWave.done=false;

  showToast(`Старт: Этап ${save.stage} · Уровень ${save.levelInStage}/5`, 1200);
}

function finishLevel(win=true){
  // add run loot to save
  save.coins += player.coins;
  save.gems  += player.gems;

  if(win){
    // progress
    if(save.levelInStage < 5){
      save.levelInStage += 1;
    } else {
      save.stage += 1;
      save.levelInStage = 1;
      showToast("Этап пройден! +сундук скоро добавим 😈", 1500);
    }
    writeSave();
    showToast("Уровень пройден ✅", 1200);
  } else {
    // if lose -> back to first level of stage
    save.levelInStage = 1;
    writeSave();
    showToast("Проиграл — назад на 1-й уровень этапа ❌", 1400);
  }

  // run skills reset each level:
  resetRunStats();
}

function gameOver(){
  setState(STATE.PAUSE);
  ui.screenPause.querySelector(".title").textContent = "Поражение";
  ui.btnResume.textContent="Повторить";
}

function startGame(){
  resetRunStats();
  setState(STATE.RUN);
  ui.screenPause.querySelector(".title").textContent = "Пауза";
  ui.btnResume.textContent="Продолжить";
}

// ===== Waves / spawns =====
const levelWave = {
  t:0,
  spawnT:0,
  boss:null,
  bossSpawned:false,
  done:false
};

function spawnEnemy(e){
  enemies.push(e);
}

function spawnAtEdge(){
  // spawn around camera/player
  const angle = rand(0, Math.PI*2);
  const d = rand(520, 760);
  const sx = player.x + Math.cos(angle)*d;
  const sy = player.y + Math.sin(angle)*d;
  return {x:sx, y:sy};
}

function doSpawn(dt){
  levelWave.t += dt;
  levelWave.spawnT -= dt;

  // boss level
  const isBossLevel = (save.levelInStage === 5);

  // spawn pacing
  const diff = (save.stage-1)*5 + (save.levelInStage-1);
  const spawnInterval = clamp(1.05 - diff*0.03, 0.22, 1.05);

  if(!isBossLevel){
    if(levelWave.spawnT <= 0){
      levelWave.spawnT = spawnInterval;
      const n = randi(1, 2 + Math.floor(diff/4));
      for(let i=0;i<n;i++){
        const p = spawnAtEdge();
        const t = enemyTemplate(save.stage, save.levelInStage);
        spawnEnemy({
          ...t,
          x:p.x, y:p.y,
          vx:0, vy:0,
          hpMax:t.hp
        });
      }
    }
    // win condition: survive time
    const targetTime = 55 + diff*6; // seconds
    if(levelWave.t >= targetTime){
      levelWave.done=true;
    }
  } else {
    // boss level: spawn small + boss
    if(!levelWave.bossSpawned && levelWave.t > 6){
      levelWave.bossSpawned=true;
      const p = spawnAtEdge();
      levelWave.boss = {...bossTemplate(save.stage), x:p.x, y:p.y, hpMax:null};
      levelWave.boss.hpMax = levelWave.boss.hp;
      enemies.push(levelWave.boss);
      showToast("БОСС! Держись 😈", 1400);
    }

    // adds
    if(levelWave.spawnT <= 0){
      levelWave.spawnT = clamp(spawnInterval*0.85, 0.18, 0.8);
      const n = randi(1, 2 + Math.floor(diff/5));
      for(let i=0;i<n;i++){
        const p = spawnAtEdge();
        const t = enemyTemplate(save.stage, 4); // tough adds
        spawnEnemy({
          ...t,
          x:p.x, y:p.y,
          hp:t.hp*0.95, hpMax:t.hp*0.95
        });
      }
    }

    // win when boss dead
    if(levelWave.bossSpawned && levelWave.boss && levelWave.boss.hp<=0){
      levelWave.done=true;
    }
  }
}

// ===== Combat =====
let shotCd=0;
let droneCd=0;
let grenadeCd=0;
let lightningCd=0;
let shieldCd=0;
let shieldReady=false;

function nearestEnemy(x,y){
  let best=null, bestD=1e18;
  for(const e of enemies){
    if(e.hp<=0) continue;
    const d = dist2(x,y,e.x,e.y);
    if(d<bestD){ bestD=d; best=e; }
  }
  return best;
}

function spawnBullet(x,y,dirx,diry, dmg, speed, pierce, color, rad=3){
  bullets.push({x,y,vx:dirx*speed,vy:diry*speed,r:rad,dmg,pierce, col:color, life:2.2});
}

function autoShoot(dt){
  shotCd -= dt;
  if(shotCd>0) return;

  const w = WEAPONS[player.weapon];
  const fire = player.baseFire / player.run.fireMul;
  shotCd = fire;

  const t = nearestEnemy(player.x, player.y);
  if(!t) return;
  const dx=t.x-player.x, dy=t.y-player.y;
  const d = Math.hypot(dx,dy)||1;
  const nx=dx/d, ny=dy/d;

  const bulletsN = w.bullets;
  for(let i=0;i<bulletsN;i++){
    const spread = w.spread;
    const ang = Math.atan2(ny,nx) + (bulletsN===1?0:( (i-(bulletsN-1)/2)*spread ));
    const dirx = Math.cos(ang), diry = Math.sin(ang);

    let dmg = player.baseDmg * player.run.dmgMul;
    // crit
    if(player.run.critLv>0){
      const chance = clamp(0.06*player.run.critLv, 0, 0.35);
      if(Math.random()<chance) dmg*=2;
    }
    spawnBullet(player.x, player.y, dirx, diry, dmg, w.speed, w.pierce, w.color, 3.2);
  }
}

function orbitSaws(dt){
  const lv = player.run.orbitSawLv;
  if(lv<=0) return;
  const count = clamp(1+lv, 2, 6);
  const radius = 42 + lv*8;
  const dmg = (10 + lv*4) * player.run.dmgMul;
  const spin = 2.1 + lv*0.25;
  for(let i=0;i<count;i++){
    const a = runTime*spin + i*(Math.PI*2/count);
    const sx = player.x + Math.cos(a)*radius;
    const sy = player.y + Math.sin(a)*radius;
    // hit enemies by proximity
    for(const e of enemies){
      if(e.hp<=0) continue;
      const rr = e.r + 10;
      if(dist2(sx,sy,e.x,e.y) < rr*rr){
        e.hp -= dmg * dt; // continuous
        fx.push({x:sx,y:sy,t:0.12, col:"#ffffff"});
      }
    }
    // draw handled later (as virtual saw points)
    fx.push({x:sx,y:sy,t:0.01, col:"#fff"}); // tiny
  }
}

function droneShoot(dt){
  const lv = player.run.droneLv;
  if(lv<=0) return;
  droneCd -= dt;
  if(droneCd>0) return;
  droneCd = clamp(0.85 - lv*0.08, 0.35, 0.85);

  const t = nearestEnemy(player.x, player.y);
  if(!t) return;
  const dx=t.x-player.x, dy=t.y-player.y;
  const d = Math.hypot(dx,dy)||1;
  const nx=dx/d, ny=dy/d;

  const dmg = (6 + lv*3) * player.run.dmgMul;
  spawnBullet(player.x, player.y, nx, ny, dmg, 780, 0, "#c7d2fe", 3);
}

function throwGrenade(dt){
  const lv = player.run.grenadeLv;
  if(lv<=0) return;
  grenadeCd -= dt;
  if(grenadeCd>0) return;
  grenadeCd = clamp(2.2 - lv*0.14, 1.1, 2.2);

  // target nearest enemy position
  const t = nearestEnemy(player.x, player.y);
  if(!t) return;

  // grenade lands and explodes after short delay
  const gx = t.x + rand(-25,25);
  const gy = t.y + rand(-25,25);
  const delay = 0.55;
  const radius = 70 + lv*10;
  const dmg = (28 + lv*10) * player.run.dmgMul;

  fx.push({ type:"grenade", x:gx, y:gy, t:delay, r:radius, dmg });
}

function lightning(dt){
  const lv = player.run.lightningLv;
  if(lv<=0) return;
  lightningCd -= dt;
  if(lightningCd>0) return;
  lightningCd = clamp(1.9 - lv*0.12, 0.8, 1.9);

  // strike K nearest
  const k = clamp(1+Math.floor(lv/2), 1, 5);
  const alive = enemies.filter(e=>e.hp>0);
  alive.sort((a,b)=>dist2(player.x,player.y,a.x,a.y)-dist2(player.x,player.y,b.x,b.y));
  const targets = alive.slice(0,k);
  const dmg = (20 + lv*8) * player.run.dmgMul;

  for(const t of targets){
    t.hp -= dmg;
    fx.push({ type:"zap", x:t.x, y:t.y, t:0.20, col:"#93c5fd" });
  }
}

function shieldUpdate(dt){
  const lv = player.run.shieldLv;
  if(lv<=0) { shieldReady=false; return; }
  shieldCd -= dt;
  if(shieldCd<=0){
    shieldCd = clamp(7 - lv*0.6, 2.8, 7);
    shieldReady=true;
  }
}

// ===== Drops =====
function spawnDrops(x,y, xpCount){
  // xp orbs
  for(let i=0;i<xpCount;i++){
    const a=rand(0,Math.PI*2), d=rand(0,18);
    drops.push({type:"xp", x:x+Math.cos(a)*d, y:y+Math.sin(a)*d, vx:rand(-40,40), vy:rand(-40,40), r:6, col:"#22c55e", val:1});
  }
  // coins
  if(Math.random()<0.65){
    const n = randi(1,2);
    for(let i=0;i<n;i++){
      const a=rand(0,Math.PI*2), d=rand(0,18);
      drops.push({type:"coin", x:x+Math.cos(a)*d, y:y+Math.sin(a)*d, vx:rand(-50,50), vy:rand(-50,50), r:6, col:"#fbbf24", val:randi(1,3)});
    }
  }
  // gems rarer
  if(Math.random()<0.14){
    drops.push({type:"gem", x:x, y:y, vx:rand(-40,40), vy:rand(-40,40), r:7, col:"#60a5fa", val:1});
  }
}

function pickupDrops(dt){
  const baseMag = 120;
  const mag = baseMag * (1 + player.magnet);
  const mag2 = mag*mag;

  for(let i=drops.length-1;i>=0;i--){
    const d = drops[i];

    // friction
    d.vx *= Math.pow(0.3, dt);
    d.vy *= Math.pow(0.3, dt);
    d.x += d.vx*dt;
    d.y += d.vy*dt;

    const dd = dist2(player.x,player.y,d.x,d.y);
    if(dd < mag2){
      const dx=player.x-d.x, dy=player.y-d.y;
      const dist = Math.hypot(dx,dy)||1;
      const pull = clamp((mag - dist)/mag, 0, 1);
      d.x += (dx/dist) * (420*pull) * dt;
      d.y += (dy/dist) * (420*pull) * dt;
    }

    if(dd < (player.r + d.r + 6)**2){
      if(d.type==="xp"){
        xp.cur += d.val;
        if(player.run.healOnPick>0){
          player.hp = clamp(player.hp + player.run.healOnPick, 0, player.maxHp);
        }
        // level up
        while(xp.cur >= xp.need){
          xp.cur -= xp.need;
          xp.level++;
          xp.need = Math.floor(xp.need * 1.22 + 3);
          openLevelUp();
        }
      } else if(d.type==="coin"){
        player.coins += d.val;
      } else if(d.type==="gem"){
        player.gems += d.val;
      }
      drops.splice(i,1);
    }
  }
}

// ===== Level-up UI =====
let pendingUpgrades = [];

function pick3Upgrades(){
  const defs = skillDefs();
  // avoid exact duplicates
  const picks=[];
  while(picks.length<3){
    const c = defs[randi(0,defs.length-1)];
    if(picks.find(p=>p.id===c.id)) continue;
    picks.push(c);
  }
  return picks;
}

function openLevelUp(){
  if(state!==STATE.RUN) return;
  pendingUpgrades = pick3Upgrades();
  ui.upgradeGrid.innerHTML="";
  pendingUpgrades.forEach((u)=>{
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML = `
      <div class="cardTitle">${u.name} <span class="badge">Выбрать</span></div>
      <div class="cardDesc">${u.desc}</div>
      <div class="cardPrice">
        <div class="pill">LVL ${xp.level}</div>
        <button class="btn small primary">Взять</button>
      </div>
    `;
    card.querySelector("button").addEventListener("click", ()=>{
      u.apply();
      setState(STATE.RUN);
      showToast(`Выбрано: ${u.name}`);
    });
    ui.upgradeGrid.appendChild(card);
  });
  setState(STATE.LEVELUP);
}

// ===== Damage & collisions =====
function damagePlayer(amount){
  if(amount<=0) return;
  if(player.run.shieldLv>0 && shieldReady){
    shieldReady=false;
    fx.push({type:"shield", x:player.x, y:player.y, t:0.35, col:"#93c5fd"});
    return;
  }
  player.hp -= amount;
  fx.push({type:"hit", x:player.x, y:player.y, t:0.18, col:"#ef4444"});
  if(player.hp<=0){
    player.hp=0;
    gameOver();
  }
}

function updateEnemies(dt){
  for(const e of enemies){
    if(e.hp<=0) continue;

    // boss ult
    if(e.type==="boss"){
      e.ultTimer -= dt;
      if(e.ultTimer<=0){
        e.ultTimer = e.ultCd;
        // ult: spawn extra balls (adds) around player
        const n = randi(4,7);
        for(let i=0;i<n;i++){
          const a=rand(0,Math.PI*2);
          const d=rand(260, 340);
          const p={x:player.x+Math.cos(a)*d, y:player.y+Math.sin(a)*d};
          const t = enemyTemplate(save.stage, 4);
          spawnEnemy({...t, x:p.x, y:p.y, hp:t.hp*0.9, hpMax:t.hp*0.9});
        }
        fx.push({type:"bossUlt", x:e.x,y:e.y,t:0.45,col:"#ef4444"});
      }
    }

    // move to player
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.hypot(dx,dy)||1;
    const sp = e.sp;
    e.x += (dx/d)*sp*dt;
    e.y += (dy/d)*sp*dt;

    // arena clamp
    if(world.arena){
      const dd = Math.hypot(e.x, e.y);
      if(dd > world.arenaR){
        const k = world.arenaR/dd;
        e.x*=k; e.y*=k;
      }
    }

    // touch damage
    const rr = (player.r + e.r);
    if(dist2(player.x,player.y,e.x,e.y) < rr*rr){
      damagePlayer(e.dmg*dt);
    }
  }
}

function updateBullets(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i];
    b.life -= dt;
    b.x += b.vx*dt;
    b.y += b.vy*dt;

    // arena bounds
    if(world.arena){
      const dd = Math.hypot(b.x, b.y);
      if(dd > world.arenaR+120){ bullets.splice(i,1); continue; }
    }

    // hit enemies
    for(const e of enemies){
      if(e.hp<=0) continue;
      const rr = e.r + b.r;
      if(dist2(b.x,b.y,e.x,e.y) < rr*rr){
        e.hp -= b.dmg;
        fx.push({type:"hit", x:b.x,y:b.y,t:0.10,col:"#ffffff"});
        if(b.pierce>0){
          b.pierce--;
        } else {
          b.life=0;
        }
        break;
      }
    }

    if(b.life<=0) bullets.splice(i,1);
  }
}

function cleanupDeaths(){
  for(let i=enemies.length-1;i>=0;i--){
    const e = enemies[i];
    if(e.hp>0) continue;
    // drops
    spawnDrops(e.x,e.y, e.xp);
    player.kills++;
    enemies.splice(i,1);
  }
}

// ===== FX update =====
function updateFx(dt){
  for(let i=fx.length-1;i>=0;i--){
    const f=fx[i];
    if(f.type==="grenade"){
      f.t -= dt;
      if(f.t<=0){
        // explode
        const r = f.r;
        const r2 = r*r;
        for(const e of enemies){
          if(e.hp<=0) continue;
          if(dist2(f.x,f.y,e.x,e.y) < (r+e.r)**2){
            e.hp -= f.dmg;
          }
        }
        fx.push({type:"boom", x:f.x,y:f.y,t:0.20,col:"#f59e0b", r});
        fx.splice(i,1);
      }
      continue;
    }

    f.t -= dt;
    if(f.t<=0) fx.splice(i,1);
  }
}

// ===== Movement / camera =====
function updatePlayer(dt){
  const speed = player.baseSpeed * player.run.speedMul;
  const len = Math.hypot(joy.dx, joy.dy);
  let nx=0, ny=0;
  if(joy.active && len>6){
    nx = joy.dx/len;
    ny = joy.dy/len;
  }
  player.x += nx * speed * joy.mag * dt;
  player.y += ny * speed * joy.mag * dt;

  // arena clamp
  if(world.arena){
    const d = Math.hypot(player.x, player.y);
    if(d > world.arenaR){
      const k = world.arenaR/d;
      player.x*=k; player.y*=k;
    }
  }

  // camera follows player
  world.camX = player.x;
  world.camY = player.y;
}

// ===== Drawing =====
function bg(){
  // base background
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0,0,W,H);

  // subtle grid for infinite map
  const grid = 70;
  const ox = (-world.camX % grid + grid) % grid;
  const oy = (-world.camY % grid + grid) % grid;

  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = "#93c5fd";
  ctx.lineWidth = 1;
  for(let x=ox; x<=W; x+=grid){
    ctx.beginPath();
    ctx.moveTo(x,0); ctx.lineTo(x,H);
    ctx.stroke();
  }
  for(let y=oy; y<=H; y+=grid){
    ctx.beginPath();
    ctx.moveTo(0,y); ctx.lineTo(W,y);
    ctx.stroke();
  }
  ctx.restore();

  // arena ring
  if(world.arena){
    const cx = W/2 + (0 - world.camX);
    const cy = H/2 + (0 - world.camY);
    // actually draw ring relative to camera:
    const dx = -world.camX;
    const dy = -world.camY;
    ctx.save();
    ctx.translate(W/2 + dx, H/2 + dy);
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0,0, world.arenaR, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
}

function worldToScreen(x,y){
  // camera center at player
  const sx = W/2 + (x - world.camX);
  const sy = H/2 + (y - world.camY);
  return {sx,sy};
}

function drawEntityCircle(x,y,r,fill,stroke="rgba(255,255,255,.12)"){
  const {sx,sy} = worldToScreen(x,y);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(sx,sy,r,0,Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawPlayer(){
  const color = COS_COLORS.find(c=>c.id===save.cosmetics.color)?.col ?? "#3b82f6";
  const {sx,sy} = worldToScreen(player.x,player.y);

  // aura
  if(save.cosmetics.aura==="Pulse"){
    ctx.save();
    ctx.globalAlpha=0.25;
    ctx.strokeStyle=color;
    ctx.lineWidth=4;
    ctx.beginPath();
    ctx.arc(sx,sy, 24 + Math.sin(runTime*4)*4, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
  if(save.cosmetics.aura==="Halo"){
    ctx.save();
    ctx.globalAlpha=0.22;
    ctx.strokeStyle="#fbbf24";
    ctx.lineWidth=5;
    ctx.beginPath();
    ctx.arc(sx,sy, 28, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  // body
  drawEntityCircle(player.x,player.y, player.r, color);

  // “weapon” small line to nearest target direction
  const t = nearestEnemy(player.x,player.y);
  if(t){
    const dx=t.x-player.x, dy=t.y-player.y;
    const d=Math.hypot(dx,dy)||1;
    const nx=dx/d, ny=dy/d;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx,sy);
    ctx.lineTo(sx + nx*22, sy + ny*22);
    ctx.stroke();
    ctx.restore();
  }

  // shield ready indicator
  if(player.run.shieldLv>0 && shieldReady){
    ctx.save();
    ctx.globalAlpha=0.35;
    ctx.strokeStyle="#93c5fd";
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.arc(sx,sy, 20, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemies(){
  for(const e of enemies){
    if(e.hp<=0) continue;
    drawEntityCircle(e.x,e.y,e.r, e.col);

    // hp bar
    const {sx,sy}=worldToScreen(e.x,e.y);
    const w=48, h=6;
    const hpMax = e.hpMax ?? e.hp;
    const p = clamp(e.hp / hpMax, 0, 1);
    ctx.fillStyle="rgba(0,0,0,.35)";
    ctx.fillRect(sx-w/2, sy-e.r-14, w, h);
    ctx.fillStyle= e.type==="boss" ? "#ef4444" : "#22c55e";
    ctx.fillRect(sx-w/2, sy-e.r-14, w*p, h);
  }
}

function drawBullets(){
  for(const b of bullets){
    const {sx,sy}=worldToScreen(b.x,b.y);
    ctx.fillStyle=b.col;
    ctx.beginPath();
    ctx.arc(sx,sy,b.r,0,Math.PI*2);
    ctx.fill();
  }
}

function drawDrops(){
  for(const d of drops){
    const {sx,sy}=worldToScreen(d.x,d.y);
    ctx.fillStyle=d.col;
    ctx.beginPath();
    ctx.arc(sx,sy,d.r,0,Math.PI*2);
    ctx.fill();
  }
}

function drawFx(){
  for(const f of fx){
    if(f.type==="boom"){
      const {sx,sy}=worldToScreen(f.x,f.y);
      ctx.save();
      ctx.globalAlpha = clamp(f.t/0.20, 0, 1);
      ctx.strokeStyle = f.col;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(sx,sy, f.r*(1 - f.t/0.20), 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    } else if(f.type==="zap"){
      const {sx,sy}=worldToScreen(f.x,f.y);
      ctx.save();
      ctx.globalAlpha = clamp(f.t/0.20, 0, 1);
      ctx.strokeStyle = f.col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy-22);
      ctx.lineTo(sx, sy+22);
      ctx.stroke();
      ctx.restore();
    } else if(f.type==="bossUlt"){
      const {sx,sy}=worldToScreen(f.x,f.y);
      ctx.save();
      ctx.globalAlpha = clamp(f.t/0.45, 0, 1);
      ctx.strokeStyle = f.col;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(sx,sy, 48*(1 - f.t/0.45) + 18, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    } else if(f.type==="shield"){
      const {sx,sy}=worldToScreen(f.x,f.y);
      ctx.save();
      ctx.globalAlpha = clamp(f.t/0.35, 0, 1);
      ctx.strokeStyle = f.col;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(sx,sy, 26, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // saws visual (fast)
  const lv = player.run.orbitSawLv;
  if(lv>0){
    const count = clamp(1+lv,2,6);
    const radius = 42 + lv*8;
    const spin = 2.1 + lv*0.25;
    for(let i=0;i<count;i++){
      const a = runTime*spin + i*(Math.PI*2/count);
      const sxw = player.x + Math.cos(a)*radius;
      const syw = player.y + Math.sin(a)*radius;
      const {sx,sy}=worldToScreen(sxw,syw);
      ctx.fillStyle="rgba(255,255,255,.92)";
      ctx.beginPath();
      ctx.arc(sx,sy, 8, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

function drawHUD(){
  ui.hudStage.textContent = `Этап ${save.stage} · Уровень ${save.levelInStage}/5`;
  ui.hudMode.textContent = `Карта: ${world.arena ? "Арена" : "Бесконечная"}`;
  ui.hudHP.textContent = `❤ ${Math.floor(player.hp)} / ${Math.floor(player.maxHp)}`;
  ui.hudXP.textContent = `XP ${xp.cur} / ${xp.need} · LV ${xp.level}`;
  ui.hudCoins.textContent = `🪙 ${player.coins}`;
  ui.hudGems.textContent  = `💎 ${player.gems}`;
  ui.hudTime.textContent  = `⏱ ${fmtTime(runTime)}`;
  ui.hudKills.textContent = `☠ ${player.kills}`;
}

// ===== Main update loop =====
let prev = performance.now();

function tick(now){
  const dt = clamp((now-prev)/1000, 0.008, 0.05);
  prev = now;

  if(state===STATE.RUN){
    runTime += dt;

    updatePlayer(dt);
    doSpawn(dt);
    autoShoot(dt);
    orbitSaws(dt);
    droneShoot(dt);
    throwGrenade(dt);
    lightning(dt);
    shieldUpdate(dt);

    updateBullets(dt);
    updateEnemies(dt);
    updateFx(dt);
    pickupDrops(dt);
    cleanupDeaths();

    // win check
    if(levelWave.done){
      finishLevel(true);
    }

    // draw
    bg();
    drawDrops();
    drawBullets();
    drawEnemies();
    drawPlayer();
    drawFx();
    drawHUD();
  } else if(state===STATE.MENU){
    // menu idle background
    world.camX = Math.sin(now/1400)*140;
    world.camY = Math.cos(now/1700)*140;
    bg();
    // mini hero preview
    drawPlayerPreview();
  } else {
    // paused/levelup/shop/loadout: still render last known world
    bg();
    drawDrops();
    drawBullets();
    drawEnemies();
    drawPlayer();
    drawFx();
    drawHUD();
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function drawPlayerPreview(){
  // center preview on menu background
  const px=0, py=0;
  const color = COS_COLORS.find(c=>c.id===save.cosmetics.color)?.col ?? "#3b82f6";
  const sx = W/2, sy = H/2 + 50;
  ctx.save();
  ctx.fillStyle=color;
  ctx.beginPath(); ctx.arc(sx,sy,18,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,.18)"; ctx.lineWidth=2; ctx.stroke();
  ctx.restore();
}

// ===== UI events =====
ui.btnPlay.addEventListener("click", ()=>startGame());
ui.btnPause.addEventListener("click", ()=>{
  if(state!==STATE.RUN) return;
  setState(STATE.PAUSE);
});
ui.btnResume.addEventListener("click", ()=>{
  if(ui.screenPause.querySelector(".title").textContent==="Поражение"){
    // retry level
    resetRunStats();
    setState(STATE.RUN);
    return;
  }
  setState(STATE.RUN);
});
ui.btnToMenu.addEventListener("click", ()=>{
  setState(STATE.MENU);
  updateMenuWallet();
});
ui.btnShop.addEventListener("click", ()=>{
  renderShop();
  setState(STATE.SHOP);
});
ui.btnLoadout.addEventListener("click", ()=>{
  renderLoadout();
  setState(STATE.LOADOUT);
});
ui.btnReset.addEventListener("click", ()=>hardReset());

ui.btnCloseShop.addEventListener("click", ()=>{ setState(STATE.MENU); updateMenuWallet(); });
ui.btnCloseLoadout.addEventListener("click", ()=>{ setState(STATE.MENU); updateMenuWallet(); });

ui.dockShop.addEventListener("click", ()=>{
  renderShop(); setState(STATE.SHOP);
});
ui.dockLoadout.addEventListener("click", ()=>{
  renderLoadout(); setState(STATE.LOADOUT);
});
ui.dockSkills.addEventListener("click", ()=>{
  // quick show current run skills
  showToast(`Навыки: пилы ${player.run.orbitSawLv} · гранаты ${player.run.grenadeLv} · молния ${player.run.lightningLv} · дрон ${player.run.droneLv}`);
});
ui.dockQuit.addEventListener("click", ()=>{
  setState(STATE.MENU);
  updateMenuWallet();
});

ui.tabs.forEach(t=>{
  t.addEventListener("click", ()=>{
    ui.tabs.forEach(x=>x.classList.remove("active"));
    t.classList.add("active");
    const tab = t.dataset.tab;
    ui.shopMeta.classList.toggle("hidden", tab!=="meta");
    ui.shopWeapons.classList.toggle("hidden", tab!=="weapons");
    ui.shopCosmetics.classList.toggle("hidden", tab!=="cosmetics");
  });
});

// init ui
setState(STATE.MENU);
updateMenuWallet();
renderShop(); // prebuild once
