// Counts the seconds a video is actually playing on this tab and reports them in batches.
// Watch time is kept by the service worker (summed over all tabs) and never leaves the machine.

const SEND_EVERY_SECONDS = 15;

export function startWatchTimeTracking(send) {
  let pending = 0;
  let sinceSend = 0;
  let last = performance.now();

  const flush = () => {
    if (pending >= 0.5) {
      send(Math.round(pending * 10) / 10);
      pending = 0;
    }
    sinceSend = 0;
  };

  const poll = () => {
    const now = performance.now();
    const dt = Math.min(2.5, (now - last) / 1000); // a throttled background tab must not inflate the count
    last = now;
    const v = document.querySelector('video');
    const playing = !!v && !v.paused && !v.ended && v.readyState >= 2 && v.currentTime > 0;
    if (playing) pending += dt;
    sinceSend += dt;
    if (sinceSend >= SEND_EVERY_SECONDS) flush();
  };

  setInterval(poll, 1000);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  return { flush, pending: () => pending };
}
