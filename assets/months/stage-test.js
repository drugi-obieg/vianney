/*!
 * Test + demo harness for stage.js / layers.json.
 *
 * Open stage-test.html over http (the page fetches layers.json), e.g. `python3 -m http.server` in the repository root.
 *
 * Host mode (default): a grid of live stages in containers of many sizes (phone ... 32:9 ultrawide, 4K), shown scaled down, with
 * controls for month, zoom and lift mode. On load (and on "Run tests") it checks, for all 12 months x all sizes, that
 *   - the plate always fills the whole container (object-fit: cover semantics, 16:9 preserved, not larger than needed),
 *   - the CSS geometry equals the JS model, every image decoded at its manifest size,
 *   - every character layer sits exactly on its pixels of the plate and the front stage coincides with the back stage,
 *   - the focus point stays visible, stacking is back < page content < front, the stages never intercept pointer events,
 * and then that it follows live resizes and zoom proportionally, and that every lift mode lifts the expected layers.
 *
 * Embed mode (?embed=1&month=11&zoom=1&lift=all&mock=1&page=ff00ff&mockbg=ff00ff): one full-window fixed stage plus a mock
 * 800 px content window; used for screenshot tests and to look at one month at real size.
 *
 * Results: #summary, #results, window.__stageTest = { done, verdict, total, passed, failed, failures, groups }.
 */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);

  var MOCK_CSS = 'z-index:10;box-sizing:border-box;padding:18px 26px;border:1px solid rgba(0,0,0,.35);border-radius:10px;' +
    'font:15px/1.45 system-ui,sans-serif;color:#2b2118;overflow:hidden;pointer-events:auto;' +
    'left:50%;top:50%;transform:translate(-50%,-50%);width:min(800px,calc(100% - 24px));height:min(62%,520px)';
  function makeMock(position, bg) {
    var mock = document.createElement('div');
    mock.className = 'mock-content';
    mock.style.cssText = 'position:' + position + ';' + MOCK_CSS + ';background:' + (bg ? '#' + bg : 'rgba(250,244,230,.93)');
    mock.innerHTML = '<strong>Landing page content</strong><br>800 px wide, centred. Lifted characters are drawn in front of this window.';
    return mock;
  }

  // ---------------------------------------------------------------------------------------------- embed mode
  function runEmbed() {
    var page = params.get('page') || '1b1b1f';
    document.documentElement.style.cssText = 'height:100%;background:#' + page;
    document.body.style.cssText = 'margin:0;height:100%;overflow:hidden;background:#' + page;
    var mock = makeMock('fixed', params.get('mockbg'));
    mock.hidden = params.get('mock') === '0';
    document.body.appendChild(mock);
    MonthStage.loadManifest('layers.json').then(function (manifest) {
      window.__stage = MonthStage.mount({
        manifest: manifest, month: parseInt(params.get('month'), 10) || (new Date().getMonth() + 1),
        zoom: parseFloat(params.get('zoom')) || 1, lift: params.get('lift') || 'manifest', content: mock
      });
    }).catch(function (e) {
      document.body.insertAdjacentHTML('beforeend', '<pre style="position:fixed;z-index:99;color:#f66;background:#000;padding:8px">' + e + '</pre>');
    });
  }

  // ---------------------------------------------------------------------------------------------- host mode
  var VIEWPORTS = [
    { name: 'phone SE', w: 320, h: 568 }, { name: 'phone', w: 390, h: 844 }, { name: 'phone landscape', w: 844, h: 390 },
    { name: 'tablet portrait', w: 768, h: 1024 }, { name: 'tablet landscape', w: 1024, h: 768 },
    { name: 'laptop 16:10', w: 1440, h: 900 }, { name: 'HD 16:9', w: 1280, h: 720 }, { name: 'FHD 16:9', w: 1920, h: 1080 },
    { name: 'ultrawide 21:9', w: 2560, h: 1080 }, { name: 'ultrawide 32:9', w: 3840, h: 1080 }, { name: '4K 16:9', w: 3840, h: 2160 }
  ];
  var RESIZE_STEPS = [[390, 844], [1920, 1080], [800, 800], [2560, 1080], [320, 568], [1024, 768]];   // from the 1280x720 baseline
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function runHost() {
    var results = [], manifest = null, credits = null, devices = [];
    var $ = function (id) { return document.getElementById(id); };
    var monthSel = $('month'), zoomInp = $('zoom'), liftSel = $('lift'), mockChk = $('mock');
    MONTH_NAMES.forEach(function (n, i) { monthSel.add(new Option((i + 1) + ' ' + n, i + 1)); });
    monthSel.value = String(new Date().getMonth() + 1);

    // waits are counted in animation frames (ResizeObserver needs rendering), with a 60 ms timer fallback for throttled tabs
    function tick() {
      return new Promise(function (resolve) {
        var done = false; function fin() { if (!done) { done = true; resolve(); } }
        requestAnimationFrame(fin); setTimeout(fin, 60);
      });
    }
    function frames(n) { var p = Promise.resolve(); for (var i = 0; i < n; i++) { p = p.then(tick); } return p; }
    function waitUntil(fn, maxTicks, what) {
      var n = 0;
      return new Promise(function (resolve, reject) {
        (function poll() { if (fn()) { resolve(); } else if (++n > maxTicks) { reject(new Error('timeout: ' + what)); } else { tick().then(poll); } }());
      });
    }
    function record(group, name, ok, detail) { results.push({ group: group, name: name, ok: !!ok, detail: ok ? '' : (detail || '') }); }
    var fx = function (v) { return Math.round(v * 100) / 100; };
    var monthData = function (n) { return manifest.months.filter(function (m) { return m.month === n; })[0]; };

    // ---- devices --------------------------------------------------------------------------------------------
    function addDevice(def) {
      var cell = document.createElement('figure'); cell.className = 'dev';
      var cap = document.createElement('figcaption');
      var box = document.createElement('div'); box.className = 'box';
      var host = document.createElement('div'); host.className = 'host';
      box.appendChild(host); cell.appendChild(cap); cell.appendChild(box); $('grid').appendChild(cell);
      var mock = makeMock('absolute');
      host.appendChild(mock);
      var d = { def: def, host: host, box: box, cap: cap, mock: mock, w: def.w, h: def.h, k: 1 };
      d.stage = MonthStage.mount({ manifest: manifest, host: host, fixed: false, month: +monthSel.value, zoom: +zoomInp.value, lift: liftSel.value, content: mock });
      sizeDevice(d, def.w, def.h);
      devices.push(d);
      return d;
    }
    function sizeDevice(d, w, h) {
      d.w = w; d.h = h; d.k = Math.min(300 / w, 190 / h);
      d.host.style.width = w + 'px'; d.host.style.height = h + 'px'; d.host.style.transform = 'scale(' + d.k + ')';
      d.box.style.width = Math.round(w * d.k) + 'px'; d.box.style.height = Math.round(h * d.k) + 'px';
      d.cap.textContent = d.def.name + ' ' + w + '×' + h;
    }

    // ---- measuring one device (all rectangles in the device's own CSS pixels, undoing the preview scale) ----------
    function measure(d) {
      var hr = d.host.getBoundingClientRect(), k = d.host.offsetWidth ? hr.width / d.host.offsetWidth : 1;
      function rel(el) { var r = el.getBoundingClientRect(); return { left: (r.left - hr.left) / k, top: (r.top - hr.top) / k, width: r.width / k, height: r.height / k }; }
      var st = d.stage, el = st.elements, cs = function (e) { return getComputedStyle(e); };
      return {
        month: st.month, vw: d.host.clientWidth, vh: d.host.clientHeight,
        sheet: rel(el.sheetBack), frontSheet: rel(el.sheetFront), frame: st.frame,
        bg: { complete: el.bg.complete, nw: el.bg.naturalWidth, nh: el.bg.naturalHeight },
        layers: st.layers.map(function (l) {
          return { id: l.data.id, lifted: l.lifted, hidden: l.el.hidden, rect: rel(l.el), complete: l.el.complete, nw: l.el.naturalWidth, nh: l.el.naturalHeight };
        }),
        z: { back: cs(el.back).zIndex, front: cs(el.front).zIndex, content: cs(d.mock).zIndex },
        pe: { front: cs(el.front).pointerEvents, back: cs(el.back).pointerEvents },
        contentRect: d.mock.hidden ? null : rel(d.mock)
      };
    }
    function settle(d) { return d.stage.ready.then(function () { return frames(2); }); }

    // The stage follows a container resize by itself (ResizeObserver). Headless / background tabs may not deliver observer
    // callbacks, so after a short wait the window 'resize' event (the library's second trigger) is dispatched; the path used is reported.
    var resizePaths = { observer: 0, 'window resize event': 0 };
    function followResize(d, w, h) {
      var done = function () { return d.stage.frame.vw === w && d.stage.frame.vh === h; };
      return waitUntil(done, 25, 'observer').then(function () { resizePaths.observer++; }, function () {
        // no observer callback yet: the JS model is stale, but the CSS (container query units) must already cover the new size
        var R = measure(d), s = R.sheet;
        record('fill from CSS alone after a resize (before any JS relayout)', w + 'x' + h,
          s.left <= 0.75 && s.top <= 0.75 && s.left + s.width >= R.vw - 0.75 && s.top + s.height >= R.vh - 0.75,
          'sheet ' + [s.left, s.top, s.width, s.height].map(fx).join(',') + ' does not cover ' + R.vw + 'x' + R.vh);
        window.dispatchEvent(new Event('resize'));
        return waitUntil(done, 10, 'stage did not re-layout for ' + w + 'x' + h).then(function () { resizePaths['window resize event']++; });
      });
    }

    // ---- the assertions on one measurement ----------------------------------------------------------------------
    function evaluate(R, tag, expectZoom) {
      var M = monthData(R.month), W = M.background.width, H = M.background.height, s = R.sheet, vw = R.vw, vh = R.vh, eps = 0.75;
      var where = tag + ' m' + R.month + ' ' + vw + 'x' + vh, cover = Math.max(vw / W, vh / H);
      record('fill', where, s.left <= eps && s.top <= eps && s.left + s.width >= vw - eps && s.top + s.height >= vh - eps,
        'sheet ' + [s.left, s.top, s.width, s.height].map(fx).join(',') + ' does not cover ' + vw + 'x' + vh);
      record('aspect 16:9', where, Math.abs(s.width / s.height - W / H) / (W / H) < 0.002, 'ratio ' + s.width / s.height);
      record('cover scale (zoom ' + expectZoom + ')', where, Math.abs(s.width - W * cover * expectZoom) <= 1.5,
        'width ' + fx(s.width) + ' expected ' + fx(W * cover * expectZoom));
      if (expectZoom === 1) {
        record('not larger than needed', where, Math.min(s.width - vw, s.height - vh) <= 1.5, 'overshoot ' + fx(Math.min(s.width - vw, s.height - vh)) + ' px');
      }
      record('css == js model', where, ['left', 'top', 'width', 'height'].every(function (k) { return Math.abs(s[k] - R.frame[k]) <= 1; }),
        'dom ' + [s.left, s.top, s.width, s.height].map(fx).join(',') + ' model ' + ['left', 'top', 'width', 'height'].map(function (k) { return fx(R.frame[k]); }).join(','));
      record('background decoded', where, R.bg.complete && R.bg.nw === W && R.bg.nh === H, 'natural ' + R.bg.nw + 'x' + R.bg.nh + ' expected ' + W + 'x' + H);
      var fs = R.frontSheet;
      record('front stage == back stage', where, ['left', 'top', 'width', 'height'].every(function (k) { return Math.abs(fs[k] - s[k]) <= 0.5; }),
        'front ' + [fs.left, fs.top, fs.width, fs.height].map(fx).join(',') + ' back ' + [s.left, s.top, s.width, s.height].map(fx).join(','));
      var fp = { x: s.left + M.focus.x * s.width, y: s.top + M.focus.y * s.height };
      record('focus point visible', where, fp.x >= -eps && fp.x <= vw + eps && fp.y >= -eps && fp.y <= vh + eps, 'focus at ' + fx(fp.x) + ',' + fx(fp.y));   // focus 0 or 1 puts it exactly on the edge
      M.layers.forEach(function (L) {
        var r = R.layers.filter(function (x) { return x.id === L.id; })[0], scale = s.width / W;
        var exp = { left: s.left + L.x * scale, top: s.top + L.y * scale, width: L.width * scale, height: L.height * scale };
        if (!r || !r.hidden) {   // a layer that is not lifted is display:none and has no box; positions are checked with lift 'all'
          var okPos = !!r && ['left', 'top', 'width', 'height'].every(function (k) { return Math.abs(r.rect[k] - exp[k]) <= 1; });
          record('layer position', where + ' ' + L.id, okPos, r ? 'got ' + [r.rect.left, r.rect.top, r.rect.width, r.rect.height].map(fx).join(',') + ' expected ' + [exp.left, exp.top, exp.width, exp.height].map(fx).join(',') : 'layer missing');
        }
        record('layer decoded', where + ' ' + L.id, !!r && r.complete && r.nw === L.width && r.nh === L.height,
          r ? 'natural ' + r.nw + 'x' + r.nh + ' expected ' + L.width + 'x' + L.height : 'layer missing');
      });
      if (R.contentRect) { record('z-order back < content < front', where, +R.z.back < +R.z.content && +R.z.content < +R.z.front, JSON.stringify(R.z)); }
      record('stages ignore pointer', where, R.pe.front === 'none' && R.pe.back === 'none', JSON.stringify(R.pe));
    }

    // ---- the test run --------------------------------------------------------------------------------------------
    function status(msg) { $('status').textContent = msg; }
    function forAll(fn) { return Promise.all(devices.map(fn)); }

    function runTests() {
      results = []; var t0 = Date.now(), startMonth = +monthSel.value;
      $('run').disabled = true; status('running ...');
      var chain = forAll(function (d) { return d.stage.ready; });

      // 1. all 12 months on every viewport, every layer visible (lift 'all') so that each layer's position is measurable
      for (var m = 1; m <= 12; m++) {
        (function (month) {
          chain = chain.then(function () {
            status('month ' + month + ' / 12 on ' + devices.length + ' viewports');
            return forAll(function (d) {
              d.mock.hidden = false;
              var p = d.stage.setMonth(month); d.stage.setZoom(1); d.stage.setLift('all');
              return p.then(function () { return settle(d); }).then(function () { evaluate(measure(d), 'grid[' + d.def.name + ']', 1); });
            });
          });
        }(m));
      }

      // 2. live resize: one container is resized, the stage must re-layout by itself
      chain = chain.then(function () {
        var d = devices.filter(function (x) { return x.def.name === 'HD 16:9'; })[0], prev = null;
        return d.stage.setMonth(startMonth).then(function () { return settle(d); }).then(function () {
          prev = measure(d); evaluate(prev, 'resize baseline', 1);
          var c2 = Promise.resolve();
          RESIZE_STEPS.forEach(function (st) {
            c2 = c2.then(function () {
              status('resize to ' + st[0] + 'x' + st[1]);
              sizeDevice(d, st[0], st[1]);
              return followResize(d, st[0], st[1]);
            }).then(function () { return frames(2); }).then(function () {
              var R = measure(d), M = monthData(R.month), c = function (v) { return Math.max(v.vw / M.background.width, v.vh / M.background.height); };
              evaluate(R, 'resize', 1);
              var want = c(R) / c(prev);
              record('resize proportional', prev.vw + 'x' + prev.vh + ' -> ' + R.vw + 'x' + R.vh, Math.abs(R.sheet.width / prev.sheet.width - want) < 0.005 * want,
                'width ratio ' + R.sheet.width / prev.sheet.width + ' expected ' + want);
              prev = R;
            });
          });
          return c2.then(function () { sizeDevice(d, 1280, 720); return followResize(d, 1280, 720); });
        });
      });

      // 3. zoom ("slightly resizable"): still covers, still registered
      [1.1, 1.25, 1.5].forEach(function (z) {
        chain = chain.then(function () {
          status('zoom ' + z);
          return forAll(function (d) {
            d.stage.setMonth(startMonth); d.stage.setZoom(z); d.stage.setLift('all');
            return settle(d).then(function () { evaluate(measure(d), 'zoom ' + z + ' [' + d.def.name + ']', z); });
          });
        });
      });

      // 4. lift modes (expected values are recomputed here from the measured boxes, not taken from the library); a month with layers is needed
      var liftMonth = (manifest.months.filter(function (m) { return m.layers.length >= 2; })[0] || monthData(startMonth)).month;
      ['all', 'none', 'manifest', 'overlap'].forEach(function (mode) {
        chain = chain.then(function () {
          status('lift mode ' + mode);
          return forAll(function (d) {
            d.stage.setMonth(liftMonth); d.stage.setZoom(1); d.stage.setLift('all'); d.mock.hidden = false;
            return settle(d).then(function () {
              var all = measure(d);                       // every layer visible: gives the boxes for the overlap rule
              d.stage.setLift(mode);
              return settle(d).then(function () {
                var R = measure(d), M = monthData(R.month), where = 'lift ' + mode + ' [' + d.def.name + '] m' + R.month;
                R.layers.forEach(function (l) {
                  var L = M.layers.filter(function (x) { return x.id === l.id; })[0], want;
                  if (mode === 'all') { want = true; } else if (mode === 'none') { want = false; } else if (mode === 'manifest') { want = !!L.lift; }
                  else {
                    var a = all.layers.filter(function (x) { return x.id === l.id; })[0].rect, c = all.contentRect;
                    var w = Math.min(a.left + a.width, c.left + c.width) - Math.max(a.left, c.left), h = Math.min(a.top + a.height, c.top + c.height) - Math.max(a.top, c.top);
                    want = w > 0 && h > 0 && (w * h) / (a.width * a.height) >= 0.01;
                  }
                  record('lift ' + mode, where + ' ' + l.id, l.lifted === want && l.hidden === !want, 'lifted=' + l.lifted + ' hidden=' + l.hidden + ' expected lifted=' + want);
                });
              });
            });
          });
        });
      });

      return chain
        .catch(function (e) { record('harness', 'exception', false, String(e && e.stack || e)); })
        .then(function () { return applyControls(); })
        .then(function () { finish(Date.now() - t0); });
    }

    function finish(ms) {
      var failures = results.filter(function (r) { return !r.ok; }), groups = {}, order = [];
      results.forEach(function (r) {
        if (!groups[r.group]) { groups[r.group] = { ok: 0, total: 0 }; order.push(r.group); }
        groups[r.group].total++; if (r.ok) { groups[r.group].ok++; }
      });
      var tbody = $('results').querySelector('tbody'); tbody.textContent = '';
      order.forEach(function (g) {
        var tr = document.createElement('tr'), ok = groups[g].ok === groups[g].total;
        tr.className = ok ? 'pass' : 'fail';
        tr.innerHTML = '<td>' + g + '</td><td>' + groups[g].ok + ' / ' + groups[g].total + '</td><td>' + (ok ? 'PASS' : 'FAIL') + '</td>';
        tbody.appendChild(tr);
      });
      var list = $('failures'); list.textContent = '';
      var seen = {}, shown = failures.filter(function (r) { seen[r.group] = (seen[r.group] || 0) + 1; return seen[r.group] <= 3; });   // first 3 per check
      shown.slice(0, 40).forEach(function (r) { var li = document.createElement('li'); li.textContent = r.group + ' | ' + r.name + ' | ' + r.detail; list.appendChild(li); });
      var verdict = failures.length === 0 ? 'PASS' : 'FAIL';
      $('summary').textContent = verdict + ': ' + (results.length - failures.length) + ' / ' + results.length + ' checks passed in ' + Math.round(ms / 100) / 10 + ' s (live resizes followed via ResizeObserver: ' + resizePaths.observer + ', via window resize event: ' + resizePaths['window resize event'] + ')';
      $('summary').className = verdict.toLowerCase();
      document.body.dataset.status = verdict.toLowerCase();
      status('done'); $('run').disabled = false;
      window.__stageTest = { done: true, verdict: verdict, resizePaths: resizePaths, total: results.length, passed: results.length - failures.length, failed: failures.length, failures: shown.slice(0, 40), groups: groups };
      var pre = $('stage-test-json') || document.createElement('pre');
      pre.id = 'stage-test-json'; pre.hidden = true; pre.textContent = JSON.stringify(window.__stageTest); document.body.appendChild(pre);
    }

    // ---- controls ------------------------------------------------------------------------------------------------
    function applyControls() {
      $('zoomv').textContent = (+zoomInp.value).toFixed(2) + '×';
      var month = +monthSel.value;
      showCredit();
      return forAll(function (d) {
        d.mock.hidden = !mockChk.checked;
        var p = d.stage.month !== month ? d.stage.setMonth(month) : d.stage.ready;
        d.stage.setZoom(+zoomInp.value); d.stage.setLift(liftSel.value);
        return p;
      });
    }
    function showCredit() {
      var c = credits && credits.filter(function (x) { return x.month === +monthSel.value; })[0];
      if (c) { $('credit').innerHTML = 'Folio ' + c.folio + ', ' + c.name_en + ' – ' + c.artist_or_institution + ' – ' + c.licence + ' – <a href="' + c.commons_file_page + '">Wikimedia Commons</a>'; }
    }
    [monthSel, zoomInp, liftSel, mockChk].forEach(function (c) { c.addEventListener('input', applyControls); });
    $('run').addEventListener('click', runTests);

    Promise.all([MonthStage.loadManifest('layers.json'), fetch('credits.json').then(function (r) { return r.json(); }).catch(function () { return null; })])
      .then(function (a) {
        manifest = a[0]; credits = a[1]; showCredit();
        VIEWPORTS.forEach(addDevice);
        return forAll(function (d) { return d.stage.ready; });
      })
      .then(function () { if (params.get('autorun') !== '0') { return runTests(); } })
      .catch(function (e) { $('summary').textContent = 'Cannot run: ' + e + ' (open this page over http, not file://, so layers.json can be fetched).'; $('summary').className = 'fail'; });
  }

  // everything above is defined: start
  if (params.get('embed')) { runEmbed(); } else { runHost(); }
}());
