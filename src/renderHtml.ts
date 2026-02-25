export function renderHtml() {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Tiny Tower Defense+</title>
        <style>
          :root { color-scheme: dark; --bg:#10131a; --panel:#1a2230; --text:#f2f6ff; --accent:#57cc99; --path:#f4a261; --selected:#90e0ef; }
          * { box-sizing: border-box; font-family: Inter, system-ui, sans-serif; }
          body { margin:0; background: radial-gradient(circle at top,#1d2b42,var(--bg)); color:var(--text); min-height:100vh; display:grid; place-items:center; }
          .layout { width:min(98vw,1240px); display:grid; grid-template-columns:minmax(300px,1fr) 300px; gap:12px; }
          .game-panel { display:grid; gap:12px; }
          .hud { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 12px; background:var(--panel); border-radius:12px; border:1px solid #2f3a52; flex-wrap:wrap; }
          .stats { display:flex; gap:12px; flex-wrap:wrap; font-size:0.94rem; }
          button { border:0; border-radius:8px; background:var(--accent); color:#052111; font-weight:700; padding:9px 12px; cursor:pointer; }
          button:disabled { opacity:0.5; cursor:not-allowed; }
          canvas { width:100%; height:auto; background:#0f1724; border-radius:12px; border:1px solid #344160; }
          .hint { margin:0; opacity:0.85; font-size:0.9rem; text-align:center; }
          .side { background:var(--panel); border:1px solid #2f3a52; border-radius:12px; padding:10px; display:grid; grid-template-rows:auto 1fr auto; gap:8px; max-height:780px; }
          .tower-list { overflow-y:auto; display:grid; gap:8px; padding-right:4px; max-height:360px; }
          .tower-card { border:1px solid #36415a; border-radius:10px; padding:8px; cursor:pointer; background:#151b26; }
          .tower-card.active { border-color:var(--selected); box-shadow:0 0 0 1px var(--selected); }
          .tower-title { font-weight:700; margin-bottom:4px; }
          .tower-meta { font-size:0.82rem; opacity:0.85; line-height:1.35; }
          .upgrade { border-top:1px solid #334058; padding-top:8px; display:grid; gap:8px; }
          .upgrade-paths { display:grid; gap:6px; max-height:260px; overflow:auto; }
          .u-btn { width:100%; text-align:left; font-size:0.8rem; background:#2e3d58; color:#fff; }
          .u-btn.locked { background:#403344; opacity:0.65; }
          .u-btn.maxed { background:#22543d; }
          .small { font-size:0.82rem; opacity:0.9; }
        </style>
      </head>
      <body>
        <div class="layout">
          <section class="game-panel">
            <div class="hud">
              <h1>🛡️ Tiny Tower Defense+</h1>
              <div class="stats">
                <span>❤️ Lives: <strong id="lives">20</strong></span>
                <span>💰 Gold: <strong id="gold">220</strong></span>
                <span>🌊 Wave: <strong id="wave">0</strong></span>
                <span>👾 Enemies: <strong id="enemies">0</strong></span>
              </div>
              <button id="startWave">Start wave</button>
            </div>
            <canvas id="game" width="920" height="560"></canvas>
            <p class="hint">Pick a tower on the right, click map to place. Click placed tower to open upgrades.</p>
          </section>
          <aside class="side">
            <strong>Towers</strong>
            <div class="tower-list" id="towerList"></div>
            <div class="upgrade" id="upgradePanel">
              <strong>Upgrades</strong>
              <div class="small" id="upgradeInfo">Select a placed tower to upgrade.</div>
              <div class="upgrade-paths" id="upgradePaths"></div>
            </div>
          </aside>
        </div>

        <script>
          const canvas = document.getElementById("game");
          const ctx = canvas.getContext("2d");
          const livesEl = document.getElementById("lives");
          const goldEl = document.getElementById("gold");
          const waveEl = document.getElementById("wave");
          const enemiesEl = document.getElementById("enemies");
          const startWaveButton = document.getElementById("startWave");
          const towerListEl = document.getElementById("towerList");
          const upgradeInfoEl = document.getElementById("upgradeInfo");
          const upgradePathsEl = document.getElementById("upgradePaths");

          const RANGE_UNIT = 22;
          const SPEED_SCALE = 0.08;

          const path = [
            { x: 0, y: 280 }, { x: 220, y: 280 }, { x: 220, y: 110 }, { x: 500, y: 110 },
            { x: 500, y: 390 }, { x: 740, y: 390 }, { x: 740, y: 220 }, { x: 920, y: 220 },
          ];

          const ENEMY_TYPES = {
            normal: { label:"Normal", hp:10, speed:10, defense:0, reward:6, color:"#ef476f", shape:"circle", baseDamage:1, budget:1 },
            fast: { label:"Fast", hp:5, speed:20, defense:0, reward:6, color:"#00d4ff", shape:"triangle", baseDamage:1, budget:1 },
            strong: { label:"Strong", hp:25, speed:5, defense:5, reward:13, color:"#9aa0a6", shape:"square", baseDamage:2, budget:3 },
            swarm: { label:"Swarm", hp:3, speed:15, defense:0, reward:2, color:"#ff9f1c", shape:"smallTriangle", baseDamage:1, budget:0.45 },
            stunner: { label:"Stunner", hp:7, speed:25, defense:0, reward:8, color:"#ffdd00", shape:"hex", baseDamage:0, budget:2 },
            splitter: { label:"Splitter", hp:15, speed:10, defense:0, reward:10, color:"#3adb76", shape:"split", baseDamage:1, budget:2 },
            splitterChild: { label:"Split", hp:10, speed:15, defense:0, reward:4, color:"#5ee28f", shape:"circle", baseDamage:1, budget:0 },
            tank: { label:"Tank", hp:40, speed:3, defense:15, reward:20, color:"#123b69", shape:"oct", baseDamage:3, budget:5 },
          };

          const TOWERS = [
            { id:"basic", name:"Basic Tower", cost:40, damage:1, atkSpeed:1, range:5, color:"#ffffff", shape:"circle" },
            { id:"gatling", name:"Gatling Turret", cost:60, damage:1, atkSpeed:0.3, range:4, color:"#274c77", shape:"gatling" },
            { id:"sniper", name:"Sniper Tower", cost:100, damage:5, atkSpeed:3, range:25, color:"#1b4332", shape:"sniper" },
            { id:"frost", name:"Frost Cannon", cost:55, damage:0, atkSpeed:2, range:3, color:"#48cae4", shape:"diamond", frost:true },
            { id:"tesla", name:"Tesla Coil", cost:100, damage:6, atkSpeed:4, range:10, color:"#ffd60a", shape:"tesla", chain:true, chainCount:3 },
            { id:"flame", name:"Flamethrower", cost:150, damage:0.5, atkSpeed:0.1, range:6, color:"#d90429", shape:"ellipse", burn:true, burnDuration:240, burnDps:3, projectileColor:"#ff2d2d" },
            { id:"acid", name:"Acid Launcher", cost:200, damage:5, atkSpeed:3, range:12, color:"#b7efc5", shape:"trap", pierce:true, armoredBonus:5 },
            { id:"commander", name:"Commander", cost:250, damage:0, atkSpeed:0, range:8, color:"#ffffff", shape:"commander", auraDamage:0.3, auraSpeed:0.3 },
            { id:"railgun", name:"Railgun", cost:300, damage:25, atkSpeed:5, range:20, color:"#c0c0c0", shape:"railgun", linePierce:true, linePierceCount:999, pierce:true },
            { id:"factory", name:"Turret Factory", cost:350, damage:0, atkSpeed:4, range:0, color:"#4a4e69", shape:"factory", summonFactoryTurret:true },
            { id:"bomb", name:"Bomb Tower", cost:150, damage:8, atkSpeed:3, range:9, color:"#8d99ae", shape:"bomb", splashRadius:68 },
          ];

          const UPGRADES = {
            basic: {
              A:[{cost:60,set:{damage:2,atkSpeed:1,range:5}},{cost:120,set:{damage:4,atkSpeed:1,range:6}},{cost:260,set:{damage:8,atkSpeed:1,range:7}},{cost:550,set:{damage:16,atkSpeed:1,range:8,critChance:0.25}}],
              B:[{cost:60,set:{damage:1,atkSpeed:0.6,range:5}},{cost:120,set:{damage:1,atkSpeed:0.35,range:6}},{cost:260,set:{damage:1,atkSpeed:0.2,range:7}},{cost:550,set:{damage:2,atkSpeed:0.15,range:8,doubleEvery:5}}],
              C:[{cost:70,set:{damage:1,atkSpeed:1,range:5,supportVuln:0.1}},{cost:140,set:{damage:1,atkSpeed:1,range:6,supportVuln:0.2}},{cost:300,set:{damage:1,atkSpeed:1,range:7,supportVuln:0.3}},{cost:600,set:{damage:2,atkSpeed:1,range:8,supportVuln:0.5,spreadVuln:1}}],
            },
            gatling: {
              A:[{cost:90,set:{damage:1.5,atkSpeed:0.25,range:4}},{cost:160,set:{damage:2,atkSpeed:0.2,range:5}},{cost:350,set:{damage:3,atkSpeed:0.18,range:6}},{cost:800,set:{damage:5,atkSpeed:0.12,range:7,pierceTargets:2}}],
              B:[{cost:80,set:{damage:1,atkSpeed:0.3,range:4,shred:2}},{cost:150,set:{damage:1.5,atkSpeed:0.25,range:5,shred:4}},{cost:320,set:{damage:2,atkSpeed:0.22,range:6,shred:6}},{cost:750,set:{damage:3,atkSpeed:0.2,range:7,shred:6}}],
              C:[{cost:80,set:{damage:1,atkSpeed:0.3,range:5,hitSlow:0.2}},{cost:150,set:{damage:1,atkSpeed:0.25,range:6,hitSlow:0.35}},{cost:320,set:{damage:1.5,atkSpeed:0.22,range:7,hitSlow:0.5}},{cost:700,set:{damage:2,atkSpeed:0.2,range:8,hitSlow:0.7,weakenDamage:0.25}}],
            },
            sniper: {
              A:[{cost:150,set:{damage:8,atkSpeed:3,range:25}},{cost:300,set:{damage:14,atkSpeed:3,range:30}},{cost:600,set:{damage:25,atkSpeed:3,range:35}},{cost:1200,set:{damage:50,atkSpeed:3,range:40,executeChance:0.2,executeHp:0.4}}],
              B:[{cost:140,set:{damage:5,atkSpeed:2.2,range:25,lowHpBonus:0.5}},{cost:280,set:{damage:6,atkSpeed:2,range:30,lowHpBonus:1}},{cost:520,set:{damage:8,atkSpeed:2,range:35,lowHpBonus:1.5}},{cost:1000,set:{damage:12,atkSpeed:2,range:40,lowHpBonus:3}}],
              C:[{cost:160,set:{damage:5,atkSpeed:3,range:25,pierceTargets:1}},{cost:320,set:{damage:7,atkSpeed:3,range:30,pierceTargets:3}},{cost:550,set:{damage:9,atkSpeed:3,range:35,pierceTargets:6}},{cost:1100,set:{damage:14,atkSpeed:3,range:40,pierceTargets:999,perPierceProjectileBonus:0.25}}],
            },
            frost: {
              A:[{cost:80,set:{damage:0,atkSpeed:2,range:4,frostSlow:0.5}},{cost:150,set:{damage:0,atkSpeed:2,range:5,frostSlow:0.5,freezeOnMaxSlow:60}},{cost:300,set:{damage:0,atkSpeed:2,range:6,frostSlow:0.5,freezeOnMaxSlow:90}},{cost:700,set:{damage:0,atkSpeed:2,range:7,frostSlow:0.5,freezeOnMaxSlow:90,frozenVuln:0.5}}],
              B:[{cost:90,set:{damage:1,atkSpeed:2,range:3,cryoHitSlow:true}},{cost:170,set:{damage:2,atkSpeed:2,range:4,cryoHitSlow:true}},{cost:320,set:{damage:3,atkSpeed:2,range:5,cryoHitSlow:true,hitSlow:0.4}},{cost:700,set:{damage:5,atkSpeed:2,range:6,cryoHitSlow:true,freezeEvery:4,freezeOnHitTicks:60}}],
              C:[{cost:70,set:{damage:0,atkSpeed:2,range:5,supportAtkAura:0.1}},{cost:140,set:{damage:0,atkSpeed:2,range:6,supportAtkAura:0.2}},{cost:300,set:{damage:0,atkSpeed:2,range:7,supportAtkAura:0.3}},{cost:700,set:{damage:0,atkSpeed:2,range:8,supportAtkAura:0.4,supportDmgAura:0.2}}],
            },
            tesla: {
              A:[{cost:160,set:{damage:7,atkSpeed:4,range:10,chainCount:4}},{cost:300,set:{damage:9,atkSpeed:4,range:12,chainCount:6}},{cost:600,set:{damage:11,atkSpeed:4,range:14,chainCount:8}},{cost:1200,set:{damage:16,atkSpeed:4,range:16,chainCount:999,chainNoFalloff:true}}],
              B:[{cost:180,set:{damage:9,atkSpeed:4,range:10}},{cost:350,set:{damage:14,atkSpeed:4,range:12}},{cost:650,set:{damage:22,atkSpeed:4,range:14}},{cost:1300,set:{damage:40,atkSpeed:4,range:16,lightningExplosion:true}}],
              C:[{cost:150,set:{damage:6,atkSpeed:4,range:10,hitSlow:0.2}},{cost:300,set:{damage:7,atkSpeed:4,range:12,hitSlow:0.4}},{cost:600,set:{damage:9,atkSpeed:4,range:14,hitSlow:0.6}},{cost:1200,set:{damage:12,atkSpeed:4,range:16,permaSlowInRange:0.4}}],
            },
            flame: {
              A:[{cost:200,set:{damage:1.5,atkSpeed:0.1,range:7,burnDuration:360,burnDps:3}},{cost:350,set:{damage:2,atkSpeed:0.1,range:8,burnDuration:360,burnDps:5}},{cost:650,set:{damage:3,atkSpeed:0.1,range:9,burnDuration:480,burnDps:5}},{cost:1300,set:{damage:5,atkSpeed:0.1,range:10,burnDuration:480,burnDps:5,burnSpread:true}}],
              B:[{cost:220,set:{damage:2,atkSpeed:0.08,range:6}},{cost:400,set:{damage:3,atkSpeed:0.07,range:7}},{cost:700,set:{damage:5,atkSpeed:0.06,range:8}},{cost:1400,set:{damage:8,atkSpeed:0.05,range:9,rampOnTarget:true}}],
              C:[{cost:200,set:{damage:1.5,atkSpeed:0.1,range:6,burnExplode:3}},{cost:350,set:{damage:2,atkSpeed:0.1,range:7,burnExplode:6}},{cost:650,set:{damage:3,atkSpeed:0.1,range:8,burnExplode:10}},{cost:1300,set:{damage:4,atkSpeed:0.1,range:9,burnExplode:20,igniteOnExplode:true}}],
            },
            acid: {
              A:[{cost:260,set:{damage:7,armoredBonus:7,atkSpeed:3,range:12}},{cost:450,set:{damage:10,armoredBonus:10,atkSpeed:3,range:14}},{cost:750,set:{damage:16,armoredBonus:16,atkSpeed:3,range:16}},{cost:1500,set:{damage:30,armoredBonus:30,atkSpeed:3,range:18,ignoreDefense:true}}],
              B:[{cost:240,set:{damage:5,atkSpeed:2,range:12,acidDotDps:2}},{cost:420,set:{damage:6,atkSpeed:2,range:14,acidDotDps:4}},{cost:700,set:{damage:7,atkSpeed:2,range:16,acidDotDps:6}},{cost:1400,set:{damage:10,atkSpeed:2,range:18,acidDotDps:12,acidSpreadOnDeath:true}}],
              C:[{cost:230,set:{damage:5,atkSpeed:3,range:12,splashRadius:68}},{cost:400,set:{damage:6,atkSpeed:3,range:14,splashRadius:95}},{cost:700,set:{damage:7,atkSpeed:3,range:16,splashRadius:140}},{cost:1400,set:{damage:10,atkSpeed:3,range:18,splashRadius:160,splashAppliesAcid:true,acidDotDps:6}}],
            },
            commander: {
              A:[{cost:350,set:{auraDamage:0.4,auraSpeed:0.4}},{cost:600,set:{auraDamage:0.6,auraSpeed:0.6}},{cost:900,set:{auraDamage:0.8,auraSpeed:0.8}},{cost:1800,set:{auraDamage:1.2,auraSpeed:1.2,trueDamageWindow:true}}],
              B:[{cost:300,set:{range:10}},{cost:550,set:{range:14}},{cost:800,set:{range:18}},{cost:1600,set:{globalAuraHalf:true}}],
              C:[{cost:300,set:{auraCrit:0.1}},{cost:550,set:{auraCrit:0.2,auraImmuneStun:true}},{cost:850,set:{auraCrit:0.3,auraImmuneStun:true}},{cost:1600,set:{auraCrit:0.5,auraImmuneStun:true,lifesteal:0.1}}],
            },
            railgun: {
              A:[{cost:500,set:{damage:40,atkSpeed:5,range:20}},{cost:900,set:{damage:70,atkSpeed:5,range:25}},{cost:1400,set:{damage:120,atkSpeed:5,range:30}},{cost:3000,set:{damage:250,atkSpeed:5,range:35,railShockwave:true}}],
              B:[{cost:450,set:{damage:25,atkSpeed:5,range:20,linePierceCount:5}},{cost:800,set:{damage:35,atkSpeed:5,range:25,linePierceCount:9999}},{cost:1300,set:{damage:60,atkSpeed:5,range:30,linePierceCount:9999}},{cost:2800,set:{damage:100,atkSpeed:5,range:35,linePierceCount:9999,perPierceBeamBonus:0.1}}],
              C:[{cost:450,set:{damage:30,atkSpeed:5,range:20,ignoreDefense:true}},{cost:800,set:{damage:45,atkSpeed:5,range:25,ignoreDefense:true,antiArmorBonus:0.5}},{cost:1300,set:{damage:70,atkSpeed:5,range:30,ignoreDefense:true,antiArmorBonus:1}},{cost:2800,set:{damage:120,atkSpeed:5,range:35,ignoreDefense:true,antiArmorBonus:2}}],
            },
            factory: {
              A:[{cost:450,set:{spawnRateMult:1.3}},{cost:800,set:{spawnRateMult:1.6}},{cost:1200,set:{spawnRateMult:2}},{cost:2500,set:{spawnRateMult:3,doubleSpawn:true}}],
              B:[{cost:500,set:{unitDamage:1,unitAtkSpeed:0.4,unitRange:7,unitHp:10}},{cost:900,set:{unitDamage:2,unitAtkSpeed:0.35,unitRange:8,unitHp:20}},{cost:1400,set:{unitDamage:4,unitAtkSpeed:0.3,unitRange:9,unitHp:30}},{cost:3000,set:{unitDamage:8,unitAtkSpeed:0.25,unitRange:11,unitHp:60}}],
              C:[{cost:450,set:{unitDeathExplosion:5}},{cost:800,set:{unitDeathExplosion:12,unitDeathBurn:true}},{cost:1200,set:{unitDeathExplosion:25}},{cost:2500,set:{unitDeathExplosion:60,unitDeathBurn:true,burningGround:true}}],
            },
            bomb: {
              A:[{cost:240,set:{damage:12,atkSpeed:3,range:9}},{cost:420,set:{damage:20,atkSpeed:3,range:11}},{cost:700,set:{damage:35,atkSpeed:3,range:13}},{cost:1500,set:{damage:80,atkSpeed:3,range:15,doubleShockwave:true}}],
              B:[{cost:220,set:{damage:8,atkSpeed:3,range:9,clusterCount:2}},{cost:400,set:{damage:10,atkSpeed:3,range:11,clusterCount:4}},{cost:650,set:{damage:15,atkSpeed:3,range:13,clusterCount:6}},{cost:1400,set:{damage:25,atkSpeed:3,range:15,clusterCount:10}}],
              C:[{cost:230,set:{damage:8,atkSpeed:3,range:9,hitStun:30}},{cost:420,set:{damage:10,atkSpeed:3,range:11,hitStun:72}},{cost:700,set:{damage:12,atkSpeed:3,range:13,hitStun:120}},{cost:1500,set:{damage:18,atkSpeed:3,range:15,hitStun:120,chainStun:true}}],
            },
          };

          const GOLD_MULTIPLIER = 2.2;

          const state = { lives:20, gold:220, wave:0, towers:[], enemies:[], projectiles:[], alliedTurrets:[], spawning:false, queue:[], spawnCooldown:0, selectedTower:TOWERS[0].id, selectedPlacedTowerId:null };

          const copyStats = (m) => JSON.parse(JSON.stringify(m));
          const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

          function updateHud() { livesEl.textContent=Math.max(state.lives,0); goldEl.textContent=Math.floor(state.gold); waveEl.textContent=state.wave; enemiesEl.textContent=state.enemies.length; startWaveButton.disabled=state.spawning||state.enemies.length>0||state.lives<=0; }

          function buildTowerMenu() {
            towerListEl.innerHTML="";
            for (const tower of TOWERS) {
              const card=document.createElement("div");
              card.className="tower-card" + (state.selectedTower===tower.id ? " active" : "");
              card.innerHTML='<div class="tower-title">'+tower.name+' ('+tower.cost+'g)</div><div class="tower-meta">DMG: '+tower.damage+'<br>ATK SPD: '+tower.atkSpeed+'s<br>Range: '+tower.range+'</div>';
              card.onclick=()=>{ state.selectedTower=tower.id; buildTowerMenu(); };
              towerListEl.appendChild(card);
            }
          }

          function getPlacedTower() { return state.towers.find((t)=>t.id===state.selectedPlacedTowerId) || null; }

          function renderUpgradePanel() {
            const tower = getPlacedTower();
            upgradePathsEl.innerHTML = "";
            if (!tower) { upgradeInfoEl.textContent = "Select a placed tower to upgrade."; return; }
            const defs = UPGRADES[tower.baseId];
            if (!defs) { upgradeInfoEl.textContent = tower.baseName + ": no upgrade paths"; return; }
            const lockedPath = tower.upgradePath;
            upgradeInfoEl.textContent = tower.baseName + " | Path: " + (lockedPath || "none") + " | Tier: " + tower.upgradeTier;

            for (const pathKey of ["A","B","C"]) {
              const tiers = defs[pathKey];
              const nextTier = tower.upgradePath === pathKey ? tower.upgradeTier + 1 : 1;
              const locked = !!(lockedPath && lockedPath !== pathKey);
              const maxed = tower.upgradePath === pathKey && tower.upgradeTier >= tiers.length;
              const btn = document.createElement("button");
              btn.className = "u-btn" + (locked ? " locked" : "") + (maxed ? " maxed" : "");
              if (locked) {
                btn.textContent = "Path " + pathKey + " (locked)";
                btn.disabled = true;
              } else if (maxed) {
                btn.textContent = "Path " + pathKey + " maxed";
                btn.disabled = true;
              } else {
                const up = tiers[nextTier - 1];
                btn.textContent = "Path " + pathKey + " T" + nextTier + " - " + up.cost + "g";
                btn.disabled = state.gold < up.cost;
                btn.onclick = () => purchaseUpgrade(tower.id, pathKey, nextTier);
              }
              upgradePathsEl.appendChild(btn);
            }
          }

          function applyTowerStats(tower, set) {
            Object.assign(tower.stats, set);
            tower.rangePx = tower.stats.range * RANGE_UNIT;
          }

          function purchaseUpgrade(towerId, pathKey, tier) {
            const tower = state.towers.find((t)=>t.id===towerId);
            if (!tower) return;
            const defs = UPGRADES[tower.baseId];
            if (!defs || !defs[pathKey]) return;
            if (tower.upgradePath && tower.upgradePath !== pathKey) return;
            if (tier !== tower.upgradeTier + 1) return;
            const up = defs[pathKey][tier - 1];
            if (!up || state.gold < up.cost) return;

            state.gold -= up.cost;
            if (!tower.upgradePath) tower.upgradePath = pathKey;
            tower.upgradeTier = tier;
            applyTowerStats(tower, up.set);
            updateHud();
            renderUpgradePanel();
          }

          function fairWavePlan(wave) {
            const budget=14 + wave*5; const plan=[]; let left=budget;
            const unlocked=["normal"]; if (wave>=2) unlocked.push("fast","swarm"); if (wave>=3) unlocked.push("strong","splitter"); if (wave>=4) unlocked.push("stunner"); if (wave>=5) unlocked.push("tank");
            const limits={ fast:Math.max(4,wave*2), stunner:Math.max(1,Math.floor(wave/2)), tank:Math.max(1,Math.floor(wave/3))}; const c={fast:0,stunner:0,tank:0};
            while (left>0.8) { const pool=unlocked.filter((t)=>ENEMY_TYPES[t].budget<=left+0.2 && (limits[t]===undefined || c[t]<limits[t])); if(!pool.length) break; const p=pool[Math.floor(Math.random()*pool.length)]; if(p==="swarm"){ const count=5+Math.floor(Math.random()*6); for(let i=0;i<count;i++) plan.push("swarm"); left-=ENEMY_TYPES.swarm.budget*count; } else { plan.push(p); left-=ENEMY_TYPES[p].budget; if(c[p]!==undefined)c[p]++; } }
            if (plan.filter((x)=>x==="normal").length<3) plan.push("normal","normal","normal");
            return plan.sort(()=>Math.random()-0.5);
          }

          function createEnemy(typeKey) {
            const type=ENEMY_TYPES[typeKey];
            return { id:crypto.randomUUID(), type:typeKey, x:path[0].x, y:path[0].y, hp:type.hp, maxHp:type.hp, speed:type.speed*SPEED_SCALE, defense:type.defense, reward:type.reward, pathIndex:1, baseDamage:type.baseDamage, burnTicks:0, burnDps:3, slowTicks:0, slowAmount:0.45, vulnMult:0, acidTicks:0, acidDps:0, stunTicks:0, weakenedDamage:0, permaSlow:0, frozenVuln:0 };
          }

          function startWave(){ if(state.spawning||state.lives<=0) return; state.wave++; state.queue=fairWavePlan(state.wave); state.spawning=true; state.spawnCooldown=0; updateHud(); }
          function spawnEnemyTick(){ if(!state.spawning) return; state.spawnCooldown--; if(state.spawnCooldown>0) return; if(!state.queue.length){state.spawning=false;return;} state.enemies.push(createEnemy(state.queue.shift())); state.spawnCooldown=10+Math.floor(Math.random()*12); }

          function applyDamage(enemy, amount, options={}) {
            let dmg = amount;
            if (enemy.vulnMult > 0) dmg *= 1 + enemy.vulnMult;
            if (options.lowHpBonus && enemy.hp <= enemy.maxHp * 0.5) dmg *= 1 + options.lowHpBonus;
            if (options.antiArmorBonus && enemy.defense > 0) dmg *= 1 + options.antiArmorBonus;
            if (options.ignoreDefense) {
            } else if (options.pierce && enemy.defense > 0) dmg += options.armoredBonus || 0;
            if (!options.ignoreDefense) {
              if (enemy.defense > 0 && !options.pierce && amount < enemy.defense) dmg = 0;
              else if (enemy.defense > 0 && !options.pierce) dmg = Math.max(0, dmg - enemy.defense);
            }
            enemy.hp -= dmg;
            if (options.shred) enemy.defense = Math.max(0, enemy.defense - options.shred);
            if (options.hitSlow) { enemy.slowTicks = Math.max(enemy.slowTicks, 60); enemy.slowAmount = Math.max(enemy.slowAmount, options.hitSlow); }
            if (options.supportVuln) enemy.vulnMult = Math.max(enemy.vulnMult, options.supportVuln);
            if (options.acidDotDps) { enemy.acidTicks = Math.max(enemy.acidTicks, 240); enemy.acidDps = Math.max(enemy.acidDps, options.acidDotDps); if (options.acidSpreadOnDeath) enemy.acidSpreadOnDeath = true; }
            if (options.hitStun) enemy.stunTicks = Math.max(enemy.stunTicks, options.hitStun);
            if (options.freezeOnHitTicks) enemy.stunTicks = Math.max(enemy.stunTicks, options.freezeOnHitTicks);
            if (options.weakenDamage) enemy.weakenedDamage = Math.max(enemy.weakenedDamage || 0, options.weakenDamage);
            return dmg;
          }

          function explodeAt(x, y, radius, dmg, burn=false) {
            for (const enemy of state.enemies) {
              if (distance(enemy,{x,y}) <= radius) {
                applyDamage(enemy, dmg, {});
                if (burn) { enemy.burnTicks = Math.max(enemy.burnTicks, 180); enemy.burnDps = Math.max(enemy.burnDps, 3); }
              }
            }
          }

          function killEnemy(i, enemy) {
            state.enemies.splice(i,1); state.gold += enemy.reward * GOLD_MULTIPLIER;
            if (enemy.type === "stunner") {
              for (const tower of state.towers) {
                const buffs = computeBuffsForTower(tower);
                if (distance(tower, enemy) <= 120 && !buffs.immuneStun) tower.stunTicks = Math.max(tower.stunTicks, 120);
              }
            }
            if (enemy.type === "splitter") {
              for (let n=0;n<2;n++) { const c=createEnemy("splitterChild"); c.x=enemy.x+(n===0?-8:8); c.y=enemy.y+(n===0?-4:4); c.pathIndex=enemy.pathIndex; state.enemies.push(c); }
            }
            if (enemy.burnExplode > 0) explodeAt(enemy.x, enemy.y, 55, enemy.burnExplode, false);
            if (enemy.acidTicks > 0 && enemy.acidDps > 0 && enemy.acidSpreadOnDeath) { for (const near of state.enemies) { if (distance(near, enemy) <= 60) { near.acidTicks = Math.max(near.acidTicks, 180); near.acidDps = Math.max(near.acidDps, enemy.acidDps); } } }
          }

          function updateEnemies() {
            for (let i=state.enemies.length-1;i>=0;i--) {
              const enemy=state.enemies[i];
              if (enemy.burnTicks>0) { enemy.hp -= enemy.burnDps / 60; enemy.burnTicks--; }
              if (enemy.acidTicks>0) { enemy.hp -= enemy.acidDps / 60; enemy.acidTicks--; }
              if (enemy.hp <= 0) { killEnemy(i, enemy); continue; }
              if (enemy.stunTicks>0) { enemy.stunTicks--; continue; }
              const activeSlow = Math.max(enemy.permaSlow || 0, enemy.slowTicks>0 ? enemy.slowAmount : 0);
              const speedMultiplier = activeSlow>0 ? Math.max(0.05, 1 - activeSlow) : 1;
              if (enemy.slowTicks>0) enemy.slowTicks--;
              const target=path[enemy.pathIndex];
              if (!target) { state.enemies.splice(i,1); state.lives -= Math.max(0, enemy.baseDamage * (1 - (enemy.weakenedDamage || 0))); continue; }
              const dx=target.x-enemy.x, dy=target.y-enemy.y, len=Math.hypot(dx,dy), move=enemy.speed*speedMultiplier;
              if (len<move) { enemy.x=target.x; enemy.y=target.y; enemy.pathIndex++; } else { enemy.x += (dx/len)*move; enemy.y += (dy/len)*move; }
            }
          }

          function updateAlliedTurrets() {
            for (let i=state.alliedTurrets.length-1;i>=0;i--) {
              const unit=state.alliedTurrets[i];
              const p=path[unit.pathIndex]; if(!p){ if (unit.deathExplosion) explodeAt(unit.x, unit.y, 58, unit.deathExplosion, !!unit.deathBurn); state.alliedTurrets.splice(i,1); continue; }
              const dx=p.x-unit.x, dy=p.y-unit.y, len=Math.hypot(dx,dy), move=1.4;
              if(len<move){ unit.x=p.x; unit.y=p.y; unit.pathIndex--; } else { unit.x += (dx/len)*move; unit.y += (dy/len)*move; }
              for (const e of state.enemies) if(distance(unit,e)<12) unit.hp -= 0.1;
              unit.cooldown--; if(unit.cooldown<=0){ let t=null, fur=-1; for(const e of state.enemies){ if(distance(unit,e)<=unit.rangePx && e.pathIndex>fur){t=e;fur=e.pathIndex;} } if(t){ unit.cooldown=Math.max(1,Math.round(unit.atkSpeed*60)); state.projectiles.push({x:unit.x,y:unit.y,target:t,speed:6,damage:unit.damage,color:"#89fcff",options:{}}); } }
              if(unit.hp<=0){ if (unit.deathExplosion) explodeAt(unit.x, unit.y, 58, unit.deathExplosion, !!unit.deathBurn); state.alliedTurrets.splice(i,1); }
            }
          }

          function computeBuffsForTower(tower) {
            const out = { dmg:0, spd:0, crit:0, immuneStun:false, trueDamage:false, lifesteal:0 };
            for (const src of state.towers) {
              if (!src.stats.auraDamage && !src.stats.auraSpeed && !src.stats.auraCrit && !src.stats.supportAtkAura) continue;
              if (src === tower) continue;
              if (!src.stats.globalAuraHalf && distance(src,tower) > src.rangePx) continue;
              const auraScale = src.stats.globalAuraHalf ? 0.5 : 1;
              out.dmg = Math.max(out.dmg, (src.stats.auraDamage || 0) * auraScale, (src.stats.supportDmgAura || 0) * auraScale);
              out.spd = Math.max(out.spd, (src.stats.auraSpeed || 0) * auraScale, (src.stats.supportAtkAura || 0) * auraScale);
              out.crit = Math.max(out.crit, (src.stats.auraCrit || 0) * auraScale);
              if (src.stats.trueDamageWindow) {
                const phase = Math.floor(performance.now() / 1000) % 10;
                if (phase < 3) out.trueDamage = true;
              }
              out.immuneStun = out.immuneStun || !!src.stats.auraImmuneStun;
              out.lifesteal = Math.max(out.lifesteal, (src.stats.lifesteal || 0) * auraScale);
            }
            return out;
          }

          function findTargetForTower(t){ let target=null,fur=-1; for(const e of state.enemies){ if(distance(t,e)<=t.rangePx && e.pathIndex>fur){target=e;fur=e.pathIndex;} } return target; }
          function pointToSegmentDistance(px,py,x1,y1,x2,y2){ const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy; if(l2===0)return Math.hypot(px-x1,py-y1); let t=((px-x1)*dx+(py-y1)*dy)/l2; t=Math.max(0,Math.min(1,t)); const qx=x1+t*dx,qy=y1+t*dy; return Math.hypot(px-qx,py-qy); }

          function towerShoot(tower, target, buffs) {
            const s=tower.stats;
            let dmg=s.damage*(1+buffs.dmg);
            if (s.rampOnTarget && tower.lastTargetId === (target && target.id)) { tower.rampStacks = Math.min((tower.rampStacks || 0) + 1, 20); } else { tower.rampStacks = 0; }
            tower.lastTargetId = target && target.id;
            if (s.rampOnTarget && tower.rampStacks > 0) dmg *= 1 + tower.rampStacks * 0.08;
            const critChance = Math.max(buffs.crit || 0, s.critChance || 0);
            if (critChance > 0 && Math.random() < critChance) dmg *= 2;

            if (s.summonFactoryTurret) {
              const rateMult = s.spawnRateMult || 1;
              const spawnCount = s.doubleSpawn ? 2 : 1;
              for (let i = 0; i < spawnCount; i++) state.alliedTurrets.push({ x:path[path.length-1].x, y:path[path.length-1].y, pathIndex:path.length-2, hp:s.unitHp||5, unitHp:s.unitHp||5, damage:s.unitDamage||0.6, atkSpeed:s.unitAtkSpeed||0.4, rangePx:(s.unitRange||7)*RANGE_UNIT, cooldown:0, deathExplosion:s.unitDeathExplosion||0, deathBurn:!!s.unitDeathBurn, burningGround:!!s.burningGround });
              tower.cooldown = Math.max(1, Math.round((s.atkSpeed / rateMult) * 60));
              return;
            }

            if (s.frost) {
              const slowAmount = s.frostSlow ?? 0.45;
              for (const enemy of state.enemies) {
                if (distance(enemy, target) <= tower.rangePx) {
                  enemy.slowTicks = Math.max(enemy.slowTicks, 120);
                  enemy.slowAmount = Math.max(enemy.slowAmount, slowAmount);
                  if (s.freezeOnMaxSlow && slowAmount >= 0.5) { enemy.stunTicks = Math.max(enemy.stunTicks, s.freezeOnMaxSlow); if (s.frozenVuln) enemy.vulnMult = Math.max(enemy.vulnMult, s.frozenVuln); }
                  if (s.damage > 0) applyDamage(enemy, dmg, { hitSlow: s.cryoHitSlow ? slowAmount : 0 });
                  if (s.permaSlowInRange) enemy.permaSlow = Math.max(enemy.permaSlow, s.permaSlowInRange);
                }
              }
            }

            if (s.chain) {
              const impacted=[target];
              applyDamage(target,dmg,{ hitSlow:s.hitSlow||0 });
              const cap = s.chainCount || 3;
              for(const enemy of state.enemies){ if(impacted.length>=cap) break; if(enemy===target) continue; if(distance(enemy, impacted[impacted.length-1])<=110){ impacted.push(enemy); applyDamage(enemy,s.chainNoFalloff ? dmg : dmg/2,{ hitSlow:s.hitSlow||0 }); } }
              state.projectiles.push({x:tower.x,y:tower.y,target,mode:"bolt",ttl:8});
              if (s.lightningExplosion) explodeAt(target.x, target.y, 42, dmg * 0.35, false);
              return;
            }

            if (s.linePierce) {
              let hits = 0;
              for (const enemy of state.enemies) {
                if (distance(tower, enemy) > tower.rangePx) continue;
                if (pointToSegmentDistance(enemy.x, enemy.y, tower.x, tower.y, target.x, target.y) <= 14) {
                  const scaledDamage = dmg * (1 + (s.perPierceBeamBonus || 0) * hits);
                  applyDamage(enemy, scaledDamage, { pierce:true, armoredBonus:s.armoredBonus||0, ignoreDefense:!!s.ignoreDefense || buffs.trueDamage, antiArmorBonus:s.antiArmorBonus||0 });
                  hits++;
                  if (hits >= (s.linePierceCount || 999)) break;
                }
              }
              state.projectiles.push({x:tower.x,y:tower.y,target,mode:"beam",ttl:6,color:"#d9d9d9"});
              if (s.railShockwave) explodeAt(target.x - 25, target.y, 48, dmg * 0.5, false);
              return;
            }

            state.projectiles.push({ x:tower.x, y:tower.y, target, speed:6, damage:dmg, color:s.projectileColor||"#ffffff", splashRadius:s.splashRadius||0, clusterCount:s.clusterCount||0, options:{ pierce:!!s.pierce, armoredBonus:s.armoredBonus||0, burn:!!s.burn, burnDuration:s.burnDuration||240, burnDps:s.burnDps||3, burnExplode:s.burnExplode||0, shred:s.shred||0, hitSlow:s.hitSlow||0, supportVuln:s.supportVuln||0, acidDotDps:s.acidDotDps||0, hitStun:s.hitStun||0, lowHpBonus:s.lowHpBonus||0, ignoreDefense:!!s.ignoreDefense || buffs.trueDamage, antiArmorBonus:s.antiArmorBonus||0, lifesteal:buffs.lifesteal||0, weakenDamage:s.weakenDamage||0, spreadVuln:s.spreadVuln||0, splashAppliesAcid:!!s.splashAppliesAcid, chainStun:!!s.chainStun, igniteOnExplode:!!s.igniteOnExplode, acidSpreadOnDeath:!!s.acidSpreadOnDeath, freezeOnHitTicks:tower.tempFreezeTicks||0, lifesteal:s.lifesteal||0 }, pierceTargets:s.pierceTargets||0, doubleShockwave:!!s.doubleShockwave, perPierceProjectileBonus:s.perPierceProjectileBonus||0 });
          }

          function updateTowers() {
            for (const tower of state.towers) {
              const buffs = computeBuffsForTower(tower);
              if (tower.stunTicks>0) { if (!buffs.immuneStun) { tower.stunTicks--; continue; } tower.stunTicks = 0; }
              if (tower.stats.auraDamage || tower.stats.auraSpeed || tower.stats.auraCrit) continue;
              tower.cooldown--; if(tower.cooldown>0) continue;
              const target=findTargetForTower(tower); if(!target && !tower.stats.summonFactoryTurret) continue;
              const atkSpeed = tower.stats.atkSpeed > 0 ? tower.stats.atkSpeed / (1 + buffs.spd) : 99999;
              tower.cooldown = Math.max(1, Math.round(atkSpeed * 60));
              tower.shotCount = (tower.shotCount || 0) + 1;
              tower.tempFreezeTicks = 0;
              if (tower.stats.freezeEvery && tower.shotCount % tower.stats.freezeEvery === 0) tower.tempFreezeTicks = tower.stats.freezeOnHitTicks || 60;
              if (tower.stats.executeChance && target && target.hp <= target.maxHp * (tower.stats.executeHp || 0.4) && Math.random() < tower.stats.executeChance && target.type !== "tank") target.hp = 0;
              towerShoot(tower,target||{x:tower.x,y:tower.y},buffs);
              if (tower.stats.doubleEvery && tower.shotCount % tower.stats.doubleEvery === 0 && target) towerShoot(tower,target,buffs);
            }
          }

          function updateProjectiles() {
            for (let i=state.projectiles.length-1;i>=0;i--) {
              const p=state.projectiles[i];
              if (p.mode==="bolt"||p.mode==="beam") { p.ttl--; if(p.ttl<=0) state.projectiles.splice(i,1); continue; }
              if (!state.enemies.includes(p.target)) { state.projectiles.splice(i,1); continue; }
              const dx=p.target.x-p.x, dy=p.target.y-p.y, len=Math.hypot(dx,dy);
              if (len < p.speed + 2) {
                const deal = (enemy) => {
                  const dealt=applyDamage(enemy,p.damage,p.options||{});
                  if (dealt>0 && p.options.burn) { enemy.burnTicks=Math.max(enemy.burnTicks,p.options.burnDuration); enemy.burnDps=Math.max(enemy.burnDps,p.options.burnDps); enemy.burnExplode=Math.max(enemy.burnExplode||0,p.options.burnExplode||0); }
                  if (p.options.lifesteal) { for (const t of state.towers) if (distance(t, enemy) <= 120) t.stunTicks = Math.max(0, t.stunTicks - dealt * p.options.lifesteal); }
                  if (p.options.supportVuln && p.options.spreadVuln) { for (const near of state.enemies) { if (near !== enemy && distance(near, enemy) <= 48) { near.vulnMult = Math.max(near.vulnMult, p.options.supportVuln); break; } } }
                };
                deal(p.target);
                let pierced=0;
                if (p.pierceTargets > 0) {
                  for (const e of state.enemies) {
                    if (e===p.target) continue;
                    if (distance(e,p.target) <= 50) {
                      if (p.perPierceProjectileBonus) p.damage *= 1 + p.perPierceProjectileBonus;
                      deal(e); pierced++; if (pierced >= p.pierceTargets) break;
                    }
                  }
                }
                if (p.splashRadius>0) {
                  for (const e of state.enemies) if (e!==p.target && distance(e,p.target)<=p.splashRadius) { deal(e); if (p.options.splashAppliesAcid) { e.acidTicks = Math.max(e.acidTicks, 240); e.acidDps = Math.max(e.acidDps, p.options.acidDotDps || 4); } }
                }
                if (p.doubleShockwave) explodeAt(p.target.x, p.target.y, 70, p.damage * 0.75, false);
                if (p.clusterCount>0) {
                  for (let c=0;c<p.clusterCount;c++) {
                    const ang=(Math.PI*2*c)/p.clusterCount;
                    explodeAt(p.target.x + Math.cos(ang)*18, p.target.y + Math.sin(ang)*18, 40, p.damage*0.45, !!p.options.igniteOnExplode);
                  }
                }
                if (p.options.chainStun) { for (const e of state.enemies) if (distance(e,p.target)<=60) e.stunTicks=Math.max(e.stunTicks, Math.round((p.options.hitStun||0)*0.7)); }
                state.projectiles.splice(i,1);
              } else {
                p.x += (dx/len)*p.speed; p.y += (dy/len)*p.speed;
              }
            }
          }

          function polygon(x,y,r,sides,color,rot=0){ ctx.fillStyle=color; ctx.beginPath(); for(let i=0;i<sides;i++){ const a=rot+(i*Math.PI*2)/sides; const px=x+Math.cos(a)*r, py=y+Math.sin(a)*r; if(i===0)ctx.moveTo(px,py); else ctx.lineTo(px,py);} ctx.closePath(); ctx.fill(); }

          function drawEnemy(enemy){ const s=ENEMY_TYPES[enemy.type]||ENEMY_TYPES.normal; if(s.shape==="circle"){ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(enemy.x,enemy.y,12,0,Math.PI*2);ctx.fill();} else if(s.shape==="triangle"||s.shape==="smallTriangle"){polygon(enemy.x,enemy.y,s.shape==="smallTriangle"?8:12,3,s.color,-Math.PI/2);} else if(s.shape==="square"){ctx.fillStyle=s.color;ctx.fillRect(enemy.x-11,enemy.y-11,22,22);} else if(s.shape==="hex"){polygon(enemy.x,enemy.y,12,6,s.color,Math.PI/6);} else if(s.shape==="oct"){polygon(enemy.x,enemy.y,13,8,s.color,Math.PI/8);} else if(s.shape==="split"){ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(enemy.x,enemy.y,12,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#0a3318";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(enemy.x-5,enemy.y-7);ctx.lineTo(enemy.x+2,enemy.y-1);ctx.lineTo(enemy.x-1,enemy.y+6);ctx.stroke();}
            ctx.fillStyle="#111";ctx.fillRect(enemy.x-14,enemy.y-20,28,4);ctx.fillStyle="#57cc99";ctx.fillRect(enemy.x-14,enemy.y-20,28*(Math.max(enemy.hp,0)/enemy.maxHp),4);
          }

          function drawTower(t){ const {x,y}=t; const m=t.stats; ctx.strokeStyle=t.stunTicks>0?"rgba(255,200,0,0.7)":(state.selectedPlacedTowerId===t.id?"rgba(170,240,255,0.85)":"rgba(144,224,239,0.2)"); ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,t.rangePx,0,Math.PI*2); ctx.stroke();
            ctx.fillStyle=m.color;
            if(m.shape==="circle"){ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.fill();}
            else if(m.shape==="gatling"){ctx.fillRect(x-14,y-8,22,16);ctx.beginPath();ctx.arc(x+11,y,6,0,Math.PI*2);ctx.fill();}
            else if(m.shape==="sniper"){ctx.fillRect(x-16,y-4,32,8);}
            else if(m.shape==="diamond"){polygon(x,y,13,4,m.color,Math.PI/2);}
            else if(m.shape==="tesla"){ctx.fillStyle="#80858f";ctx.fillRect(x-14,y-10,28,20);ctx.fillStyle=m.color;ctx.beginPath();ctx.moveTo(x-3,y-8);ctx.lineTo(x+3,y-2);ctx.lineTo(x-1,y-2);ctx.lineTo(x+2,y+8);ctx.lineTo(x-5,y+1);ctx.lineTo(x-1,y+1);ctx.closePath();ctx.fill();}
            else if(m.shape==="ellipse"){ctx.beginPath();ctx.ellipse(x,y,16,10,0,0,Math.PI*2);ctx.fill();}
            else if(m.shape==="trap"){ctx.beginPath();ctx.moveTo(x-14,y+10);ctx.lineTo(x+14,y+10);ctx.lineTo(x+9,y-10);ctx.lineTo(x-9,y-10);ctx.closePath();ctx.fill();}
            else if(m.shape==="commander"){ctx.fillStyle="#fff";ctx.fillRect(x-12,y-12,24,24);ctx.fillStyle="#18a558";ctx.fillRect(x-2,y-8,4,16);ctx.fillRect(x-8,y-2,16,4);}
            else if(m.shape==="railgun"){ctx.fillStyle="#a9b2bf";ctx.fillRect(x-18,y-4,34,8);ctx.fillStyle="#e0fbfc";ctx.beginPath();ctx.arc(x+17,y,4,0,Math.PI*2);ctx.fill();}
            else if(m.shape==="factory"){ctx.fillStyle="#40444f";ctx.fillRect(x-14,y-14,28,28);ctx.fillStyle="#00d4ff";ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(x+3,y-3);ctx.lineTo(x+9,y-3);ctx.lineTo(x+4,y+1);ctx.lineTo(x+6,y+8);ctx.lineTo(x,y+4);ctx.lineTo(x-6,y+8);ctx.lineTo(x-4,y+1);ctx.lineTo(x-9,y-3);ctx.lineTo(x-3,y-3);ctx.closePath();ctx.fill();}
            else if(m.shape==="bomb"){ctx.fillStyle="#9aa0a6";ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.fill();ctx.fillStyle="#111";ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();}
          }

          function drawAlliedTurrets(){ for(const u of state.alliedTurrets){ ctx.fillStyle="#313a46";ctx.fillRect(u.x-8,u.y-8,16,16);ctx.fillStyle="#89fcff";ctx.beginPath();ctx.arc(u.x,u.y,4,0,Math.PI*2);ctx.fill(); ctx.fillStyle="#111";ctx.fillRect(u.x-10,u.y-14,20,3);ctx.fillStyle="#57cc99";ctx.fillRect(u.x-10,u.y-14,20*Math.max(0,u.hp)/(u.unitHp||5),3);} }
          function drawPath(){ ctx.strokeStyle="#f4a261";ctx.lineWidth=34;ctx.lineJoin="round";ctx.lineCap="round";ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);for(let i=1;i<path.length;i++)ctx.lineTo(path[i].x,path[i].y);ctx.stroke(); }
          function drawProjectiles(){ for(const p of state.projectiles){ if(p.mode==="bolt"){ctx.strokeStyle="#f7f45f";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);if(p.target)ctx.lineTo(p.target.x,p.target.y);ctx.stroke();} else if(p.mode==="beam"){ctx.strokeStyle=p.color||"#d9d9d9";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(p.x,p.y);if(p.target)ctx.lineTo(p.target.x,p.target.y);ctx.stroke();} else {ctx.fillStyle=p.color||"#fff";ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fill();} } }
          function drawGameOver(){ if(state.lives>0)return; ctx.fillStyle="rgba(0,0,0,0.72)";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="bold 52px system-ui";ctx.fillText("Game Over",canvas.width/2,canvas.height/2-20);ctx.font="24px system-ui";ctx.fillText("Refresh to try again",canvas.width/2,canvas.height/2+24); }

          function tick(){ ctx.clearRect(0,0,canvas.width,canvas.height); spawnEnemyTick(); updateEnemies(); updateAlliedTurrets(); updateTowers(); updateProjectiles(); updateHud(); drawPath(); for(const t of state.towers) drawTower(t); drawAlliedTurrets(); for(const e of state.enemies) drawEnemy(e); drawProjectiles(); drawGameOver(); requestAnimationFrame(tick); }

          function canPlaceTower(x,y){ const onPath=path.some((pt,i)=>{ if(i===0)return false; const a=path[i-1],b=pt; return x>=Math.min(a.x,b.x)-26&&x<=Math.max(a.x,b.x)+26&&y>=Math.min(a.y,b.y)-26&&y<=Math.max(a.y,b.y)+26;}); if(onPath)return false; if(state.towers.some((t)=>distance(t,{x,y})<34)) return false; return true; }

          canvas.addEventListener("click", (event) => {
            if (state.lives <= 0) return;
            const rect = canvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) * (canvas.width / rect.width);
            const y = (event.clientY - rect.top) * (canvas.height / rect.height);

            const hitTower = state.towers.find((t) => distance(t, {x, y}) <= 18);
            if (hitTower) {
              state.selectedPlacedTowerId = hitTower.id;
              renderUpgradePanel();
              return;
            }

            const model=TOWERS.find((t)=>t.id===state.selectedTower);
            if(!model || state.gold<model.cost) return;
            if(!canPlaceTower(x,y)) return;

            state.gold -= model.cost;
            state.towers.push({ id:crypto.randomUUID(), baseId:model.id, baseName:model.name, x, y, stats:copyStats(model), rangePx:model.range*RANGE_UNIT, cooldown:0, stunTicks:0, upgradePath:null, upgradeTier:0, shotCount:0 });
            updateHud(); buildTowerMenu(); renderUpgradePanel();
          });

          startWaveButton.addEventListener("click", startWave);
          buildTowerMenu(); renderUpgradePanel(); updateHud(); requestAnimationFrame(tick);
        </script>
      </body>
    </html>
`;
}
