// ═══════════════════════════════════════════════════════
// SKALD — scroll-driven scene engine v2
// ═══════════════════════════════════════════════════════

const TOTAL_SKALD = 180;
const TOTAL_HAND  = 50;
const TOTAL_CLIENT = 144;
const TOTAL_FRAMES = TOTAL_SKALD + TOTAL_HAND + TOTAL_CLIENT;

// Stage timeline (vh units, cumulative). Matches spacers in HTML.
const STAGES = [
  { name: 'hero-idle',       start: 0,    end: 50 },
  { name: 'rotation',        start: 50,   end: 410 },
  { name: 'hand',            start: 410,  end: 650 },    // 240vh — slower hand
  { name: 'black',           start: 650,  end: 710 },
  { name: 'phrase-in',       start: 710,  end: 850 },    // phrase enters from right
  { name: 'phrase-hold',     start: 850,  end: 1080 },   // 230vh — hold + migrate
  { name: 'cards-rail',      start: 1080, end: 1660 },   // 580vh — slower
  { name: 'portal-grow',     start: 1660, end: 1840 },
  { name: 'portal-problems', start: 1840, end: 2320 },   // 480vh — 4 problems, several seconds each
  { name: 'ending',          start: 2320, end: 2480 },   // 160vh — panel out, then SKALD in
  { name: 'end',             start: 2480, end: 2530 },
];

// Cards — each card has a HOLD WINDOW where it sits in the centre frame.
// Before the window, card is in right stack; after, it's in left stack.
// The enter/exit transitions are smooth ramps OUTSIDE the hold window.
const CARDS = [
  { i: 0, holdStart: 0.04, holdEnd: 0.18 },
  { i: 1, holdStart: 0.28, holdEnd: 0.42 },
  { i: 2, holdStart: 0.52, holdEnd: 0.66 },
  { i: 3, holdStart: 0.78, holdEnd: 99 }, // portal — never exits during cards-rail (portal-grow takes over)
];
const CARD_RAMP = 0.10; // progress span for enter/exit transitions

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
const skaldImgs  = new Array(TOTAL_SKALD);
const handImgs   = new Array(TOTAL_HAND);
const clientImgs = new Array(TOTAL_CLIENT);

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
  // Critical first
  await Promise.all([
    loadImg(`assets/skald/frame_001.webp`, skaldImgs, 0),
    loadImg(`assets/skald/frame_180.webp`, skaldImgs, 179),
  ]);

  // Everything else in parallel
  const rest = [];
  for (let i = 1; i < TOTAL_SKALD - 1; i++) {
    rest.push(loadImg(`assets/skald/frame_${pad3(i + 1)}.webp`, skaldImgs, i));
  }
  for (let i = 0; i < TOTAL_HAND; i++) {
    rest.push(loadImg(`assets/hand/hand_${pad3(i + 1)}.jpg`, handImgs, i));
  }
  for (let i = 0; i < TOTAL_CLIENT; i++) {
    rest.push(loadImg(`assets/client/frame_${pad3(i + 1)}.webp`, clientImgs, i));
  }
  await Promise.all(rest);
}

// ── canvas ───────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Client video canvas — lives inside portal card body, NOT fixed to viewport
const clientCanvas = document.getElementById('clientCanvas');
const clientCtx = clientCanvas ? clientCanvas.getContext('2d') : null;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // clientCanvas size is managed per-frame inside the tick (matches card body size)
}
window.addEventListener('resize', resize);
resize();

function drawCover(img, targetCtx) {
  const c = targetCtx || ctx;
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const cr = cw / ch;
  const ir = iw / ih;
  let dw, dh, dx, dy;
  if (ir > cr) {
    dh = ch;
    dw = dh * ir;
    dx = (cw - dw) / 2;
    dy = 0;
  } else {
    dw = cw;
    dh = dw / ir;
    dx = 0;
    dy = (ch - dh) / 2;
  }
  c.clearRect(0, 0, cw, ch);
  c.drawImage(img, dx, dy, dw, dh);
}

