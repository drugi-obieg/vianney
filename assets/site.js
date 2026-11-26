// The script of the site: the search box, the back and forward buttons, the Copy buttons, and on a phone the way of iOS Settings
// (the sidebar is the list, and the page slides in over it). Everything works without it, except these.
(function () {
  'use strict';
  var root = document.documentElement;
  var nav = document.getElementById('nav');
  var search = document.getElementById('search');
  var mobile = window.matchMedia('(max-width: 640px)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ---- search: narrows the list of pages; Enter opens the first that is left
  if (search && nav) {
    var items = Array.prototype.slice.call(nav.querySelectorAll('.nav-item'));
    var empty = document.createElement('div');
    empty.className = 'no-hit';
    empty.textContent = 'Nothing matches.';
    empty.hidden = true;
    nav.appendChild(empty);
    var norm = function (s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };
    var apply = function () {
      var q = norm(search.value.trim());
      var shown = 0;
      items.forEach(function (a) { var hit = !q || norm(a.textContent).indexOf(q) !== -1; a.classList.toggle('dim', !hit); if (hit) shown++; });
      empty.hidden = shown !== 0;
    };
    search.addEventListener('input', apply);
    search.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { search.value = ''; apply(); return; }
      if (e.key !== 'Enter') return;
      var first = items.filter(function (a) { return !a.classList.contains('dim'); })[0];
      if (first) first.click();
    });
  }

  // ---- characters of the painting in front of the window (assets/months/stage.js): in the months listed in _data/wallpaper.yml, and on any page with
  // ?lift=overlap. Only where there is a window to step out of: on a tablet and a desktop, never on a phone, where the page fills the screen.
  var shownMonth = parseInt(root.getAttribute('data-month'), 10);
  var liftMonths = (root.getAttribute('data-lift-months') || '').split(',').map(Number);
  var lift = new URLSearchParams(location.search).get('lift') || (liftMonths.indexOf(shownMonth) !== -1 ? 'overlap' : null);
  var stage = null;
  var stageLoading = false;
  var stopStage = function () {
    if (stage) { stage.destroy(); stage = null; }
    root.removeAttribute('data-stage');
  };
  var startStage = function () {
    if (!lift || lift === 'none' || mobile.matches || stage || stageLoading) return;
    stageLoading = true;
    var base = document.querySelector('link[rel="stylesheet"][href*="site.css"]').href.replace(/site\.css.*$/, 'months/');
    var mount = function () {
      window.MonthStage.loadManifest(base + 'layers.json').then(function (manifest) {
        stageLoading = false;
        if (mobile.matches) return;                       // the screen became a phone's while this loaded
        root.setAttribute('data-stage', lift);
        stage = window.MonthStage.mount({ manifest: manifest, month: shownMonth, lift: lift, content: document.querySelector('.app'), zoom: 1.08 });
      }, function () { stageLoading = false; });
    };
    if (window.MonthStage) { mount(); return; }
    var tag = document.createElement('script');
    tag.src = base + 'stage.js';
    tag.onload = mount;
    tag.onerror = function () { stageLoading = false; };
    document.head.appendChild(tag);
  };
  if (mobile.addEventListener) mobile.addEventListener('change', function () { if (mobile.matches) stopStage(); else startStage(); });
  startStage();

  // ---- Copy buttons: a button with data-copy puts that text on the clipboard
  // (a link to chrome://extensions is a real link, but a browser does not open chrome:// addresses from a page: it is copied instead)
  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (button) {
    var label = button.textContent;
    var isLink = button.tagName === 'A';
    var done = function () { button.textContent = isLink ? 'Copied: paste it into the address bar' : 'Copied'; setTimeout(function () { button.textContent = label; }, isLink ? 2600 : 1600); };
    button.addEventListener('click', function (e) {
      if (isLink) e.preventDefault();
      var text = button.getAttribute('data-copy');
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, fallback); } else fallback();
      function fallback() {
        var box = document.createElement('textarea');
        box.value = text;
        box.setAttribute('readonly', '');
        box.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(box);
        box.select();
        try { if (document.execCommand('copy')) done(); } catch (e) { /* nothing to do */ }
        box.remove();
      }
    });
  });

  // ---- ?month= and ?lift= stay in the links of the site, so that the painting can be looked at page by page
  var keep = new URLSearchParams(location.search);
  ['month', 'lift'].forEach(function (name) {
    var value = keep.get(name);
    if (value === null) return;
    Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function (a) {
      if (a.hostname !== location.hostname || a.protocol.indexOf('http') !== 0 || /\.zip$/.test(a.pathname)) return;
      var u = new URL(a.href);
      u.searchParams.set(name, value);
      a.href = u.href;
    });
  });

  // ---- a phone: the sidebar is the list and the page slides in over it, as in iOS Settings.
  // <html data-screen> is "list" or "page" (the layout sets it: the list on the home page, the page everywhere else), and the stylesheet shows
  // one of the two. Moving between them in the same document, and going to another page, both use view transitions where the browser has them.
  var home = root.getAttribute('data-home') === 'yes';
  var screenFor = function () { return home && location.hash === '#menu' ? 'list' : 'page'; };
  var go = function (screen, dir) {
    var change = function () { root.setAttribute('data-screen', screen); window.scrollTo(0, 0); };
    root.setAttribute('data-nav', dir);
    if (document.startViewTransition && mobile.matches && !reduced.matches) document.startViewTransition(change); else change();
  };
  var remember = function (dir) { try { sessionStorage.setItem('vianney-nav', dir); } catch (e) { /* private mode */ } };

  // A phone that opens the home page lands on the Idea page, with the list one step back, as if the Idea row had been tapped:
  // the list is the entry #menu, the page the entry #open on top of it, so Back goes to the list and a second Back leaves the site.
  if (home && mobile.matches && !location.hash) {
    try {
      history.replaceState(null, '', location.pathname + location.search + '#menu');
      history.pushState({ screen: 'page' }, '', location.pathname + location.search + '#open');
    } catch (e) { /* the page keeps working without the extra entry */ }
  }

  window.addEventListener('pagereveal', function (e) {
    var dir = 'forward';
    try { dir = sessionStorage.getItem('vianney-nav') || 'forward'; sessionStorage.removeItem('vianney-nav'); } catch (err) { /* private mode */ }
    var act = window.navigation && window.navigation.activation;
    if (act && act.navigationType === 'traverse' && act.from && act.entry) dir = act.entry.index < act.from.index ? 'back' : 'forward';
    root.setAttribute('data-nav', dir);
    root.setAttribute('data-arrived', e.viewTransition ? 'transition' : 'plain');     // for the tests
  });

  if (nav) {
    var samePage = function (a) { return a.pathname === location.pathname; };
    var onList = function (e) {
      var a = e.target.closest && e.target.closest('a.nav-item, a.status-card');
      if (!a || !mobile.matches || a.target === '_blank' || /^https?:/.test(a.getAttribute('href')) && a.hostname !== location.hostname) return;
      if (samePage(a)) {                                   // the page that is open: slide it in
        e.preventDefault();
        if (root.getAttribute('data-screen') !== 'page') { history.pushState({ screen: 'page' }, '', location.pathname + location.search + '#open'); go('page', 'forward'); }
        return;
      }
      e.preventDefault();                                  // another page: it opens as a page, not as the list
      remember('forward');
      root.setAttribute('data-nav', 'forward');
      location.href = a.href.split('#')[0] + '#open';
    };
    nav.addEventListener('click', onList);
    var card = document.querySelector('.status-card');
    if (card) card.addEventListener('click', onList);
  }

  // ---- back and forward, as in the System Settings toolbar (on a phone: back goes to the list)
  var back = document.getElementById('back');
  var forward = document.getElementById('forward');
  if (back && forward) {
    var sync = function () {
      var n = window.navigation;
      back.disabled = mobile.matches ? false : (n ? !n.canGoBack : history.length < 2);
      forward.disabled = n ? !n.canGoForward : false;
    };
    back.addEventListener('click', function () {
      if (mobile.matches) {
        if (root.getAttribute('data-screen') === 'list') return;
        if (history.state && history.state.screen === 'page') history.back(); else go('list', 'back');
      } else history.back();
    });
    forward.addEventListener('click', function () { history.forward(); });
    if (window.navigation && window.navigation.addEventListener) window.navigation.addEventListener('navigatesuccess', sync);
    window.addEventListener('pageshow', sync);
    if (mobile.addEventListener) mobile.addEventListener('change', sync);
    sync();
  }
  window.addEventListener('popstate', function () {
    var want = screenFor();
    if (root.getAttribute('data-screen') !== want) go(want, want === 'list' ? 'back' : 'forward');
  });
})();
