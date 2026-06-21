(function () {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const W = 800;
  const H = 600;

  // ── Brick grid config ──────────────────────────────────────────────────────
  const COLS = 8;
  const ROWS = 5;
  const BRICK_W = 80;
  const BRICK_H = 24;
  const BRICK_PAD = 8;
  const BRICK_TOP = 60;
  const BRICK_LEFT = (W - (COLS * (BRICK_W + BRICK_PAD) - BRICK_PAD)) / 2;

  // [intact, damaged] — flat colours, no gradients
  const ROW_COLORS = [
    ['#1c3347', '#2e5270'],  // row 0 — steel blue (2-hit)
    ['#26163a', '#46296e'],  // row 1 — plum (2-hit)
    ['#1a2e1c', '#2e5230'],  // row 2 — forest (2-hit)
    ['#6b2d18', '#6b2d18'],  // row 3 — sienna (1-hit)
    ['#1a496b', '#1a496b'],  // row 4 — ocean (1-hit)
  ];
  const DOUBLE_HIT_ROWS = 3; // rows 0..2 require 2 hits

  // ── State ──────────────────────────────────────────────────────────────────
  let state = 'IDLE'; // IDLE | PLAYING | WIN | LOSE
  let score = 0;
  let lives = 3;
  let bricksDestroyed = 0;

  // ── Input ──────────────────────────────────────────────────────────────────
  const keys = {};
  let mouseX = W / 2;

  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      handleAction();
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    mouseX = (e.clientX - rect.left) * scaleX;
  });
  canvas.addEventListener('click', handleAction);
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    mouseX = (e.touches[0].clientX - rect.left) * scaleX;
  }, { passive: false });
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    handleAction();
  }, { passive: false });

  function handleAction() {
    if (state === 'IDLE') {
      startGame();
    } else if (state === 'WIN' || state === 'LOSE') {
      resetGame();
    } else if (state === 'PLAYING' && ball.stuck) {
      ball.launch();
    }
  }

  // ── Paddle ─────────────────────────────────────────────────────────────────
  const paddle = {
    w: 110,
    h: 14,
    x: W / 2,
    y: H - 40,
    speed: 7,

    update() {
      if (keys['ArrowLeft'])  mouseX = Math.max(this.w / 2, mouseX - this.speed);
      if (keys['ArrowRight']) mouseX = Math.min(W - this.w / 2, mouseX + this.speed);
      this.x = clamp(mouseX, this.w / 2, W - this.w / 2);
    },

    draw() {
      ctx.fillStyle = '#d4d4d4';
      ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
    }
  };

  // ── Ball ───────────────────────────────────────────────────────────────────
  const ball = {
    r: 8,
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    baseSpeed: 5,
    speed: 5,
    stuck: true,

    reset() {
      this.x = paddle.x;
      this.y = paddle.y - paddle.h / 2 - this.r - 1;
      this.dx = 0;
      this.dy = 0;
      this.stuck = true;
    },

    launch() {
      const angle = -Math.PI / 2 + (Math.random() * 0.6 - 0.3);
      this.dx = Math.cos(angle) * this.speed;
      this.dy = Math.sin(angle) * this.speed;
      this.stuck = false;
    },

    update() {
      if (this.stuck) {
        this.x = paddle.x;
        this.y = paddle.y - paddle.h / 2 - this.r - 1;
        return;
      }

      this.x += this.dx;
      this.y += this.dy;

      // Wall collisions
      if (this.x - this.r < 0) { this.x = this.r; this.dx = Math.abs(this.dx); }
      if (this.x + this.r > W) { this.x = W - this.r; this.dx = -Math.abs(this.dx); }
      if (this.y - this.r < 0) { this.y = this.r; this.dy = Math.abs(this.dy); }

      // Paddle collision
      if (
        this.dy > 0 &&
        this.x > paddle.x - paddle.w / 2 - this.r &&
        this.x < paddle.x + paddle.w / 2 + this.r &&
        this.y + this.r >= paddle.y - paddle.h / 2 &&
        this.y - this.r <= paddle.y + paddle.h / 2
      ) {
        this.y = paddle.y - paddle.h / 2 - this.r;
        // Angle varies based on hit position relative to paddle center
        const offset = (this.x - paddle.x) / (paddle.w / 2);
        const angle = offset * (Math.PI / 3); // max ±60°
        this.dx = Math.sin(angle) * this.speed;
        this.dy = -Math.abs(Math.cos(angle) * this.speed);
      }

      // Fell off bottom
      if (this.y - this.r > H) {
        lives--;
        if (lives <= 0) {
          state = 'LOSE';
        } else {
          this.reset();
        }
      }
    },

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  };

  // ── Bricks ─────────────────────────────────────────────────────────────────
  let bricks = [];

  function buildBricks() {
    bricks = [];
    for (let row = 0; row < ROWS; row++) {
      bricks[row] = [];
      const maxHits = row < DOUBLE_HIT_ROWS ? 2 : 1;
      for (let col = 0; col < COLS; col++) {
        bricks[row][col] = {
          hits: maxHits,
          maxHits,
          active: true,
          colors: ROW_COLORS[row],
        };
      }
    }
  }

  function drawBricks() {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const b = bricks[row][col];
        if (!b.active) continue;

        const x = BRICK_LEFT + col * (BRICK_W + BRICK_PAD);
        const y = BRICK_TOP + row * (BRICK_H + BRICK_PAD);
        const colorIdx = b.hits < b.maxHits ? 1 : 0;

        ctx.fillStyle = b.colors[colorIdx];
        roundRect(ctx, x, y, BRICK_W, BRICK_H, 3);
        ctx.fill();

        // Crack line on damaged double-hit bricks
        if (b.maxHits === 2 && b.hits === 1) {
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + BRICK_W * 0.3, y + 4);
          ctx.lineTo(x + BRICK_W * 0.55, y + BRICK_H - 4);
          ctx.stroke();
        }
      }
    }
  }

  function checkBrickCollisions() {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const b = bricks[row][col];
        if (!b.active) continue;

        const bx = BRICK_LEFT + col * (BRICK_W + BRICK_PAD);
        const by = BRICK_TOP + row * (BRICK_H + BRICK_PAD);

        // AABB + circle overlap check
        const nearX = clamp(ball.x, bx, bx + BRICK_W);
        const nearY = clamp(ball.y, by, by + BRICK_H);
        const dx = ball.x - nearX;
        const dy = ball.y - nearY;

        if (dx * dx + dy * dy > ball.r * ball.r) continue;

        // Determine which face was hit using overlap on each axis
        const overlapX = Math.min(ball.x + ball.r - bx, bx + BRICK_W - ball.x + ball.r);
        const overlapY = Math.min(ball.y + ball.r - by, by + BRICK_H - ball.y + ball.r);

        if (overlapX < overlapY) {
          ball.dx = -ball.dx;
          ball.x += ball.dx > 0 ? overlapX : -overlapX;
        } else {
          ball.dy = -ball.dy;
          ball.y += ball.dy > 0 ? overlapY : -overlapY;
        }

        b.hits--;
        if (b.hits <= 0) {
          b.active = false;
          bricksDestroyed++;
          score += b.maxHits === 2 ? 15 : 10;

          // Speed bonus every 5 bricks
          if (bricksDestroyed % 5 === 0) {
            score += 50;
            ball.speed = Math.min(ball.baseSpeed + bricksDestroyed * 0.1, 12);
            const mag = Math.hypot(ball.dx, ball.dy);
            ball.dx = (ball.dx / mag) * ball.speed;
            ball.dy = (ball.dy / mag) * ball.speed;
          }

          if (allBricksCleared()) state = 'WIN';
        } else {
          score += 5; // first hit on double-hit brick
        }

        return; // one brick per frame to avoid tunnelling through edges
      }
    }
  }

  function allBricksCleared() {
    return bricks.every(row => row.every(b => !b.active));
  }

  // ── HUD ────────────────────────────────────────────────────────────────────
  function drawHUD() {
    ctx.save();
    ctx.font = '13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';

    ctx.textAlign = 'left';
    ctx.fillText('score', 20, 22);
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(score, 20, 46);

    // Lives as small dots
    const dotR = 4;
    const dotY = 34;
    const dotSpacing = 14;
    const dotsStart = W - 20 - (3 - 1) * dotSpacing;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(dotsStart + i * dotSpacing, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i < lives ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.12)';
      ctx.fill();
    }

    ctx.restore();
  }

  // ── Overlay screens ────────────────────────────────────────────────────────
  function drawOverlay(title, subtitle, sub2) {
    ctx.save();
    ctx.fillStyle = 'rgba(14, 14, 14, 0.82)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';

    ctx.font = '500 40px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(title, W / 2, H / 2 - 28);

    ctx.font = '18px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(subtitle, W / 2, H / 2 + 14);

    if (sub2) {
      ctx.font = '13px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillText(sub2, W / 2, H / 2 + 46);
    }

    ctx.restore();
  }

  function drawIdleScreen() {
    ctx.save();
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';

    ctx.font = '300 48px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillText('brick breaker', W / 2, H / 2 - 20);

    ctx.font = '13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillText('space or click to play  ·  ← → or mouse to move', W / 2, H / 2 + 24);

    ctx.restore();
  }

  // ── Game lifecycle ─────────────────────────────────────────────────────────
  function startGame() {
    state = 'PLAYING';
    score = 0;
    lives = 3;
    bricksDestroyed = 0;
    ball.baseSpeed = 5;
    ball.speed = 5;
    buildBricks();
    paddle.x = W / 2;
    ball.reset();
  }

  function resetGame() {
    state = 'IDLE';
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    ctx.lineTo(x + w, y + h - r);
    ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
    ctx.closePath();
  }

  // ── Main loop ──────────────────────────────────────────────────────────────
  let lastTime = 0;

  function loop(ts) {
    const dt = Math.min(ts - lastTime, 50);
    lastTime = ts;

    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(0, 0, W, H);

    if (state === 'IDLE') {
      drawIdleScreen();
    } else if (state === 'PLAYING') {
      paddle.update();
      ball.update();
      if (state === 'PLAYING') checkBrickCollisions(); // state may change in update
      drawBricks();
      paddle.draw();
      ball.draw();
      drawHUD();
      if (ball.stuck) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '13px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillText('space or click to launch', W / 2, H - 16);
        ctx.restore();
      }
    } else if (state === 'WIN') {
      drawBricks();
      paddle.draw();
      drawHUD();
      drawOverlay('YOU WIN!', `Final Score: ${score}`, 'SPACE or click to play again');
    } else if (state === 'LOSE') {
      drawBricks();
      paddle.draw();
      drawHUD();
      drawOverlay('GAME OVER', `Score: ${score}`, 'SPACE or click to try again');
    }

    requestAnimationFrame(loop);
  }

  buildBricks();
  requestAnimationFrame(loop);
})();
