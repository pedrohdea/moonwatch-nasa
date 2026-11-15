// Shared page shell: nav + #home + #track + #about. Must load before table.js and boot.js.
(function (root) {
  'use strict';

  var doc = root.document;
  var lib = doc.body.getAttribute('data-lib') || 'Chart';
  var data = root.MoonSeries.dataset;

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
  }

  // Accuracy visualization versions (?viz=), kept with the current dataset.
  var vizLinks = root.MoonSeries.vizModes.map(function (m) {
    var url = new URL(root.location.href);
    url.searchParams.set('viz', m.key);
    url.searchParams.set('seed', root.MoonSeries.seed); // same random points in every version
    url.hash = 'track';
    var current = m.key === root.MoonSeries.viz ? ' aria-current="page"' : '';
    return '<a class="variant viz-pill" data-viz="' + m.key + '" href="' + url.search + url.hash + '"' + current + '>' + m.label + '</a>';
  }).join('');
  var rerollHref = (function () {
    var url = new URL(root.location.href);
    url.searchParams.delete('seed');
    url.hash = 'track';
    return url.search + url.hash;
  })();
  var vizMode = root.MoonSeries.vizModes.filter(function (m) { return m.key === root.MoonSeries.viz; })[0];
  var stops = root.MoonSeries.accuracyStops;
  var accDomain = root.MoonSeries.accuracyDomain;
  function vizInfoHtml(mode) {
    return '<strong>Confidence · ' + mode.label + ':</strong> ' + mode.help +
      ' Reference = ' + root.MoonSeries.dataset.referenceLabel + '.' +
      (mode.key === 'color'
        ? ' <span class="acc-scale" style="background:linear-gradient(90deg,' + stops.join(',') + ')"></span> <span class="mono">' + accDomain[0] + '% → 100%</span>'
        : '') +
      ' <span id="viz-hint" class="viz-hint"></span>' +
      ' <a class="reroll" href="' + rerollHref + '">Re-roll</a>';
  }

  var datasetOptions = root.MoonSeries.datasets.map(function (d) {
    return '<option value="' + d.key + '"' + (d.key === data.key ? ' selected' : '') + '>' + escapeHtml(d.label) + '</option>';
  }).join('');

  // Disclaimers live in #references (after About); the text shows an asterisk mark linking to them.
  function refMark(n) { return '<sup class="ref-mark"><a href="#ref-' + n + '" id="refmark-' + n + '" aria-label="Reference ' + n + '">*' + n + '</a></sup>'; }
  var datasetInfo = data.kind === 'spurious'
    ? escapeHtml(data.title) + ' · r = ' + data.r.toFixed(4) +
      ' · each series normalized to 0–10; actual values in the table; random confidence (usability test). Source: <a href="' + data.url + '" target="_blank" rel="noopener">Tyler Vigen, Spurious Correlations</a> (CC BY 4.0).'
    : data.kind === 'viability'
    ? 'Simulated viability of the 50 sites in <code>dLandingSites.csv</code>, from ' + data.xDate(0) + ' to ' + data.xDate(data.xRange[1]) +
      ': one series per mission (missionID) = daily mean of its 5 sites. X axis in dates. Random confidence (usability test).'
    : '20 types of math curves, simulated data: 21 measured points per curve (x from 0 to 10), with random confidence: the lower it is, the farther the point sits from the theoretical curve.';

  var REFS = [
    'Viability, Departure and Deadline models and formulas are grounded in data from NASA’s <a href="https://science.nasa.gov/mission/lro/" target="_blank" rel="noopener">Lunar Reconnaissance Orbiter (LRO)</a> lunar maps and the <a href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noopener">DONKI</a> space weather database (Space Weather Database Of Notifications, Knowledge, Information).',
    datasetInfo,
    'NASA data (public domain): Canvas texture from <a href="https://trek.nasa.gov/moon/" target="_blank" rel="noopener">NASA Moon Trek</a> (LRO WAC mosaic), fallback SVS CGI Moon Kit; three.js globe from <a href="https://svs.gsfc.nasa.gov/14959/" target="_blank" rel="noopener">NASA SVS Moon 3D model</a>; Terrain 3D from <a href="https://science.nasa.gov/3d-resources/" target="_blank" rel="noopener">NASA 3D Resources</a>. Coordinates: <a href="https://moon3dmap.com/pt/" target="_blank" rel="noopener">moon3dmap.com</a>.'
  ];

  // Improvements & Fixes (#roadmap): cards in the style of spaceappschallenge.org/2026/challenges (image, title, Type / Status / Areas chips, text).
  var TILE = 'shared/vendor/nasa/moontrek/3/'; // vendored NASA Moon Trek tiles as thumbnails
  var ROADMAP = [
    { title: 'Transit time from Departure and daily variables', type: 'Improvement', status: 'Planned', areas: ['Chart', 'Transit time'], img: TILE + '3/8.jpg',
      text: 'Recalculate transit time from the Departure date and day-to-day variables (daily lunar conditions and space weather), instead of fixed offsets.' },
    { title: 'Models grounded in NASA LRO and DONKI data', type: 'Improvement', status: 'Planned', areas: ['Viability', 'Departure', 'Deadline'], img: TILE + '2/7.jpg',
      text: 'Ground the Viability, Departure and Deadline models in real NASA LRO lunar maps and DONKI space weather data (today the viability data is simulated).' },
    { title: 'Real-time viability', type: 'Improvement', status: 'Planned', areas: ['Data lake', 'Viability'], img: TILE + '4/9.jpg',
      text: 'Ingest official internal NASA sources (not mapped yet) into a structured data lake, following the current star schema, relate them by landing site and date, and compute viability in real time.' },
    { title: 'Demo and pilot with historical missions', type: 'Improvement', status: 'Planned', areas: ['Validation', 'Missions'], img: TILE + '3/6.jpg',
      text: 'Run a demo and a pilot on past missions, both on time and delayed: replay their real Departure, landing and Deadline dates and check whether MoonWatch would have flagged the risk before the delay.' },
    { title: 'Sun–Earth–Moon animation', type: 'Improvement', status: 'Planned', areas: ['Landing & Impact Sites', 'Animation'], img: TILE + '2/9.jpg',
      text: 'Animation showing the bodies\u2019 positions on the launch (Departure), landing and Deadline dates, displayed next to the Moon globe in Landing & Impact Sites.' }
  ];
  function roadmapCard(r) {
    var chip = function (cls, t) { return '<span class="chip ' + cls + '">' + escapeHtml(t) + '</span>'; };
    return '<article class="roadmap-card">' +
      '<div class="roadmap-img" style="background-image:url(' + r.img + ')" role="img" aria-label="NASA Moon Trek image"></div>' +
      '<div class="roadmap-body">' +
        '<h3>' + escapeHtml(r.title) + '</h3>' +
        '<dl class="roadmap-meta">' +
          '<div><dt>Type</dt><dd>' + chip(r.type === 'Fix' ? 'chip-fix' : 'chip-improvement', r.type) + '</dd></div>' +
          '<div><dt>Status</dt><dd>' + chip('chip-status', r.status) + '</dd></div>' +
          '<div><dt>Areas</dt><dd>' + r.areas.map(function (a) { return chip('chip-area', a); }).join('') + '</dd></div>' +
        '</dl>' +
        '<p>' + escapeHtml(r.text) + '</p>' +
      '</div>' +
    '</article>';
  }

  // Mission Definitions: simplified roadmap cards (title, one category chip, text), 2 columns.
  var DEFINITIONS = [
    { title: 'Objective', tag: 'Goal', text: 'Help planners, educators, and the public compare landing sites and dates quickly and intuitively.' },
    { title: 'Landing site', tag: 'Location', text: 'Candidate location on the lunar surface, defined by selenographic latitude and longitude.' },
    { title: 'Elevation', tag: 'Measurement', text: 'Angle of the Sun or Earth above (positive) or below (negative) the local horizon, in degrees.' },
    { title: 'Illumination window', tag: 'Window', text: 'Period with the Sun above the local horizon: potential for solar power generation.' },
    { title: 'Communication window', tag: 'Window', text: 'Period with the Earth above the local horizon: direct-to-Earth (DTE) communication without a relay satellite.' },
    { title: 'South Pole constraints', tag: 'Constraint', text: 'The Sun and Earth stay low on the horizon, so small changes in date and location greatly change illumination and communication.' }
  ];
  function definitionCard(d) {
    return '<article class="roadmap-card roadmap-card-simple">' +
      '<div class="roadmap-body">' +
        '<h3>' + escapeHtml(d.title) + '</h3>' +
        '<p class="roadmap-tags"><span class="chip chip-area">' + escapeHtml(d.tag) + '</span></p>' +
        '<p>' + escapeHtml(d.text) + '</p>' +
      '</div>' +
    '</article>';
  }

  doc.body.insertAdjacentHTML('afterbegin',
    '<header class="topbar">' +
      '<a class="brand" href="#home">Moon<span>Watch</span></a>' +
      '<nav class="nav" aria-label="Sections">' +
        '<a href="#home">Home</a><a href="#track">Track</a><a href="#mission">Mission</a><a href="#roadmap">Roadmap</a><a href="#about">About</a>' +
      '</nav>' +
      '<div class="settings">' +
        '<button type="button" class="settings-toggle" aria-expanded="false" aria-controls="settings-panel" aria-label="Settings" title="Settings">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
        '</button>' +
        '<div id="settings-panel" class="settings-panel" hidden>' +
          '<div class="variants viz" role="group" aria-label="Confidence visualization"><span class="variants-label">Confidence</span>' + vizLinks + '</div>' +
        '</div>' +
      '</div>' +
    '</header>' +
    '<main>' +
      '<section id="home" class="hero">' +
        '<div class="wrap">' +
          '<p class="eyebrow">Usability prototype · ' + lib + '</p>' +
          '<h1>Compare landing sites,<br>filter with a click.</h1>' +
          '<p class="lead">Daily viability of candidate lunar landing sites, grouped by mission.' + refMark(1) + ' Click a line to filter the table, the viable areas and the site map.</p>' +
        '</div>' +
      '</section>' +
      '<section id="track" class="track" title="Click a line to filter. Click an empty area or “Clear filter” to see everything. Use the mouse wheel or drag to zoom.">' +
        '<div class="wrap">' +
          '<h2>Track</h2>' +
          '<label class="dataset-picker">Dataset ' +
            '<select id="dataset-select">' + datasetOptions + '</select>' +
          '</label>' + refMark(2) +
          '<label class="all-series"><input type="checkbox" id="all-series" checked> ' + (data.kind === 'viability' ? 'All missions' : 'All series') + '</label>' +
          '<div id="chart" class="chart" role="img" aria-label="Line chart of the dataset series"></div>' +
          '<p class="viz-info">' + vizInfoHtml(vizMode) + '</p>' +
          '<div class="toolbar">' +
            '<span id="filter-badge" class="badge" role="status" aria-live="polite"></span>' +
            '<button id="clear-filter" class="btn btn-ghost" type="button">Clear filter</button>' +
            '<button id="reset-zoom" class="btn btn-ghost" type="button">Reset zoom</button>' +
          '</div>' +
          '<div id="fill-areas" class="fill-areas" role="status" aria-live="polite" aria-label="Viable area per series"></div>' +
          '<div class="toolbar vlines-bar departure-bar" aria-label="Departure">' +
            '<span class="vlines-label" title="Moving the departure moves every transit time line with it">Departure</span>' +
            '<div id="departure-list" class="vlines-list"></div>' +
          '</div>' +
          '<div class="toolbar vlines-bar departure-bar deadline-bar" aria-label="Deadline">' +
            '<span class="vlines-label" title="Viable areas only count up to the deadline">Deadline</span>' +
            '<div id="deadline-list" class="vlines-list"></div>' +
          '</div>' +
          '<div class="toolbar vlines-bar" aria-label="Transit time">' +
            '<span class="vlines-label" title="One vertical line per series (V1…Vn): the fill starts at it">Transit time [days]</span>' +
            '<div id="vlines-list" class="vlines-list"></div>' +
            '<button id="vline-add" class="btn btn-ghost" type="button">+ Transit time</button>' +
          '</div>' +
          '<div class="toolbar vlines-bar hlines-bar" aria-label="Minimum viability">' +
            '<span class="vlines-label" title="One line for all series: the fill stays above it">Minimum viability</span>' +
            '<div id="hlines-list" class="vlines-list"></div>' +
          '</div>' +
          '<div class="table-bar" data-for="table-box"><span class="table-bar-title">Data table</span>' +
            '<input type="search" id="table-search" class="table-search" placeholder="Filter rows…" aria-label="Filter data table rows">' +
            '<button type="button" class="btn btn-ghost table-toggle" aria-controls="table-box" aria-expanded="false">Expand</button></div>' +
          '<div class="table-box is-min" id="table-box" tabindex="0" aria-label="Chart data">' +
            '<table class="data">' +
              '<thead id="table-head"></thead>' +
              '<tbody id="table-body"></tbody>' +
            '</table>' +
            '<div id="table-sentinel" class="sentinel">Loading more rows…</div>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section id="mission" class="mission">' +
        '<div class="wrap">' +
          '<h2>Mission Definitions</h2>' +
          '<p class="hint">Concepts used to compare landing sites and dates at the lunar south pole.</p>' +
          '<div class="roadmap-list">' + DEFINITIONS.map(definitionCard).join('') + '</div>' +
        '</div>' +
      '</section>' +
      '<section id="roadmap" class="about roadmap">' +
        '<div class="wrap">' +
          '<h2>Improvements &amp; Fixes</h2>' +
          '<p class="hint">Planned work for MoonWatch. Not implemented yet.</p>' +
          '<div class="roadmap-bar"><input type="search" id="roadmap-search" class="table-search" placeholder="Search by improvement or fix" aria-label="Search improvements and fixes"></div>' +
          '<p id="roadmap-count" class="roadmap-count"></p>' +
          '<div id="roadmap-list" class="roadmap-list">' + ROADMAP.map(roadmapCard).join('') + '</div>' +
        '</div>' +
      '</section>' +
      '<section id="about" class="about">' +
        '<div class="wrap">' +
          '<h2>About</h2>' +
          '<p>MoonWatch is a prototype by the Myr Battlesphere team for the <em>Lunar Landing Site Navigator</em> challenge of the NASA Space Apps Challenge 2026.</p>' +
          '<p>This page tests chart usability for comparing landing sites and dates. There are three kinds of dataset:</p>' +
          '<ul>' +
            '<li><strong>Math curves (simulated)</strong>: 20 curve types, from linear to cosine, with 21 measured points each (x from 0 to 10, y between 0 and 10).</li>' +
            '<li><strong>Simulated site viability (default)</strong>: daily viability of 50 simulated landing sites (2024-01-01 to 2025-12-31), one line per mission (mean of its 5 sites); mission names from <code>dMission.csv</code>.</li>' +
            '<li><strong>Spurious correlations (real)</strong>: four examples from <a href="https://www.tylervigen.com/spurious-correlations" target="_blank" rel="noopener">Spurious Correlations</a> by Tyler Vigen (CC BY 4.0). High correlation does not imply causation.</li>' +
          '</ul>' +
          '<p>The chart is drawn from the table points. Each point has a <strong>confidence</strong> (0–100%): in this prototype it is <strong>random</strong> (drawn on each load; <code>?seed=N</code> repeats a draw). On the curves, the point sits away from the theoretical curve in proportion to the confidence: 100% on the curve, 0% at 2.5 units from it. On the spurious correlations the values are real and only the confidence is random.</p>' +
          '<p>Charts by <a href="https://www.chartjs.org/" target="_blank" rel="noopener">Chart.js</a> 4.4.1, with no network dependency (local library).</p>' +
        '</div>' +
      '</section>' +
      '<section id="references" class="about references">' +
        '<div class="wrap">' +
          '<h2>References</h2>' +
          '<ol class="refs">' + REFS.map(function (text, i) {
            var n = i + 1;
            return '<li id="ref-' + n + '"><span class="ref-num">*' + n + '</span> <span><span class="ref-text">' + text + '</span> <a class="ref-back" href="#refmark-' + n + '" aria-label="Back to the text">↩</a></span></li>';
          }).join('') + '</ol>' +
        '</div>' +
      '</section>' +
    '</main>' +
    '<footer class="footer"><div class="wrap">' +
      '<p class="footer-brand"><strong>MoonWatch</strong> · Myr Battlesphere · NASA Space Apps Challenge 2026 · <em>Lunar Landing Site Navigator</em></p>' +
      '<p>Next: transit time recalculated from Departure and day-to-day variables · <a href="#roadmap">Improvements &amp; Fixes</a></p>' +
    '</div></footer>'
  );

  // Roadmap search: text filter over the cards + "Currently returning N items".
  var roadmapSearch = doc.getElementById('roadmap-search');
  function filterRoadmap() {
    var q = roadmapSearch.value.trim().toLowerCase();
    var cards = doc.querySelectorAll('#roadmap-list .roadmap-card');
    var shown = 0;
    cards.forEach(function (c) { c.hidden = q !== '' && c.textContent.toLowerCase().indexOf(q) < 0; if (!c.hidden) shown++; });
    doc.getElementById('roadmap-count').textContent = 'Currently returning ' + shown + ' of ' + cards.length + ' items';
  }
  roadmapSearch.addEventListener('input', filterRoadmap);
  filterRoadmap();

  // Asterisk marks show their reference on hover (title = note text). After DOMContentLoaded: landing.js adds its mark later.
  doc.addEventListener('DOMContentLoaded', function () {
    doc.querySelectorAll('.ref-mark a').forEach(function (a) {
      var note = doc.querySelector(a.getAttribute('href') + ' .ref-text');
      if (note) a.title = note.textContent.trim();
    });
  });

  // Settings gear: expands the panel with the Confidence modes; outside click or Esc closes it.
  var settingsToggle = doc.querySelector('.settings-toggle');
  var settingsPanel = doc.getElementById('settings-panel');
  function setSettings(open) {
    settingsPanel.hidden = !open;
    settingsToggle.setAttribute('aria-expanded', String(open));
  }
  settingsToggle.addEventListener('click', function () { setSettings(settingsPanel.hidden); });
  doc.addEventListener('click', function (e) { if (!settingsPanel.hidden && !e.target.closest('.settings')) setSettings(false); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !settingsPanel.hidden) { setSettings(false); settingsToggle.focus(); } });

  // Fixed top bar: reserve exactly its height (it wraps on narrow screens) for the body and anchor offsets.
  var topbar = doc.querySelector('.topbar');
  function syncTopbar() { doc.documentElement.style.setProperty('--topbar-h', topbar.offsetHeight + 'px'); }
  syncTopbar();
  root.addEventListener('resize', syncTopbar);
  if (root.document.fonts && root.document.fonts.ready) root.document.fonts.ready.then(syncTopbar); // web fonts change its width

  // Modes drawn only on focused series tell the user to pick one when nothing is focused.
  var hint = doc.getElementById('viz-hint');
  function updateHint(index) {
    var needsFocus = ['band', 'label'].indexOf(root.MoonSeries.viz) >= 0;
    hint.textContent = needsFocus && root.MoonSeries.focus(index).length === 0 ? 'Select a line to see it.' : '';
  }
  root.MoonCore.onFilterChange(updateHint);
  updateHint(root.MoonCore.getFilter());

  // Accuracy pills switch the visualization in place: filter, legend, lines, tables and scroll stay; only the chart redraws.
  doc.addEventListener('click', function (e) {
    var pill = e.target.closest && e.target.closest('.viz-pill');
    if (!pill || e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; // let "open in new tab" work
    e.preventDefault();
    root.MoonSeries.setViz(pill.getAttribute('data-viz'));
  });
  root.MoonSeries.onVizChange(function (key) {
    doc.querySelectorAll('.viz-pill').forEach(function (p) {
      if (p.getAttribute('data-viz') === key) p.setAttribute('aria-current', 'page'); else p.removeAttribute('aria-current');
    });
    var mode = root.MoonSeries.vizModes.filter(function (m) { return m.key === key; })[0];
    doc.querySelector('.viz-info').innerHTML = vizInfoHtml(mode);
    hint = doc.getElementById('viz-hint');
    updateHint(root.MoonCore.getFilter());
    var url = new URL(root.location.href);
    url.searchParams.set('viz', key);
    url.searchParams.set('seed', root.MoonSeries.seed);
    root.history.replaceState(null, '', url);
  });

  // Line chips (vertical and horizontal share the pattern): one chip per line with a number input and ×,
  // plus an add button; values kept in the URL (replaceState, no reload). Line k <-> series k (color, visibility).
  // opts: {param, listId, addId|null, removable, tag(i), color(i), visible(i), kind,
  //        show(line) -> input value, write(id, inputValue, source), input: {type, min, max, step}}
  function lineBar(set, opts) {
    var list = doc.getElementById(opts.listId);
    var add = opts.addId ? doc.getElementById(opts.addId) : null;
    var input = opts.input || { type: 'number', min: set.min, max: set.max, step: set.step === 1 ? '1' : '0.1' };
    var show = opts.show || function (l) { return l.value; };
    var write = opts.write || function (id, v, source) { set.set(id, v, source); };
    var param = opts.param;
    var kind = opts.kind;

    function render(lines, source) {
      var url = new URL(root.location.href);
      url.searchParams.set(param, lines.map(function (l) { return l.value; }).join(','));
      root.history.replaceState(null, '', url);
      if (add) add.disabled = lines.length >= set.limit;
      // While typing, keep the focused input (and its caret) untouched.
      if (source === 'input') return;
      list.innerHTML = lines.map(function (l, i) {
        var color = opts.color(i);
        var hiddenAttr = opts.visible(i) ? '' : ' hidden'; // series hidden in the legend
        var tag = opts.tag(i);
        return '<span class="vline-chip" data-id="' + l.id + '" style="border-color:' + color + '"' + hiddenAttr + '>' +
          (tag ? '<span class="vline-tag" style="color:' + color + '" title="' + root.MoonSeries.all[i % root.MoonSeries.all.length].name + '">' + tag + '</span>' : '') +
          '<input type="' + input.type + '" step="' + input.step + '" min="' + input.min + '" max="' + input.max + '" value="' + show(l) + '" aria-label="' + kind + ' line' + (tag ? ' ' + tag : '') + '">' +
          (opts.removable ? '<button type="button" class="vline-remove" aria-label="Remove ' + kind + ' line ' + tag + '" title="Remove">×</button>' : '') +
        '</span>';
      }).join('') || '<span class="vlines-empty">none</span>';
    }

    list.addEventListener('input', function (e) {
      var chip = e.target.closest('.vline-chip');
      if (chip && e.target.tagName === 'INPUT') write(Number(chip.getAttribute('data-id')), e.target.value, 'input');
    });
    list.addEventListener('change', function () { render(set.list(), 'change'); }); // show the clamped value
    list.addEventListener('click', function (e) {
      var chip = e.target.closest('.vline-chip');
      if (chip && e.target.classList.contains('vline-remove')) set.remove(Number(chip.getAttribute('data-id')), 'button');
    });
    if (add) add.addEventListener('click', function () { set.add(null, 'button'); });
    set.onChange(render);
    render(set.list(), 'init');
    return function () { render(set.list(), 'visibility'); };
  }

  var vl = root.MoonCore.vlines;
  var hl = root.MoonCore.hlines;
  var dep = root.MoonCore.departure;
  var span = data.xRange[1] - data.xRange[0];

  // Departure: a date input when the x axis is a day index (viability), a number otherwise.
  var start = root.MoonViability && data.xDate ? Date.parse(root.MoonViability.start + 'T00:00:00Z') : null;
  function isoFromDay(day) { return new Date(start + Math.round(day) * 864e5).toISOString().slice(0, 10); }
  function dayFromIso(iso) { return Math.round((Date.parse(iso + 'T00:00:00Z') - start) / 864e5); }
  // Departure and Deadline: single-line bars with a date input when the x axis is a day index.
  function dateLineBar(set, param, label, color) {
    var opts = {
      param: param, listId: param + '-list', addId: null, removable: false, kind: param,
      tag: function () { return ''; }, color: function () { return color; }, visible: function () { return true; } // the bar label already names it
    };
    if (start !== null) {
      opts.input = { type: 'date', min: isoFromDay(data.xRange[0]), max: isoFromDay(data.xRange[1]), step: 1 };
      opts.show = function (l) { return isoFromDay(l.value); };
      opts.write = function (id, v, source) { if (v) set.set(id, dayFromIso(v), source); };
    }
    lineBar(set, opts);
  }
  dateLineBar(dep, 'departure', 'Departure', '#FFFFFF');
  dateLineBar(root.MoonCore.deadline, 'deadline', 'Deadline', '#FF6A3D');

  // Travel-time chips show the duration from the departure; typing it moves only that line.
  var refreshVChips = lineBar(vl, {
    param: 'transit', listId: 'vlines-list', addId: 'vline-add', removable: true, kind: 'transit time',
    tag: function (i) { return 'V' + (i + 1); }, color: root.MoonCore.vlineColor, visible: root.MoonCore.vlineVisible,
    input: { type: 'number', min: -span, max: span, step: vl.step === 1 ? '1' : '0.1' },
    show: function (l) { return root.MoonCore.travelTime(l.id); },
    write: function (id, v, source) { root.MoonCore.setTravelTime(id, v, source); }
  });
  var refreshHChips = lineBar(hl, {
    param: 'threshold', listId: 'hlines-list', addId: null, removable: false, kind: 'minimum viability',
    tag: root.MoonCore.hlineLabel, color: root.MoonCore.hlineColor, visible: root.MoonCore.hlineVisible
  });

  // Filled area per series (above the minimum viability, right of Vk), refreshed on any line move.
  var areasEl = doc.getElementById('fill-areas');
  var areaFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function renderAreas() {
    // Sorted best -> worst (largest filled area first), refreshed on every line move.
    // Cards with zero viable area are hidden; the rest sorted best -> worst.
    var items = root.MoonCore.areas().filter(function (a) { return a.area > 0; }).sort(function (a, b) { return b.area - a.area; });
    // Largest filled area is highlighted in green (ties: all of them); nothing when every area is 0.
    var maxArea = items.reduce(function (m, a) { return Math.max(m, a.area); }, 0);
    areasEl.innerHTML = '<span class="fill-areas-label">Viable area <span class="unit">(' + (data.xDate ? 'days × mean viability' : data.xLabel + ' × ' + data.yLabel) + ')</span></span>' +
      (items.map(function (a) {
        var isMax = maxArea > 0 && a.area === maxArea;
        var objectives = root.MoonSeries.all[a.seriesIndex].objectives;
        return '<span class="fill-area' + (isMax ? ' is-max' : '') + '" title="' + escapeHtml(a.name + (objectives ? ' — ' + objectives : '') + (isMax ? ' · largest area' : '')) + '" style="--area-color:' + a.color + '">' +
          '<span><span class="vline-tag" style="color:' + a.color + '">' + a.label + '</span> <span class="fill-area-name">' + a.name + '</span></span>' +
          '<strong>' + areaFmt.format(a.area) + '</strong></span>';
      }).join('') || '<span class="vlines-empty">no viable area</span>');
  }
  vl.onChange(renderAreas);
  hl.onChange(renderAreas);
  root.MoonCore.deadline.onChange(renderAreas);
  renderAreas();

  // Legend toggles change how many lines the chart shows: chips and area cards follow.
  root.MoonCore.onVisibilityChange(function () {
    refreshVChips();
    refreshHChips();
    renderAreas();
  });
  // "All missions": checked = all series visible, unchecked = none, indeterminate = some (legend toggles).
  var allBox = doc.getElementById('all-series');
  function syncAllBox() {
    var n = root.MoonSeries.all.length, shown = root.MoonCore.visibleCount();
    allBox.checked = shown === n;
    allBox.indeterminate = shown > 0 && shown < n;
  }
  allBox.addEventListener('change', function () { root.MoonCore.setAllVisible(allBox.checked); });
  root.MoonCore.onVisibilityChange(syncAllBox);
  syncAllBox();

  // A series filter also filters the travel-time chips and area cards.
  root.MoonCore.onFilterChange(function () {
    refreshVChips();
    renderAreas();
  });

  // Tables start minimized; the bar button toggles Expand / Collapse (any .table-bar on the page).
  doc.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.table-toggle');
    if (!btn) return;
    var box = doc.getElementById(btn.getAttribute('aria-controls'));
    var open = box.classList.toggle('is-min') === false;
    btn.textContent = open ? 'Collapse' : 'Expand';
    btn.setAttribute('aria-expanded', String(open));
  });

  // Switching dataset reloads the page so every chart adapter starts clean.
  doc.getElementById('dataset-select').addEventListener('change', function (e) {
    var url = new URL(root.location.href);
    url.searchParams.set('dataset', e.target.value);
    // Line positions belong to the old dataset's axes and series count: start the new one from defaults.
    url.searchParams.delete('transit');
    url.searchParams.delete('threshold');
    url.searchParams.delete('departure');
    url.searchParams.delete('deadline');
    url.hash = 'track';
    root.location.href = url.toString();
  });

  root.MoonLayout = {
    lib: lib,
    chartEl: doc.getElementById('chart'),
    resetZoomButton: doc.getElementById('reset-zoom')
  };
})(window);
