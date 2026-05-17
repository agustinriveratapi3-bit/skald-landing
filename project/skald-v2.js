// ═══════════════════════════════════════════════════════
// SKALD — scroll-driven scene engine
// ═══════════════════════════════════════════════════════

const TOTAL_SKALD = 180;
const TOTAL_HAND  = 50;
const TOTAL_FRAMES = TOTAL_SKALD + TOTAL_HAND;

// Stage timeline (vh units, cumulative)
const STAGES = [
  { name: 'hero-idle',       start: 0,    end: 50 },
  { name: 'rotation',        start: 50,   end: 410 },
  { name: 'hand',            start: 410,  end: 530 },
  { name: 'black',           start: 530,  end: 600 },
  { name: 'phrase-in',       start: 600,  end: 740 },
  { name: 'phrase-migrate',  start: 740,  end: 820 },
  { name: 'cards-rail',      start: 820,  end: 1050 },
  { name: 'portal-grow',     start: 1050, end: 1250 },
  { name: 'portal-problems', start: 1250, end: 1450 },
  { name: 'solution',        start: 1450, end: 1550 },
  { name: 'end',             start: 1550, end: 1600 },
];

// Cards — active progress windows within cards-rail stage (0..1)
const CARDS = [
  { i: 0, a: 0.00, b: 0.18 },
  { i: 1, a: 0.25, b: 0.43 },
  { i: 2, a: 0.50, b: 0.68 },
  { i: 3, a: 0.78, b: 99 }, // portal — stays active
];

// ── helpers ─────────────────────────────────────────────
const clamp  = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp   = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function stageProgress(name) {
  const s = STAGES.find(s => s.name === name);
  if (!s) return 0;
  const vh = window.innerHeight / 100;
  const scrollY = window.scrollY;
  return clamp((scrollY - s.start * vh) / ((s.end - s.start) * vh), 0, 1);
}

function stageActive(name) {
  const s = STAGES.find(s => s.name === name);
  if (!s) return false;
  const vh = window.innerHeight / 100;
  const y = window.scrollY;
  return y >= s.start * vh && y < s.end * vh;
}

// ── image preload ────────────────────────────────────────
const skaldImgs = new Array(TOTAL_SKALD);
const handImgs  = new Array(TOTAL_HAND);

let loadedCount = 0;
const loaderFill = document.getElementById('loaderFill');
const loaderStatus = document.getElementById('loaderStatus');
const loader = document.getElementById('loader');

function pad3(n) { return String(n).padStart(3, '0'); }

function loadImg(src, target, idx) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      target[idx] = img;
      loadedCount++;
      const pct = (loadedCount / TOTAL_FRAMES) * 100;
      loaderFill.style.right = (100 - pct) + '%';
      loaderStatus.textContent = `Cargando · ${Math.round(pct)}%`;
      resolve();
    };
    img.onerror = () => {
      loadedCount++;
      resolve();
    };
    img.src = src;
  });
}

async function preload() {
  const promises = [];
  // Critical frames first (priority loading)
  promises.push(loadImg(`assets/skald/frame_001.webp`, skaldImgs, 0));
  promises.push(loadImg(`assets/skald/frame_180.webp`, skaldImgs, 179));
  await Promise.all(promises);

  // Now everything else in parallel
  const rest = [];
  for (let i = 1; i < TOTAL_SKALD - 1; i++) {
    rest.push(loadImg(`assets/skald/frame_${pad3(i + 1)}.webp`, skaldImgs, i));
  }
  for (let i = 0; i < TOTAL_HAND; i++) {
    rest.push(loadImg(`assets/hand/hand_${pad3(i + 1)}.jpg`, handImgs, i));
  }
  await Promise.all(rest);
}

// ── canvas ───────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function drawCover(img) {
  // Cover-fit: fill viewport, crop if needed (like background-size: cover)
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const cr = cw / ch;
  const ir = iw / ih;
  let dw, dh, dx, dy;
  if (ir > cr) {
    // image wider than canvas — fit height, crop sides
    dh = ch;
    dw = dh * ir;
    dx = (cw - dw) / 2;
    dy = 0;
  } else {
    // image taller — fit width, crop top/bottom
    dw = cw;
    dh = dw / ir;
    dx = 0;
    dy = (ch - dh) / 2;
  }
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawBlack() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
}

