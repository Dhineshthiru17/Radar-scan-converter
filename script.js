/* ── PANEL NAVIGATION ─────────────────────────────── */


let activePanel   = null;
let activeBtn     = null;

// Store original field values per panel for cancel/reset
const originalValues = {};

function showPanel(name, btn) {
  // Deactivate old
  if (activePanel) document.getElementById('panel-' + activePanel).classList.remove('active');
  if (activeBtn) activeBtn.classList.remove('active');

  // Activate new
  activePanel = name;
  activeBtn   = btn;
  document.getElementById('panel-' + name).classList.add('active');
  btn.classList.add('active');

  // Snapshot current values for cancel (skip preview panel — it has no editable settings)
  if (name !== 'preview') snapshotPanel(name);

  // Init gradient bar when palette opens
  if (name === 'palette') updateGradientBar();
}

/* ── SNAPSHOT (for Cancel) ────────────────────────── */

function snapshotPanel(name) {
  const panel  = document.getElementById('panel-' + name);
  const inputs = panel.querySelectorAll('input');
  const snap   = {};

  inputs.forEach(inp => {
    if (inp.type === 'checkbox') {
      snap[inp.id] = inp.checked;
    } else {
      snap[inp.id] = inp.value;
    }
  });

  originalValues[name] = snap;
}

/* ── CANCEL ───────────────────────────────────────── */

function cancelPanel(name) {
  const snap = originalValues[name];
  if (!snap) return;

  const panel  = document.getElementById('panel-' + name);
  const inputs = panel.querySelectorAll('input');

  inputs.forEach(inp => {
    if (snap[inp.id] !== undefined) {
      if (inp.type === 'checkbox') {
        inp.checked = snap[inp.id];
        syncToggleLabel(inp);
        // live swatch update not needed for checkboxes
      } else {
        inp.value = snap[inp.id];
      }
    }
  });

  // Re-sync swatches if palette
  if (name === 'palette') {
    ['0','43','85','128','170','213','255'].forEach(k => updateSwatch(k));
  }

  showToast('Changes discarded', false);
}

/* ── SUBMIT ───────────────────────────────────────── */

function submitPanel(name) {
  const panel  = document.getElementById('panel-' + name);
  const inputs = panel.querySelectorAll('input');
  const result = {};

  let valid = true;
  inputs.forEach(inp => {
    if (inp.type === 'checkbox') {
      result[inp.id] = inp.checked;
    } else if (inp.type === 'number') {
      const v = parseFloat(inp.value);
      if (isNaN(v)) {
        inp.style.borderColor = '#ff4060';
        valid = false;
      } else {
        inp.style.borderColor = '';
        result[inp.id] = v;
      }
    } else {
      result[inp.id] = inp.value.trim();
    }
  });

  if (!valid) {
    showToast('Please fix invalid fields', true);
    return;
  }

  console.log('[' + name.toUpperCase() + '] Applied:', result);
  snapshotPanel(name); // new snapshot after apply
  showToast('✓ ' + name.toUpperCase() + ' settings applied');
}

/* ── TOGGLE LABEL SYNC ────────────────────────────── */

function updateToggleLabel(checkbox) {
  syncToggleLabel(checkbox);
}

function syncToggleLabel(checkbox) {
  const labelEl = document.getElementById('lbl-' + checkbox.id);
  if (labelEl) {
    labelEl.textContent = checkbox.checked ? 'ON' : 'OFF';
    labelEl.style.color = checkbox.checked
      ? 'var(--accent)'
      : 'var(--text-muted)';
  }
}

// Init all toggle labels on load
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.toggle input[type="checkbox"]').forEach(cb => {
    syncToggleLabel(cb);
  });
});

/* ── PALETTE COLOR PICKER ─────────────────────────── */

// Called when user picks a color via native picker
function onColorPick(key, hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);

  // Update visible circle swatch
  const prev = document.getElementById('cprev-' + key);
  if (prev) prev.style.background = hex;

  // Update hex + rgb labels
  const hexEl = document.getElementById('chex-' + key);
  const rgbEl = document.getElementById('crgb-' + key);
  if (hexEl) hexEl.textContent = hex.toUpperCase();
  if (rgbEl) rgbEl.textContent = `rgb(${r}, ${g}, ${b})`;

  // Rebuild gradient bar
  updateGradientBar();
}

