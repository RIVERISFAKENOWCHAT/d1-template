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
              <div class="small" id="towerStats">-</div>
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
          const towerStatsEl = document.getElementById("towerStats");

          const RANGE_UNIT = 22;
          const SPEED_SCALE = 0.08;
          const NON_PROJECTILE_TOWERS = new Set(["mine","gravity","poison","emp","void","cryomines","fence","oil","static","snare","spore","firetotem","shocknet","nanoswarm","timespire","arctrap","spikewall","plaguetower","heatsink","magnet","stormpillar","decaytotem"]);
          const BEAM_TOWERS = new Set(["laser","beamsplit","thermalray","cryobeam"]);
          const NERF_IDS = new Set(["railgun","bomb","laser","beamsplit","scatterlaser","ion","voidemperorkiller"]);
          const BUFF_IDS = new Set(["wind","snare","spore","firetotem","decaytotem","shockwavetotem","overwatch","heatsink","pulse"]);
          const NERF_DMG_MULT = 0.88;
          const NERF_RANGE_MULT = 0.93;
          const BUFF_DMG_MULT = 1.12;
          const BUFF_RANGE_BONUS = 0.4;

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

          Object.assign(ENEMY_TYPES, {
            juggernaut:{label:"Juggernaut",hp:120,speed:2,defense:20,reward:120,color:"#7f1d1d",shape:"oct",baseDamage:5,budget:10,knockbackImmune:true},
            bulwark:{label:"Bulwark",hp:150,speed:3,defense:30,reward:150,color:"#7c8894",shape:"square",baseDamage:5,budget:11,shieldHalf:true},
            titan:{label:"Titan",hp:300,speed:1,defense:25,reward:250,color:"#111",shape:"hex",baseDamage:8,budget:18,aoeResist:0.5},
            warden:{label:"Warden",hp:180,speed:4,defense:15,reward:160,color:"#d4af37",shape:"pent",baseDamage:5,budget:12,redirectNearby:0.3},
            phalanx:{label:"Phalanx",hp:80,speed:4,defense:20,reward:30,color:"#c0c0c0",shape:"triangle",baseDamage:2,budget:2,groupReduce:true},
            colossus:{label:"Colossus",hp:400,speed:2,defense:25,reward:350,color:"#0b2d5e",shape:"oct",baseDamage:10,budget:22,stunImmune:true},
            ironback:{label:"Ironback",hp:220,speed:3,defense:30,reward:180,color:"#8d99ae",shape:"circle",baseDamage:6,budget:14,reflect:0.2},
            siegebeast:{label:"Siege Beast",hp:260,speed:3,defense:10,reward:200,color:"#8b0000",shape:"square",baseDamage:12,budget:15},
            behemoth:{label:"Behemoth",hp:500,speed:1,defense:35,reward:500,color:"#111",shape:"pent",baseDamage:12,budget:28,minSpeedMult:0.5},
            fortifier:{label:"Fortifier",hp:140,speed:5,defense:10,reward:140,color:"#3a86ff",shape:"square",baseDamage:4,budget:11,defAura:5},
            chronotitan:{label:"Chrono Titan",hp:200,speed:4,defense:10,reward:180,color:"#c9a227",shape:"oct",baseDamage:6,budget:13,speedAura:0.25},
            nullwalker:{label:"Null Walker",hp:120,speed:6,defense:0,reward:140,color:"#f8f9fa",shape:"square",baseDamage:4,budget:10,debuffImmune:true,dotImmune:true},
            phasejuggernaut:{label:"Phase Juggernaut",hp:160,speed:6,defense:15,reward:170,color:"#b22222",shape:"hex",baseDamage:6,budget:13,phaseCycle:240,phaseDuration:60},
            disruptor:{label:"Disruptor Core",hp:100,speed:5,defense:5,reward:130,color:"#7b2cbf",shape:"square",baseDamage:4,budget:9,disableTowerOnHit:60},
            emptitan:{label:"EMP Titan",hp:180,speed:4,defense:15,reward:170,color:"#ffd60a",shape:"square",baseDamage:6,budget:13,empAura:true},
            overlorddrone:{label:"Overlord Drone",hp:90,speed:12,defense:0,reward:120,color:"#111",shape:"diamond",baseDamage:3,budget:9,spawnOnDeath:["fast","fast"]},
            warengine:{label:"War Engine",hp:350,speed:2,defense:20,reward:300,color:"#4a4e69",shape:"square",baseDamage:14,budget:21},
            voidbrute:{label:"Void Brute",hp:220,speed:3,defense:15,reward:190,color:"#5a189a",shape:"square",baseDamage:6,budget:14,beamResist:0.35},
            plaguehulk:{label:"Plague Hulk",hp:180,speed:3,defense:5,reward:160,color:"#2d6a4f",shape:"circle",baseDamage:6,budget:12,poisonAura:true},
            mirrorknight:{label:"Mirror Knight",hp:140,speed:4,defense:10,reward:150,color:"#adb5bd",shape:"diamond",baseDamage:5,budget:11,mirrorCd:180},
            leviathan:{label:"Leviathan Spawn",hp:450,speed:2,defense:20,reward:400,color:"#0a9396",shape:"oct",baseDamage:12,budget:24,spawnPeriodic:"swarm"},
            bloodreaver:{label:"Blood Reaver",hp:120,speed:10,defense:5,reward:140,color:"#9d0208",shape:"triangle",baseDamage:6,budget:10,regenOnBase:0.2},
            sentinelprime:{label:"Sentinel Prime",hp:300,speed:3,defense:25,reward:350,color:"#ffbf00",shape:"square",baseDamage:9,budget:20,buffsAll:true},
            oblivionguard:{label:"Oblivion Guard",hp:260,speed:4,defense:20,reward:240,color:"#111",shape:"pent",baseDamage:8,budget:17,dotImmune:true},
            grimcarrier:{label:"Grim Carrier",hp:150,speed:5,defense:10,reward:170,color:"#1b4332",shape:"square",baseDamage:6,budget:12,spawnOnDeath:["swarm","swarm","swarm","swarm"]},
            dreadhowler:{label:"Dread Howler",hp:100,speed:12,defense:0,reward:120,color:"#111",shape:"triangle",baseDamage:5,budget:10,globalSpeedAura:0.2},
            voidshield:{label:"Void Shieldbearer",hp:180,speed:4,defense:25,reward:190,color:"#6a4c93",shape:"square",baseDamage:6,budget:14,shieldAura:true},
            flametyrant:{label:"Flame Tyrant",hp:220,speed:4,defense:10,reward:200,color:"#e85d04",shape:"circle",baseDamage:7,budget:14,burnImmune:true,fireTrail:true},
            cryocolossus:{label:"Cryo Colossus",hp:240,speed:3,defense:20,reward:210,color:"#90e0ef",shape:"hex",baseDamage:7,budget:15,stunImmune:true},
            blackwall:{label:"Blackwall Sentinel",hp:500,speed:1,defense:40,reward:500,color:"#222",shape:"monolith",baseDamage:12,budget:30,noPierce:true},
            voidemperor:{label:"Void Emperor",hp:800,speed:2,defense:35,reward:800,color:"#6d28d9",shape:"oct",baseDamage:18,budget:45,boss:true},
            endbringer:{label:"Endbringer",hp:1000,speed:1,defense:50,reward:1200,color:"#000",shape:"sun",baseDamage:25,budget:60,boss:true,spawnOnly:true},
          });


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
            { id:"laser", name:"Laser Pointer", cost:90, damage:2, atkSpeed:0.2, range:12, color:"#ff3b30", shape:"laser", rampOnTarget:true },
            { id:"pulse", name:"Pulse Cannon", cost:120, damage:4, atkSpeed:2, range:8, color:"#ffffff", shape:"pulse", pulseEvery:5, pulseAllInRange:true },
            { id:"mine", name:"Mine Layer", cost:90, damage:8, atkSpeed:1, range:3, color:"#8b5a2b", shape:"mine", placeMine:true, mineDamage:8, mineRadius:32 },
            { id:"gravity", name:"Gravity Well", cost:180, damage:1, atkSpeed:3, range:6, color:"#8a2be2", shape:"gravity", pullStrength:0.35, hitSlow:0.35 },
            { id:"wind", name:"Wind Turbine", cost:100, damage:0, atkSpeed:3, range:5, color:"#c9ced6", shape:"wind", knockback:10 },
            { id:"poison", name:"Poison Tower", cost:120, damage:0, atkSpeed:2, range:5, color:"#39ff14", shape:"poison", acidDotDps:2, poisonDuration:360 },
            { id:"emp", name:"EMP Spire", cost:140, damage:0, atkSpeed:5, range:7, color:"#111111", shape:"emp", stripDefense:999, hitStun:20 },
            { id:"shard", name:"Shard Launcher", cost:90, damage:3, atkSpeed:1.5, range:9, color:"#4deeea", shape:"shard", pierceTargets:2 },
            { id:"void", name:"Void Siphon", cost:160, damage:2, atkSpeed:1.5, range:7, color:"#2a003f", shape:"void", supportVuln:0.2, lifesteal:0.06 },
            { id:"echo", name:"Echo Turret", cost:110, damage:2, atkSpeed:1.2, range:6, color:"#7d8597", shape:"echo", echoNearby:true, echoPower:0.5 },
            { id:"arcmortar", name:"Arc Mortar", cost:210, damage:10, atkSpeed:5, range:16, color:"#495057", shape:"arcmortar", splashRadius:82 },
            { id:"cryomines", name:"Cryo Mines", cost:80, damage:0, atkSpeed:1, range:3, color:"#7bdff2", shape:"cryomines", placeMine:true, mineDamage:0, mineRadius:34, mineFreeze:40 },
            { id:"needle", name:"Needle Gun", cost:70, damage:2, atkSpeed:0.4, range:7, color:"#101010", shape:"needle", pierceTargets:1 },
            { id:"fence", name:"Tesla Fence", cost:100, damage:1, atkSpeed:2, range:4, color:"#ffd60a", shape:"fence", hitSlow:0.2 },
            { id:"oil", name:"Oil Sprayer", cost:90, damage:0, atkSpeed:1, range:5, color:"#111111", shape:"oil", fireVuln:1.0 },
            { id:"burst", name:"Burst Turret", cost:100, damage:3, atkSpeed:0.5, range:6, color:"#5e503f", shape:"burst", burstCount:3 },
            { id:"plasma", name:"Plasma Thrower", cost:160, damage:4, atkSpeed:0.15, range:6, color:"#ff66c4", shape:"plasma", shred:3 },
            { id:"static", name:"Static Totem", cost:110, damage:0, atkSpeed:2, range:6, color:"#f5cb5c", shape:"static", hitSlow:0.3 },
            { id:"snare", name:"Snare Trap", cost:60, damage:0, atkSpeed:1, range:3, color:"#6c757d", shape:"snare", hitStun:35 },
            { id:"beamsplit", name:"Beam Splitter", cost:140, damage:2, atkSpeed:0.1, range:10, color:"#ff0000", shape:"beamsplit", splitBeams:2 },
            { id:"flak", name:"Flak Cannon", cost:130, damage:6, atkSpeed:3, range:8, color:"#111", shape:"flak", fastBonus:1.0 },
            { id:"spore", name:"Spore Pod", cost:90, damage:0, atkSpeed:1, range:5, color:"#3a5a40", shape:"spore", acidDotDps:2 },
            { id:"kinetic", name:"Kinetic Ram", cost:120, damage:5, atkSpeed:2, range:3, color:"#6c757d", shape:"kinetic", knockback:14 },
            { id:"volt", name:"Volt Rifle", cost:100, damage:3, atkSpeed:1, range:9, color:"#4361ee", shape:"volt", chain:true, chainCount:2 },
            { id:"obsidian", name:"Obsidian Spike", cost:130, damage:6, atkSpeed:1, range:7, color:"#111", shape:"obsidian", antiArmorBonus:0.5 },
            { id:"firetotem", name:"Fire Totem", cost:110, damage:0, atkSpeed:1, range:6, color:"#d90429", shape:"firetotem", burn:true, burnDuration:300, burnDps:3 },
            { id:"shocknet", name:"Shock Net", cost:100, damage:1, atkSpeed:2, range:5, color:"#ffd60a", shape:"shocknet", hitStun:24 },
            { id:"nanoswarm", name:"Nano Swarm", cost:140, damage:1, atkSpeed:0.2, range:6, color:"#adb5bd", shape:"nanoswarm", acidDotDps:1 },
            { id:"timespire", name:"Time Spire", cost:160, damage:0, atkSpeed:2, range:6, color:"#e9c46a", shape:"timespire", hitSlow:0.35 },
            { id:"shardmortar", name:"Shard Mortar", cost:200, damage:8, atkSpeed:4, range:14, color:"#4cc9f0", shape:"shardmortar", splashRadius:80, clusterCount:2 },
            { id:"thermalray", name:"Thermal Ray", cost:170, damage:2, atkSpeed:0.08, range:9, color:"#f77f00", shape:"thermalray", burn:true, burnDuration:360, burnDps:4, rampOnTarget:true },
            { id:"frostnet", name:"Frost Net", cost:80, damage:0, atkSpeed:1, range:4, color:"#90e0ef", shape:"frostnet", hitStun:28, hitSlow:0.35 },
            { id:"arctrap", name:"Arc Trap", cost:90, damage:4, atkSpeed:1, range:3, color:"#ffdd00", shape:"arctrap", hitStun:20 },
            { id:"spikewall", name:"Spike Wall", cost:100, damage:3, atkSpeed:1, range:2, color:"#495057", shape:"spikewall" },
            { id:"gravcannon", name:"Grav Cannon", cost:160, damage:5, atkSpeed:1, range:7, color:"#7b2cbf", shape:"gravcannon", pullStrength:0.5 },
            { id:"plaguetower", name:"Plague Tower", cost:140, damage:0, atkSpeed:1, range:6, color:"#2d6a4f", shape:"plaguetower", acidDotDps:3, acidSpreadOnDeath:true },
            { id:"chainblaster", name:"Chain Blaster", cost:140, damage:4, atkSpeed:1, range:8, color:"#4895ef", shape:"chainblaster", splitBeams:1 },
            { id:"cryobeam", name:"Cryo Beam", cost:130, damage:1, atkSpeed:0.1, range:8, color:"#a8dadc", shape:"cryobeam", permaSlowInRange:0.35 },
            { id:"pulsemine", name:"Pulse Mine", cost:100, damage:6, atkSpeed:1, range:3, color:"#e0fbfc", shape:"pulsemine", placeMine:true, mineDamage:6, mineRadius:45, mineFreeze:35 },
            { id:"heatsink", name:"Heat Sink", cost:90, damage:0, atkSpeed:0, range:6, color:"#212529", shape:"heatsink", fireAura:0.3 },
            { id:"magnet", name:"Magnet Tower", cost:120, damage:0, atkSpeed:1, range:6, color:"#d00000", shape:"magnet", pullStrength:0.45, antiArmorBonus:0.4 },
            { id:"bleed", name:"Bleed Turret", cost:110, damage:2, atkSpeed:1, range:6, color:"#9d0208", shape:"bleed", acidDotDps:2 },
            { id:"ion", name:"Ion Cannon", cost:260, damage:10, atkSpeed:4, range:14, color:"#fff", shape:"ion", ignoreDefense:true },
            { id:"frostflare", name:"Frost Flare", cost:140, damage:3, atkSpeed:2, range:7, color:"#4cc9f0", shape:"frostflare", hitStun:24 },
            { id:"moltenmortar", name:"Molten Mortar", cost:220, damage:9, atkSpeed:5, range:15, color:"#e85d04", shape:"moltenmortar", splashRadius:90, burn:true, burnDuration:240, burnDps:4 },
            { id:"shrapnel", name:"Shrapnel Gun", cost:120, damage:4, atkSpeed:1, range:7, color:"#6c757d", shape:"shrapnel", clusterCount:3 },
            { id:"stormpillar", name:"Storm Pillar", cost:150, damage:0, atkSpeed:1, range:7, color:"#457b9d", shape:"stormpillar", hitStun:18 },
            { id:"decaytotem", name:"Decay Totem", cost:140, damage:0, atkSpeed:1, range:6, color:"#6a040f", shape:"decaytotem", stripDefense:4 },
            { id:"overwatch", name:"Overwatch Drone", cost:130, damage:2, atkSpeed:0.5, range:10, color:"#adb5bd", shape:"overwatch" },
            { id:"shardfan", name:"Shard Fan", cost:100, damage:3, atkSpeed:1, range:5, color:"#48cae4", shape:"shardfan", splitBeams:2 },
            { id:"pulsebarrage", name:"Pulse Barrage", cost:120, damage:3, atkSpeed:1, range:7, color:"#f1faee", shape:"pulsebarrage", burstCount:3 },
            { id:"cryoturbine", name:"Cryo Turbine", cost:130, damage:1, atkSpeed:1.5, range:6, color:"#a8dadc", shape:"cryoturbine", hitSlow:0.25 },
            { id:"arcshotgun", name:"Arc Shotgun", cost:140, damage:5, atkSpeed:0.6, range:5, color:"#4361ee", shape:"arcshotgun", splitBeams:2 },
            { id:"corrosion", name:"Corrosion Spitter", cost:150, damage:4, atkSpeed:1, range:7, color:"#80ed99", shape:"corrosion", shred:3 },
            { id:"shockwavetotem", name:"Shockwave Totem", cost:120, damage:0, atkSpeed:1, range:6, color:"#6c757d", shape:"shockwavetotem", hitSlow:0.2 },
            { id:"embertrap", name:"Ember Trap", cost:90, damage:2, atkSpeed:1, range:3, color:"#ff5400", shape:"embertrap", placeMine:true, mineDamage:2, mineRadius:30, burn:true, burnDuration:240, burnDps:3 },
            { id:"sentry", name:"Sentry Drone", cost:130, damage:2, atkSpeed:0.5, range:9, color:"#8d99ae", shape:"sentry" },
            { id:"rift", name:"Rift Beacon", cost:160, damage:0, atkSpeed:1, range:7, color:"#7209b7", shape:"rift", pullStrength:0.4, supportVuln:0.1 },
            { id:"scatterlaser", name:"Scatter Laser", cost:150, damage:2, atkSpeed:0.12, range:10, color:"#ef233c", shape:"scatterlaser", splitBeams:3 },
            { id:"bastion", name:"Bastion Turret", cost:200, damage:8, atkSpeed:2, range:8, color:"#495057", shape:"bastion", defenseAura:0.3 },
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
            laser: {
              A:[{cost:140,set:{damage:3,atkSpeed:0.2,range:12,rampOnTarget:true}},{cost:260,set:{damage:5,atkSpeed:0.2,range:13,rampOnTarget:true}},{cost:520,set:{damage:8,atkSpeed:0.2,range:14,rampOnTarget:true}},{cost:980,set:{damage:14,atkSpeed:0.2,range:15,rampOnTarget:true}}],
              B:[{cost:130,set:{damage:2,atkSpeed:0.25,range:12,splitBeams:2}},{cost:250,set:{damage:2,atkSpeed:0.25,range:13,splitBeams:3}},{cost:500,set:{damage:3,atkSpeed:0.25,range:14,splitBeams:4}},{cost:900,set:{damage:4,atkSpeed:0.25,range:15,splitBeams:6}}],
              C:[{cost:140,set:{damage:3,atkSpeed:0.2,range:12,ignoreArmorPct:0.25}},{cost:260,set:{damage:4,atkSpeed:0.2,range:13,ignoreArmorPct:0.5}},{cost:520,set:{damage:6,atkSpeed:0.2,range:14,ignoreArmorPct:0.75}},{cost:980,set:{damage:8,atkSpeed:0.2,range:15,ignoreDefense:true}}],
            },
            pulse: {
              A:[{cost:180,set:{damage:5,atkSpeed:2,range:8,pulseEvery:5,pulseAllInRange:true}},{cost:320,set:{damage:7,atkSpeed:2,range:9,pulseEvery:5,pulseAllInRange:true}},{cost:620,set:{damage:10,atkSpeed:2,range:10,pulseEvery:5,pulseAllInRange:true}},{cost:1100,set:{damage:15,atkSpeed:2,range:11,pulseEvery:3,pulseAllInRange:true}}],
              B:[{cost:180,set:{damage:4,atkSpeed:1.5,range:8,doubleEvery:2}},{cost:320,set:{damage:4,atkSpeed:1.2,range:9,doubleEvery:2}},{cost:620,set:{damage:5,atkSpeed:1,range:10,doubleEvery:2}},{cost:1100,set:{damage:6,atkSpeed:0.8,range:11,doubleEvery:2,burstCount:2}}],
              C:[{cost:180,set:{damage:4,atkSpeed:2,range:8,hitSlow:0.2}},{cost:320,set:{damage:5,atkSpeed:2,range:9,hitSlow:0.35}},{cost:620,set:{damage:6,atkSpeed:2,range:10,hitSlow:0.5}},{cost:1100,set:{damage:7,atkSpeed:2,range:11,hitSlow:0.5,weakenDamage:0.25}}],
            },
            mine: {
              A:[{cost:140,set:{mineDamage:12}},{cost:280,set:{mineDamage:18}},{cost:560,set:{mineDamage:25}},{cost:980,set:{mineDamage:40,mineRadius:55}}],
              B:[{cost:140,set:{mineCount:2}},{cost:280,set:{mineCount:3}},{cost:560,set:{mineCount:4}},{cost:980,set:{mineCount:6}}],
              C:[{cost:140,set:{mineSlow:0.25}},{cost:280,set:{mineRoot:25}},{cost:560,set:{mineFreeze:30}},{cost:980,set:{mineFreeze:40,mineVuln:0.5}}],
            },
            gravity: {
              A:[{cost:260,set:{pullStrength:0.45}},{cost:420,set:{pullStrength:0.7}},{cost:760,set:{pullStrength:1}},{cost:1300,set:{pullStrength:1.6}}],
              B:[{cost:260,set:{damage:2}},{cost:420,set:{damage:4}},{cost:760,set:{damage:7}},{cost:1300,set:{damage:12,rampOnTarget:true}}],
              C:[{cost:260,set:{hitSlow:0.4}},{cost:420,set:{hitSlow:0.6}},{cost:760,set:{hitSlow:0.8}},{cost:1300,set:{hitSlow:0.85,hitStun:20}}],
            },
            wind: {
              A:[{cost:180,set:{knockback:16}},{cost:320,set:{knockback:22}},{cost:620,set:{knockback:30}},{cost:1000,set:{knockback:42}}],
              B:[{cost:180,set:{damage:1}},{cost:320,set:{damage:2}},{cost:620,set:{damage:4}},{cost:1000,set:{damage:7,acidDotDps:2}}],
              C:[{cost:180,set:{hitSlow:0.2}},{cost:320,set:{hitSlow:0.4}},{cost:620,set:{hitSlow:0.6}},{cost:1000,set:{hitSlow:0.6,supportVuln:0.25}}],
            },
            poison: {
              A:[{cost:190,set:{acidDotDps:2,poisonDuration:360}},{cost:330,set:{acidDotDps:4,poisonDuration:360}},{cost:640,set:{acidDotDps:7,poisonDuration:360}},{cost:1200,set:{acidDotDps:12,poisonDuration:420,acidSpreadOnDeath:true}}],
              B:[{cost:190,set:{supportVuln:0.1}},{cost:330,set:{supportVuln:0.2}},{cost:640,set:{supportVuln:0.35}},{cost:1200,set:{supportVuln:0.5,shred:6}}],
              C:[{cost:190,set:{spreadVuln:1}},{cost:330,set:{spreadVuln:2}},{cost:640,set:{spreadVuln:4}},{cost:1200,set:{spreadVuln:999}}],
            },
            emp: {
              A:[{cost:220,set:{empDisable:60}},{cost:380,set:{empDisable:120}},{cost:700,set:{empDisable:180}},{cost:1200,set:{empDisable:9999}}],
              B:[{cost:220,set:{hitStun:18}},{cost:380,set:{hitStun:36}},{cost:700,set:{hitStun:60}},{cost:1200,set:{hitStun:60,chainStun:true}}],
              C:[{cost:220,set:{damage:1}},{cost:380,set:{damage:2}},{cost:700,set:{damage:4}},{cost:1200,set:{damage:4,supportVuln:1}}],
            },
            shard: {
              A:[{cost:150,set:{pierceTargets:2}},{cost:300,set:{pierceTargets:3}},{cost:620,set:{pierceTargets:5}},{cost:1100,set:{pierceTargets:8}}],
              B:[{cost:150,set:{pierceTargets:1}},{cost:300,set:{pierceTargets:3}},{cost:620,set:{pierceTargets:5}},{cost:1100,set:{pierceTargets:999}}],
              C:[{cost:150,set:{acidDotDps:2}},{cost:300,set:{acidDotDps:3}},{cost:620,set:{acidDotDps:4,acidSpreadOnDeath:true}},{cost:1100,set:{acidDotDps:5,acidSpreadOnDeath:true,burnExplode:8}}],
            },
            void: {
              A:[{cost:240,set:{supportVuln:0.15}},{cost:400,set:{supportVuln:0.3}},{cost:760,set:{supportVuln:0.5}},{cost:1300,set:{supportVuln:0.75}}],
              B:[{cost:240,set:{lifesteal:0.04}},{cost:400,set:{lifesteal:0.08}},{cost:760,set:{lifesteal:0.12}},{cost:1300,set:{lifesteal:0.2}}],
              C:[{cost:240,set:{hitSlow:0.2}},{cost:400,set:{hitSlow:0.4}},{cost:760,set:{hitSlow:0.5,hitStun:20}},{cost:1300,set:{hitSlow:0.6,burnExplode:10}}],
            },
            echo: {
              A:[{cost:180,set:{echoPower:0.7}},{cost:340,set:{echoPower:1}},{cost:700,set:{echoPower:1.3}},{cost:1300,set:{echoPower:2}}],
              B:[{cost:180,set:{echoCount:2}},{cost:340,set:{echoCount:3}},{cost:700,set:{echoCount:4}},{cost:1300,set:{echoCount:999}}],
              C:[{cost:180,set:{echoStrongest:true}},{cost:340,set:{echoStrongestEnemy:true}},{cost:700,set:{echoSpecials:true}},{cost:1300,set:{echoSpecials:true,echoUltimate:true}}],
            },
          };

          const GOLD_MULTIPLIER = 1.85;

          function ensureTowerUpgrades() {
            for (const tower of TOWERS) {
              if (UPGRADES[tower.id]) continue;
              const dmg=tower.damage||0;
              const sp=tower.atkSpeed||1;
              const rg=tower.range||5;
              UPGRADES[tower.id] = {
                A:[{cost:Math.round(tower.cost*1.4),set:{damage:+(dmg*1.4+1).toFixed(2),atkSpeed:sp,range:rg}},{cost:Math.round(tower.cost*2.4),set:{damage:+(dmg*2+2).toFixed(2),atkSpeed:sp,range:rg+1}},{cost:Math.round(tower.cost*4.2),set:{damage:+(dmg*3+3).toFixed(2),atkSpeed:sp,range:rg+2}},{cost:Math.round(tower.cost*7),set:{damage:+(dmg*4.2+5).toFixed(2),atkSpeed:sp,range:rg+3}}],
                B:[{cost:Math.round(tower.cost*1.3),set:{damage:dmg,atkSpeed:+Math.max(0.05,sp*0.85).toFixed(2),range:rg}},{cost:Math.round(tower.cost*2.2),set:{damage:+(dmg+1).toFixed(2),atkSpeed:+Math.max(0.04,sp*0.7).toFixed(2),range:rg+1}},{cost:Math.round(tower.cost*3.8),set:{damage:+(dmg+2).toFixed(2),atkSpeed:+Math.max(0.03,sp*0.55).toFixed(2),range:rg+2}},{cost:Math.round(tower.cost*6.4),set:{damage:+(dmg+3).toFixed(2),atkSpeed:+Math.max(0.02,sp*0.45).toFixed(2),range:rg+3}}],
                C:[{cost:Math.round(tower.cost*1.5),set:{damage:dmg,atkSpeed:sp,range:rg+1,supportVuln:0.1}},{cost:Math.round(tower.cost*2.6),set:{damage:+(dmg+0.5).toFixed(2),atkSpeed:sp,range:rg+2,supportVuln:0.2}},{cost:Math.round(tower.cost*4.4),set:{damage:+(dmg+1).toFixed(2),atkSpeed:sp,range:rg+3,supportVuln:0.35}},{cost:Math.round(tower.cost*7.2),set:{damage:+(dmg+2).toFixed(2),atkSpeed:sp,range:rg+4,supportVuln:0.5}}],
              };
            }
          }

          ensureTowerUpgrades();

          const state = { lives:20, gold:220, wave:0, towers:[], enemies:[], projectiles:[], mines:[], alliedTurrets:[], spawning:false, queue:[], spawnCooldown:0, selectedTower:TOWERS[0].id, selectedPlacedTowerId:null };

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
            if (!tower) { upgradeInfoEl.textContent = "Select a placed tower to upgrade."; towerStatsEl.textContent = "-"; return; }
            const defs = UPGRADES[tower.baseId];
            if (!defs) { upgradeInfoEl.textContent = tower.baseName + ": no upgrade paths"; towerStatsEl.textContent = "-"; return; }
            const lockedPath = tower.upgradePath;
            upgradeInfoEl.textContent = tower.baseName + " | Path: " + (lockedPath || "none") + " | Tier: " + tower.upgradeTier;

            const s = tower.stats;
            const extras = [];
            if (s.pierceTargets) extras.push("Pierce: " + s.pierceTargets);
            if (s.chainCount) extras.push("Chain: " + s.chainCount);
            if (s.hitSlow) extras.push("Slow: " + Math.round(s.hitSlow * 100) + "%");
            if (s.supportVuln) extras.push("Vuln: +" + Math.round(s.supportVuln * 100) + "%");
            if (s.acidDotDps) extras.push("DoT: " + s.acidDotDps + "/s");
            if (s.burnDps) extras.push("Burn: " + s.burnDps + "/s");
            if (s.knockback) extras.push("Knockback: " + s.knockback);
            if (s.splitBeams) extras.push("Split Beams: " + s.splitBeams);
            if (s.burstCount) extras.push("Burst: " + s.burstCount);
            if (s.splashRadius) extras.push("Splash: " + Math.round(s.splashRadius));
            if (s.placeMine) extras.push("Mine Layer");
            towerStatsEl.innerHTML = "<strong>Placed Tower Stats</strong><br>DMG: " + (s.damage ?? 0) +
              "<br>ATK SPD: " + (s.atkSpeed ?? 0) + "s" +
              "<br>Range: " + (s.range ?? 0) +
              (extras.length ? "<br>" + extras.join(" | ") : "");

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
            if (wave>=7) unlocked.push("juggernaut","bulwark","phalanx");
            if (wave>=10) unlocked.push("warden","fortifier","chronotitan","nullwalker");
            if (wave>=12) unlocked.push("titan","ironback","phasejuggernaut","disruptor");
            if (wave>=14) unlocked.push("colossus","warengine","voidbrute","plaguehulk","mirrorknight");
            if (wave>=16) unlocked.push("leviathan","sentinelprime","oblivionguard","grimcarrier","dreadhowler");
            if (wave>=18) unlocked.push("voidshield","flametyrant","cryocolossus","blackwall");
            if (wave>=20) unlocked.push("voidemperor");
            const limits={ fast:Math.max(4,wave*2), stunner:Math.max(1,Math.floor(wave/2)), tank:Math.max(1,Math.floor(wave/3))}; const c={fast:0,stunner:0,tank:0};
            while (left>0.8) { const pool=unlocked.filter((t)=>ENEMY_TYPES[t].budget<=left+0.2 && (limits[t]===undefined || c[t]<limits[t])); if(!pool.length) break; const p=pool[Math.floor(Math.random()*pool.length)]; if(p==="swarm"){ const count=5+Math.floor(Math.random()*6); for(let i=0;i<count;i++) plan.push("swarm"); left-=ENEMY_TYPES.swarm.budget*count; } else { plan.push(p); left-=ENEMY_TYPES[p].budget; if(c[p]!==undefined)c[p]++; } }
            if (plan.filter((x)=>x==="normal").length<3) plan.push("normal","normal","normal");
            if (wave % 20 === 0) plan.push("endbringer");
            return plan.sort(()=>Math.random()-0.5);
          }

          function createEnemy(typeKey) {
            const type=ENEMY_TYPES[typeKey];
            return { id:crypto.randomUUID(), type:typeKey, x:path[0].x, y:path[0].y, hp:type.hp, maxHp:type.hp, speed:type.speed*SPEED_SCALE, defense:type.defense, reward:type.reward, pathIndex:1, baseDamage:type.baseDamage, burnTicks:0, burnDps:3, slowTicks:0, slowAmount:0.45, vulnMult:0, acidTicks:0, acidDps:0, stunTicks:0, weakenedDamage:0, permaSlow:0, frozenVuln:0, debuffImmune:!!type.debuffImmune, dotImmune:!!type.dotImmune, burnImmune:!!type.burnImmune, knockbackImmune:!!type.knockbackImmune, stunImmune:!!type.stunImmune, noPierce:!!type.noPierce, noShred:!!type.noShred, shieldHalf:!!type.shieldHalf, aoeResist:type.aoeResist||0, beamResist:type.beamResist||0, allDamageHalf:type.allDamageHalf||0, minSpeedMult:type.minSpeedMult||0, phaseCycle:type.phaseCycle||0, phaseDuration:type.phaseDuration||0, phaseTick:0, disableTowerOnHit:type.disableTowerOnHit||0, reflect:type.reflect||0, defAura:type.defAura||0, speedAura:type.speedAura||0, globalSpeedAura:type.globalSpeedAura||0, mirrorCd:type.mirrorCd||0, mirrorTick:0, spawnOnDeath:type.spawnOnDeath||null, spawnPeriodic:type.spawnPeriodic||null, spawnTick:0, empAura:!!type.empAura, buffsAll:!!type.buffsAll, poisonAura:!!type.poisonAura, fireTrail:!!type.fireTrail, regenOnBase:type.regenOnBase||0 };
          }

          function startWave(){ if(state.spawning||state.lives<=0) return; state.wave++; state.queue=fairWavePlan(state.wave); state.spawning=true; state.spawnCooldown=0; updateHud(); }
          function spawnEnemyTick(){ if(!state.spawning) return; state.spawnCooldown--; if(state.spawnCooldown>0) return; if(!state.queue.length){state.spawning=false;return;} state.enemies.push(createEnemy(state.queue.shift())); state.spawnCooldown=10+Math.floor(Math.random()*12); }

          function applyDamage(enemy, amount, options={}) {
            if (enemy.phaseDuration && enemy.phaseTick > 0) return 0;
            if ((options.hitSlow || options.hitStun || options.supportVuln || options.weakenDamage) && enemy.debuffImmune) return 0;
            if ((options.acidDotDps || options.burn) && enemy.dotImmune) return 0;
            let dmg = amount;
            if (enemy.vulnMult > 0) dmg *= 1 + enemy.vulnMult;
            if (enemy.shieldHalf) dmg *= 0.5;
            if (enemy.aoeResist && options.aoe) dmg *= (1 - enemy.aoeResist);
            if (enemy.beamResist && options.beam) dmg *= (1 - enemy.beamResist);
            if (enemy.allDamageHalf) dmg *= (1 - enemy.allDamageHalf);
            if (options.lowHpBonus && enemy.hp <= enemy.maxHp * 0.5) dmg *= 1 + options.lowHpBonus;
            if (options.antiArmorBonus && enemy.defense > 0) dmg *= 1 + options.antiArmorBonus;
            if (options.fireVuln && (options.burn || enemy.burnTicks > 0)) dmg *= 1 + options.fireVuln;
            if (options.ignoreDefense) {
            } else if (options.pierce && enemy.defense > 0) dmg += options.armoredBonus || 0;
            if (options.ignoreArmorPct && enemy.defense > 0) enemy.defense = Math.max(0, enemy.defense * (1 - options.ignoreArmorPct));
            if (!options.ignoreDefense) {
              if (enemy.defense > 0 && !options.pierce && amount < enemy.defense) dmg = 0;
              else if (enemy.defense > 0 && !options.pierce) dmg = Math.max(0, dmg - enemy.defense);
            }
            enemy.hp -= dmg;
            if (options.shred && !enemy.noShred) enemy.defense = Math.max(0, enemy.defense - options.shred);
            if (options.stripDefense) enemy.defense = Math.max(0, enemy.defense - options.stripDefense);
            if (options.hitSlow) { enemy.slowTicks = Math.max(enemy.slowTicks, 60); enemy.slowAmount = Math.max(enemy.slowAmount, options.hitSlow); }
            if (options.supportVuln) enemy.vulnMult = Math.max(enemy.vulnMult, options.supportVuln);
            if (options.acidDotDps) { enemy.acidTicks = Math.max(enemy.acidTicks, 240); enemy.acidDps = Math.max(enemy.acidDps, options.acidDotDps); if (options.acidSpreadOnDeath) enemy.acidSpreadOnDeath = true; }
            if (options.hitStun && !enemy.stunImmune) enemy.stunTicks = Math.max(enemy.stunTicks, options.hitStun);
            if (options.freezeOnHitTicks && !enemy.stunImmune) enemy.stunTicks = Math.max(enemy.stunTicks, options.freezeOnHitTicks);
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
            if (enemy.spawnOnDeath) {
              for (const t of enemy.spawnOnDeath) {
                const c = createEnemy(t); c.x = enemy.x + (Math.random()*12-6); c.y = enemy.y + (Math.random()*12-6); c.pathIndex = enemy.pathIndex; state.enemies.push(c);
              }
            }
            if (enemy.acidTicks > 0 && enemy.acidDps > 0 && enemy.acidSpreadOnDeath) { for (const near of state.enemies) { if (distance(near, enemy) <= 60) { near.acidTicks = Math.max(near.acidTicks, 180); near.acidDps = Math.max(near.acidDps, enemy.acidDps); } } }
          }

          function updateEnemies() {
            for (let i=state.enemies.length-1;i>=0;i--) {
              const enemy=state.enemies[i];
              if (enemy.burnTicks>0 && !enemy.burnImmune && !enemy.dotImmune) { enemy.hp -= enemy.burnDps / 60; enemy.burnTicks--; }
              if (enemy.acidTicks>0 && !enemy.dotImmune) { enemy.hp -= enemy.acidDps / 60; enemy.acidTicks--; }
              if (enemy.hp <= 0) { killEnemy(i, enemy); continue; }
              if (enemy.phaseCycle) { enemy.phaseTick = (enemy.phaseTick + 1) % enemy.phaseCycle; }
              if (enemy.mirrorCd) enemy.mirrorTick = (enemy.mirrorTick + 1) % enemy.mirrorCd;
              if (enemy.spawnPeriodic) { enemy.spawnTick++; if (enemy.spawnTick % 240 === 0) { const c=createEnemy(enemy.spawnPeriodic); c.x=enemy.x; c.y=enemy.y; c.pathIndex=enemy.pathIndex; state.enemies.push(c); } }
              if (enemy.defAura) for (const other of state.enemies) if (other!==enemy && distance(enemy,other)<=90) other.defense = Math.max(other.defense, (ENEMY_TYPES[other.type]?.defense || other.defense) + enemy.defAura);
              if (enemy.speedAura || enemy.globalSpeedAura || enemy.buffsAll) { const b = (enemy.speedAura||0) + (enemy.globalSpeedAura||0) + (enemy.buffsAll?0.2:0); for (const other of state.enemies) if (other!==enemy && (enemy.globalSpeedAura||enemy.buffsAll || distance(enemy,other)<=100)) other.speed = Math.max(other.speed, (ENEMY_TYPES[other.type].speed*SPEED_SCALE)*(1+b)); }
              if (enemy.poisonAura) for (const t of state.towers) if (distance(enemy,t)<=90) t.stunTicks = Math.max(t.stunTicks, 5);
              if (enemy.empAura) for (const t of state.towers) if (distance(enemy,t)<=95) t.stunTicks = Math.max(t.stunTicks, 15);
              if (enemy.stunTicks>0 && !enemy.stunImmune) { enemy.stunTicks--; continue; }
              const activeSlow = Math.max(enemy.permaSlow || 0, enemy.slowTicks>0 ? enemy.slowAmount : 0);
              const minSlowFloor = enemy.minSpeedMult || 0;
              const speedMultiplier = activeSlow>0 ? Math.max(minSlowFloor || 0.05, 1 - activeSlow) : 1;
              if (enemy.slowTicks>0) enemy.slowTicks--;
              const target=path[enemy.pathIndex];
              if (!target) { state.enemies.splice(i,1); state.lives -= Math.max(0, enemy.baseDamage * (1 - (enemy.weakenedDamage || 0))); if (enemy.regenOnBase) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * enemy.regenOnBase); continue; }
              const dx=target.x-enemy.x, dy=target.y-enemy.y, len=Math.hypot(dx,dy), move=enemy.speed*speedMultiplier;
              if (len<move) { enemy.x=target.x; enemy.y=target.y; enemy.pathIndex++; } else { enemy.x += (dx/len)*move; enemy.y += (dy/len)*move; if (enemy.fireTrail) explodeAt(enemy.x, enemy.y, 22, 0.4, true); if (enemy.type === "warengine") { for (const t of state.towers) if (distance(enemy,t)<=32) t.stunTicks = Math.max(t.stunTicks, 45); } }
            }
          }


          function updateMines() {
            for (let i = state.mines.length - 1; i >= 0; i--) {
              const mine = state.mines[i];
              mine.ttl--;
              let exploded = false;
              for (const enemy of state.enemies) {
                if (distance(mine, enemy) <= mine.radius) {
                  if (mine.damage > 0) applyDamage(enemy, mine.damage, { supportVuln: mine.vuln || 0 });
                  if (mine.slow) { enemy.slowTicks = Math.max(enemy.slowTicks, 90); enemy.slowAmount = Math.max(enemy.slowAmount, mine.slow); }
                  if (mine.root) enemy.stunTicks = Math.max(enemy.stunTicks, mine.root);
                  if (mine.freeze) enemy.stunTicks = Math.max(enemy.stunTicks, mine.freeze);
                  if (mine.vuln) enemy.vulnMult = Math.max(enemy.vulnMult, mine.vuln);
                  if (mine.splash) explodeAt(mine.x, mine.y, mine.splash, mine.damage * 0.8, false);
                  exploded = true;
                  break;
                }
              }
              if (exploded || mine.ttl <= 0) state.mines.splice(i, 1);
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
              let extraFireAura = 0;
              const fireShapes = new Set(["ellipse","plasma","thermalray","flame","firetotem","moltenmortar","embertrap"]);
              if (src.stats.fireAura && fireShapes.has(tower.stats.shape)) extraFireAura = src.stats.fireAura;
              out.dmg = Math.max(out.dmg, (src.stats.auraDamage || 0) * auraScale, (src.stats.supportDmgAura || 0) * auraScale, extraFireAura * auraScale);
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

          function findTargetForTower(t){ let target=null,fur=-1; for(const e of state.enemies){ if(distance(t,e)<=t.rangePx && e.pathIndex>fur && !(e.phaseDuration && e.phaseTick>0) && !(e.mirrorCd && e.mirrorTick===0)){target=e;fur=e.pathIndex;} } return target; }
          function pointToSegmentDistance(px,py,x1,y1,x2,y2){ const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy; if(l2===0)return Math.hypot(px-x1,py-y1); let t=((px-x1)*dx+(py-y1)*dy)/l2; t=Math.max(0,Math.min(1,t)); const qx=x1+t*dx,qy=y1+t*dy; return Math.hypot(px-qx,py-qy); }

          function towerShoot(tower, target, buffs) {
            const s=tower.stats;
            let dmg=s.damage*(1+buffs.dmg);
            if (NERF_IDS.has(s.id)) dmg *= NERF_DMG_MULT;
            if (BUFF_IDS.has(s.id)) dmg *= BUFF_DMG_MULT;
            if (s.rampOnTarget && tower.lastTargetId === (target && target.id)) { tower.rampStacks = Math.min((tower.rampStacks || 0) + 1, 20); } else { tower.rampStacks = 0; }
            tower.lastTargetId = target && target.id;
            if (s.rampOnTarget && tower.rampStacks > 0) dmg *= 1 + tower.rampStacks * 0.08;
            const critChance = Math.max(buffs.crit || 0, s.critChance || 0);
            if (critChance > 0 && Math.random() < critChance) dmg *= 2;

            if (s.placeMine) {
              const count = s.mineCount || 1;
              for (let m = 0; m < count; m++) {
                const seg = 1 + Math.floor(Math.random() * (path.length - 2));
                const a = path[seg - 1];
                const b = path[seg];
                const t = Math.random();
                state.mines.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, damage: s.mineDamage || s.damage || 0, radius: s.mineRadius || 32, slow: s.mineSlow || 0, root: s.mineRoot || 0, freeze: s.mineFreeze || 0, vuln: s.mineVuln || 0, splash: s.mineSplash || 0, ttl: 900 });
              }
              return;
            }

            if (NON_PROJECTILE_TOWERS.has(s.id) && !s.placeMine) {
              for (const enemy of state.enemies) {
                if (distance(tower, enemy) > tower.rangePx) continue;
                if (s.pullStrength) {
                  const dx = tower.x - enemy.x;
                  const dy = tower.y - enemy.y;
                  const len = Math.max(1, Math.hypot(dx, dy));
                  enemy.x += (dx / len) * s.pullStrength;
                  enemy.y += (dy / len) * s.pullStrength;
                }
                if (s.supportVuln) enemy.vulnMult = Math.max(enemy.vulnMult, s.supportVuln);
                if (s.hitSlow) { enemy.slowTicks = Math.max(enemy.slowTicks, 90); enemy.slowAmount = Math.max(enemy.slowAmount, s.hitSlow); }
                if (s.hitStun && !enemy.stunImmune) enemy.stunTicks = Math.max(enemy.stunTicks, s.hitStun);
                if (s.acidDotDps) { enemy.acidTicks = Math.max(enemy.acidTicks, s.poisonDuration || 360); enemy.acidDps = Math.max(enemy.acidDps, s.acidDotDps); if (s.acidSpreadOnDeath) enemy.acidSpreadOnDeath = true; }
                if (s.burn) { enemy.burnTicks = Math.max(enemy.burnTicks, s.burnDuration || 240); enemy.burnDps = Math.max(enemy.burnDps, s.burnDps || 3); }
                if (s.stripDefense) enemy.defense = Math.max(0, enemy.defense - s.stripDefense);
                if (s.fireVuln) enemy.vulnMult = Math.max(enemy.vulnMult, s.fireVuln);
                if (s.damage > 0) applyDamage(enemy, dmg, { hitSlow:s.hitSlow||0, hitStun:s.hitStun||0, supportVuln:s.supportVuln||0, stripDefense:s.stripDefense||0, burn:!!s.burn, burnDuration:s.burnDuration||240, burnDps:s.burnDps||3, acidDotDps:s.acidDotDps||0 });
              }
              return;
            }

            if (BEAM_TOWERS.has(s.id)) {
              const options = { burn:!!s.burn, burnDuration:s.burnDuration||240, burnDps:s.burnDps||3, hitSlow:s.hitSlow||0, supportVuln:s.supportVuln||0, ignoreDefense:!!s.ignoreDefense, antiArmorBonus:s.antiArmorBonus||0 };
              applyDamage(target, dmg, options);
              let beams = s.splitBeams || 0;
              for (const enemy of state.enemies) {
                if (beams <= 0) break;
                if (enemy === target) continue;
                if (distance(target, enemy) <= 130) {
                  applyDamage(enemy, dmg * 0.8, options);
                  beams--;
                }
              }
              state.projectiles.push({ x:tower.x, y:tower.y, target, mode:"beam", ttl:10, color:s.color || "#ff5a5f" });
              return;
            }

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

            if (s.pulseAllInRange && tower.shotCount && s.pulseEvery && tower.shotCount % s.pulseEvery === 0) {
              for (const enemy of state.enemies) if (distance(tower, enemy) <= tower.rangePx) applyDamage(enemy, dmg, { hitSlow:s.hitSlow||0, weakenDamage:s.weakenDamage||0 });
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

            if (s.pullStrength) {
              for (const enemy of state.enemies) {
                if (distance(tower, enemy) <= tower.rangePx) {
                  const dx = tower.x - enemy.x;
                  const dy = tower.y - enemy.y;
                  const len = Math.max(1, Math.hypot(dx, dy));
                  enemy.x += (dx / len) * s.pullStrength;
                  enemy.y += (dy / len) * s.pullStrength;
                }
              }
            }

            if (s.linePierce) {
              let hits = 0;
              for (const enemy of state.enemies) {
                if (distance(tower, enemy) > tower.rangePx) continue;
                if (pointToSegmentDistance(enemy.x, enemy.y, tower.x, tower.y, target.x, target.y) <= 14) {
                  const scaledDamage = dmg * (1 + (s.perPierceBeamBonus || 0) * hits);
                  const dealt = applyDamage(enemy, scaledDamage, { pierce:true, beam:true, armoredBonus:s.armoredBonus||0, ignoreDefense:!!s.ignoreDefense || buffs.trueDamage, antiArmorBonus:s.antiArmorBonus||0 });
                  if (enemy.reflect && dealt>0) tower.stunTicks = Math.max(tower.stunTicks, Math.round(dealt * enemy.reflect));
                  hits++;
                  if (hits >= (s.linePierceCount || 999)) break;
                }
              }
              state.projectiles.push({x:tower.x,y:tower.y,target,mode:"beam",ttl:6,color:"#d9d9d9"});
              if (s.railShockwave) explodeAt(target.x - 25, target.y, 48, dmg * 0.5, false);
              return;
            }

            state.projectiles.push({ x:tower.x, y:tower.y, target, speed:6, damage:dmg, color:s.projectileColor||"#ffffff", splashRadius:s.splashRadius||0, clusterCount:s.clusterCount||0, options:{ pierce:!!s.pierce, armoredBonus:s.armoredBonus||0, burn:!!s.burn, burnDuration:s.burnDuration||240, burnDps:s.burnDps||3, burnExplode:s.burnExplode||0, shred:s.shred||0, hitSlow:s.hitSlow||0, supportVuln:s.supportVuln||0, acidDotDps:s.acidDotDps||0, hitStun:s.hitStun||0, lowHpBonus:s.lowHpBonus||0, ignoreDefense:!!s.ignoreDefense || buffs.trueDamage, antiArmorBonus:s.antiArmorBonus||0, lifesteal:buffs.lifesteal||0, weakenDamage:s.weakenDamage||0, spreadVuln:s.spreadVuln||0, splashAppliesAcid:!!s.splashAppliesAcid, chainStun:!!s.chainStun, igniteOnExplode:!!s.igniteOnExplode, acidSpreadOnDeath:!!s.acidSpreadOnDeath, freezeOnHitTicks:tower.tempFreezeTicks||0, lifesteal:s.lifesteal||0, knockback:s.knockback||0, fireVuln:s.fireVuln||0, stripDefense:s.stripDefense||0 }, pierceTargets:s.pierceTargets||0, doubleShockwave:!!s.doubleShockwave, perPierceProjectileBonus:s.perPierceProjectileBonus||0, splitBeams:s.splitBeams||0, burstCount:s.burstCount||0, echoNearby:!!s.echoNearby, echoPower:s.echoPower||0.5, echoCount:s.echoCount||1 });
          }

          function updateTowers() {
            for (const tower of state.towers) {
              const buffs = computeBuffsForTower(tower);
              if (tower.stunTicks>0) { if (!buffs.immuneStun) { tower.stunTicks--; continue; } tower.stunTicks = 0; }
              if ((tower.stats.auraDamage || tower.stats.auraSpeed || tower.stats.auraCrit) && !tower.stats.damage && !tower.stats.summonFactoryTurret) continue;
              tower.cooldown--; if(tower.cooldown>0) continue;
              const target=findTargetForTower(tower); if(!target && !tower.stats.summonFactoryTurret) continue;
              let atkSpeed = tower.stats.atkSpeed > 0 ? tower.stats.atkSpeed / (1 + buffs.spd) : 99999;
              if (NERF_IDS.has(tower.stats.id)) atkSpeed *= 1.08;
              if (BUFF_IDS.has(tower.stats.id)) atkSpeed *= 0.94;
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
                  const dealt=applyDamage(enemy,p.damage,{...(p.options||{}), aoe: p.splashRadius>0});
                  if (enemy.reflect && dealt>0) { const src = state.towers.find((t)=>distance(t,{x:p.x,y:p.y})<22); if (src) src.stunTicks = Math.max(src.stunTicks, Math.round(dealt * enemy.reflect)); }
                  if (enemy.disableTowerOnHit) { const nearTower = state.towers.sort((a,b)=>distance(a,enemy)-distance(b,enemy))[0]; if (nearTower) nearTower.stunTicks = Math.max(nearTower.stunTicks, enemy.disableTowerOnHit); }
                  if (dealt>0 && p.options.burn) { enemy.burnTicks=Math.max(enemy.burnTicks,p.options.burnDuration); enemy.burnDps=Math.max(enemy.burnDps,p.options.burnDps); enemy.burnExplode=Math.max(enemy.burnExplode||0,p.options.burnExplode||0); }
                  if (p.options.lifesteal) { for (const t of state.towers) if (distance(t, enemy) <= 120) t.stunTicks = Math.max(0, t.stunTicks - dealt * p.options.lifesteal); }
                  if (p.options.knockback) { enemy.pathIndex = Math.max(1, enemy.pathIndex - 1); enemy.x = Math.max(0, enemy.x - p.options.knockback); }
                  if (p.options.supportVuln && p.options.spreadVuln) { for (const near of state.enemies) { if (near !== enemy && distance(near, enemy) <= 48) { near.vulnMult = Math.max(near.vulnMult, p.options.supportVuln); break; } } }
                };
                deal(p.target);
                if (p.splitBeams > 0) {
                  let splits = 0;
                  for (const e of state.enemies) {
                    if (e !== p.target && distance(e, p.target) <= 120) { deal(e); splits++; if (splits >= p.splitBeams) break; }
                  }
                }
                if (p.burstCount > 1) { for (let b = 1; b < p.burstCount; b++) deal(p.target); }
                if (p.echoNearby) {
                  const echoes = state.towers.filter((t) => t.stats.id !== "echo" && distance(t, p.target) <= 180).slice(0, p.echoCount || 1);
                  for (const eTower of echoes) applyDamage(p.target, p.damage * (p.echoPower || 0.5), p.options || {});
                }
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

          function drawEnemy(enemy){ const s=ENEMY_TYPES[enemy.type]||ENEMY_TYPES.normal; if(s.shape==="circle"){ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(enemy.x,enemy.y,12,0,Math.PI*2);ctx.fill();} else if(s.shape==="triangle"||s.shape==="smallTriangle"){polygon(enemy.x,enemy.y,s.shape==="smallTriangle"?8:12,3,s.color,-Math.PI/2);} else if(s.shape==="square"){ctx.fillStyle=s.color;ctx.fillRect(enemy.x-11,enemy.y-11,22,22);} else if(s.shape==="hex"){polygon(enemy.x,enemy.y,12,6,s.color,Math.PI/6);} else if(s.shape==="oct"){polygon(enemy.x,enemy.y,13,8,s.color,Math.PI/8);} else if(s.shape==="pent"){polygon(enemy.x,enemy.y,12,5,s.color,Math.PI/10);} else if(s.shape==="diamond"){polygon(enemy.x,enemy.y,12,4,s.color,Math.PI/4);} else if(s.shape==="monolith"){ctx.fillStyle=s.color;ctx.fillRect(enemy.x-8,enemy.y-14,16,28);} else if(s.shape==="sun"){ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(enemy.x,enemy.y,12,0,Math.PI*2);ctx.fill(); for(let k=0;k<8;k++){const a=(k*Math.PI)/4; ctx.beginPath(); ctx.moveTo(enemy.x,enemy.y); ctx.lineTo(enemy.x+Math.cos(a)*18, enemy.y+Math.sin(a)*18); ctx.strokeStyle="#333"; ctx.stroke();}} else if(s.shape==="split"){ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(enemy.x,enemy.y,12,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#0a3318";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(enemy.x-5,enemy.y-7);ctx.lineTo(enemy.x+2,enemy.y-1);ctx.lineTo(enemy.x-1,enemy.y+6);ctx.stroke();}
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
            else if(m.shape==="laser"){ctx.fillStyle="#ff3b30";ctx.fillRect(x-16,y-2,32,4);}
            else if(m.shape==="pulse"){ctx.fillStyle="#fff";ctx.fillRect(x-10,y-10,20,20);ctx.strokeStyle="#4cc9f0";ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.stroke();}
            else if(m.shape==="mine"){ctx.fillStyle="#8b5a2b";ctx.fillRect(x-10,y-10,20,20);ctx.strokeStyle="#ffd60a";ctx.beginPath();ctx.moveTo(x-6,y-6);ctx.lineTo(x+6,y+6);ctx.moveTo(x+6,y-6);ctx.lineTo(x-6,y+6);ctx.stroke();}
            else if(m.shape==="gravity"){ctx.fillStyle="#8a2be2";ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();}
            else if(m.shape==="wind"){ctx.fillStyle="#c9ced6";ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();}
            else if(m.shape==="poison"){ctx.fillStyle="#39ff14";ctx.beginPath();ctx.arc(x-5,y,7,0,Math.PI*2);ctx.arc(x+4,y-2,8,0,Math.PI*2);ctx.fill();}
            else if(m.shape==="emp"){polygon(x,y,12,3,"#111",Math.PI/2);ctx.strokeStyle="#4cc9f0";ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.stroke();}
            else if(m.shape==="shard"){polygon(x,y,12,3,"#4deeea",-Math.PI/2);}
            else if(m.shape==="void"){ctx.fillStyle="#000";ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();ctx.fillStyle="#7b2cbf";ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();}
            else if(m.shape==="echo"){ctx.fillStyle="#7d8597";ctx.fillRect(x-14,y-6,28,12);ctx.beginPath();ctx.arc(x-10,y,4,0,Math.PI*2);ctx.arc(x+10,y,4,0,Math.PI*2);ctx.fill();}
            else if(m.shape==="arcmortar"){ctx.fillStyle="#495057";ctx.beginPath();ctx.arc(x,y+2,14,Math.PI,0);ctx.fill();}
            else if(m.shape==="cryomines"){ctx.fillStyle="#7bdff2";ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.fill();}
            else if(m.shape==="needle"){ctx.fillStyle="#000";ctx.fillRect(x-15,y-2,30,4);}
            else if(m.shape==="fence"){ctx.strokeStyle="#ffd60a";ctx.beginPath();ctx.moveTo(x-12,y+6);ctx.lineTo(x-6,y-6);ctx.lineTo(x,y+6);ctx.lineTo(x+6,y-6);ctx.lineTo(x+12,y+6);ctx.stroke();}
            else if(m.shape==="oil"){ctx.fillStyle="#111";ctx.beginPath();ctx.moveTo(x,y-12);ctx.bezierCurveTo(x+10,y-4,x+8,y+8,x,y+12);ctx.bezierCurveTo(x-8,y+8,x-10,y-4,x,y-12);ctx.fill();}
            else if(m.shape==="burst"){ctx.fillStyle="#5e503f";ctx.fillRect(x-12,y-6,24,12);}
            else if(m.shape==="plasma"){ctx.fillStyle="#ff66c4";ctx.beginPath();ctx.ellipse(x,y,14,9,0,0,Math.PI*2);ctx.fill();}
            else if(m.shape==="static"){ctx.fillStyle="#f5cb5c";ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();}
            else if(m.shape==="snare"){ctx.strokeStyle="#6c757d";ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.stroke();}
            else if(m.shape==="beamsplit"){ctx.fillStyle="#ff0000";ctx.beginPath();ctx.moveTo(x,y-12);ctx.lineTo(x+10,y+8);ctx.lineTo(x-10,y+8);ctx.closePath();ctx.fill();}
            else {ctx.fillStyle=m.color||"#fff";ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();}
          }

          function drawAlliedTurrets(){ for(const u of state.alliedTurrets){ ctx.fillStyle="#313a46";ctx.fillRect(u.x-8,u.y-8,16,16);ctx.fillStyle="#89fcff";ctx.beginPath();ctx.arc(u.x,u.y,4,0,Math.PI*2);ctx.fill(); ctx.fillStyle="#111";ctx.fillRect(u.x-10,u.y-14,20,3);ctx.fillStyle="#57cc99";ctx.fillRect(u.x-10,u.y-14,20*Math.max(0,u.hp)/(u.unitHp||5),3);} }
          function drawPath(){ ctx.strokeStyle="#f4a261";ctx.lineWidth=34;ctx.lineJoin="round";ctx.lineCap="round";ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);for(let i=1;i<path.length;i++)ctx.lineTo(path[i].x,path[i].y);ctx.stroke(); }
          function drawProjectiles(){ for(const p of state.projectiles){ if(p.mode==="bolt"){ctx.strokeStyle="#f7f45f";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);if(p.target)ctx.lineTo(p.target.x,p.target.y);ctx.stroke();} else if(p.mode==="beam"){ctx.strokeStyle=p.color||"#d9d9d9";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(p.x,p.y);if(p.target)ctx.lineTo(p.target.x,p.target.y);ctx.stroke();} else {ctx.fillStyle=p.color||"#fff";ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fill();} } }
          function drawGameOver(){ if(state.lives>0)return; ctx.fillStyle="rgba(0,0,0,0.72)";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="bold 52px system-ui";ctx.fillText("Game Over",canvas.width/2,canvas.height/2-20);ctx.font="24px system-ui";ctx.fillText("Refresh to try again",canvas.width/2,canvas.height/2+24); }

          function tick(){ ctx.clearRect(0,0,canvas.width,canvas.height); spawnEnemyTick(); updateEnemies(); updateMines(); updateAlliedTurrets(); updateTowers(); updateProjectiles(); updateHud(); drawPath(); for(const t of state.towers) drawTower(t);
            for (const m of state.mines) { ctx.fillStyle = "#d4af37"; ctx.beginPath(); ctx.arc(m.x, m.y, 5, 0, Math.PI * 2); ctx.fill(); }
            drawAlliedTurrets(); for(const e of state.enemies) drawEnemy(e); drawProjectiles(); drawGameOver(); requestAnimationFrame(tick); }

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
            const stats = copyStats(model);
            if (NERF_IDS.has(stats.id)) stats.range = +(stats.range * NERF_RANGE_MULT).toFixed(2);
            if (BUFF_IDS.has(stats.id)) stats.range = +(stats.range + BUFF_RANGE_BONUS).toFixed(2);
            state.towers.push({ id:crypto.randomUUID(), baseId:model.id, baseName:model.name, x, y, stats, rangePx:stats.range*RANGE_UNIT, cooldown:0, stunTicks:0, upgradePath:null, upgradeTier:0, shotCount:0 });
            updateHud(); buildTowerMenu(); renderUpgradePanel();
          });

          startWaveButton.addEventListener("click", startWave);
          buildTowerMenu(); renderUpgradePanel(); updateHud(); requestAnimationFrame(tick);
        </script>
      </body>
    </html>
`;
}
