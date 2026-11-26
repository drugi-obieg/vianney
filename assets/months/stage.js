/*!
 * MonthStage - responsive, layered month wallpaper (Tres Riches Heures calendar plates).
 *
 * What it does
 *   - Shows the 16:9 background plate of a month so that it always COVERS the viewport (same result as CSS
 *     `object-fit: cover`), with a focus point (so portrait screens keep the characters in view) and an optional
 *     zoom >= 1 ("slightly resizable", e.g. to make the page content look embedded in the scene).
 *   - Builds a second, pointer-transparent stage with the cut-out character layers (see layers.json). Each layer lies
 *     exactly on the same pixels of the plate, so it can be stacked ABOVE the page content with z-index without any
 *     visible change; lifted characters then overlap the content ("embedded" look).
 *
 * Stacking contract: back stage z-index 0, page content z-index 10 (give it `position: relative` or fixed),
 * front stage z-index 20. Override with the options zBack / zFront.
 *
 * No dependencies. Browser: classic <script>, global `MonthStage`. Node: CommonJS `require()` returns the API; as an ES module
 * (this repo has "type": "module") `await import('./stage.js')` defines `globalThis.MonthStage` (pure geometry works without a DOM).
 *
 *   MonthStage.loadManifest('/assets/months/layers.json').then(function (manifest) {
 *     var stage = MonthStage.mount({ manifest: manifest, month: new Date().getMonth() + 1,
 *                                    lift: 'overlap', content: document.querySelector('.window'), zoom: 1.08 });
 *   });
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.MonthStage = factory(); }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  var STYLE_ID = 'month-stage-style';
  var CSS =
    '.ms-stage{position:fixed;inset:0;overflow:hidden;pointer-events:none;container-type:size;background:var(--ms-color,#000)}' +
    '.ms-stage.ms-contained{position:absolute}' +
    '.ms-back{z-index:var(--ms-z-back,0)}' +
    '.ms-front{z-index:var(--ms-z-front,20);background:none}' +
    '.ms-sheet{position:absolute;' +
      '--ms-w:calc(max(100cqw,100cqh*var(--ms-ar,1.7778))*var(--ms-zoom,1));' +
      'width:var(--ms-w);height:calc(var(--ms-w)/var(--ms-ar,1.7778));' +
      'left:calc((100cqw - var(--ms-w))*var(--ms-px,.5));' +
      'top:calc((100cqh - var(--ms-w)/var(--ms-ar,1.7778))*var(--ms-py,.5))}' +
    '.ms-bg,.ms-layer{position:absolute;display:block;max-width:none;user-select:none;-webkit-user-drag:none}' +
    '.ms-bg{left:0;top:0;width:100%;height:100%}' +
    '.ms-layer[hidden]{display:none}' +
    '@supports not (width:1cqw){.ms-sheet{' +
      '--ms-w:calc(max(100vw,100vh*var(--ms-ar,1.7778))*var(--ms-zoom,1));' +
      'left:calc((100vw - var(--ms-w))*var(--ms-px,.5));' +
      'top:calc((100vh - var(--ms-w)/var(--ms-ar,1.7778))*var(--ms-py,.5))}}';

  // ---------------------------------------------------------------- pure geometry (no DOM)

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /**
   * Where the W x H plate sits in a vw x vh viewport: "cover" scale (times zoom >= 1), with the focus point
   * (fx, fy are fractions of the plate) centred as far as the plate still covers the viewport.
   * px/py are the CSS position fractions (like object-position) that reproduce left/top.
   */
  function coverFrame(vw, vh, W, H, zoom, fx, fy) {
    zoom = zoom >= 1 ? zoom : 1;
    fx = fx == null ? 0.5 : fx; fy = fy == null ? 0.5 : fy;
    var scale = Math.max(vw / W, vh / H) * zoom;
    var width = W * scale, height = H * scale;
    var left = clamp(vw / 2 - fx * width, Math.min(0, vw - width), 0);
    var top = clamp(vh / 2 - fy * height, Math.min(0, vh - height), 0);
    return {
      scale: scale, width: width, height: height, left: left, top: top,
      px: Math.abs(vw - width) < 1e-6 ? 0.5 : left / (vw - width),   // exact fit: any fraction gives the same left
      py: Math.abs(vh - height) < 1e-6 ? 0.5 : top / (vh - height)
    };
  }

  /** Rectangle of a layer (pixels of the plate) in viewport pixels for a given frame. */
  function layerRect(frame, layer) {
    return { left: frame.left + layer.x * frame.scale, top: frame.top + layer.y * frame.scale,
             width: layer.width * frame.scale, height: layer.height * frame.scale };
  }

  /** Fraction of rectangle a that is covered by rectangle b. */
  function overlapFraction(a, b) {
    var w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
    var h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
    if (w <= 0 || h <= 0 || a.width * a.height <= 0) { return 0; }
    return (w * h) / (a.width * a.height);
  }

  var OVERLAP_MIN = 0.01; // a layer counts as "touching the content" when >= 1 % of its box is covered

  /** Which layers are lifted in front of the content. mode: 'manifest' | 'overlap' | 'all' | 'none' | id[] | fn(layer)->bool */
  function pickLifted(mode, layers, frame, contentRect) {
    return layers.map(function (l) {
      if (typeof mode === 'function') { return !!mode(l); }
      if (Array.isArray(mode)) { return mode.indexOf(l.id) >= 0; }
      if (mode === 'all') { return true; }
      if (mode === 'none') { return false; }
      if (mode === 'overlap') {
        return !!contentRect && overlapFraction(layerRect(frame, l), contentRect) >= OVERLAP_MIN;
      }
      return !!l.lift; // 'manifest'
    });
  }

  // ---------------------------------------------------------------- DOM

  function make(doc, tag, cls) { var e = doc.createElement(tag); if (cls) { e.className = cls; } return e; }

  function injectStyle(doc) {
    if (doc.getElementById(STYLE_ID)) { return; }
    var s = doc.createElement('style'); s.id = STYLE_ID; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  /** Resolves when the image has loaded (rejects on error). Waits for the load event, not for decode(), which can stall in
   *  background tabs and headless browsers; decode() is only started to warm the cache. */
  function whenLoaded(img) {
    return new Promise(function (resolve, reject) {
      function done() { if (img.decode) { img.decode().catch(function () {}); } resolve(img); }
      if (img.complete && img.naturalWidth > 0) { done(); return; }
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', function () { reject(new Error('cannot load ' + img.src)); }, { once: true });
    });
  }

  function loadManifest(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) { throw new Error('manifest ' + url + ': HTTP ' + r.status); }
      return r.json();
    }).then(function (m) { m.__base = url.replace(/[^\/]*$/, ''); return m; });
  }

  /**
   * options: { manifest, month (1-12), host (default body), base (default: manifest folder),
   *            zoom (>= 1, default 1), focus ({x,y} fractions, default: manifest focus of the month),
   *            lift ('manifest' | 'overlap' | 'all' | 'none' | [ids] | fn), content (Element for 'overlap'),
   *            zBack (0), zFront (20), fixed (default true; false = absolute inside a positioned host element) }
   */
  function mount(opts) {
    var host = opts.host || document.body;
    var doc = host.ownerDocument;
    var base = opts.base != null ? opts.base : (opts.manifest.__base || '');
    var state = { month: opts.month || (new Date().getMonth() + 1), zoom: opts.zoom >= 1 ? opts.zoom : 1,
                  focus: opts.focus || null, lift: opts.lift || 'manifest', content: opts.content || null };
    var data = null, frame = null, layoutListeners = [], readyPromise = null;
    var layers = []; // { data, el, lifted }

    injectStyle(doc);
    var back = make(doc, 'div', 'ms-stage ms-back');
    var front = make(doc, 'div', 'ms-stage ms-front');
    var sheetBack = make(doc, 'div', 'ms-sheet');
    var sheetFront = make(doc, 'div', 'ms-sheet');
    var bg = make(doc, 'img', 'ms-bg');
    bg.alt = ''; bg.decoding = 'async'; bg.draggable = false;
    back.setAttribute('aria-hidden', 'true'); front.setAttribute('aria-hidden', 'true');
    if (opts.fixed === false) { back.classList.add('ms-contained'); front.classList.add('ms-contained'); }
    if (opts.zBack != null) { back.style.setProperty('--ms-z-back', opts.zBack); }
    if (opts.zFront != null) { front.style.setProperty('--ms-z-front', opts.zFront); }
    sheetBack.appendChild(bg); back.appendChild(sheetBack); front.appendChild(sheetFront);
    host.appendChild(back); host.appendChild(front);

    function monthData(n) {
      for (var i = 0; i < opts.manifest.months.length; i++) {
        if (opts.manifest.months[i].month === n) { return opts.manifest.months[i]; }
      }
      throw new Error('no month ' + n + ' in manifest');
    }

    function currentFocus() { return state.focus || data.focus || { x: 0.5, y: 0.5 }; }

    function contentRect() {   // content box in stage pixels (undoes any CSS transform/zoom on ancestors)
      if (!state.content) { return null; }
      var c = state.content.getBoundingClientRect(), s = back.getBoundingClientRect();
      var k = back.clientWidth ? s.width / back.clientWidth : 1;
      return { left: (c.left - s.left) / k, top: (c.top - s.top) / k, width: c.width / k, height: c.height / k };
    }

    function relayout() {
      if (!data) { return; }
      var vw = back.clientWidth, vh = back.clientHeight;
      var W = data.background.width, H = data.background.height, f = currentFocus();
      var fr = coverFrame(vw, vh, W, H, state.zoom, f.x, f.y);
      fr.vw = vw; fr.vh = vh;
      [back, front].forEach(function (s) {
        s.style.setProperty('--ms-ar', String(W / H));
        s.style.setProperty('--ms-zoom', String(state.zoom));
        s.style.setProperty('--ms-px', String(fr.px));
        s.style.setProperty('--ms-py', String(fr.py));
      });
      frame = fr;
      var lifted = pickLifted(state.lift, layers.map(function (l) { return l.data; }), fr, contentRect());
      layers.forEach(function (l, i) { l.lifted = lifted[i]; l.el.hidden = !lifted[i]; });
      layoutListeners.slice().forEach(function (fn) { fn(api); });
    }

    function load() {
      data = monthData(state.month);
      var W = data.background.width, H = data.background.height;
      back.style.setProperty('--ms-color', data.color || '#000');
      bg.src = base + data.background.file;
      sheetFront.textContent = '';
      layers.length = 0;
      data.layers.forEach(function (ld) {
        var img = make(doc, 'img', 'ms-layer');
        img.alt = ''; img.decoding = 'async'; img.draggable = false; img.hidden = true;
        img.dataset.layer = ld.id; img.dataset.kind = ld.kind;
        img.style.left = (ld.x / W * 100) + '%'; img.style.top = (ld.y / H * 100) + '%';
        img.style.width = (ld.width / W * 100) + '%'; img.style.height = (ld.height / H * 100) + '%';
        img.src = base + ld.file;
        sheetFront.appendChild(img);
        layers.push({ data: ld, el: img, lifted: false });
      });
      relayout();
      readyPromise = Promise.all([bg].concat(layers.map(function (l) { return l.el; })).map(whenLoaded)).then(function () { return api; });
      return readyPromise;
    }

    // ResizeObserver follows the stage and the content element; the window resize event is a second trigger (relayout is idempotent)
    var ro = null, win = doc.defaultView;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(relayout);
      ro.observe(back);
      if (state.content) { ro.observe(state.content); }
    }
    win.addEventListener('resize', relayout);

    var api = {
      get month() { return state.month; },
      get data() { return data; },
      get frame() { return frame; },
      get ready() { return readyPromise; },
      layers: layers,
      elements: { back: back, front: front, sheetBack: sheetBack, sheetFront: sheetFront, bg: bg },
      setMonth: function (n) { state.month = n; return load(); },
      setZoom: function (z) { state.zoom = z >= 1 ? z : 1; relayout(); },
      setFocus: function (f) { state.focus = f; relayout(); },
      setLift: function (mode) { state.lift = mode; relayout(); },
      update: relayout,
      onLayout: function (fn) { layoutListeners.push(fn); },
      destroy: function () {
        if (ro) { ro.disconnect(); }
        win.removeEventListener('resize', relayout);
        back.remove(); front.remove();
      }
    };
    load();
    return api;
  }

  return { mount: mount, loadManifest: loadManifest, coverFrame: coverFrame, layerRect: layerRect,
           overlapFraction: overlapFraction, pickLifted: pickLifted, OVERLAP_MIN: OVERLAP_MIN };
}));
