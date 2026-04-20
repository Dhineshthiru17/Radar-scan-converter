/* ── PANEL NAVIGATION ─────────────────────────────── */



let activePanel   = 'dsp';
let activeBtn     = null;

// Store original field values per panel for cancel/reset
const originalValues = {};

function showPanel(name, btn) {
  // Deactivate old
  document.getElementById('panel-' + activePanel).classList.remove('active');
  if (activeBtn) activeBtn.classList.remove('active');

  // Activate new
  activePanel = name;
  activeBtn   = btn;
  document.getElementById('panel-' + name).classList.add('active');
  btn.classList.add('active');

  // Snapshot current values for cancel
  snapshotPanel(name);
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

/* ── PALETTE SWATCH LIVE UPDATE ───────────────────── */

function updateSwatch(key) {
  const r  = parseInt(document.getElementById('pal-' + key + '-r').value) || 0;
  const g  = parseInt(document.getElementById('pal-' + key + '-g').value) || 0;
  const b  = parseInt(document.getElementById('pal-' + key + '-b').value) || 0;
  const sw = document.getElementById('sw-' + key);
  if (sw) sw.style.background = `rgb(${r},${g},${b})`;
}

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