// Draw an image cover-fit into a canvas whose own dimensions are cw × ch.
function drawCoverToCanvas(img, cw, ch, c) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const cr = cw / ch;
  const ir = iw / ih;
  let dw, dh, dx, dy;
  if (ir > cr) {
    dh = ch;
    dw = dh * ir;
    dx = (cw - dw) / 2;
    dy = 0;
  } else {
    dw = cw;
    dh = dw / ir;
    dx = 0;
    dy = (ch - dh) / 2;
  }
  c.clearRect(0, 0, cw, ch);
  c.drawImage(img, dx, dy, dw, dh);
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

// ── cards positioning ───────────────────────────────────
// New behavior: cards move continuously from right stack → center → left stack.
// Each card has a "peak" point (when it's centered in the frame).
// Before peak: card is on the right, smaller, dim.
// At peak: card is in center, full size, full opacity.
// After peak: card is on the left, smaller, dim.
function updateCards(p) {
  // Side-stack positions: keep cards inside the viewport on smaller screens
  const SIDE_X = 42;       // vw — where stack cards sit
  const STACK_STEP = 4;    // additional offset for cards further from peak
  const STACK_SCALE = 0.28;
  const STACK_OPACITY = 0.18;

  CARDS.forEach((c) => {
    const el = document.querySelector(`.card[data-i="${c.i}"]`);
    if (!el) return;

    let x, scale, opacity;

    if (p < c.holdStart - CARD_RAMP) {
      // Way before hold — right stack
      const stackPos = (c.holdStart - CARD_RAMP - p) / CARD_RAMP; // >0 increases
      x = SIDE_X + Math.min(stackPos, 1.5) * STACK_STEP;
      scale = STACK_SCALE;
      opacity = STACK_OPACITY;
    } else if (p < c.holdStart) {
      // Entering — right stack → center frame (linear: constant velocity)
      const t = (p - (c.holdStart - CARD_RAMP)) / CARD_RAMP; // 0 → 1
      x = lerp(SIDE_X, 0, t);
      scale = lerp(STACK_SCALE, 1, t);
      opacity = lerp(STACK_OPACITY, 1, t);
    } else if (p <= c.holdEnd) {
      // HOLD — fully centered in the frame
      x = 0;
      scale = 1;
      opacity = 1;
    } else if (p <= c.holdEnd + CARD_RAMP) {
      // Exiting — center frame → left stack (linear)
      const t = (p - c.holdEnd) / CARD_RAMP; // 0 → 1
      x = lerp(0, -SIDE_X, t);
      scale = lerp(1, STACK_SCALE, t);
      opacity = lerp(1, STACK_OPACITY, t);
    } else {
      // Way after hold — left stack
      const stackPos = (p - (c.holdEnd + CARD_RAMP)) / CARD_RAMP;
      x = -SIDE_X - Math.min(stackPos, 1.5) * STACK_STEP;
      scale = STACK_SCALE;
      opacity = STACK_OPACITY;
    }

    el.style.setProperty('--x', `${x}vw`);
    el.style.setProperty('--s', scale.toFixed(3));
    el.style.setProperty('--o', opacity.toFixed(3));
    // Stack order: card 0 on top of the right-stack pile, portal (3) underneath.
    el.style.zIndex = String(10 - c.i);
  });
}

// ── elements ─────────────────────────────────────────────
const els = {
  heroOverlay: document.getElementById('heroOverlay'),
  heroClaim: document.getElementById('heroClaim'),
  heroHint: document.getElementById('heroHint'),
  phraseStage: document.getElementById('phraseStage'),
  phraseWrap: document.getElementById('phraseWrap'),
  phraseSmall: document.getElementById('phraseSmall'),
  phraseBig: document.getElementById('phraseBig'),
  cardsStage: document.getElementById('cardsStage'),
  cardFrame: document.getElementById('cardFrame'),
  portalCard: document.querySelector('.card[data-i="3"]'),
  problemsPanel: document.getElementById('problemsPanel'),
  problemItems: document.querySelectorAll('.problem-item'),
  problemNumIdx: document.getElementById('problemNumIdx'),
  endingStage: document.getElementById('endingStage'),
  tc: document.getElementById('tc'),
  telemetry: document.getElementById('telemetry'),
  nav: document.getElementById('nav'),
  vignette: document.getElementById('vignette'),
  grain: document.getElementById('grain'),
};

