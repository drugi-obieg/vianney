// Runs in the page's own JavaScript world (manifest "world": "MAIN") so that it can see what the
// YouTube player itself requests. It captures two things and hands them to the extension's isolated
// content script through window.postMessage:
//   - the timed-text (caption) responses that the player fetches with its own valid token
//   - the details of the video being watched (title, channel, description, keywords)
// It changes nothing on the page and sends nothing anywhere else.
(() => {
  if (window.__vianneyHook) return;
  window.__vianneyHook = true;

  const post = (type, payload) => window.postMessage({ source: 'vianney-main', type, ...payload }, location.origin);

  const isTimedText = (url) => typeof url === 'string' && url.includes('/api/timedtext');

  function describe(url) {
    try {
      const u = new URL(url, location.origin);
      return { v: u.searchParams.get('v'), lang: u.searchParams.get('lang'), kind: u.searchParams.get('kind') || 'manual', fmt: u.searchParams.get('fmt') };
    } catch (e) {
      return {};
    }
  }

  function report(url, body) {
    post('captions', { info: describe(url), body: typeof body === 'string' ? body : '', empty: !body });
  }

  // fetch
  const realFetch = window.fetch;
  window.fetch = function (...args) {
    const p = realFetch.apply(this, args);
    try {
      const first = args[0];
      const url = typeof first === 'string' ? first : first && first.url;
      if (isTimedText(url)) {
        p.then((res) => res.clone().text().then((t) => report(url, t)).catch(() => {})).catch(() => {});
      }
    } catch (e) { /* never break the page */ }
    return p;
  };

  // XMLHttpRequest
  const realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__vianneyUrl = url;
    return realOpen.call(this, method, url, ...rest);
  };
  const realSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    try {
      if (isTimedText(String(this.__vianneyUrl))) {
        this.addEventListener('load', () => {
          try {
            if (this.responseType === '' || this.responseType === 'text') report(String(this.__vianneyUrl), this.responseText);
          } catch (e) { /* ignore */ }
        });
      }
    } catch (e) { /* ignore */ }
    return realSend.apply(this, args);
  };

  // video details
  function emitVideo(playerResponse) {
    const d = playerResponse && playerResponse.videoDetails;
    if (!d || !d.videoId) return;
    post('video', {
      video: {
        id: d.videoId,
        title: d.title || '',
        author: d.author || '',
        channelId: d.channelId || '',
        description: d.shortDescription || '',
        keywords: (d.keywords || []).join(', '),
        lengthSeconds: Number(d.lengthSeconds) || 0,
        isLive: !!d.isLive || !!d.isLiveContent,
      },
    });
  }

  let latest = null; // the newest player response we have seen
  const urlVideoId = () => new URL(location.href).searchParams.get('v');
  const remember = (pr) => { if (pr && pr.videoDetails) latest = pr; emitVideo(pr); };

  window.addEventListener('yt-navigate-finish', (e) => {
    try {
      const fromEvent = e.detail && e.detail.response && e.detail.response.playerResponse;
      remember(fromEvent || window.ytInitialPlayerResponse);
    } catch (err) { /* ignore */ }
  });
  document.addEventListener('DOMContentLoaded', () => {
    try { remember(window.ytInitialPlayerResponse); } catch (err) { /* ignore */ }
  });

  // The isolated content script may start after the messages above were sent: it says hello and we repeat.
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== 'vianney-iso' || e.data.type !== 'hello') return;
    try {
      const want = urlVideoId();
      const pick = [latest, window.ytInitialPlayerResponse].find((pr) => pr && pr.videoDetails && pr.videoDetails.videoId === want);
      if (pick) emitVideo(pick);
    } catch (err) { /* ignore */ }
  });
})();
