export function renderHtml() {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Tiny Tower Defense</title>
        <style>
          :root {
            color-scheme: dark;
            --bg: #10131a;
            --panel: #1a2230;
            --text: #f2f6ff;
            --accent: #57cc99;
            --danger: #ef476f;
            --path: #f4a261;
          }

          * {
            box-sizing: border-box;
            font-family: Inter, system-ui, sans-serif;
          }

          body {
            margin: 0;
            background: radial-gradient(circle at top, #1d2b42, var(--bg));
            color: var(--text);
            min-height: 100vh;
            display: grid;
            place-items: center;
          }

          .layout {
            width: min(96vw, 920px);
            display: grid;
            gap: 14px;
          }

          h1 {
            margin: 0;
            font-size: 1.3rem;
          }

          .hud {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            padding: 12px 14px;
            background: var(--panel);
            border-radius: 12px;
            border: 1px solid #2f3a52;
          }

          .stats {
            display: flex;
            gap: 14px;
            flex-wrap: wrap;
            font-size: 0.95rem;
          }

          button {
            border: 0;
            border-radius: 8px;
            background: var(--accent);
            color: #052111;
            font-weight: 700;
            padding: 10px 12px;
            cursor: pointer;
          }

          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          canvas {
            width: 100%;
            height: auto;
            background: #0f1724;
            border-radius: 12px;
            border: 1px solid #344160;
          }

          .hint {
            margin: 0;
            opacity: 0.85;
            font-size: 0.9rem;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="layout">
          <div class="hud">
            <h1>🛡️ Tiny Tower Defense</h1>
            <div class="stats">
              <span>❤️ Lives: <strong id="lives">15</strong></span>
              <span>💰 Gold: <strong id="gold">140</strong></span>
              <span>🌊 Wave: <strong id="wave">0</strong></span>
              <span>👾 Enemies: <strong id="enemies">0</strong></span>
            </div>
            <button id="startWave">Start wave</button>
          </div>
          <canvas id="game" width="900" height="520"></canvas>
          <p class="hint">Click to place a tower (cost 40). Keep enemies from reaching the right edge.</p>
        </div>

        <script>
          const canvas = document.getElementById("game");
          const ctx = canvas.getContext("2d");

          const livesEl = document.getElementById("lives");
          const goldEl = document.getElementById("gold");
          const waveEl = document.getElementById("wave");
          const enemiesEl = document.getElementById("enemies");
          const startWaveButton = document.getElementById("startWave");

          const path = [
            { x: 0, y: 260 },
            { x: 200, y: 260 },
            { x: 200, y: 120 },
            { x: 480, y: 120 },
            { x: 480, y: 360 },
            { x: 700, y: 360 },
            { x: 700, y: 220 },
            { x: 900, y: 220 },
          ];

          const state = {
            lives: 15,
            gold: 140,
            wave: 0,
            towers: [],
            enemies: [],
            projectiles: [],
            spawning: false,
            spawnQueue: 0,
            spawnCooldown: 0,
          };

          function distance(a, b) {
            return Math.hypot(a.x - b.x, a.y - b.y);
          }

          function updateHud() {
            livesEl.textContent = state.lives;
            goldEl.textContent = state.gold;
            waveEl.textContent = state.wave;
            enemiesEl.textContent = state.enemies.length;
            startWaveButton.disabled = state.spawning || state.enemies.length > 0 || state.lives <= 0;
          }

          function createEnemy(wave) {
            return {
              x: path[0].x,
              y: path[0].y,
              hp: 30 + wave * 10,
              speed: 1 + wave * 0.05,
              pathIndex: 1,
              reward: 12,
            };
          }

          function startWave() {
            if (state.spawning || state.lives <= 0) return;
            state.wave += 1;
            state.spawning = true;
            state.spawnQueue = 8 + state.wave * 3;
            state.spawnCooldown = 0;
            updateHud();
          }

          function spawnEnemyTick() {
            if (!state.spawning) return;
            state.spawnCooldown -= 1;
            if (state.spawnCooldown > 0) return;

            if (state.spawnQueue > 0) {
              state.enemies.push(createEnemy(state.wave));
              state.spawnQueue -= 1;
              state.spawnCooldown = 26;
            } else {
              state.spawning = false;
            }
          }

          function updateEnemies() {
            for (let i = state.enemies.length - 1; i >= 0; i--) {
              const enemy = state.enemies[i];
              const target = path[enemy.pathIndex];
              if (!target) {
                state.enemies.splice(i, 1);
                state.lives -= 1;
                continue;
              }

              const dx = target.x - enemy.x;
              const dy = target.y - enemy.y;
              const len = Math.hypot(dx, dy);
              if (len < enemy.speed) {
                enemy.x = target.x;
                enemy.y = target.y;
                enemy.pathIndex += 1;
              } else {
                enemy.x += (dx / len) * enemy.speed;
                enemy.y += (dy / len) * enemy.speed;
              }

              if (enemy.hp <= 0) {
                state.enemies.splice(i, 1);
                state.gold += enemy.reward;
              }
            }
          }

          function updateTowers() {
            for (const tower of state.towers) {
              tower.cooldown -= 1;
              if (tower.cooldown > 0) continue;

              let target = null;
              let furthestPath = -1;
              for (const enemy of state.enemies) {
                if (distance(tower, enemy) <= tower.range) {
                  if (enemy.pathIndex > furthestPath) {
                    furthestPath = enemy.pathIndex;
                    target = enemy;
                  }
                }
              }

              if (!target) continue;
              tower.cooldown = tower.fireRate;
              state.projectiles.push({
                x: tower.x,
                y: tower.y,
                target,
                speed: 5,
                damage: tower.damage,
              });
            }
          }

          function updateProjectiles() {
            for (let i = state.projectiles.length - 1; i >= 0; i--) {
              const projectile = state.projectiles[i];
              if (!state.enemies.includes(projectile.target)) {
                state.projectiles.splice(i, 1);
                continue;
              }

              const dx = projectile.target.x - projectile.x;
              const dy = projectile.target.y - projectile.y;
              const len = Math.hypot(dx, dy);
              if (len < projectile.speed + 2) {
                projectile.target.hp -= projectile.damage;
                state.projectiles.splice(i, 1);
              } else {
                projectile.x += (dx / len) * projectile.speed;
                projectile.y += (dy / len) * projectile.speed;
              }
            }
          }

          function drawPath() {
            ctx.strokeStyle = "#f4a261";
            ctx.lineWidth = 34;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
              ctx.lineTo(path[i].x, path[i].y);
            }
            ctx.stroke();
          }

          function drawTowers() {
            for (const tower of state.towers) {
              ctx.fillStyle = "#90e0ef";
              ctx.beginPath();
              ctx.arc(tower.x, tower.y, 16, 0, Math.PI * 2);
              ctx.fill();

              ctx.strokeStyle = "rgba(144, 224, 239, 0.22)";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
              ctx.stroke();
            }
          }

          function drawEnemies() {
            for (const enemy of state.enemies) {
              ctx.fillStyle = "#ef476f";
              ctx.beginPath();
              ctx.arc(enemy.x, enemy.y, 13, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = "#111";
              ctx.fillRect(enemy.x - 14, enemy.y - 20, 28, 4);
              ctx.fillStyle = "#57cc99";
              const hpPercent = Math.max(enemy.hp, 0) / (30 + state.wave * 10);
              ctx.fillRect(enemy.x - 14, enemy.y - 20, 28 * hpPercent, 4);
            }
          }

          function drawProjectiles() {
            for (const p of state.projectiles) {
              ctx.fillStyle = "#fff";
              ctx.beginPath();
              ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
              ctx.fill();
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
            updateTowers();
            updateProjectiles();
            updateHud();

            drawPath();
            drawTowers();
            drawEnemies();
            drawProjectiles();
            drawGameOver();

            requestAnimationFrame(tick);
          }

          canvas.addEventListener("click", (event) => {
            if (state.lives <= 0 || state.gold < 40) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (event.clientX - rect.left) * scaleX;
            const y = (event.clientY - rect.top) * scaleY;

            const isOnPath = path.some((point, i) => {
              if (i === 0) return false;
              const a = path[i - 1];
              const b = point;
              const minX = Math.min(a.x, b.x) - 24;
              const maxX = Math.max(a.x, b.x) + 24;
              const minY = Math.min(a.y, b.y) - 24;
              const maxY = Math.max(a.y, b.y) + 24;
              return x >= minX && x <= maxX && y >= minY && y <= maxY;
            });

            const isNearTower = state.towers.some((tower) => distance(tower, { x, y }) < 34);
            if (isOnPath || isNearTower) return;

            state.gold -= 40;
            state.towers.push({ x, y, range: 130, fireRate: 32, cooldown: 0, damage: 12 });
            updateHud();
          });

          startWaveButton.addEventListener("click", startWave);
          updateHud();
          requestAnimationFrame(tick);
        </script>
      </body>
    </html>
`;
}
