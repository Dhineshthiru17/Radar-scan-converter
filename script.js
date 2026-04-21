

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

  // Snapshot current values for cancel
  snapshotPanel(name);

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