// Rebuild the top gradient preview from current color stops
function updateGradientBar() {
  const stops = [
    { key: '0',   pos: 0   },
    { key: '43',  pos: 17  },
    { key: '85',  pos: 33  },
    { key: '128', pos: 50  },
    { key: '170', pos: 67  },
    { key: '213', pos: 83  },
    { key: '255', pos: 100 },
  ];

  const parts = stops.map(s => {
    const el  = document.getElementById('cpick-' + s.key);
    const hex = el ? el.value : '#000000';
    return `${hex} ${s.pos}%`;
  });

  const bar = document.getElementById('gradientBar');
  if (bar) bar.style.background = `linear-gradient(to right, ${parts.join(', ')})`;
}

// Legacy stub so submitPanel doesn't break
function updateSwatch(key) {}

/* ── TOAST ────────────────────────────────────────── */

let toastTimer = null;

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = 'toast show' + (isError ? ' error' : '');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

/* ── LIVE PREVIEW SCOPE ───────────────────────────────
   A classic PPI (plan position indicator) scope that reads
   the *current* values straight out of every other panel's
   inputs each frame, so it's always "live" — no Apply needed.
   ─────────────────────────────────────────────────── */

const scopeState = {
  angle:  0,      // current sweep bearing, degrees
  paused: false,
  blips:  [],     // simulated contacts: {az, rangeFrac, baseIntensity}
};

function seedBlips(count = 140) {
  const blips = [];
  for (let i = 0; i < count; i++) {
    blips.push({
      az:            Math.random() * 360,
      rangeFrac:     Math.random(),
      baseIntensity: 40 + Math.random() * 215,
    });
  }
  scopeState.blips = blips;
}

