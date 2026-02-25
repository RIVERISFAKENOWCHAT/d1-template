export function renderHtml() {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Tiny Tower Defense+</title>
        <style>
          :root {
            color-scheme: dark;
            --bg: #10131a;
            --panel: #1a2230;
            --text: #f2f6ff;
            --accent: #57cc99;
            --path: #f4a261;
            --selected: #90e0ef;
          }

          * { box-sizing: border-box; font-family: Inter, system-ui, sans-serif; }

          body {
            margin: 0;
            background: radial-gradient(circle at top, #1d2b42, var(--bg));
            color: var(--text);
            min-height: 100vh;
            display: grid;
            place-items: center;
          }

          .layout {
            width: min(98vw, 1220px);
            display: grid;
            grid-template-columns: minmax(300px, 1fr) 280px;
            gap: 12px;
          }

          .game-panel { display: grid; gap: 12px; }

          .hud {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            background: var(--panel);
            border-radius: 12px;
            border: 1px solid #2f3a52;
            flex-wrap: wrap;
          }

          .stats { display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.94rem; }

          button {
            border: 0;
            border-radius: 8px;
            background: var(--accent);
            color: #052111;
            font-weight: 700;
            padding: 9px 12px;
            cursor: pointer;
          }

          button:disabled { opacity: 0.5; cursor: not-allowed; }

          canvas {
            width: 100%;
            height: auto;
            background: #0f1724;
            border-radius: 12px;
            border: 1px solid #344160;
          }

          .hint { margin: 0; opacity: 0.85; font-size: 0.9rem; text-align: center; }

          .side {
            background: var(--panel);
            border: 1px solid #2f3a52;
            border-radius: 12px;
            padding: 10px;
            display: grid;
            grid-template-rows: auto 1fr;
            gap: 8px;
            max-height: 760px;
          }

          .tower-list {
            overflow-y: auto;
            display: grid;
            gap: 8px;
            padding-right: 4px;
          }

          .tower-card {
            border: 1px solid #36415a;
            border-radius: 10px;
            padding: 8px;
            cursor: pointer;
            background: #151b26;
          }

          .tower-card.active { border-color: var(--selected); box-shadow: 0 0 0 1px var(--selected); }
          .tower-title { font-weight: 700; margin-bottom: 4px; }
          .tower-meta { font-size: 0.82rem; opacity: 0.85; line-height: 1.35; }
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
            <p class="hint">Pick a tower on the right, then click map to place. Defeat procedural but fair waves.</p>
          </section>
          <aside class="side">
            <strong>Towers</strong>
            <div class="tower-list" id="towerList"></div>
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

          const RANGE_UNIT = 22;
          const SPEED_SCALE = 0.08;

          const path = [
            { x: 0, y: 280 },
            { x: 220, y: 280 },
            { x: 220, y: 110 },
            { x: 500, y: 110 },
            { x: 500, y: 390 },
            { x: 740, y: 390 },
            { x: 740, y: 220 },
            { x: 920, y: 220 },
          ];

          const ENEMY_TYPES = {
            normal: { label: "Normal", hp: 10, speed: 10, defense: 0, reward: 6, color: "#ef476f", shape: "circle", baseDamage: 1, budget: 1 },
            fast: { label: "Fast", hp: 5, speed: 20, defense: 0, reward: 6, color: "#00d4ff", shape: "triangle", baseDamage: 1, budget: 1 },
            strong: { label: "Strong", hp: 25, speed: 5, defense: 5, reward: 13, color: "#9aa0a6", shape: "square", baseDamage: 2, budget: 3 },
            swarm: { label: "Swarm", hp: 3, speed: 15, defense: 0, reward: 2, color: "#ff9f1c", shape: "smallTriangle", baseDamage: 1, budget: 0.45 },
            stunner: { label: "Stunner", hp: 7, speed: 25, defense: 0, reward: 8, color: "#ffdd00", shape: "hex", baseDamage: 0, budget: 2 },
            splitter: { label: "Splitter", hp: 15, speed: 10, defense: 0, reward: 10, color: "#3adb76", shape: "split", baseDamage: 1, budget: 2 },
            splitterChild: { label: "Split", hp: 10, speed: 15, defense: 0, reward: 4, color: "#5ee28f", shape: "circle", baseDamage: 1, budget: 0 },
            tank: { label: "Tank", hp: 40, speed: 3, defense: 15, reward: 20, color: "#123b69", shape: "oct", baseDamage: 3, budget: 5 },
          };

          const TOWERS = [
            { id: "basic", name: "Basic Tower", cost: 40, damage: 1, atkSpeed: 1, range: 5, color: "#ffffff", shape: "circle" },
            { id: "gatling", name: "Gatling Turret", cost: 60, damage: 1, atkSpeed: 0.3, range: 4, color: "#274c77", shape: "gatling" },
            { id: "sniper", name: "Sniper Tower", cost: 100, damage: 5, atkSpeed: 3, range: 25, color: "#1b4332", shape: "sniper" },
            { id: "frost", name: "Frost Cannon", cost: 55, damage: 0, atkSpeed: 2, range: 3, color: "#48cae4", shape: "diamond", frost: true },
            { id: "tesla", name: "Tesla Coil", cost: 100, damage: 6, atkSpeed: 4, range: 10, color: "#ffd60a", shape: "tesla", chain: true },
            { id: "flame", name: "Flamethrower", cost: 150, damage: 0.5, atkSpeed: 0.1, range: 6, color: "#d90429", shape: "ellipse", burn: true, projectileColor: "#ff2d2d" },
            { id: "acid", name: "Acid Launcher", cost: 200, damage: 5, atkSpeed: 3, range: 12, color: "#b7efc5", shape: "trap", pierce: true, armoredBonus: 5 },
            { id: "commander", name: "Commander", cost: 250, damage: 0, atkSpeed: 0, range: 8, color: "#ffffff", shape: "commander", auraBuff: 0.3 },
            { id: "railgun", name: "Railgun", cost: 300, damage: 25, atkSpeed: 5, range: 20, color: "#c0c0c0", shape: "railgun", linePierce: true, pierce: true },
            { id: "factory", name: "Turret Factory", cost: 350, damage: 0, atkSpeed: 4, range: 0, color: "#4a4e69", shape: "factory", summonFactoryTurret: true },
            { id: "bomb", name: "Bomb Tower", cost: 150, damage: 8, atkSpeed: 3, range: 9, color: "#8d99ae", shape: "bomb", splashRadius: 68 },
          ];

          const state = {
            lives: 20,
            gold: 220,
            wave: 0,
            towers: [],
            enemies: [],
            projectiles: [],
            alliedTurrets: [],
            spawning: false,
            queue: [],
            spawnCooldown: 0,
            selectedTower: TOWERS[0].id,
          };

          function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

          function updateHud() {
            livesEl.textContent = Math.max(state.lives, 0);
            goldEl.textContent = Math.floor(state.gold);
            waveEl.textContent = state.wave;
            enemiesEl.textContent = state.enemies.length;
            startWaveButton.disabled = state.spawning || state.enemies.length > 0 || state.lives <= 0;
          }

          function buildTowerMenu() {
            towerListEl.innerHTML = "";
            for (const tower of TOWERS) {
              const card = document.createElement("div");
              card.className = "tower-card" + (state.selectedTower === tower.id ? " active" : "");
              card.innerHTML =
                '<div class="tower-title">' + tower.name + " (" + tower.cost + 'g)</div>' +
                '<div class="tower-meta">DMG: ' + tower.damage +
                '<br>ATK SPD: ' + tower.atkSpeed + 's<br>Range: ' + tower.range +
                (tower.pierce ? "<br>Armor piercing" : "") +
                (tower.linePierce ? "<br>Line pierce shot" : "") +
                (tower.chain ? "<br>Chain lightning" : "") +
                (tower.burn ? "<br>Applies burn" : "") +
                (tower.frost ? "<br>Slows enemies 2s" : "") +
                (tower.auraBuff ? "<br>+30% DMG/ATK SPD aura" : "") +
                (tower.summonFactoryTurret ? "<br>Summons mobile turrets" : "") +
                (tower.splashRadius ? "<br>Splash damage" : "") +
                "</div>";
              card.onclick = () => {
                state.selectedTower = tower.id;
                buildTowerMenu();
              };
              towerListEl.appendChild(card);
            }
          }

          function fairWavePlan(wave) {
            const budget = 14 + wave * 5;
            const plan = [];
            let left = budget;
            const unlocked = ["normal"];
            if (wave >= 2) unlocked.push("fast", "swarm");
            if (wave >= 3) unlocked.push("strong", "splitter");
            if (wave >= 4) unlocked.push("stunner");
            if (wave >= 5) unlocked.push("tank");

            const limits = { fast: Math.max(4, wave * 2), stunner: Math.max(1, Math.floor(wave / 2)), tank: Math.max(1, Math.floor(wave / 3)) };
            const counters = { fast: 0, stunner: 0, tank: 0 };

            while (left > 0.8) {
              const pool = unlocked.filter((type) => ENEMY_TYPES[type].budget <= left + 0.2 && (limits[type] === undefined || counters[type] < limits[type]));
              if (!pool.length) break;
              const pick = pool[Math.floor(Math.random() * pool.length)];

              if (pick === "swarm") {
                const count = 5 + Math.floor(Math.random() * 6);
                for (let i = 0; i < count; i++) plan.push("swarm");
                left -= ENEMY_TYPES.swarm.budget * count;
              } else {
                plan.push(pick);
                left -= ENEMY_TYPES[pick].budget;
                if (counters[pick] !== undefined) counters[pick]++;
              }
            }

            if (plan.filter((x) => x === "normal").length < 3) plan.push("normal", "normal", "normal");
            return plan.sort(() => Math.random() - 0.5);
          }

          function createEnemy(typeKey) {
            const type = ENEMY_TYPES[typeKey];
            return {
              id: crypto.randomUUID(),
              type: typeKey,
              x: path[0].x,
              y: path[0].y,
              hp: type.hp,
              maxHp: type.hp,
              speed: type.speed * SPEED_SCALE,
              defense: type.defense,
              reward: type.reward,
              pathIndex: 1,
              baseDamage: type.baseDamage,
              burnTicks: 0,
              slowTicks: 0,
            };
          }

          function startWave() {
            if (state.spawning || state.lives <= 0) return;
            state.wave += 1;
            state.queue = fairWavePlan(state.wave);
            state.spawning = true;
            state.spawnCooldown = 0;
            updateHud();
          }

          function spawnEnemyTick() {
            if (!state.spawning) return;
            state.spawnCooldown -= 1;
            if (state.spawnCooldown > 0) return;
            if (!state.queue.length) {
              state.spawning = false;
              return;
            }
            const nextType = state.queue.shift();
            state.enemies.push(createEnemy(nextType));
            state.spawnCooldown = 10 + Math.floor(Math.random() * 12);
          }

          function applyDamage(enemy, amount, options = {}) {
            let dmg = amount;
            if (options.pierce && enemy.defense > 0) dmg += options.armoredBonus || 0;
            if (enemy.defense > 0 && !options.pierce && amount < enemy.defense) dmg = 0;
            else if (enemy.defense > 0 && !options.pierce) dmg = Math.max(0, amount - enemy.defense);
            enemy.hp -= dmg;
            return dmg;
          }

          function killEnemy(i, enemy) {
            state.enemies.splice(i, 1);
            state.gold += enemy.reward;

            if (enemy.type === "stunner") {
              for (const tower of state.towers) {
                if (distance(tower, enemy) <= 120) tower.stunTicks = Math.max(tower.stunTicks, 120);
              }
            }

            if (enemy.type === "splitter") {
              for (let n = 0; n < 2; n++) {
                const child = createEnemy("splitterChild");
                child.x = enemy.x + (n === 0 ? -8 : 8);
                child.y = enemy.y + (n === 0 ? -4 : 4);
                child.pathIndex = enemy.pathIndex;
                state.enemies.push(child);
              }
            }
          }

          function updateEnemies() {
            for (let i = state.enemies.length - 1; i >= 0; i--) {
              const enemy = state.enemies[i];

              if (enemy.burnTicks > 0) {
                enemy.hp -= 3 / 60;
                enemy.burnTicks -= 1;
              }

              const speedMultiplier = enemy.slowTicks > 0 ? 0.55 : 1;
              if (enemy.slowTicks > 0) enemy.slowTicks -= 1;

              const target = path[enemy.pathIndex];
              if (!target) {
                state.enemies.splice(i, 1);
                state.lives -= enemy.baseDamage;
                continue;
              }

              const dx = target.x - enemy.x;
              const dy = target.y - enemy.y;
              const len = Math.hypot(dx, dy);
              const moveSpeed = enemy.speed * speedMultiplier;
              if (len < moveSpeed) {
                enemy.x = target.x;
                enemy.y = target.y;
                enemy.pathIndex += 1;
              } else {
                enemy.x += (dx / len) * moveSpeed;
                enemy.y += (dy / len) * moveSpeed;
              }

              if (enemy.hp <= 0) killEnemy(i, enemy);
            }
          }

          function updateAlliedTurrets() {
            for (let i = state.alliedTurrets.length - 1; i >= 0; i--) {
              const unit = state.alliedTurrets[i];
              const targetPoint = path[unit.pathIndex];
              if (!targetPoint) {
                state.alliedTurrets.splice(i, 1);
                continue;
              }

              const dx = targetPoint.x - unit.x;
              const dy = targetPoint.y - unit.y;
              const len = Math.hypot(dx, dy);
              const moveSpeed = 1.4;
              if (len < moveSpeed) {
                unit.x = targetPoint.x;
                unit.y = targetPoint.y;
                unit.pathIndex -= 1;
              } else {
                unit.x += (dx / len) * moveSpeed;
                unit.y += (dy / len) * moveSpeed;
              }

              for (const enemy of state.enemies) {
                if (distance(unit, enemy) < 12) {
                  unit.hp -= 0.1;
                }
              }

              unit.cooldown -= 1;
              if (unit.cooldown <= 0) {
                let target = null;
                let furthest = -1;
                for (const enemy of state.enemies) {
                  if (distance(unit, enemy) <= unit.rangePx && enemy.pathIndex > furthest) {
                    target = enemy;
                    furthest = enemy.pathIndex;
                  }
                }
                if (target) {
                  unit.cooldown = Math.max(1, Math.round(unit.atkSpeed * 60));
                  state.projectiles.push({
                    x: unit.x,
                    y: unit.y,
                    target,
                    speed: 6,
                    damage: unit.damage,
                    color: "#89fcff",
                    options: {},
                  });
                }
              }

              if (unit.hp <= 0) state.alliedTurrets.splice(i, 1);
            }
          }

          function computeCommanderBuffs() {
            const buffs = new Map();
            const commanders = state.towers.filter((tower) => tower.model.auraBuff);
            for (const commander of commanders) {
              for (const tower of state.towers) {
                if (tower === commander || tower.model.auraBuff || tower.model.summonFactoryTurret) continue;
                if (distance(tower, commander) <= commander.rangePx) {
                  const current = buffs.get(tower) || 0;
                  buffs.set(tower, Math.max(current, commander.model.auraBuff));
                }
              }
            }
            return buffs;
          }

          function findTargetForTower(tower) {
            let target = null;
            let furthest = -1;
            for (const enemy of state.enemies) {
              if (distance(tower, enemy) <= tower.rangePx && enemy.pathIndex > furthest) {
                target = enemy;
                furthest = enemy.pathIndex;
              }
            }
            return target;
          }

          function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const l2 = dx * dx + dy * dy;
            if (l2 === 0) return Math.hypot(px - x1, py - y1);
            let t = ((px - x1) * dx + (py - y1) * dy) / l2;
            t = Math.max(0, Math.min(1, t));
            const projX = x1 + t * dx;
            const projY = y1 + t * dy;
            return Math.hypot(px - projX, py - projY);
          }

          function towerShoot(tower, target, buff = 0) {
            const buffedDamage = tower.model.damage * (1 + buff);

            if (tower.model.summonFactoryTurret) {
              state.alliedTurrets.push({
                x: path[path.length - 1].x,
                y: path[path.length - 1].y,
                pathIndex: path.length - 2,
                hp: 5,
                damage: 0.6,
                atkSpeed: 0.4,
                rangePx: 7 * RANGE_UNIT,
                cooldown: 0,
              });
              return;
            }

            if (tower.model.frost) {
              for (const enemy of state.enemies) {
                if (distance(enemy, target) <= tower.rangePx) enemy.slowTicks = Math.max(enemy.slowTicks, 120);
              }
            }

            if (tower.model.chain) {
              const impacted = [target];
              applyDamage(target, buffedDamage);
              for (const enemy of state.enemies) {
                if (impacted.length >= 3) break;
                if (enemy === target) continue;
                if (distance(enemy, impacted[impacted.length - 1]) <= 110) {
                  impacted.push(enemy);
                  applyDamage(enemy, buffedDamage / 2);
                }
              }
              state.projectiles.push({ x: tower.x, y: tower.y, target, mode: "bolt", ttl: 8 });
              return;
            }

            if (tower.model.linePierce) {
              for (const enemy of state.enemies) {
                if (distance(tower, enemy) > tower.rangePx) continue;
                const d = pointToSegmentDistance(enemy.x, enemy.y, tower.x, tower.y, target.x, target.y);
                if (d <= 14) applyDamage(enemy, buffedDamage, { pierce: true, armoredBonus: tower.model.armoredBonus || 0 });
              }
              state.projectiles.push({ x: tower.x, y: tower.y, target, mode: "beam", ttl: 6, color: "#d9d9d9" });
              return;
            }

            state.projectiles.push({
              x: tower.x,
              y: tower.y,
              target,
              speed: 6,
              damage: buffedDamage,
              color: tower.model.projectileColor || "#ffffff",
              splashRadius: tower.model.splashRadius || 0,
              options: { pierce: !!tower.model.pierce, armoredBonus: tower.model.armoredBonus || 0, burn: !!tower.model.burn },
            });
          }

          function updateTowers() {
            const buffs = computeCommanderBuffs();
            for (const tower of state.towers) {
              if (tower.stunTicks > 0) {
                tower.stunTicks -= 1;
                continue;
              }
              if (tower.model.auraBuff) continue;
              tower.cooldown -= 1;
              if (tower.cooldown > 0) continue;
              const target = findTargetForTower(tower);
              if (!target && !tower.model.summonFactoryTurret) continue;
              const buff = buffs.get(tower) || 0;
              const atkSpeed = tower.model.atkSpeed > 0 ? tower.model.atkSpeed / (1 + buff) : 99999;
              tower.cooldown = Math.max(1, Math.round(atkSpeed * 60));
              towerShoot(tower, target || { x: tower.x, y: tower.y }, buff);
            }
          }

          function updateProjectiles() {
            for (let i = state.projectiles.length - 1; i >= 0; i--) {
              const p = state.projectiles[i];
              if (p.mode === "bolt" || p.mode === "beam") {
                p.ttl -= 1;
                if (p.ttl <= 0) state.projectiles.splice(i, 1);
                continue;
              }

              if (!state.enemies.includes(p.target)) {
                state.projectiles.splice(i, 1);
                continue;
              }

              const dx = p.target.x - p.x;
              const dy = p.target.y - p.y;
              const len = Math.hypot(dx, dy);
              if (len < p.speed + 2) {
                const dealt = applyDamage(p.target, p.damage, p.options || {});
                if (dealt > 0 && p.options && p.options.burn) p.target.burnTicks = Math.max(p.target.burnTicks, 240);
                if (p.splashRadius > 0) {
                  for (const enemy of state.enemies) {
                    if (enemy !== p.target && distance(enemy, p.target) <= p.splashRadius) {
                      applyDamage(enemy, p.damage * 0.7, p.options || {});
                    }
                  }
                }
                state.projectiles.splice(i, 1);
              } else {
                p.x += (dx / len) * p.speed;
                p.y += (dy / len) * p.speed;
              }
            }
          }

          function polygon(x, y, r, sides, color, rotation = 0) {
            ctx.fillStyle = color;
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
              const angle = rotation + (i * Math.PI * 2) / sides;
              const px = x + Math.cos(angle) * r;
              const py = y + Math.sin(angle) * r;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
          }

          function drawEnemy(enemy) {
            const style = ENEMY_TYPES[enemy.type] || ENEMY_TYPES.normal;
            if (style.shape === "circle") {
              ctx.fillStyle = style.color;
              ctx.beginPath();
              ctx.arc(enemy.x, enemy.y, 12, 0, Math.PI * 2);
              ctx.fill();
            } else if (style.shape === "triangle" || style.shape === "smallTriangle") {
              polygon(enemy.x, enemy.y, style.shape === "smallTriangle" ? 8 : 12, 3, style.color, -Math.PI / 2);
            } else if (style.shape === "square") {
              ctx.fillStyle = style.color;
              ctx.fillRect(enemy.x - 11, enemy.y - 11, 22, 22);
            } else if (style.shape === "hex") {
              polygon(enemy.x, enemy.y, 12, 6, style.color, Math.PI / 6);
            } else if (style.shape === "oct") {
              polygon(enemy.x, enemy.y, 13, 8, style.color, Math.PI / 8);
            } else if (style.shape === "split") {
              ctx.fillStyle = style.color;
              ctx.beginPath();
              ctx.arc(enemy.x, enemy.y, 12, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = "#0a3318";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(enemy.x - 5, enemy.y - 7);
              ctx.lineTo(enemy.x + 2, enemy.y - 1);
              ctx.lineTo(enemy.x - 1, enemy.y + 6);
              ctx.stroke();
            }

            ctx.fillStyle = "#111";
            ctx.fillRect(enemy.x - 14, enemy.y - 20, 28, 4);
            ctx.fillStyle = "#57cc99";
            const hpPercent = Math.max(enemy.hp, 0) / enemy.maxHp;
            ctx.fillRect(enemy.x - 14, enemy.y - 20, 28 * hpPercent, 4);
          }

          function drawTower(tower) {
            const { x, y, model } = tower;
            ctx.strokeStyle = tower.stunTicks > 0 ? "rgba(255,200,0,0.7)" : "rgba(144,224,239,0.2)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, tower.rangePx, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = model.color;
            if (model.shape === "circle") {
              ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
            } else if (model.shape === "gatling") {
              ctx.fillRect(x - 14, y - 8, 22, 16);
              ctx.beginPath(); ctx.arc(x + 11, y, 6, 0, Math.PI * 2); ctx.fill();
            } else if (model.shape === "sniper") {
              ctx.fillRect(x - 16, y - 4, 32, 8);
            } else if (model.shape === "diamond") {
              polygon(x, y, 13, 4, model.color, Math.PI / 2);
            } else if (model.shape === "tesla") {
              ctx.fillStyle = "#80858f";
              ctx.fillRect(x - 14, y - 10, 28, 20);
              ctx.fillStyle = model.color;
              ctx.beginPath();
              ctx.moveTo(x - 3, y - 8); ctx.lineTo(x + 3, y - 2); ctx.lineTo(x - 1, y - 2); ctx.lineTo(x + 2, y + 8); ctx.lineTo(x - 5, y + 1); ctx.lineTo(x - 1, y + 1);
              ctx.closePath();
              ctx.fill();
            } else if (model.shape === "ellipse") {
              ctx.beginPath(); ctx.ellipse(x, y, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
            } else if (model.shape === "trap") {
              ctx.beginPath();
              ctx.moveTo(x - 14, y + 10); ctx.lineTo(x + 14, y + 10); ctx.lineTo(x + 9, y - 10); ctx.lineTo(x - 9, y - 10);
              ctx.closePath();
              ctx.fill();
            } else if (model.shape === "commander") {
              ctx.fillStyle = "#fff";
              ctx.fillRect(x - 12, y - 12, 24, 24);
              ctx.fillStyle = "#18a558";
              ctx.fillRect(x - 2, y - 8, 4, 16);
              ctx.fillRect(x - 8, y - 2, 16, 4);
            } else if (model.shape === "railgun") {
              ctx.fillStyle = "#a9b2bf";
              ctx.fillRect(x - 18, y - 4, 34, 8);
              ctx.fillStyle = "#e0fbfc";
              ctx.beginPath();
              ctx.arc(x + 17, y, 4, 0, Math.PI * 2);
              ctx.fill();
            } else if (model.shape === "factory") {
              ctx.fillStyle = "#40444f";
              ctx.fillRect(x - 14, y - 14, 28, 28);
              ctx.fillStyle = "#00d4ff";
              ctx.beginPath();
              ctx.moveTo(x, y - 8);
              ctx.lineTo(x + 3, y - 3);
              ctx.lineTo(x + 9, y - 3);
              ctx.lineTo(x + 4, y + 1);
              ctx.lineTo(x + 6, y + 8);
              ctx.lineTo(x, y + 4);
              ctx.lineTo(x - 6, y + 8);
              ctx.lineTo(x - 4, y + 1);
              ctx.lineTo(x - 9, y - 3);
              ctx.lineTo(x - 3, y - 3);
              ctx.closePath();
              ctx.fill();
            } else if (model.shape === "bomb") {
              ctx.fillStyle = "#9aa0a6";
              ctx.beginPath();
              ctx.arc(x, y, 14, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "#111";
              ctx.beginPath();
              ctx.arc(x, y, 6, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          function drawAlliedTurrets() {
            for (const unit of state.alliedTurrets) {
              ctx.fillStyle = "#313a46";
              ctx.fillRect(unit.x - 8, unit.y - 8, 16, 16);
              ctx.fillStyle = "#89fcff";
              ctx.beginPath();
              ctx.arc(unit.x, unit.y, 4, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = "#111";
              ctx.fillRect(unit.x - 10, unit.y - 14, 20, 3);
              ctx.fillStyle = "#57cc99";
              ctx.fillRect(unit.x - 10, unit.y - 14, 20 * Math.max(0, unit.hp) / 5, 3);
            }
          }

          function drawPath() {
            ctx.strokeStyle = "#f4a261";
            ctx.lineWidth = 34;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
            ctx.stroke();
          }

          function drawProjectiles() {
            for (const p of state.projectiles) {
              if (p.mode === "bolt") {
                ctx.strokeStyle = "#f7f45f";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                if (p.target) ctx.lineTo(p.target.x, p.target.y);
                ctx.stroke();
              } else if (p.mode === "beam") {
                ctx.strokeStyle = p.color || "#d9d9d9";
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                if (p.target) ctx.lineTo(p.target.x, p.target.y);
                ctx.stroke();
              } else {
                ctx.fillStyle = p.color || "#ffffff";
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }

          function drawGameOver() {
            if (state.lives > 0) return;
            ctx.fillStyle = "rgba(0,0,0,0.72)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.font = "bold 52px system-ui";
            ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 20);
            ctx.font = "24px system-ui";
            ctx.fillText("Refresh to try again", canvas.width / 2, canvas.height / 2 + 24);
          }

          function tick() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            spawnEnemyTick();
            updateEnemies();
            updateAlliedTurrets();
            updateTowers();
            updateProjectiles();
            updateHud();

            drawPath();
            for (const tower of state.towers) drawTower(tower);
            drawAlliedTurrets();
            for (const enemy of state.enemies) drawEnemy(enemy);
            drawProjectiles();
            drawGameOver();
            requestAnimationFrame(tick);
          }

          function canPlaceTower(x, y) {
            const onPath = path.some((point, i) => {
              if (i === 0) return false;
              const a = path[i - 1];
              const b = point;
              const minX = Math.min(a.x, b.x) - 26;
              const maxX = Math.max(a.x, b.x) + 26;
              const minY = Math.min(a.y, b.y) - 26;
              const maxY = Math.max(a.y, b.y) + 26;
              return x >= minX && x <= maxX && y >= minY && y <= maxY;
            });
            if (onPath) return false;
            if (state.towers.some((tower) => distance(tower, { x, y }) < 34)) return false;
            return true;
          }

          canvas.addEventListener("click", (event) => {
            if (state.lives <= 0) return;
            const model = TOWERS.find((tower) => tower.id === state.selectedTower);
            if (!model || state.gold < model.cost) return;

            const rect = canvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) * (canvas.width / rect.width);
            const y = (event.clientY - rect.top) * (canvas.height / rect.height);
            if (!canPlaceTower(x, y)) return;

            state.gold -= model.cost;
            state.towers.push({ x, y, model, rangePx: model.range * RANGE_UNIT, cooldown: 0, stunTicks: 0 });
            updateHud();
            buildTowerMenu();
          });

          startWaveButton.addEventListener("click", startWave);
          buildTowerMenu();
          updateHud();
          requestAnimationFrame(tick);
        </script>
      </body>
    </html>
`;
}
