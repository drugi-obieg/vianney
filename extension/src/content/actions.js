// Visual actions on feed cards: hide, blank, dim, label. All of them are reversible.

const STYLE_ID = 'vianney-style';

const CSS = `
[data-vianney-state="hide"] { display: none !important; }
[data-vianney-state="blank"] { visibility: hidden !important; }
[data-vianney-state="dim"], [data-vianney-state="label"] { position: relative !important; }
[data-vianney-state="dim"] > :not(.vianney-badge) { opacity: .22 !important; filter: grayscale(1) !important; }
.vianney-badge {
  position: absolute; top: 6px; left: 6px; z-index: 5; max-width: 90%;
  background: #7a1f2b; color: #fff; font: 600 11px/1.25 system-ui, sans-serif;
  padding: 3px 7px; border-radius: 4px; pointer-events: none; letter-spacing: .02em;
}
`;

export function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);
}

export function clearCard(el) {
  if (!el.dataset.vianneyState) return;
  delete el.dataset.vianneyState;
  delete el.dataset.vianneyReason;
  el.querySelectorAll(':scope > .vianney-badge').forEach((b) => b.remove());
}

/** @param {'hide'|'blank'|'dim'|'label'} action */
export function applyCardAction(el, action, reason) {
  clearCard(el);
  el.dataset.vianneyState = action;
  el.dataset.vianneyReason = reason;
  if (action === 'dim' || action === 'label') {
    const badge = document.createElement('div');
    badge.className = 'vianney-badge';
    badge.textContent = reason;
    el.appendChild(badge);
  }
}