// Pull the live value of every field the scope depends on
function getScopeSettings() {
  const num  = id => parseFloat(document.getElementById(id).value);
  const bool = id => document.getElementById(id).checked;
  return {
    decayFactor:      num('dsp-decayFactor'),
    gain:             num('dsp-gain'),
    intensityThresh:  num('dsp-intensityThreshold'),
    noiseSuppression: num('dsp-noiseSuppression'),
    accumulation:     bool('dsp-enableAccumulation'),
    ftcFactor:        num('ftc-factor'),
    azBins:           num('geo-azimuthBins'),
    maxRange:         num('geo-maxRange'),
    zoom:             num('geo-zoom'),
    lmEnable:         bool('lm-enable'),
    lmCoastline:      bool('lm-displayCoastline'),
    lmRange:          num('lm-range'),
    lmIgnoreStart:    num('lm-ignoreAzStart'),
    lmIgnoreEnd:      num('lm-ignoreAzEnd'),
    lmOffsetX:        num('lm-offsetX'),
    lmOffsetY:        num('lm-offsetY'),
    stcRadius:        num('stc-radius'),
    stcStrength:      num('stc-strength'),
  };
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

// Interpolate the live Palette panel's 7 stops for a given intensity (0–255)
function paletteColorAt(intensity) {
  const stops = [0, 43, 85, 128, 170, 213, 255];
  const hexes = stops.map(s => document.getElementById('cpick-' + s).value);
  intensity = Math.max(0, Math.min(255, intensity));

  let lo = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    if (intensity >= stops[i] && intensity <= stops[i + 1]) { lo = i; break; }
  }
  const hi   = lo + 1;
  const span = stops[hi] - stops[lo] || 1;
  const t    = (intensity - stops[lo]) / span;

  const c1 = hexToRgb(hexes[lo]);
  const c2 = hexToRgb(hexes[hi]);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r},${g},${b})`;
}

function deg2rad(d) { return (d * Math.PI) / 180; }

function drawScope() {
  const canvas = document.getElementById('scopeCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R  = Math.min(W, H) / 2 - 34;

  const s = getScopeSettings();

  // Background: fade trail (accumulation) or hard clear
  if (s.accumulation) {
    const fadeAlpha = 1 - Math.min(0.985, Math.max(0.02, s.decayFactor));
    ctx.fillStyle = `rgba(3,5,10,${fadeAlpha})`;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = '#03050a';
    ctx.fillRect(0, 0, W, H);
  }

  // Range rings, labeled from live Max Range
  ctx.strokeStyle = 'rgba(0,229,255,0.16)';
  ctx.lineWidth = 1;
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.fillStyle = 'rgba(184,190,201,0.65)';
  const ringCount = 4;
  for (let i = 1; i <= ringCount; i++) {
    const rr = (R * i) / ringCount;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
    const meters = (s.maxRange * i) / ringCount;
    ctx.fillText((meters / 1000).toFixed(1) + ' km', cx + 4, cy - rr + 10);
  }

  // Azimuth exclusion wedge, from live Land Mask ignore-az bins
  if (s.lmEnable) {
    const a1 = (s.lmIgnoreStart / s.azBins) * 360;
    const a2 = (s.lmIgnoreEnd / s.azBins) * 360;
    ctx.save();
    ctx.fillStyle = 'rgba(255,64,96,0.07)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, deg2rad(a1 - 90), deg2rad(a2 - 90));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Landmass shape, from live Land Mask range / offset / coastline toggle
  if (s.lmEnable) {
    const landR = Math.min(R, R * (s.lmRange / s.maxRange || 0));
    const ox = s.lmOffsetX * (R / 300);
    const oy = s.lmOffsetY * (R / 300);
    ctx.save();
    ctx.translate(cx + ox, cy + oy);
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0,255,136,0.10)';
    ctx.setLineDash(s.lmCoastline ? [4, 3] : []);
    ctx.strokeStyle = s.lmCoastline ? 'rgba(0,255,136,0.55)' : 'rgba(0,0,0,0)';
    const points = 24;
    for (let i = 0; i <= points; i++) {
      const t = (i / points) * Math.PI * 2;
      const wobble = 0.75 + 0.25 * Math.sin(t * 3.3) + 0.15 * Math.cos(t * 5.1);
      const rr = landR * 0.5 * wobble;
      const x = Math.cos(t) * rr;
      const y = Math.sin(t) * rr * 0.6 - landR * 0.25;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    if (s.lmCoastline) ctx.stroke();
    ctx.restore();
  }

  // Simulated returns, lit only in the sweep's afterglow window
  const sweepWindow = 14; // degrees
  scopeState.blips.forEach(b => {
    const diff = Math.abs(((b.az - scopeState.angle + 540) % 360) - 180);
    if (diff > sweepWindow) return;

    const rangeMeters = b.rangeFrac * s.maxRange;
    let intensity = b.baseIntensity * s.gain;

    // STC: suppress returns inside the live suppression radius
    if (rangeMeters < s.stcRadius) {
      intensity *= 1 - s.stcStrength * (1 - rangeMeters / Math.max(1, s.stcRadius));
    }
    // FTC: extra suppression very close-in, from the live FTC factor
    if (rangeMeters < s.stcRadius * 0.5) {
      intensity *= 1 - s.ftcFactor;
    }

    if (intensity < s.intensityThresh || intensity < s.noiseSuppression * 0.6) return;

    const fade = 1 - diff / sweepWindow;
    const rr  = b.rangeFrac * R;
    const ang = deg2rad(b.az - 90);
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;

    ctx.fillStyle = paletteColorAt(intensity);
    ctx.globalAlpha = Math.max(0.15, fade);
    ctx.beginPath();
    ctx.arc(x, y, 2.3 * ((s.zoom || 1) / 3.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Outer boundary
  ctx.strokeStyle = 'rgba(0,229,255,0.3)';
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  // Sweep arm
  const sweepRad = deg2rad(scopeState.angle - 90);
  const grad = ctx.createLinearGradient(
    cx, cy,
    cx + Math.cos(sweepRad) * R, cy + Math.sin(sweepRad) * R
  );
  grad.addColorStop(0, 'rgba(0,229,255,0)');
  grad.addColorStop(1, 'rgba(0,229,255,0.9)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweepRad) * R, cy + Math.sin(sweepRad) * R);
  ctx.stroke();

  // Live readout strip
  const readout = document.getElementById('scopeReadout');
  if (readout) {
    readout.textContent =
      `RANGE ${(s.maxRange / 1000).toFixed(1)}km · ZOOM ${s.zoom.toFixed(1)}x · ` +
      `GAIN ${s.gain.toFixed(1)} · DECAY ${s.decayFactor.toFixed(3)} · ` +
      `STC ${s.stcRadius}m/${s.stcStrength.toFixed(2)} · LAND ${s.lmEnable ? 'ON' : 'OFF'}`;
  }
}

function scopeLoop() {
  const panel = document.getElementById('panel-preview');
  const isVisible = panel && panel.classList.contains('active');
  if (isVisible && !scopeState.paused) {
    scopeState.angle = (scopeState.angle + 1.6) % 360;
    drawScope();
  }
  requestAnimationFrame(scopeLoop);
}

function clearScopeTrails() {
  const canvas = document.getElementById('scopeCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#03050a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  seedBlips();
  showToast('Scope trails cleared');
}

function togglePausePreview() {
  scopeState.paused = !scopeState.paused;
  const btn = document.getElementById('pausePreviewBtn');
  if (btn) btn.textContent = scopeState.paused ? '▶ Resume' : '⏸ Pause';
}

document.addEventListener('DOMContentLoaded', () => {
  seedBlips();
  drawScope();       // paint one static frame immediately
  scopeLoop();
});