function tick() {
  const heroP    = stageProgress('hero-idle');
  const rotP     = stageProgress('rotation');
  const handP    = stageProgress('hand');
  const blackP   = stageProgress('black');
  const phInP    = stageProgress('phrase-in');
  const phHoldP  = stageProgress('phrase-hold');
  const cardsP   = stageProgress('cards-rail');
  const portalGP = stageProgress('portal-grow');
  const portalPP = stageProgress('portal-problems');
  const endP     = stageProgress('ending');

  // ── canvas frame ──
  let frameImg = null;
  if (stageActive('hero-idle')) {
    frameImg = skaldImgs[0];
  } else if (stageActive('rotation')) {
    const idx = Math.min(TOTAL_SKALD - 1, Math.floor(rotP * (TOTAL_SKALD - 1)));
    frameImg = skaldImgs[idx];
  } else if (stageActive('hand')) {
    const idx = Math.min(TOTAL_HAND - 1, Math.floor(handP * (TOTAL_HAND - 1)));
    frameImg = handImgs[idx];
  } else {
    frameImg = null; // black for everything after
  }

  if (frameImg) drawCover(frameImg);
  else drawBlack();

  // ── client video canvas (lives inside portal card body, acts like a photo) ──
  if (clientCtx) {
    const portalBody = document.getElementById('portalBody');

    const showClient = stageActive('cards-rail') || stageActive('portal-grow') ||
                       stageActive('portal-problems') || stageActive('ending');

    let clientFrameIdx = null;
    if (stageActive('cards-rail')) {
      clientFrameIdx = 0;
    } else if (stageActive('portal-grow')) {
      clientFrameIdx = Math.floor(portalGP * 72);
    } else if (stageActive('portal-problems')) {
      clientFrameIdx = 72 + Math.floor(portalPP * (TOTAL_CLIENT - 72 - 1));
    } else if (stageActive('ending')) {
      clientFrameIdx = TOTAL_CLIENT - 1;
    }

    const img = clientFrameIdx !== null ? clientImgs[clientFrameIdx] : null;

    if (img && portalBody && showClient) {
      // Sync canvas pixel size to card body's layout size (DPR for crispness).
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const bw = portalBody.offsetWidth;
      const bh = portalBody.offsetHeight;
      const targetW = Math.round(bw * dpr);
      const targetH = Math.round(bh * dpr);
      if (clientCanvas.width !== targetW || clientCanvas.height !== targetH) {
        clientCanvas.width  = targetW;
        clientCanvas.height = targetH;
        clientCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      drawCoverToCanvas(img, bw, bh, clientCtx);
      clientCanvas.style.opacity = '1';
    } else {
      clientCanvas.style.opacity = '0';
    }
  }

  // ── canvas FX class (stage-aware filter for perceived quality) ──
  if (stageActive('hero-idle') || stageActive('rotation')) {
    canvas.classList.add('fx-skald');
    canvas.classList.remove('fx-hand');
  } else if (stageActive('hand')) {
    canvas.classList.add('fx-hand');
    canvas.classList.remove('fx-skald');
  } else {
    canvas.classList.remove('fx-skald', 'fx-hand');
  }

  // ── VSL trigger visibility (only during hero stages) ──
  const vslTrigger = document.getElementById('vslTrigger');
  if (vslTrigger) {
    const showVsl = stageActive('hero-idle') || (stageActive('rotation') && rotP < 0.08);
    vslTrigger.classList.toggle('out', !showVsl);
  }

  // ── hero overlay (visible during hero-idle, fades as rotation starts) ──
  const heroFadeT = stageActive('hero-idle') ? 1 : clamp(1 - rotP / 0.06, 0, 1);
  els.heroOverlay.style.opacity = heroFadeT;
  els.heroClaim.style.opacity = heroFadeT;
  els.heroHint.style.opacity = heroFadeT;
  const heroBlur = (1 - heroFadeT) * 8;
  els.heroOverlay.style.filter = `blur(${heroBlur}px)`;
  els.heroClaim.style.filter = `blur(${heroBlur}px)`;

  // ── phrase stage: enters, holds, then shrinks+moves to top-left ──
  if (stageActive('phrase-in')) {
    els.phraseStage.classList.add('active');
    const e = easeOut(phInP);
    const x = lerp(120, 0, e); // from right (vw)
    els.phraseWrap.style.transformOrigin = '50% 50%';
    els.phraseWrap.style.transform = `translateX(${x}vw) scale(1)`;
    els.phraseWrap.style.opacity = 1;
    // No glow during entry — starts when phrase is fully in place
    els.phraseBig.style.setProperty('--glow', '0');
    els.phraseBig.style.setProperty('--gx', '150%');
  } else if (stageActive('phrase-hold')) {
    els.phraseStage.classList.add('active');

    // Two phases inside phrase-hold:
    //  0.00 — 0.55 → phrase held in center, glow sweeps right → left across the text
    //  0.55 — 1.00 → phrase shrinks + moves to top-left corner (no glow)

    const sweepT = clamp(phHoldP / 0.55, 0, 1);
    const migrateT = clamp((phHoldP - 0.55) / 0.45, 0, 1);

    // Sweep: --gx moves from 130% (off right) to -30% (off left)
    const gx = lerp(130, -30, sweepT);
    els.phraseBig.style.setProperty('--gx', `${gx}%`);
    // Intensity bell curve: ramps up at start, full in middle, fades at end
    // Plus collapse to 0 during migrate
    const sweepGlow = Math.sin(sweepT * Math.PI);
    const glow = sweepGlow * (1 - easeOut(migrateT));
    els.phraseBig.style.setProperty('--glow', glow.toFixed(3));

    // Shrink + migrate
    const e = easeInOut(migrateT);

    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const isMobile = cw < 720;
    let targetX, targetY, scaleTarget;

    if (isMobile) {
      // Mobile: align with card-frame left edge, slightly bigger.
      const cardFrameW = Math.min(360, cw - 36);
      const cardFrameLeft = (cw - cardFrameW) / 2;
      scaleTarget = 0.28;
      const wrapW = els.phraseWrap.offsetWidth  || 0;
      const wrapH = els.phraseWrap.offsetHeight || 0;
      targetX = cardFrameLeft + (wrapW * scaleTarget) / 2 - cw / 2;
      targetY = 64 + 16 + (wrapH * scaleTarget) / 2 - ch / 2;
    } else {
      targetX = -cw / 2 + 28 + 150;
      targetY = -ch / 2 + 64 + 40;
      scaleTarget = 0.20;
    }

    const tx = lerp(0, targetX, e);
    const ty = lerp(0, targetY, e);
    const scale = lerp(1, scaleTarget, e);

    els.phraseWrap.style.transformOrigin = '50% 50%';
    els.phraseWrap.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    els.phraseWrap.style.opacity = 1;
  } else if (stageActive('cards-rail') || stageActive('portal-grow') ||
             stageActive('portal-problems')) {
    // Persist the phrase in the corner (no glow once it's a label)
    els.phraseStage.classList.add('active');
    els.phraseBig.style.setProperty('--glow', '0');
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const isMobile = cw < 720;
    let targetX, targetY, scaleTarget;
    if (isMobile) {
      const cardFrameW = Math.min(360, cw - 36);
      const cardFrameLeft = (cw - cardFrameW) / 2;
      scaleTarget = 0.28;
      const wrapW = els.phraseWrap.offsetWidth  || 0;
      const wrapH = els.phraseWrap.offsetHeight || 0;
      targetX = cardFrameLeft + (wrapW * scaleTarget) / 2 - cw / 2;
      targetY = 64 + 16 + (wrapH * scaleTarget) / 2 - ch / 2;
    } else {
      targetX = -cw / 2 + 28 + 150;
      targetY = -ch / 2 + 64 + 40;
      scaleTarget = 0.20;
    }
    els.phraseWrap.style.transformOrigin = '50% 50%';
    els.phraseWrap.style.transform = `translate(${targetX}px, ${targetY}px) scale(${scaleTarget})`;
    els.phraseWrap.style.opacity = 1;
  } else if (stageActive('ending') || stageActive('end')) {
    // Fade out phrase corner
    els.phraseStage.style.opacity = '0';
  } else {
    els.phraseStage.classList.remove('active');
    els.phraseStage.style.opacity = '';
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
    // hide non-portal cards
    document.querySelectorAll('.card:not(.card-portal)').forEach(el => {
      el.style.setProperty('--o', '0');
    });
  } else if (stageActive('ending') || stageActive('end')) {
    els.cardsStage.classList.remove('active');
  } else {
    els.cardsStage.classList.remove('active');
    els.cardFrame.classList.remove('in');
  }

  // ── portal grow: card grows via width/height (NOT transform: scale),
  //    so the inner fixed-positioned client canvas works correctly.
  if (stageActive('portal-grow') || stageActive('portal-problems')) {
    els.portalCard.classList.add('portal-active');

    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const isMobile = cw < 720;
    const startW = isMobile ? Math.min(360, cw - 36) : Math.min(560, cw * 0.5);
    const startH = isMobile ? ch * 0.64               : Math.min(700, ch * 0.64);

    let w, h;
    if (stageActive('portal-grow')) {
      const e = easeOut(portalGP);
      w = lerp(startW, cw, e);
      h = lerp(startH, ch, e);
    } else {
      w = cw;
      h = ch;
    }
    els.portalCard.style.width  = w + 'px';
    els.portalCard.style.height = h + 'px';
    els.portalCard.style.maxWidth  = 'none';
    els.portalCard.style.maxHeight = 'none';
    els.portalCard.style.transform = 'translate(-50%, -50%)';
    els.portalCard.style.setProperty('--x', '0px');
    els.portalCard.style.setProperty('--s', '1');
    els.portalCard.style.setProperty('--o', '1');
  } else if (stageActive('cards-rail')) {
    els.portalCard.classList.remove('portal-active');
    els.portalCard.style.transform = '';
    els.portalCard.style.width = '';
    els.portalCard.style.height = '';
    els.portalCard.style.maxWidth = '';
    els.portalCard.style.maxHeight = '';
  }

  // ── problems panel (left-side glass card with content swap) ──
  if (stageActive('portal-problems')) {
    els.problemsPanel.classList.add('in');

    // 4 problems with hold windows. The panel stays; only inner text swaps.
    const N = 4;
    const segment = 1 / N;
    const activeIdx = Math.min(N - 1, Math.floor(portalPP / segment));

    els.problemItems.forEach((el, i) => {
      el.classList.toggle('in', i === activeIdx);
    });
    els.problemNumIdx.textContent = String(activeIdx + 1).padStart(2, '0');
  } else {
    els.problemsPanel.classList.remove('in');
    els.problemItems.forEach(el => el.classList.remove('in'));
  }

  // ── ending: fade portal scene, show typographic SKALD AFTER previous scene is gone ──
  if (stageActive('ending') || stageActive('end')) {
    const fadeP = stageActive('ending') ? endP : 1;
    const portalOp = Math.max(0, 1 - fadeP * 2.4);
    els.portalCard.style.opacity = portalOp;
    els.cardsStage.style.opacity = portalOp;
    if (fadeP > 0.55) {
      els.endingStage.classList.add('active');
    } else {
      els.endingStage.classList.remove('active');
    }
  } else {
    els.portalCard.style.opacity = 1;
    els.cardsStage.style.opacity = '';
    els.endingStage.classList.remove('active');
  }

  // ── cinematic FX intensity (full on canvas scenes, dimmed elsewhere) ──
  const onCanvasScene = stageActive('hero-idle') || stageActive('rotation') || stageActive('hand');
  els.vignette.classList.toggle('dim', !onCanvasScene);
  els.grain.classList.toggle('dim', !onCanvasScene);

  // ── telemetry timecode ──
  const totalScrollPx = document.documentElement.scrollHeight - window.innerHeight;
  const overallProgress = clamp(window.scrollY / totalScrollPx, 0, 1);
  const seconds = overallProgress * 75;
  els.tc.textContent = formatTC(seconds);
  els.telemetry.classList.toggle('hidden', stageActive('ending') || stageActive('end'));

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

// ── nav: smooth-scroll to named stage ────────────────────
document.querySelectorAll('[data-scroll]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const name = link.dataset.scroll;
    const stage = STAGES.find(s => s.name === name);
    if (!stage) return;
    const vh = window.innerHeight / 100;
    // Land a hair past the stage start so the destination scene reads as "active"
    const target = stage.start * vh + window.innerHeight * 0.05;
    window.scrollTo({ top: target, behavior: 'smooth' });
  });
});

