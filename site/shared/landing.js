// #sites section: mission picker + animated Moon globe in 3 renderers (Canvas 2D, three.js, Moon3DMap iframe) + Apollo Terrain 3D.
// Pure math is exported for node tests; the DOM part runs only in the browser, after layout.js.
(function (root) {
  'use strict';

  var RAD = Math.PI / 180;
  var ZOOM_IN = 1.8;
  var DURATION = 2600;

  // [slug, name, agency, year, kind, lat, lon] from moon3dmap.com links.
  var MISSIONS = [
    ['apollo-11-landing-site', 'Apollo 11', 'NASA', 1969, 'landing', 0.71, 23.63],
    ['apollo-12-landing-site', 'Apollo 12', 'NASA', 1969, 'landing', -3.01, -23.42],
    ['apollo-14-landing-site', 'Apollo 14', 'NASA', 1971, 'landing', -3.65, -17.47],
    ['apollo-15-landing-site', 'Apollo 15', 'NASA', 1971, 'landing', 26.13, 3.63],
    ['apollo-16-landing-site', 'Apollo 16', 'NASA', 1972, 'landing', -8.97, 15.5],
    ['apollo-17-landing-site', 'Apollo 17', 'NASA', 1972, 'landing', 20.19, 30.77],
    ['ranger-7-impact-site', 'Ranger 7', 'NASA', 1964, 'impact', -10.6, -20.7],
    ['surveyor-1-landing-site', 'Surveyor 1', 'NASA', 1966, 'landing', 2.45, -43.22],
    ['surveyor-5-landing-site', 'Surveyor 5', 'NASA', 1967, 'landing', 1.455, 23.194],
    ['surveyor-6-landing-site', 'Surveyor 6', 'NASA', 1967, 'landing', 0.49, -1.4],
    ['surveyor-7-landing-site', 'Surveyor 7', 'NASA', 1968, 'landing', -40.981, -11.516],
    ['luna-2-impact-site', 'Luna 2', 'USSR', 1959, 'impact', 29.1, 0],
    ['luna-9-landing-site', 'Luna 9', 'USSR', 1966, 'landing', -7.1, -64.4],
    ['luna-16-landing-site', 'Luna 16', 'USSR', 1970, 'landing', -0.5137, 56.3638],
    ['luna-20-landing-site', 'Luna 20', 'USSR', 1972, 'landing', 3.7863, 56.6242],
    ['luna-24-landing-site', 'Luna 24', 'USSR', 1976, 'landing', 12.7145, 62.2097]
  ].map(function (m) {
    return {
      key: m[0], name: m[1], agency: m[2], year: m[3], kind: m[4], lat: m[5], lon: m[6],
      url: 'https://moon3dmap.com/pt/' + m[0] + '/?lat=' + m[5].toFixed(4) + '&long=' + m[6].toFixed(4) + '&layer=nasa-wac&auto3d=1'
    };
  });

  // Target longitude equivalent to `to` reached by the shortest turn from `from` (|delta| <= 180).
  function shortestLon(from, to) {
    var d = ((to - from) % 360 + 540) % 360 - 180;
    return from + d;
  }

  // Great-circle angle between two lat/lon points, in degrees.
  function angularDistance(a, b) {
    var c = Math.sin(a.lat * RAD) * Math.sin(b.lat * RAD) + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
    return Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
  }

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // View between a and b at t in [0,1]: shortest longitude turn, zooming out mid-way for long hops.
  function interpolateView(a, b, t) {
    var e = ease(Math.max(0, Math.min(1, t)));
    var dip = 0.6 * Math.min(1, angularDistance(a, b) / 60);
    var lon = a.lon + (shortestLon(a.lon, b.lon) - a.lon) * e;
    return {
      lat: a.lat + (b.lat - a.lat) * e,
      lon: ((lon + 540) % 360) - 180,
      zoom: Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * e) * (1 - dip * Math.sin(Math.PI * e)) // log scale: 1.8 -> 40 looks even
    };
  }

  // Orthographic projection centered on view: unit-disk (x right, y up) -> lat/lon, or null off the globe.
  function screenToLatLon(x, y, view) {
    var r2 = x * x + y * y;
    if (r2 > 1) return null;
    var z = Math.sqrt(1 - r2);
    var p0 = view.lat * RAD;
    var sinP0 = Math.sin(p0), cosP0 = Math.cos(p0);
    var lat = Math.asin(Math.max(-1, Math.min(1, z * sinP0 + y * cosP0))) / RAD;
    var lon = view.lon + Math.atan2(x, z * cosP0 - y * sinP0) / RAD;
    return { lat: lat, lon: ((lon + 540) % 360) - 180 };
  }

  // Inverse of screenToLatLon; visible=false on the far side.
  function latLonToScreen(lat, lon, view) {
    var p = lat * RAD, p0 = view.lat * RAD, dl = (lon - view.lon) * RAD;
    return {
      x: Math.cos(p) * Math.sin(dl),
      y: Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(dl),
      visible: Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(dl) >= 0
    };
  }

  // three.js: Euler XYZ rotation of a SphereGeometry globe that puts lat/lon in front of a camera on +Z.
  // SphereGeometry maps texture u=0.5 (lon 0) to +X and lon 90E to -Z.
  function globeRotation(lat, lon) {
    return { x: lat * RAD, y: -Math.PI / 2 - lon * RAD };
  }

  // Unit vector of lat/lon in the SphereGeometry frame described above.
  function surfacePoint(lat, lon) {
    var p = lat * RAD, l = lon * RAD;
    return [Math.cos(p) * Math.cos(l), Math.sin(p), -Math.cos(p) * Math.sin(l)];
  }

  // Fictional sites CSV (ID,NAME,LAT,LONG,missionID,PRSID,NEARESTCOLD) -> rows; rows with invalid coordinates are dropped.
  function parseSites(text) {
    return String(text).trim().split(/\r?\n/).slice(1).map(function (line) {
      var c = line.split(',');
      return { id: +c[0], name: (c[1] || '').trim(), lat: +c[2], lon: +c[3], group: +c[4], prsId: +c[5], nearestCold: +c[6] };
    }).filter(function (r) {
      return r.name && isFinite(r.lat) && isFinite(r.lon) && Math.abs(r.lat) <= 90 && Math.abs(r.lon) <= 180 && isFinite(r.group);
    });
  }

  // Autoscale view framing every point: center = normalized mean of unit vectors (safe near poles and 180°),
  // zoom so the farthest point sits at ~80% of the half view. Min 1 (whole disk), max MAX_FIT_ZOOM.
  var MAX_FIT_ZOOM = 6; // past this the 2k texture is only blur
  function frameSites(points) {
    var v = [0, 0, 0];
    points.forEach(function (r) {
      var p = r.lat * RAD, l = r.lon * RAD;
      v[0] += Math.cos(p) * Math.cos(l); v[1] += Math.cos(p) * Math.sin(l); v[2] += Math.sin(p);
    });
    var center = { lat: Math.atan2(v[2], Math.hypot(v[0], v[1])) / RAD, lon: Math.atan2(v[1], v[0]) / RAD };
    var spread = Math.max.apply(null, points.map(function (r) { return angularDistance(center, r); }));
    var zoom = spread >= 90 ? 1 : 0.4 / (0.46 * Math.max(Math.sin(spread * RAD), 1e-6));
    return { lat: center.lat, lon: center.lon, zoom: Math.max(1, Math.min(MAX_FIT_ZOOM, zoom)) };
  }

  // One entry per missionID, sorted.
  function groupSites(rows) {
    var groups = {};
    rows.forEach(function (r) { (groups[r.group] = groups[r.group] || []).push(r); });
    return Object.keys(groups).map(Number).sort(function (a, b) { return a - b; }).map(function (g) {
      // Group name = mission name from docs/dMission.csv (via viability.js), else "Group N".
      var mission = root.MoonViability && root.MoonViability.groups.filter(function (x) { return String(x.group) === String(g); })[0];
      return { key: 'csv-' + g, name: mission && mission.name ? mission.name : 'Group ' + g, objectives: mission ? mission.objectives : '', points: groups[g] };
    });
  }

  // Moon Trek tiles of one zoom level (index.json from scripts/fetch-nasa-assets.mjs) -> [{url, x, y}] pixel offsets in the mosaic.
  function trekTiles(index, base) {
    var list = [];
    for (var r = 0; r < index.rows; r++) for (var c = 0; c < index.cols; c++) {
      list.push({ url: base + index.zoom + '/' + r + '/' + c + '.jpg', x: c * index.tile, y: r * index.tile });
    }
    return list;
  }

  // NASA 3D Resources height maps exist for these Apollo landing sites only.
  var TERRAIN_APOLLO = [11, 12, 14, 15, 16];
  function terrainModel(key) {
    var m = /^apollo-(\d+)-landing-site$/.exec(key || '');
    var n = m ? Number(m[1]) : NaN;
    return TERRAIN_APOLLO.indexOf(n) >= 0 ? { apollo: n, stl: 'shared/vendor/nasa/terrain/apollo-' + n + '.stl' } : null;
  }

  var math = {
    MISSIONS: MISSIONS, parseSites: parseSites, groupSites: groupSites, frameSites: frameSites, shortestLon: shortestLon, angularDistance: angularDistance, interpolateView: interpolateView,
    screenToLatLon: screenToLatLon, latLonToScreen: latLonToScreen, globeRotation: globeRotation, surfacePoint: surfacePoint, trekTiles: trekTiles, terrainModel: terrainModel
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = math;
  if (!root.document || !root.MoonLayout) return;

  // ---------- Browser ----------
  var doc = root.document;
  var TEXTURE = 'shared/vendor/moon-2k.jpg';
  var TREK_BASE = 'shared/vendor/nasa/moontrek/';
  var SITES_CSV = 'shared/data/dLandingSites.csv';
  var reducedMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

  function coords(m) {
    return nf.format(Math.abs(m.lat)) + '° ' + (m.lat >= 0 ? 'N' : 'S') + ', ' + nf.format(Math.abs(m.lon)) + '° ' + (m.lon >= 0 ? 'E' : 'W');
  }

  var options = MISSIONS.map(function (m) {
    return '<option value="' + m.key + '">' + m.name + ' · ' + m.agency + ' · ' + m.year + '</option>';
  }).join('');
  var TABS = [['canvas', 'Canvas'], ['three', 'three.js'], ['iframe', 'Moon3DMap'], ['terrain', 'Terrain 3D']];

  // Landing section goes right after the chart section; "Mission Definitions" stays below the Moon map.
  doc.getElementById('mission').insertAdjacentHTML('beforebegin',
    '<section id="sites" class="landing">' +
      '<div class="wrap">' +
        '<h2>Landing &amp; Impact Sites</h2>' +
        '<p class="hint">Choose a mission or check groups of simulated sites: the globe spins and frames the coordinates. Four versions to compare; Terrain 3D shows the Apollo landing sites in relief.<sup class="ref-mark"><a href="#ref-3" id="refmark-3" aria-label="Reference 3">*3</a></sup></p>' +
        '<div class="landing-controls">' +
          '<label class="dataset-picker">Mission <select id="landing-select"><option value="">Choose…</option><optgroup label="Historic missions">' + options + '</optgroup></select></label>' +
          '<div class="variants landing-tabs" role="group" aria-label="Globe version">' +
            TABS.map(function (t) { return '<button type="button" class="variant" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') +
          '</div>' +
        '</div>' +
        '<fieldset id="landing-groups" class="landing-groups" hidden><legend>Simulated sites (CSV)</legend>' +
          '<div id="landing-group-list" class="landing-group-list"></div>' +
          '<button type="button" class="btn btn-ghost" data-all="1">All</button> <button type="button" class="btn btn-ghost" data-all="0">None</button>' +
        '</fieldset>' +
        '<div class="landing-stage">' +
          '<canvas id="landing-canvas" class="landing-pane" data-pane="canvas" width="560" height="560" role="img" aria-label="Lunar globe"></canvas>' +
          '<div class="landing-pane" data-pane="three" role="img" aria-label="3D lunar globe"></div>' +
          '<iframe class="landing-pane" data-pane="iframe" title="Moon3DMap: mission site" loading="lazy" referrerpolicy="no-referrer"></iframe>' +
          '<div class="landing-pane" data-pane="terrain" role="img" aria-label="3D terrain of the Apollo landing site"></div>' +
        '</div>' +
        '<p id="landing-info" class="dataset-info" aria-live="polite"></p>' +
        '<div class="table-bar landing-points-bar" data-for="landing-points" hidden><span class="table-bar-title">Selected sites</span>' +
          '<input type="search" id="landing-search" class="table-search" placeholder="Filter sites…" aria-label="Filter selected sites">' +
          '<button type="button" class="btn btn-ghost table-toggle" aria-controls="landing-points" aria-expanded="false">Expand</button></div>' +
        '<div id="landing-points" class="table-box landing-points is-min" hidden></div>' +
      '</div>' +
    '</section>');
  doc.querySelector('.nav a[href="#mission"]').insertAdjacentHTML('beforebegin', '<a href="#sites">Sites</a>');

  var select = doc.getElementById('landing-select');
  var info = doc.getElementById('landing-info');
  var stage = doc.querySelector('.landing-stage');
  var state = { tab: 'canvas', mission: null, view: { lat: 0, lon: 0, zoom: 1 }, groups: [], checked: [], url: null };
  var pointsBox = doc.getElementById('landing-points');
  if (root.MoonTableKit) root.MoonTableKit.attach(pointsBox, doc.getElementById('landing-search'));
  var renderers = {};
  var anim = null;

  function pane(name) { return stage.querySelector('[data-pane="' + name + '"]'); }

  // ----- Canvas 2D: per-pixel orthographic projection of the equirectangular texture -----
  function createCanvasRenderer() {
    var canvas = pane('canvas');
    var ctx = canvas.getContext('2d');
    var S = canvas.width;
    var out = ctx.createImageData(S, S);
    var out32 = new Uint32Array(out.data.buffer);
    var hits = []; // screen positions of the drawn dots (canvas pixels), for the hover title

    // Hover title: nearest dot within 10 px -> mission / site name and the group's "Viable area".
    canvas.addEventListener('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      var k = canvas.width / rect.width;
      var mx = (e.clientX - rect.left) * k, my = (e.clientY - rect.top) * k;
      var best = null, bestD = 10 * k;
      hits.forEach(function (h) { var d = Math.hypot(h.x - mx, h.y - my); if (d <= bestD) { bestD = d; best = h; } });
      var title = best ? best.title() : '';
      if (canvas.title !== title) canvas.title = title;
      canvas.style.cursor = best ? 'help' : '';
    });
    var tex = null, tw = 0, th = 0;
    var api = { draw: draw, hits: function () { return hits; }, texture: { source: 'loading', width: 0, height: 0 } };
    function useTexture(source, w, h, paint) {
      var c = doc.createElement('canvas');
      c.width = w; c.height = h;
      var cx = c.getContext('2d');
      paint(cx);
      tex = new Uint32Array(cx.getImageData(0, 0, w, h).data.buffer);
      tw = w; th = h;
      api.texture = { source: source, width: w, height: h };
      draw(state.view);
    }
    function loadImage(url) {
      return new Promise(function (resolve, reject) {
        var im = new Image();
        im.onload = function () { resolve(im); };
        im.onerror = function () { reject(new Error('image failed: ' + url)); };
        im.src = url;
      });
    }
    // 2k CGI Moon Kit first (fast), then the sharper Moon Trek LRO WAC mosaic stitched from vendored tiles.
    loadImage(TEXTURE).then(function (img) {
      useTexture('cgi-moon-kit', img.naturalWidth, img.naturalHeight, function (cx) { cx.drawImage(img, 0, 0); });
    }).catch(function (err) { console.error('Moon texture failed to load: ' + err.message); }).then(function () {
      return root.fetch(TREK_BASE + 'index.json').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }).then(function (index) {
      var tiles = trekTiles(index, TREK_BASE);
      return Promise.all(tiles.map(function (t) { return loadImage(t.url); })).then(function (imgs) {
        useTexture('moon-trek', index.width, index.height, function (cx) {
          imgs.forEach(function (im, i) { cx.drawImage(im, tiles[i].x, tiles[i].y); });
        });
      });
    }).catch(function (err) { console.error('Moon Trek mosaic failed to load: ' + err.message); });

    function draw(view) {
      if (!tex) return;
      hits = [];
      var R = 0.46 * S * view.zoom, c = S / 2;
      var p0 = view.lat * RAD, sinP0 = Math.sin(p0), cosP0 = Math.cos(p0);
      for (var py = 0; py < S; py++) {
        var y = (c - py - 0.5) / R;
        for (var px = 0; px < S; px++) {
          var x = (px + 0.5 - c) / R;
          var r2 = x * x + y * y;
          var i = py * S + px;
          if (r2 > 1) { out32[i] = 0; continue; }
          var z = Math.sqrt(1 - r2);
          var lat = Math.asin(z * sinP0 + y * cosP0);
          var lon = view.lon * RAD + Math.atan2(x, z * cosP0 - y * sinP0);
          // bilinear sample (smooth when zoomed past the texture resolution)
          var fu = (((lon / (2 * Math.PI) + 0.5) % 1 + 1) % 1) * tw - 0.5, fv = Math.max(0, Math.min(th - 1.001, (0.5 - lat / Math.PI) * th - 0.5));
          var u0 = Math.floor(fu), v0 = fv | 0, du = fu - u0, dv = fv - v0;
          var ua = (u0 + tw) % tw, ub = (u0 + 1) % tw, ra = v0 * tw, rb = Math.min(th - 1, v0 + 1) * tw;
          var a = tex[ra + ua], b = tex[ra + ub], cc = tex[rb + ua], d = tex[rb + ub];
          var w0 = (1 - du) * (1 - dv), w1 = du * (1 - dv), w2 = (1 - du) * dv, w3 = du * dv;
          var k = 0.35 + 0.65 * z; // limb darkening
          var rr = ((a & 255) * w0 + (b & 255) * w1 + (cc & 255) * w2 + (d & 255) * w3) * k;
          var gg = ((a >>> 8 & 255) * w0 + (b >>> 8 & 255) * w1 + (cc >>> 8 & 255) * w2 + (d >>> 8 & 255) * w3) * k;
          var bb = ((a >>> 16 & 255) * w0 + (b >>> 16 & 255) * w1 + (cc >>> 16 & 255) * w2 + (d >>> 16 & 255) * w3) * k;
          out32[i] = 0xff000000 | (bb << 16) | (gg << 8) | rr;
        }
      }
      ctx.putImageData(out, 0, 0);
      MISSIONS.forEach(function (m) {
        var s = latLonToScreen(m.lat, m.lon, view);
        if (!s.visible) return;
        var sel = state.mission === m;
        hits.push({ x: c + s.x * R, y: c - s.y * R, title: function () { return m.name; } });
        ctx.beginPath();
        ctx.arc(c + s.x * R, c - s.y * R, sel ? 7 : 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = sel ? '#EAFE07' : 'rgba(46,150,245,0.9)';
        ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#07173F'; ctx.stroke();
        if (sel) {
          ctx.font = '700 18px "Fira Sans", system-ui, sans-serif';
          ctx.fillStyle = '#EAFE07'; ctx.strokeStyle = 'rgba(7,23,63,0.85)'; ctx.lineWidth = 4;
          ctx.strokeText(m.name, c + s.x * R + 12, c - s.y * R + 6);
          ctx.fillText(m.name, c + s.x * R + 12, c - s.y * R + 6);
        }
      });
      // CSV points last: on top of mission dots (group 4 shares Apollo 14's coordinates)
      var best = bestGroupKey();
      state.groups.forEach(function (g) {
        var sel = state.checked.indexOf(g.key) >= 0;
        var top = g.key === best; // same green as the largest "Viable area" card
        g.points.forEach(function (r) {
          var s = latLonToScreen(r.lat, r.lon, view);
          if (!s.visible) return;
          hits.push({ x: c + s.x * R, y: c - s.y * R, title: function () { var t = siteTotal(r.id); return r.name + ' · ' + g.name + (t === null ? '' : '\nViability sum: ' + sumFmt.format(t)) + '\n' + groupAreaText(g); } });
          ctx.beginPath();
          ctx.arc(c + s.x * R, c - s.y * R, top ? 6 : sel ? 4 : 3, 0, 2 * Math.PI);
          ctx.fillStyle = top ? BEST_GREEN : sel ? '#EAFE07' : 'rgba(255,106,61,0.9)';
          ctx.fill();
          ctx.lineWidth = 1; ctx.strokeStyle = '#07173F'; ctx.stroke();
        });
      });
    }
    return api;
  }

  // ----- three.js: textured, lit sphere; script loaded on first use -----
  // three.js as ES modules (import map "three" in index.html); loaded only when a 3D tab opens.
  var THREE_LIBS = null;
  function loadThree() {
    if (!THREE_LIBS) {
      var base = doc.baseURI;
      THREE_LIBS = Promise.all([
        import('three'),
        import(new URL('shared/vendor/three/addons/loaders/GLTFLoader.js', base).href),
        import(new URL('shared/vendor/three/addons/loaders/STLLoader.js', base).href),
        import(new URL('shared/vendor/three/addons/loaders/DRACOLoader.js', base).href)
      ]).then(function (m) { return { THREE: m[0], GLTFLoader: m[1].GLTFLoader, STLLoader: m[2].STLLoader, DRACOLoader: m[3].DRACOLoader }; });
    }
    return THREE_LIBS;
  }

  // NASA SVS 14959 Moon model (LRO color + topography). GLB_YAW aligns its longitude 0 with our sphere frame.
  var MOON_GLB = 'shared/vendor/nasa/moon_small.glb';
  var GLB_YAW = -Math.PI / 2; // measured: the SVS model's lon 0 faces -Z in its frame; ours faces +X

  function createThreeRenderer() {
    var el = pane('three');
    var api = { draw: function () {}, source: 'loading' };
    loadThree().then(function (libs) {
      var THREE = libs.THREE;
      var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
      el.appendChild(renderer.domElement);
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(35, 1, 0.001, 100);
      // Mostly frontal light: the sites must be readable everywhere (no night side); a slight angle shows the relief.
      scene.add(new THREE.AmbientLight(0xffffff, 1.1));
      var sun = new THREE.DirectionalLight(0xffffff, 1.8);
      sun.position.set(-0.6, 0.5, 3);
      scene.add(sun);
      // Group rotated by the view; holds the surface (sphere fallback or NASA GLB) and the markers.
      var globe = new THREE.Group();
      scene.add(globe);
      var texture = new THREE.TextureLoader().load(TEXTURE, function () { api.draw(state.view); });
      texture.colorSpace = THREE.SRGBColorSpace;
      var sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 }));
      globe.add(sphere);
      api.source = 'sphere';
      new libs.GLTFLoader().load(MOON_GLB, function (gltf) {
        var moon = gltf.scene;
        var box = new THREE.Box3().setFromObject(moon);
        var center = box.getCenter(new THREE.Vector3());
        var radius = (box.max.x - box.min.x) / 2 || 1; // half the width: the GLB is a sphere (relief is tiny)
        moon.position.sub(center);
        var holder = new THREE.Group();
        holder.add(moon);
        holder.scale.setScalar(1 / radius);
        holder.rotation.y = GLB_YAW;
        globe.add(holder);
        sphere.visible = false;
        api.source = 'glb';
        api.draw(state.view);
      }, undefined, function (err) { console.error('NASA Moon GLB did not load (' + MOON_GLB + '): ' + err.message); });
      var markers = MISSIONS.map(function (m) {
        var dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), new THREE.MeshBasicMaterial({ color: 0x2e96f5 }));
        dot.position.fromArray(surfacePoint(m.lat, m.lon)).multiplyScalar(1.012); // above the GLB relief
        globe.add(dot);
        return dot;
      });
      var csvMarkers = [];
      function syncCsvMarkers() { // CSV loads async: add its dots once
        if (csvMarkers.length || !state.groups.length) return;
        state.groups.forEach(function (g) {
          g.points.forEach(function (r) {
            var dot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff6a3d }));
            dot.position.fromArray(surfacePoint(r.lat, r.lon)).multiplyScalar(1.014); // above mission dots
            dot.userData.group = g;
            globe.add(dot);
            csvMarkers.push(dot);
          });
        });
      }
      function resize() {
        var w = el.clientWidth || 560;
        renderer.setSize(w, w, false);
      }
      api.draw = function (view) {
        resize();
        var rot = globeRotation(view.lat, view.lon);
        globe.rotation.set(rot.x, rot.y, 0);
        camera.position.set(0, 0, 1 + 3.2 / view.zoom); // close to the Canvas framing: globe fills most of the view at zoom 1
        syncCsvMarkers();
        var shrink = Math.min(1, ZOOM_IN / view.zoom); // keep dots a few pixels wide when zoomed in
        markers.forEach(function (dot, i) {
          var sel = state.mission === MISSIONS[i];
          dot.material.color.setHex(sel ? 0xeafe07 : 0x2e96f5);
          dot.scale.setScalar((sel ? 1.8 : 1) * shrink);
        });
        var best = bestGroupKey();
        csvMarkers.forEach(function (dot) {
          var sel = state.checked.indexOf(dot.userData.group.key) >= 0;
          var top = dot.userData.group.key === best;
          dot.material.color.setHex(top ? 0x3ddc84 : sel ? 0xeafe07 : 0xff6a3d);
          dot.scale.setScalar((top ? 2 : sel ? 1.4 : 1) * shrink);
        });
        renderer.render(scene, camera);
      };
      api.draw(state.view);
    }).catch(function (err) {
      console.error(err);
      el.textContent = 'Could not load three.js.';
    });
    return api;
  }

  // ----- Terrain 3D: NASA 3D Resources Apollo landing-site height map (STL) + Apollo Lunar Module (GLB) -----
  var LM_GLB = 'shared/vendor/nasa/apollo-lm.glb';
  var TERRAIN_LOW = [0x0b, 0x3d, 0x91], TERRAIN_HIGH = [0xea, 0xfe, 0x07]; // NASA blue -> Neon Yellow by height

  function createTerrainRenderer() {
    var el = pane('terrain');
    var note = doc.createElement('p');
    note.className = 'terrain-note';
    el.appendChild(note);
    var api = { draw: function () {}, status: 'loading', apollo: null, lander: 'loading' };
    loadThree().then(function (libs) {
      var THREE = libs.THREE;
      var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
      el.insertBefore(renderer.domElement, note);
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
      camera.up.set(0, 0, 1); // STL height maps are Z-up
      camera.position.set(0, -3.1, 2.3);
      camera.lookAt(0, 0, 0);
      scene.add(new THREE.AmbientLight(0xffffff, 0.35));
      var sun = new THREE.DirectionalLight(0xffffff, 1.4);
      sun.position.set(-2, -1, 2.5); // low sun: relief casts readable shading
      scene.add(sun);
      var turntable = new THREE.Group();
      scene.add(turntable);
      var cache = {};   // apollo number -> Promise<{mesh, top}>
      var current = null;
      var wanted = null;
      var lm = null;
      var draco = new libs.DRACOLoader().setDecoderPath('shared/vendor/three/addons/libs/draco/gltf/'); // the LM GLB is Draco-compressed
      new libs.GLTFLoader().setDRACOLoader(draco).load(LM_GLB, function (gltf) {
        var model = gltf.scene;
        model.rotation.x = Math.PI / 2; // GLB is Y-up
        var box = new THREE.Box3().setFromObject(model);
        var size = box.getSize(new THREE.Vector3());
        var holder = new THREE.Group();
        model.position.sub(box.getCenter(new THREE.Vector3()));
        model.position.z += size.z / 2; // feet on z=0
        holder.add(model);
        holder.scale.setScalar(0.16 / Math.max(size.x, size.y, size.z)); // not to scale: visible marker of the landing point
        lm = holder;
        api.lander = 'ready';
        if (current) { lm.position.z = current.top; turntable.add(lm); frame(); }
      }, undefined, function (err) { api.lander = 'error'; console.error('Apollo LM GLB did not load (' + LM_GLB + '): ' + err.message); });

      function loadTerrain(model) {
        if (!cache[model.apollo]) {
          cache[model.apollo] = new Promise(function (resolve, reject) {
            new libs.STLLoader().load(model.stl, resolve, undefined, reject);
          }).then(function (geometry) {
            geometry.computeBoundingBox();
            var bb = geometry.boundingBox.clone(); // translate()/scale() recompute boundingBox in place
            var k = 2 / Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y); // 30 km square -> 2 units
            geometry.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -bb.min.z);
            geometry.scale(k, k, k);
            geometry.computeVertexNormals(); // the NASA STLs ship zero normals (no shading otherwise)
            var pos = geometry.attributes.position;
            var zMax = (bb.max.z - bb.min.z) * k;
            var zLow = zMax; // lowest surface point, above the flat printing base at z=0
            for (var j = 0; j < pos.count; j++) if (pos.getZ(j) > 1e-3) zLow = Math.min(zLow, pos.getZ(j));
            var colors = new Float32Array(pos.count * 3);
            var tint = new THREE.Color();
            var top = 0;
            for (var i = 0; i < pos.count; i++) {
              var t = Math.max(0, (pos.getZ(i) - zLow) / (zMax - zLow || 1));
              tint.setRGB.apply(tint, [0, 1, 2].map(function (c) { return (TERRAIN_LOW[c] + (TERRAIN_HIGH[c] - TERRAIN_LOW[c]) * t) / 255; }).concat(THREE.SRGBColorSpace)); // sRGB -> linear
              colors[i * 3] = tint.r; colors[i * 3 + 1] = tint.g; colors[i * 3 + 2] = tint.b;
              if (Math.abs(pos.getX(i)) < 0.04 && Math.abs(pos.getY(i)) < 0.04) top = Math.max(top, pos.getZ(i)); // surface at the landing point
            }
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            var mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide })); // DoubleSide: STL winding is inverted
            mesh.position.z = -zMax / 2;
            return { mesh: mesh, top: top - zMax / 2 };
          });
        }
        return cache[model.apollo];
      }

      function show(model) {
        api.apollo = model ? model.apollo : null;
        if (!model) {
          if (current) turntable.remove(current.mesh);
          if (lm) turntable.remove(lm);
          current = null;
          renderer.domElement.hidden = true;
          api.status = 'empty';
          note.textContent = '3D terrain available for Apollo 11, 12, 14, 15 and 16: choose one in "Mission".';
          return;
        }
        api.status = 'loading';
        note.textContent = 'Loading Apollo ' + model.apollo + ' terrain…';
        loadTerrain(model).then(function (t) {
          if (wanted !== model.apollo) return; // user moved on meanwhile
          if (current) turntable.remove(current.mesh);
          current = t;
          turntable.add(t.mesh);
          if (lm) { lm.position.z = t.top; turntable.add(lm); }
          renderer.domElement.hidden = false;
          api.status = 'ready';
          note.textContent = 'NASA 3D Resources — Apollo ' + model.apollo + ' landing site (30×30 km, height ×60). Lunar Module not to scale. Drag to rotate.';
          frame();
        }).catch(function (err) {
          api.status = 'error';
          note.textContent = 'Could not load the Apollo ' + model.apollo + ' terrain.';
          console.error('Terrain STL did not load (' + model.stl + '): ' + (err && err.message));
        });
      }

      // Drag rotates; otherwise a slow turntable while the tab is open.
      var dragging = null, loop = null;
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.addEventListener('pointerdown', function (e) { dragging = e.clientX; renderer.domElement.setPointerCapture(e.pointerId); });
      renderer.domElement.addEventListener('pointermove', function (e) {
        if (dragging === null) return;
        turntable.rotation.z += (e.clientX - dragging) * 0.01;
        dragging = e.clientX;
        frame();
      });
      ['pointerup', 'pointercancel'].forEach(function (n) { renderer.domElement.addEventListener(n, function () { dragging = null; }); });

      function frame() {
        var w = el.clientWidth || 560;
        renderer.setSize(w, w, false);
        renderer.render(scene, camera);
      }
      function tick() {
        loop = null;
        if (state.tab !== 'terrain') return; // restarted by api.draw when the tab opens again
        if (current) {
          if (dragging === null) turntable.rotation.z += 0.0025;
          frame();
        }
        loop = root.requestAnimationFrame(tick);
      }

      api.draw = function () {
        var model = state.mission ? terrainModel(state.mission.key) : null;
        var key = model ? model.apollo : null;
        if (key !== wanted || api.status === 'loading' && !model) { wanted = key; show(model); }
        if (!reducedMotion && !loop) loop = root.requestAnimationFrame(tick);
      };
      api.draw();
    }).catch(function (err) {
      console.error(err);
      api.status = 'error';
      note.textContent = 'Could not load three.js.';
    });
    return api;
  }

  // ----- Moon3DMap iframe: external page, src set only while its tab is open -----
  function createIframeRenderer() {
    var frame = pane('iframe');
    return {
      draw: function () {
        var url = state.url || 'https://moon3dmap.com/pt/';
        if (frame.getAttribute('src') !== url) frame.setAttribute('src', url);
      }
    };
  }

  var factories = { canvas: createCanvasRenderer, three: createThreeRenderer, iframe: createIframeRenderer, terrain: createTerrainRenderer };

  function draw() {
    if (!renderers[state.tab]) renderers[state.tab] = factories[state.tab]();
    renderers[state.tab].draw(state.view);
    // Mission label of the green group, same green as the largest "Viable area" card.
    var best = bestGroupKey();
    doc.querySelectorAll('#landing-group-list label').forEach(function (l) {
      var cb = l.querySelector('input');
      l.classList.toggle('is-best', !!cb && cb.value === best);
    });
  }

  function animateTo(target) {
    if (anim) root.cancelAnimationFrame(anim);
    var from = state.view;
    var start = null;
    if (reducedMotion || state.tab === 'iframe' || state.tab === 'terrain') { state.view = target; draw(); return; }
    function step(ts) {
      if (start === null) start = ts;
      var t = (ts - start) / DURATION;
      state.view = t >= 1 ? target : interpolateView(from, target, t);
      draw();
      anim = t < 1 ? root.requestAnimationFrame(step) : null;
    }
    anim = root.requestAnimationFrame(step);
  }

  function mapLink(lat, lon) {
    return 'https://moon3dmap.com/pt/?lat=' + lat.toFixed(4) + '&long=' + lon.toFixed(4) + '&layer=nasa-wac&auto3d=1';
  }

  function selectMission(key) {
    var m = MISSIONS.filter(function (x) { return x.key === key; })[0] || null;
    state.mission = m;
    state.url = m ? m.url : null;
    select.value = m ? m.key : '';
    info.innerHTML = m
      ? '<strong>' + escapeHtml(m.name) + '</strong> · ' + m.agency + ' · ' + m.year + ' · ' + (m.kind === 'impact' ? 'impact site' : 'landing site') +
        ' · <span class="mono">' + coords(m) + '</span> · <a href="' + m.url + '" target="_blank" rel="noopener">View on Moon3DMap</a>'
      : '';
    animateTo(m ? { lat: m.lat, lon: m.lon, zoom: ZOOM_IN } : { lat: 0, lon: 0, zoom: 1 });
  }

  // Multi-select of CSV groups: highlights them, lists their points and autoscales the view to frame all of them.
  // "Viable area: 1,234.56 (days × ...)" of a landing group, from the same MoonCore.areas() as the cards.
  var areaFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function groupAreaText(g) {
    if (!root.MoonCore || !root.MoonCore.areas || !root.MoonSeries || root.MoonSeries.dataset.kind !== 'viability') return '';
    var s = root.MoonSeries.all.filter(function (x) { return 'csv-' + x.group === g.key; })[0];
    var a = s && root.MoonCore.areas().filter(function (x) { return x.seriesIndex === s.index; })[0];
    var unit = '(days × ' + String(root.MoonSeries.dataset.yLabel).toLowerCase() + ')';
    return a ? 'Viable area: ' + areaFmt.format(a.area) + ' ' + unit + (g.key === bestGroupKey() ? ' · largest area' : '')
      : 'Viable area: — (mission hidden or filtered in the chart)';
  }

  // Group with the largest filled area (the green "Viable area" card), as 'csv-<missionID>'; null when none.
  var BEST_GREEN = '#3DDC84';
  function bestGroupKey() {
    if (!root.MoonCore || !root.MoonCore.areas || !root.MoonSeries || root.MoonSeries.dataset.kind !== 'viability') return null;
    var best = null;
    root.MoonCore.areas().forEach(function (a) { if (a.area > 0 && (!best || a.area > best.area)) best = a; });
    var s = best && root.MoonSeries.all[best.seriesIndex];
    return s && s.group !== undefined ? 'csv-' + s.group : null;
  }

  // Total VIABILITY of a site over every day of docs/fLandingSites_viability.csv (null when not loaded).
  var sumFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  function groupName(g) {
    var hit = state.groups.filter(function (x) { return x.key === 'csv-' + g; })[0];
    return hit ? hit.name : String(g);
  }
  function siteTotal(id) {
    var t = root.MoonViability && root.MoonViability.siteTotals ? root.MoonViability.siteTotals[id] : undefined;
    return t === undefined ? null : t;
  }

  function setGroups(keys) {
    state.checked = state.groups.map(function (g) { return g.key; }).filter(function (k) { return keys.indexOf(k) >= 0; });
    groupList.querySelectorAll('input').forEach(function (cb) { cb.checked = state.checked.indexOf(cb.value) >= 0; });
    var pts = [];
    state.groups.forEach(function (g) { if (state.checked.indexOf(g.key) >= 0) pts = pts.concat(g.points); });
    pointsBox.hidden = !pts.length;
    doc.querySelector('.landing-points-bar').hidden = !pts.length;
    if (root.MoonTableKit) root.setTimeout(function () { root.MoonTableKit.apply(pointsBox); }, 0); // keep sort + filter after re-render
    doc.querySelector('.landing-points-bar .table-bar-title').textContent = 'Selected sites (' + pts.length + ')';
    pointsBox.innerHTML = pts.length
      ? '<table class="data"><thead><tr><th>ID</th><th>Mission</th><th>Name</th><th>Latitude</th><th>Longitude</th><th>PRSID</th><th>NEARESTCOLD</th><th class="num">Viability sum</th></tr></thead><tbody>' +
        pts.map(function (r) {
          var total = siteTotal(r.id);
          return '<tr><td>' + r.id + '</td><td class="mono">' + escapeHtml(groupName(r.group)) + '</td><td class="mono">' + escapeHtml(r.name) + '</td><td>' + nf.format(r.lat) + '</td><td>' + nf.format(r.lon) +
            '</td><td>' + r.prsId + '</td><td>' + nf.format(r.nearestCold) + '</td><td class="num mono">' + (total === null ? '—' : sumFmt.format(total)) + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '';
    if (!pts.length) { if (!state.mission) { info.innerHTML = ''; state.url = null; animateTo({ lat: 0, lon: 0, zoom: 1 }); } else draw(); return; }
    state.mission = null;
    select.value = '';
    var f = frameSites(pts);
    state.url = mapLink(f.lat, f.lon);
    var sum = pts.reduce(function (acc, r) { var t = siteTotal(r.id); return t === null ? acc : acc + t; }, 0);
    info.innerHTML = '<strong>' + pts.length + ' simulated sites</strong> · ' + state.checked.length + ' mission(s)' +
      (root.MoonViability && root.MoonViability.siteTotals ? ' · <span class="landing-sum">viability sum <strong>' + sumFmt.format(sum) + '</strong></span>' : '') +
      ' · center <span class="mono">' + coords(f) +
      '</span> · <a href="' + state.url + '" target="_blank" rel="noopener">View on Moon3DMap</a>';
    animateTo(f);
  }

  function setTab(name) {
    state.tab = name;
    stage.setAttribute('data-tab', name);
    stage.querySelectorAll('.landing-pane').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== name; });
    doc.querySelectorAll('.landing-tabs .variant').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-tab') === name));
    });
    draw();
  }

  var groupList = doc.getElementById('landing-group-list');
  select.addEventListener('change', function () { selectMission(select.value); });
  groupList.addEventListener('change', function () {
    setGroups([].map.call(groupList.querySelectorAll('input:checked'), function (cb) { return cb.value; }));
  });
  doc.getElementById('landing-groups').addEventListener('click', function (e) {
    var all = e.target.getAttribute('data-all');
    if (all !== null) setGroups(all === '1' ? state.groups.map(function (g) { return g.key; }) : []);
  });
  doc.querySelector('.landing-tabs').addEventListener('click', function (e) {
    var tab = e.target.getAttribute('data-tab');
    if (tab) setTab(tab);
  });

  // Fictional points from the CSV: one checkbox per missionID once loaded.
  var ready = root.fetch(SITES_CSV).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }).then(function (text) {
    state.groups = groupSites(parseSites(text));
    groupList.innerHTML = state.groups.map(function (g) {
      return '<label title="' + escapeHtml(g.objectives || '') + '"><input type="checkbox" value="' + g.key + '"> ' + escapeHtml(g.name) + ' <span class="muted">(' + g.points.length + ')</span></label>';
    }).join('');
    doc.getElementById('landing-groups').hidden = false;
    draw();
  }).catch(function (err) { console.error('Simulated sites failed to load (' + SITES_CSV + '): ' + err.message); });

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (ch) { return '&#' + ch.charCodeAt(0) + ';'; });
  }

  setTab('canvas');

  // Viability chart -> landing groups, same rule as the "Viable area" cards (MoonCore.vlineVisible):
  // every group visible in the chart (legend / "All missions"), or only the filtered one when a filter is active.
  if (root.MoonCore && root.MoonSeries && root.MoonSeries.dataset.kind === 'viability') {
    var syncFromChart = function () {
      ready.then(function () {
        setGroups(root.MoonSeries.all
          .filter(function (s) { return s.group !== undefined && root.MoonCore.vlineVisible(s.index); })
          .map(function (s) { return 'csv-' + s.group; }));
      });
    };
    root.MoonCore.onFilterChange(syncFromChart);
    root.MoonCore.onVisibilityChange(syncFromChart);
    syncFromChart();
    // The largest area (green) can change when lines move: recolor the globe points.
    [root.MoonCore.vlines, root.MoonCore.hlines, root.MoonCore.departure, root.MoonCore.deadline].forEach(function (set) { set.onChange(function () { draw(); }); });
  }

  root.MoonLanding = { missions: MISSIONS, state: state, renderers: renderers, select: selectMission, setGroups: setGroups, bestGroupKey: bestGroupKey, groupAreaText: groupAreaText,
    canvasHits: function () { return renderers.canvas ? renderers.canvas.hits().map(function (h) { return { x: h.x, y: h.y, title: h.title() }; }) : []; }, setTab: setTab, math: math, ready: ready };
})(typeof window !== 'undefined' ? window : globalThis);
