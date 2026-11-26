// The hover preview. When the mouse rests on a thumbnail, YouTube plays a muted preview video. That <video> sits in one shared
// element, <ytd-video-preview>, which YouTube places over the thumbnail but which is NOT inside the card. Styling the card
// (blur, black, dim, "still being checked") therefore never reached it: hovering a blacked-out result showed the real video.
//
// This finds the card under the preview, by position, and gives the preview the same look:
//   black  a blacked-out picture, or a picture that has not been checked yet (the hold)
//   blur   a blurred picture
//   dim    a dimmed card
// and keeps a flagged preview muted (and a black one paused, so that nothing plays behind the black).

const PREVIEW = 'ytd-video-preview';
const CARD_STATES = '[data-vianney-thumb], [data-vianney-pending], [data-vianney-state]';

/** How a hover preview must look for a card in this state; null = leave it alone. */
export function previewLook(card) {
  if (!card) return null;
  const thumb = card.dataset.vianneyThumb;
  if (thumb) {
    if (thumb === 'blackout') return 'black';
    if (thumb === 'blur') return 'blur';
    if (thumb === 'dim') return 'dim';
    return null; // revealed by the user, a label (the picture is shown), hide/blank (cannot be hovered)
  }
  if (card.hasAttribute('data-vianney-pending')) return 'black';
  if (card.dataset.vianneyState === 'dim') return 'dim';
  return null;
}

function apply(pv, look) {
  if (look) {
    if (pv.dataset.vianneyPreview !== look) pv.dataset.vianneyPreview = look;
    const video = pv.querySelector('video');
    if (video) {
      video.muted = true;
      if (look === 'black' && !video.paused) video.pause();
    }
  } else if (pv.dataset.vianneyPreview) {
    delete pv.dataset.vianneyPreview;
  }
}

/** Looks at the preview that is showing now, and styles it according to the card below it. Exported for the tests. */
export function checkPreview() {
  const pv = document.querySelector(PREVIEW);
  if (!pv) return null;
  const r = pv.getBoundingClientRect();
  if (r.width < 40 || r.height < 40) { apply(pv, null); return null; }
  let look = null;
  for (const el of document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)) {
    if (pv.contains(el)) continue;
    const card = el.closest(CARD_STATES);
    if (card) { look = previewLook(card); break; }
  }
  apply(pv, look);
  return look;
}

export function startPreviewGuard() {
  // the preview appears a moment after the mouse arrives: look right away, and again as it starts
  document.addEventListener('mouseover', () => {
    checkPreview();
    setTimeout(checkPreview, 60);
    setTimeout(checkPreview, 250);
    setTimeout(checkPreview, 700);
  }, true);
  setInterval(checkPreview, 250);
}
