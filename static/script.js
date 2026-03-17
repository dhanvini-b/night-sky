const canvas = document.getElementById('sky');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const bgStars = [];
const messageStars = [];
let pendingClick = null;
let activeTooltip = null;
let t = 0;

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

// ── Star shape ─────────────────────────────────────────

function drawStar(x, y, outerR, innerR, alpha, color) {
  const points = 4;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color || '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 4;
    i === 0
      ? ctx.moveTo(x + r * Math.cos(angle), y + r * Math.sin(angle))
      : ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Background stars ───────────────────────────────────

function createBgStars() {
  for (let i = 0; i < 200; i++) {
    bgStars.push({
      x:     randomBetween(0, canvas.width),
      y:     randomBetween(0, canvas.height),
      size:  randomBetween(2, 6),
      phase: randomBetween(0, Math.PI * 2),
      speed: randomBetween(0.02, 0.06),
    });
  }
}

function drawBgStars() {
  bgStars.forEach(star => {
    const pulse  = (Math.sin(star.phase + t * star.speed) + 1) / 2;
    const outer  = star.size * (0.5 + 0.5 * pulse);
    const inner  = outer * 0.35;
    const alpha  = 0.3 + 0.7 * pulse;
    drawStar(star.x, star.y, outer, inner, alpha);
  });
}

// ── Moon ───────────────────────────────────────────────

function drawMoon() {
  const mx = canvas.width * 0.82;
  const my = canvas.height * 0.18;
  const r  = 58;

  // glow
  const glow = ctx.createRadialGradient(mx, my, r * 0.2, mx, my, r * 3);
  glow.addColorStop(0, 'rgba(255, 220, 100, 0.2)');
  glow.addColorStop(0.5, 'rgba(255, 200, 60, 0.06)');
  glow.addColorStop(1, 'rgba(255, 200, 60, 0)');
  ctx.beginPath();
  ctx.arc(mx, my, r * 3, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // offscreen canvas
  const size = r * 2 + 4;
  const off  = document.createElement('canvas');
  off.width  = size;
  off.height = size;
  const oc   = off.getContext('2d');
  const cx   = size / 2;
  const cy   = size / 2;

  // full golden circle
  const moonGrad = oc.createRadialGradient(
    cx + r * 0.15, cy - r * 0.2, r * 0.05,
    cx, cy, r
  );
  moonGrad.addColorStop(0, '#fff8d0');
  moonGrad.addColorStop(0.25, '#ffd84d');
  moonGrad.addColorStop(1, '#c47f00');
  oc.beginPath();
  oc.arc(cx, cy, r, 0, Math.PI * 2);
  oc.fillStyle = moonGrad;
  oc.fill();

  // punch out crescent
  oc.globalCompositeOperation = 'destination-out';
  oc.beginPath();
  oc.arc(cx + r * 0.38, cy, r * 0.92, 0, Math.PI * 2);
  oc.fillStyle = 'rgba(0,0,0,1)';
  oc.fill();

  // stamp onto main canvas with rotation
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(-0.4);          // anticlockwise — increase this for more tilt
  ctx.drawImage(off, -size / 2, -size / 2);
  ctx.restore();
}
// ── Message stars ──────────────────────────────────────

function drawMessageStars() {
  messageStars.forEach(star => {
    const x        = (star.x_percent / 100) * canvas.width;
    const y        = (star.y_percent / 100) * canvas.height;
    const isActive = activeTooltip && activeTooltip.id === star.id;
    const pulse    = (Math.sin(t * 0.04 + (star.id || 0) * 1.3) + 1) / 2;
    const outer    = isActive ? 10 + pulse * 3 : 7 + pulse * 2;
    const inner    = outer * 0.38;
    const alpha    = isActive ? 1 : 0.6 + 0.4 * pulse;

    // glow
    ctx.beginPath();
    ctx.arc(x, y, outer + 8, 0, Math.PI * 2);
    ctx.fillStyle = isActive
  ? 'rgba(255, 220, 100, 0.2)'
  : 'rgba(255, 200, 80, 0.08)';
    ctx.fill();

    drawStar(x, y, outer, inner, alpha, isActive ? '#fff4c2' : '#ffd97d');
  });
}

// ── Draw loop ──────────────────────────────────────────

function draw() {
  t++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#080c18');
  grad.addColorStop(1, '#0d1530');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawMoon();
  drawBgStars();
  drawMessageStars();

  requestAnimationFrame(draw);
}

// ── Load stars ─────────────────────────────────────────

async function loadStars() {
  try {
    const res  = await fetch(`/api/space/${SPACE_CODE}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      messageStars.length = 0;
      data.forEach(s => messageStars.push(s));
    }
  } catch (e) { console.error('could not load stars', e); }
}

setInterval(loadStars, 10000);

// ── Hit detection ──────────────────────────────────────

function findStarAt(x, y) {
  for (const star of messageStars) {
    const sx   = (star.x_percent / 100) * canvas.width;
    const sy   = (star.y_percent / 100) * canvas.height;
    const dist = Math.sqrt((x - sx) ** 2 + (y - sy) ** 2);
    if (dist < 18) return star;
  }
  return null;
}

// ── Tooltip ────────────────────────────────────────────

function showTooltip(star, x, y) {
  activeTooltip = star;
  const tooltip = document.getElementById('tooltip');
  document.getElementById('tooltip-message').textContent = star.message;
  document.getElementById('tooltip-author').textContent =
    star.author !== 'anonymous' ? `— ${star.author}` : '';

  let tx = x + 16, ty = y - 20;
  if (tx + 240 > canvas.width)  tx = x - 256;
  if (ty + 100 > canvas.height) ty = y - 110;

  tooltip.style.left = tx + 'px';
  tooltip.style.top  = ty + 'px';
  tooltip.classList.add('show');
}

function hideTooltip() {
  activeTooltip = null;
  document.getElementById('tooltip').classList.remove('show');
}

async function deleteStar() {
  if (!activeTooltip) return;

  const starId = activeTooltip.id;

  try {
    await fetch(`/api/space/${SPACE_CODE}/star/${starId}`, {
      method: 'DELETE'
    });

    // remove from local array immediately
    const idx = messageStars.findIndex(s => s.id === starId);
    if (idx !== -1) messageStars.splice(idx, 1);

    hideTooltip();
  } catch (e) {
    console.error('could not delete star', e);
  }
}

// ── Form ───────────────────────────────────────────────

function openForm(x, y) {
  pendingClick = { x, y };
  const form = document.getElementById('add-form');

  let fx = x + 16, fy = y - 20;
  if (fx + 260 > canvas.width)  fx = x - 260;
  if (fy + 180 > canvas.height) fy = y - 180;

  form.style.left = fx + 'px';
  form.style.top  = fy + 'px';
  form.classList.add('show');
  document.getElementById('form-message').focus();
}

function closeForm() {
  pendingClick = null;
  document.getElementById('add-form').classList.remove('show');
  document.getElementById('form-message').value = '';
  document.getElementById('form-author').value  = '';
}

async function submitStar() {
  const message = document.getElementById('form-message').value.trim();
  const author  = document.getElementById('form-author').value.trim();
  if (!message || !pendingClick) return;

  const x_percent = (pendingClick.x / canvas.width)  * 100;
  const y_percent = (pendingClick.y / canvas.height) * 100;

  try {
    const res = await fetch(`/api/space/${SPACE_CODE}/star`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message, author, x_percent, y_percent })
    });
    const newStar = await res.json();
    messageStars.push(newStar);
    closeForm();
  } catch (e) { console.error('could not add star', e); }
}

// ── Events ─────────────────────────────────────────────

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (document.getElementById('add-form').classList.contains('show')) {
    closeForm(); return;
  }

  const hit = findStarAt(x, y);
  if (hit) {
    activeTooltip && activeTooltip.id === hit.id
      ? hideTooltip()
      : (hideTooltip(), showTooltip(hit, x, y));
    return;
  }

  hideTooltip();
  openForm(x, y);
});

document.getElementById('tooltip').addEventListener('click', e => {
  e.stopPropagation();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { hideTooltip(); closeForm(); }
});

function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    const el = document.getElementById('copied');
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  });
}

window.addEventListener('resize', () => {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  bgStars.length = 0;
  createBgStars();
});

// ── Init ───────────────────────────────────────────────

createBgStars();
loadStars();
draw();