// ── ending: mouse-reactive red glow ───────────────────
(function initEndingFx() {
  const stage = document.getElementById('endingStage');
  const glow  = document.getElementById('endingGlow');
  if (!stage || !glow) return;

  let tx = 0.5, ty = 0.5;
  let cx = 0.5, cy = 0.5;
  let rafId = null;

  function onMove(e) {
    const r = stage.getBoundingClientRect();
    tx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    ty = Math.max(0, Math.min(1, (e.clientY - r.top)  / r.height));
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function loop() {
    cx += (tx - cx) * 0.12;
    cy += (ty - cy) * 0.12;
    glow.style.setProperty('--gx', (cx * 100) + '%');
    glow.style.setProperty('--gy', (cy * 100) + '%');
    rafId = null;
    if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
      rafId = requestAnimationFrame(loop);
    }
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      const t = e.touches[0];
      onMove({ clientX: t.clientX, clientY: t.clientY });
    }
  }, { passive: true });
})();
function enterHero() {
  els.heroClaim.classList.add('in');
  els.heroHint.classList.add('in');
  document.getElementById('vslTrigger').classList.add('in');
}

// ── VSL: hero video thumb + fullscreen player ─────────────
(function initVsl() {
  const trigger   = document.getElementById('vslTrigger');
  const overlay   = document.getElementById('vslOverlay');
  const backdrop  = document.getElementById('vslBackdrop');
  const player    = document.getElementById('vslPlayer');
  const video     = player.querySelector('.vsl-video');
  const audioBtn  = document.getElementById('vslAudio');
  if (!trigger || !overlay) return;

  let isPlaying = true; // visual state only (no real video yet)

  function setCursorState() {
    cursor.classList.remove('vsl-play', 'vsl-pause');
    if (overlay.classList.contains('open') && overOver) {
      cursor.classList.add(isPlaying ? 'vsl-pause' : 'vsl-play');
    }
  }

  let overOver = false; // pointer over the video area

  function open() {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    isPlaying = true;
  }
  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    cursor.classList.remove('x', 'vsl-play', 'vsl-pause');
  }

  trigger.addEventListener('click', open);
  backdrop.addEventListener('click', close);

  // Click anywhere on the video area toggles play/pause
  video.addEventListener('click', e => {
    e.stopPropagation();
    isPlaying = !isPlaying;
    setCursorState();
  });

  // Hover state — cursor becomes the play/pause control
  video.addEventListener('mouseenter', () => { overOver = true; setCursorState(); });
  video.addEventListener('mouseleave', () => { overOver = false; setCursorState(); });

  // Stop propagation on player (so clicks on its non-video areas don't close)
  player.addEventListener('click', e => e.stopPropagation());

  audioBtn.addEventListener('click', e => {
    e.stopPropagation();
    audioBtn.classList.toggle('muted');
  });

  // X cursor when over backdrop (close affordance)
  backdrop.addEventListener('mouseenter', () => cursor.classList.add('x'));
  backdrop.addEventListener('mouseleave', () => cursor.classList.remove('x'));

  // Esc to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });
})();

// ── boot ─────────────────────────────────────────────────
(async function init() {
  await preload();
  loader.classList.add('done');
  await new Promise(r => setTimeout(r, 200));
  enterHero();
  tick();
})();
