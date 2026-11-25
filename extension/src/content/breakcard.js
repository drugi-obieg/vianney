// The break reminder: a card that looks like a video recommendation and tells the user they have been
// watching for a while. It is drawn inside its own shadow DOM (no copying of YouTube's markup, so it
// survives layout changes) and carries a small label naming the extension, so it cannot be mistaken
// for YouTube content. It never links to a video.

import { formatDuration } from '../core/breaktimer.js';

const CSS = `
:host { display: block; }
.card { box-sizing: border-box; width: 100%; height: 100%; display: flex; flex-direction: column; gap: 10px; font: 14px/1.4 Roboto, Arial, sans-serif; color: var(--yt-spec-text-primary, #0f0f0f); }
.card[data-layout="row"] { flex-direction: row; gap: 16px; }
.thumb { position: relative; aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; background: linear-gradient(135deg, #7a1f2b, #3a0f16); display: flex; align-items: center; justify-content: center; flex: none; }
.card[data-layout="row"] .thumb { width: 360px; max-width: 40%; }
.thumb svg { width: 34%; height: 34%; color: #f4e6e3; opacity: .92; }
.text { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.title { font-size: 16px; font-weight: 500; line-height: 1.3; }
.sub { color: var(--yt-spec-text-secondary, #606060); }
.label { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #7a1f2b; font-weight: 600; }
.buttons { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
button { font: 500 13px Roboto, Arial, sans-serif; padding: 7px 14px; border-radius: 18px; border: 1px solid rgba(127,127,127,.5); background: transparent; color: inherit; cursor: pointer; }
button.primary { background: #7a1f2b; color: #fff; border-color: #7a1f2b; }
.banner { position: fixed; z-index: 2147483000; left: 50%; bottom: 20px; transform: translateX(-50%); width: min(560px, calc(100vw - 24px)); box-sizing: border-box;
  background: #14110d; color: #efe7d6; border: 1px solid #5b4a34; border-radius: 10px; padding: 14px 16px; display: flex; gap: 14px; align-items: center; font: 14px/1.4 Roboto, Arial, sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,.5); }
.banner .text { flex: 1; }
.banner .title { color: #fff; }
.banner .sub { color: #cbbfa8; }
.banner .label { color: #e3a0a5; }
.banner button { color: #efe7d6; }
.banner button.primary { background: #e3a0a5; color: #1a1210; border-color: #e3a0a5; }
`;

const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2h4v7h7v4h-7v9h-4v-9H3V9h7z" fill="currentColor"/></svg>';

function content(seconds, cfg) {
  const title = `You have been watching for ${formatDuration(seconds)}`;
  const sub = cfg.message && cfg.message.trim() ? cfg.message.trim() : 'This is a good moment to take a break.';
  return { title, sub };
}

function build({ title, sub, layout, onSnooze, onDismiss, banner }) {
  const host = document.createElement('div');
  host.dataset.vianneyUi = banner ? 'break-banner' : 'break-card';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  const body = document.createElement('div');
  body.className = banner ? 'banner' : 'card';
  body.setAttribute('role', 'status');
  if (!banner) body.dataset.layout = layout;
  body.innerHTML = `
    ${banner ? '' : `<div class="thumb">${CROSS}</div>`}
    <div class="text">
      <div class="title"></div>
      <div class="sub"></div>
      <div class="label">Vianney Content Blocker &middot; break reminder</div>
      <div class="buttons"><button class="primary later">Remind me later</button><button class="dismiss">Dismiss</button></div>
    </div>`;
  body.querySelector('.title').textContent = title;
  body.querySelector('.sub').textContent = sub;
  body.querySelector('.later').addEventListener('click', onSnooze);
  body.querySelector('.dismiss').addEventListener('click', onDismiss);
  root.append(style, body);
  return host;
}

export class BreakUI {
  constructor({ onSnooze, onDismiss }) {
    this.onSnooze = onSnooze;
    this.onDismiss = onDismiss;
    this.card = null;
    this.banner = null;
    this.placedBefore = null;
    this.lastKey = '';
  }

  /** @param {{due:boolean, seconds:number, cfg:object, cards:{el:Element}[]}} s */
  update({ due, seconds, cfg, cards }) {
    if (!due) { this.remove(); return; }
    const text = content(seconds, cfg);
    const key = text.title + '|' + text.sub;
    const ref = cfg.showCard ? cards.find((c) => c.el.isConnected && c.el.getBoundingClientRect().width > 0 && c.el.dataset.vianneyState !== 'hide') : null;
    if (ref) {
      this.removeBanner();
      const stillPlaced = this.card && this.card.isConnected && this.card.nextElementSibling === ref.el && key === this.lastKey;
      if (!stillPlaced) this.placeCard(ref.el, text, key);
    } else {
      this.removeCard();
      if (cfg.showBanner) {
        if (!this.banner || !this.banner.isConnected || key !== this.lastKey) this.showBanner(text, key);
      } else this.removeBanner();
    }
  }

  placeCard(refEl, text, key) {
    this.removeCard();
    const r = refEl.getBoundingClientRect();
    const layout = r.width >= 700 ? 'row' : 'column';
    const host = build({ ...text, layout, onSnooze: this.onSnooze, onDismiss: this.onDismiss, banner: false });
    host.style.width = Math.round(r.width) + 'px';
    host.style.boxSizing = 'border-box';
    host.style.margin = getComputedStyle(refEl).margin;
    refEl.parentElement.insertBefore(host, refEl);
    this.card = host;
    this.lastKey = key;
  }

  showBanner(text, key) {
    this.removeBanner();
    this.banner = build({ ...text, onSnooze: this.onSnooze, onDismiss: this.onDismiss, banner: true });
    document.body.appendChild(this.banner);
    this.lastKey = key;
  }

  removeCard() { if (this.card) { this.card.remove(); this.card = null; } }
  removeBanner() { if (this.banner) { this.banner.remove(); this.banner = null; } }
  remove() { this.removeCard(); this.removeBanner(); this.lastKey = ''; }

  state() { return { card: !!(this.card && this.card.isConnected), banner: !!(this.banner && this.banner.isConnected) }; }
}