// ── timecode ─────────────────────────────────────────────
function formatTC(secondsFloat) {
  const totalFrames = Math.floor(secondsFloat * 24);
  const hh = Math.floor(totalFrames / (24 * 60 * 60));
  const mm = Math.floor((totalFrames / (24 * 60)) % 60);
  const ss = Math.floor((totalFrames / 24) % 60);
  const ff = totalFrames % 24;
  const p = n => String(n).padStart(2, '0');
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(ff)}`;
}

// ── card positioning ─────────────────────────────────────
function updateCards(p) {
  CARDS.forEach(c => {
    const el = document.querySelector(`.card[data-i="${c.i}"]`);
    if (!el) return;

    let x, scale, opacity;
    const enter = 0.12;
    const exit = 0.12;

    if (p < c.a - enter) {
      x = 60; scale = 0.5; opacity = 0.22;
    } else if (p < c.a) {
      const t = (p - (c.a - enter)) / enter;
      const e = easeOut(t);
      x = lerp(60, 0, e);
      scale = lerp(0.5, 1, e);
      opacity = lerp(0.22, 1, e);
    } else if (p <= c.b) {
      x = 0; scale = 1; opacity = 1;
    } else if (p < c.b + exit) {
      const t = (p - c.b) / exit;
      const e = easeOut(t);
      x = lerp(0, -90, e);
      scale = lerp(1, 0.85, e);
      opacity = lerp(1, 0, e);
    } else {
      x = -90; scale = 0.85; opacity = 0;
    }

    el.style.setProperty('--x', `${x}vw`);
    el.style.setProperty('--s', scale.toFixed(3));
    el.style.setProperty('--o', opacity.toFixed(3));
  });
}

// ── stage overlays ───────────────────────────────────────
const els = {
  heroOverlay: document.getElementById('heroOverlay'),
  heroClaim: document.getElementById('heroClaim'),
  heroHint: document.getElementById('heroHint'),
  phraseStage: document.getElementById('phraseStage'),
  phrase: document.getElementById('phrase'),
  phraseCorner: document.getElementById('phraseCorner'),
  cardsStage: document.getElementById('cardsStage'),
  cardFrame: document.getElementById('cardFrame'),
  portalCard: document.querySelector('.card[data-i="3"]'),
  portalPointer: document.getElementById('portalPointer'),
  problems: document.querySelectorAll('.problem'),
  solutionStage: document.getElementById('solutionStage'),
  tc: document.getElementById('tc'),
  telemetry: document.getElementById('telemetry'),
  nav: document.getElementById('nav'),
};

let lastFrameIndex = -1;

function tick() {
  const heroP    = stageProgress('hero-idle');
  const rotP     = stageProgress('rotation');
  const handP    = stageProgress('hand');
  const blackP   = stageProgress('black');
  const phInP    = stageProgress('phrase-in');
  const phMigP   = stageProgress('phrase-migrate');
  const cardsP   = stageProgress('cards-rail');
  const portalGP = stageProgress('portal-grow');
  const portalPP = stageProgress('portal-problems');
  const solP     = stageProgress('solution');

  // ── canvas frame to draw ──
  let frameImg = null;
  if (stageActive('hero-idle') || (stageActive('rotation') && rotP < 0.01)) {
    frameImg = skaldImgs[0];
  } else if (stageActive('rotation')) {
    const idx = Math.min(TOTAL_SKALD - 1, Math.floor(rotP * (TOTAL_SKALD - 1)));
    frameImg = skaldImgs[idx];
  } else if (stageActive('hand')) {
    const idx = Math.min(TOTAL_HAND - 1, Math.floor(handP * (TOTAL_HAND - 1)));
    frameImg = handImgs[idx];
  } else if (stageActive('black') || stageActive('phrase-in') || stageActive('phrase-migrate') ||
             stageActive('cards-rail') || stageActive('portal-grow') || stageActive('portal-problems')) {
    frameImg = null; // canvas remains black
  } else if (stageActive('solution') || stageActive('end')) {
    frameImg = skaldImgs[0]; // SKALD as solution
  }

  if (frameImg) drawCover(frameImg);
  else drawBlack();

  // ── hero overlay (visible during hero-idle and start of rotation) ──
  const heroFade = clamp(1 - rotP / 0.06, 0, 1); // fades out as rotation starts
  els.heroOverlay.style.opacity = stageActive('hero-idle') ? 1 : heroFade;
  els.heroClaim.style.opacity = (stageActive('hero-idle') ? 1 : heroFade) * 1;
  els.heroHint.style.opacity = (stageActive('hero-idle') ? 1 : heroFade) * 1;
  // Apply blur as it fades
  const heroBlur = (1 - (stageActive('hero-idle') ? 1 : heroFade)) * 8;
  els.heroOverlay.style.filter = `blur(${heroBlur}px)`;
  els.heroClaim.style.filter = `blur(${heroBlur}px)`;

  // ── phrase stage (in + migrate) ──
  if (stageActive('phrase-in')) {
    els.phraseStage.classList.add('active');
    // X: from +120vw → 0
    const e = easeOut(phInP);
    const x = lerp(120, 0, e);
    els.phrase.style.transform = `translateX(${x}vw) scale(1)`;
    els.phrase.style.opacity = 1;
    els.phrase.style.filter = 'blur(0)';
    els.phraseCorner.classList.remove('in');
  } else if (stageActive('phrase-migrate')) {
    els.phraseStage.classList.add('active');
    // Shrink + fade
    const e = easeInOut(phMigP);
    const scale = lerp(1, 0.15, e);
    const op = lerp(1, 0, Math.min(1, phMigP * 1.6));
    els.phrase.style.transform = `translateX(0) scale(${scale})`;
    els.phrase.style.opacity = op;
    els.phrase.style.filter = `blur(${e * 6}px)`;
    if (phMigP > 0.4) els.phraseCorner.classList.add('in');
  } else if (stageActive('cards-rail') || stageActive('portal-grow') ||
             stageActive('portal-problems') || stageActive('solution') || stageActive('end')) {
    els.phraseStage.classList.remove('active');
    els.phraseCorner.classList.add('in');
  } else {
    els.phraseStage.classList.remove('active');
    els.phraseCorner.classList.remove('in');
  }

  // Hide phrase corner once we leave the cards/portal arc
  if (stageActive('solution') || stageActive('end')) {
    els.phraseCorner.classList.remove('in');
  }

  // ── cards rail ──
  if (stageActive('cards-rail')) {
    els.cardsStage.classList.add('active');
    els.cardFrame.classList.add('in');
    els.cardFrame.classList.remove('gone');
    updateCards(cardsP);
  } else if (stageActive('portal-grow') || stageActive('portal-problems')) {
    els.cardsStage.classList.add('active');
    els.cardFrame.classList.remove('in');
    els.cardFrame.classList.add('gone');
    // Hide non-portal cards
    document.querySelectorAll('.card:not(.card-portal)').forEach(el => {
      el.style.setProperty('--o', '0');
    });
  } else {
    els.cardsStage.classList.remove('active');
    els.cardFrame.classList.remove('in');
  }

  // ── portal grow ──
  if (stageActive('portal-grow') || stageActive('portal-problems')) {
    els.portalCard.classList.add('portal-active');

    // Scale from card size to viewport size
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const startW = Math.min(560, cw * 0.5);
    const startH = Math.min(700, ch * 0.64);
    let scale;
    if (stageActive('portal-grow')) {
      const e = easeInOut(portalGP);
      scale = lerp(1, Math.max(cw / startW, ch / startH), e);
    } else {
      scale = Math.max(cw / startW, ch / startH);
    }
    els.portalCard.style.transform = `translate(-50%, -50%) scale(${scale})`;
    els.portalCard.style.setProperty('--x', '0px');
    els.portalCard.style.setProperty('--s', '1');
    els.portalCard.style.setProperty('--o', '1');

    // Show pointer + first problem at end of portal-grow
    if (portalGP > 0.85) {
      els.portalPointer.classList.add('in');
    } else if (!stageActive('portal-problems')) {
      els.portalPointer.classList.remove('in');
    }
  } else if (stageActive('cards-rail')) {
    // Reset portal card
    els.portalCard.classList.remove('portal-active');
    els.portalCard.style.transform = '';
  }

  // ── problem cards (stagger reveal) ──
  if (stageActive('portal-problems')) {
    els.portalPointer.classList.add('in');
    els.problems.forEach((el, i) => {
      const threshold = i * 0.18 + 0.05;
      el.classList.toggle('in', portalPP > threshold);
    });
  } else if (stageActive('portal-grow')) {
    // hide problems until portal-problems stage
    els.problems.forEach(el => el.classList.remove('in'));
  } else if (stageActive('solution') || stageActive('end')) {
    // keep them in for continuity (or fade out — let solution stage handle)
  } else {
    els.problems.forEach(el => el.classList.remove('in'));
    els.portalPointer.classList.remove('in');
  }

  // ── fade portal scene as solution starts ──
  if (stageActive('solution') || stageActive('end')) {
    const fadeP = stageActive('solution') ? solP : 1;
    const op = Math.max(0, 1 - fadeP * 2);
    els.portalCard.style.opacity = op;
    els.cardsStage.style.opacity = op;
    els.solutionStage.classList.add('active');
  } else {
    els.portalCard.style.opacity = 1;
    els.cardsStage.style.opacity = stageActive('cards-rail') || stageActive('portal-grow') || stageActive('portal-problems') ? 1 : 0;
    els.solutionStage.classList.remove('active');
  }

  // ── telemetry timecode ──
  const totalScrollPx = document.documentElement.scrollHeight - window.innerHeight;
  const overallProgress = clamp(window.scrollY / totalScrollPx, 0, 1);
  // Map to seconds (1600vh of scroll = simulate ~67 seconds at 24fps)
  const seconds = overallProgress * 67;
  els.tc.textContent = formatTC(seconds);

  // Hide telemetry during solution
  els.telemetry.classList.toggle('hidden', stageActive('solution') || stageActive('end'));

  requestAnimationFrame(tick);
}

// ── cursor ───────────────────────────────────────────────
const cursor = document.getElementById('cursor');
let mx = 0, my = 0;
window.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursor.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
});
document.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
  el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
});

// ── on-load entrance ─────────────────────────────────────
function enterHero() {
  document.querySelector('.hero-label-left').classList.add('in');
  document.querySelector('.hero-label-right').classList.add('in');
  els.heroClaim.classList.add('in');
  els.heroHint.classList.add('in');
}

// ── boot ─────────────────────────────────────────────────
(async function init() {
  await preload();
  loader.classList.add('done');
  await new Promise(r => setTimeout(r, 200));
  enterHero();
  tick();
})();
