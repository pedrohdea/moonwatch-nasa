// Datasets for the chart: 20 math curves (fake data) + spurious correlations by Tyler Vigen (real data).
// Active dataset comes from ?dataset=<key>; MoonSeries.all is always the active dataset's series.
(function (root) {
  'use strict';

  // Point format (shared by table and charts): [x, y, realValue|null, accuracyPercent, referenceY].
  // referenceY = theoretical curve (curves) or a fake expected value (spurious); |y − referenceY| = (1 − acc/100)·MAX_DEV.
  var X_MIN = 0;
  var X_MAX = 10;
  var STEP = 0.5;
  var COUNT = Math.round((X_MAX - X_MIN) / STEP) + 1;
  var MAX_DEV = 2.5; // |measured − theoretical| at 0% accuracy (fake curve points)
  var ACC_MIN = 5; // random accuracy range: ACC_MIN..100 %
  var REFERENCE_COUNT = 201; // samples of the theoretical curve drawn as reference
  var SEED = 20261114; // fixed seed outside the browser (tests); the page draws a new seed per load unless ?seed=N
  var EXP_NORM = Math.exp(2.5) - 1;
  var LOG_NORM = Math.log(11);

  // All curves stay within y in [0, 10] for x in [0, 10]. `formula` documents the curve; it is not shown on the site.
  var CURVES = [
    { name: 'Linear', formula: 'y = x', fn: function (x) { return x; } },
    { name: 'Quadrática', formula: 'y = x² / 10', fn: function (x) { return (x * x) / 10; } },
    { name: 'Parabólica', formula: 'y = 10 − 0,4·(x − 5)²', fn: function (x) { return 10 - 0.4 * (x - 5) * (x - 5); } },
    { name: 'Cúbica', formula: 'y = 5 + 0,04·(x − 5)³', fn: function (x) { return 5 + 0.04 * Math.pow(x - 5, 3); } },
    { name: 'Quártica', formula: 'u = (x − 5)/2,5; y = 10 + 2,5·(u⁴ − 4u²)', fn: function (x) { var u = (x - 5) / 2.5; return 10 + 2.5 * (Math.pow(u, 4) - 4 * u * u); } },
    { name: 'Polinomial', formula: 'u = (x − 5)/5; y = 5 + 5·(16u⁵ − 20u³ + 5u)', fn: function (x) { var u = (x - 5) / 5; return 5 + 5 * (16 * Math.pow(u, 5) - 20 * Math.pow(u, 3) + 5 * u); } },
    { name: 'Exponencial', formula: 'y = 10·(e^(x/4) − 1) / (e^2,5 − 1)', fn: function (x) { return (10 * (Math.exp(x / 4) - 1)) / EXP_NORM; } },
    { name: 'Logarítmica', formula: 'y = 10·ln(1 + x) / ln(11)', fn: function (x) { return (10 * Math.log(1 + x)) / LOG_NORM; } },
    { name: 'Hiperbólica', formula: 'y = 5 + 5·tanh(x − 5)', fn: function (x) { return 5 + 5 * Math.tanh(x - 5); } },
    { name: 'Racional', formula: 'y = 12x / (x + 2)', fn: function (x) { return (12 * x) / (x + 2); } },
    { name: 'Modular', formula: 'y = 2·|x − 5|', fn: function (x) { return 2 * Math.abs(x - 5); } },
    { name: 'Inversa', formula: 'y = 1 / (x + 0,1)', fn: function (x) { return 1 / (x + 0.1); } },
    { name: 'Potência', formula: 'y = x^1,5 / √10', fn: function (x) { return Math.pow(x, 1.5) / Math.sqrt(10); } },
    { name: 'Radical', formula: 'y = √(10x)', fn: function (x) { return Math.sqrt(10 * x); } },
    { name: 'Por partes', formula: 'y = 2 (x < 3); 1,5x − 2,5 (3 ≤ x < 7); 9 (x ≥ 7)', fn: function (x) { return x < 3 ? 2 : x < 7 ? 1.5 * x - 2.5 : 9; } },
    { name: 'Implícita', formula: '(x − 5)² + (y/2)² = 25, y ≥ 0', fn: function (x) { return 2 * Math.sqrt(Math.max(0, 25 - (x - 5) * (x - 5))); } },
    { name: 'Paramétrica', formula: 'x = 10(t − sen t)/2π; y = 5(1 − cos t); t ∈ [0, 2π]', parametric: true },
    { name: 'Trigonométrica', formula: 'y = 5 + 3·sen(x) + 2·cos(2x)', fn: function (x) { return 5 + 3 * Math.sin(x) + 2 * Math.cos(2 * x); } },
    { name: 'Senoidal', formula: 'y = 5 + 5·sen(x)', fn: function (x) { return 5 + 5 * Math.sin(x); } },
    { name: 'Cossenoidal', formula: 'y = 5 + 5·cos(x)', fn: function (x) { return 5 + 5 * Math.cos(x); } }
  ];

  // Real data, copied from tylervigen.com (CC BY 4.0). Pearson r recomputed from these values matches each page.
  var SPURIOUS = [
    {
      key: 'barco', url: 'https://www.tylervigen.com/spurious/correlation/5135_popularity-of-the-im-on-a-boat-meme_correlates-with_the-number-of-executive-administrative-assistants-in-alabama',
      title: 'Popularidade do meme “I’m on a boat” × assistentes executivos no Alabama', r: 0.9885069,
      years: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022],
      a: { name: 'Meme “I’m on a boat”', unit: 'popularidade relativa', source: 'Google Trends', values: [15.8333, 10.1667, 3.33333, 2.16667, 1.5, 1.5, 1.5, 1.33333, 1.66667, 1.25, 1, 1, 1] },
      b: { name: 'Assistentes executivos (AL)', unit: 'trabalhadores', source: 'Bureau of Labor Statistics', values: [6520, 5050, 4100, 3310, 3190, 3310, 3300, 3220, 3210, 3310, 3250, 2990, 3110] }
    },
    {
      key: 'milho', url: 'https://www.tylervigen.com/spurious/correlation/2697_gmo-use-in-corn-grown-in-michigan_correlates-with_enbridges-stock-price',
      title: 'Milho transgênico em Michigan × preço da ação da Enbridge (ENB)', r: 0.9202181,
      years: [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
      a: { name: 'Milho transgênico (MI)', unit: '% do milho plantado', source: 'USDA', values: [2, 3, 4, 5, 10, 19, 33, 42, 44, 52, 52, 71, 76, 74, 70, 71, 72, 75, 74, 76, 81, 81] },
      b: { name: 'Ação ENB', unit: 'preço de abertura do ano', source: 'LSEG Analytics (Refinitiv)', values: [6.78, 6.84, 10.34, 12.35, 15.63, 17.18, 20.2, 16.28, 23.45, 28.38, 37.8, 44.05, 43.57, 51.03, 32.62, 42.52, 39.36, 30.74, 39.8, 32.35, 39.13, 38.91] }
    },
    {
      key: 'malta', url: 'https://www.tylervigen.com/spurious/correlation/1874_masters-degrees-awarded-in-communication-journalism-and-related-programs_correlates-with_solar-power-generated-in-malta',
      title: 'Mestrados em jornalismo (EUA) × energia solar gerada em Malta', r: 0.9873362,
      years: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021],
      a: { name: 'Mestrados em jornalismo', unit: 'diplomas', source: 'National Center for Education Statistics', values: [9005, 8760, 9353, 9581, 9676, 10119, 10241, 10463, 10588, 10805] },
      b: { name: 'Energia solar em Malta', unit: 'bilhões de kWh', source: 'Energy Information Administration', values: [0.02, 0.03, 0.068, 0.09499, 0.127886, 0.162261, 0.188818, 0.195557, 0.237074, 0.256] }
    },
    {
      key: 'sarah', url: 'https://www.tylervigen.com/spurious/correlation/4241_popularity-of-the-first-name-sarah_correlates-with_remaining-forest-cover-in-the-brazilian-amazon',
      title: 'Bebês chamados Sarah (EUA) × floresta restante na Amazônia brasileira', r: 0.9943754,
      years: [1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022],
      a: { name: 'Bebês chamados Sarah', unit: 'nascimentos', source: 'US Social Security Administration', values: [28004, 28460, 27938, 25879, 25265, 24689, 24300, 22339, 21426, 21074, 20731, 19918, 19128, 17738, 15942, 14793, 13805, 12804, 11565, 11174, 10016, 9065, 7798, 6343, 5570, 5207, 4715, 4710, 4539, 4432, 4039, 3774, 3316, 3068, 2855, 2780] },
      b: { name: 'Floresta na Amazônia', unit: 'km²', source: 'Mongabay', values: [3744570, 3723520, 3705750, 3692020, 3680990, 3667200, 3652310, 3637410, 3608350, 3590190, 3576960, 3559580, 3542320, 3524100, 3505930, 3484280, 3458880, 3431110, 3412100, 3397810, 3386160, 3373250, 3365790, 3358790, 3352370, 3347800, 3341910, 3336900, 3330690, 3322800, 3315850, 3308310, 3298550, 3290120, 3279650, 3268050] }
    }
  ];

  var SPURIOUS_COLORS = ['#EAFE07', '#2E96F5']; // Neon Yellow + Blue Yonder

  function round(value, digits) {
    var f = Math.pow(10, digits);
    return Math.round(value * f) / f;
  }

  // Evenly spaced hues, light enough for >= 3:1 contrast on Deep Blue #07173F.
  function palette(n) {
    var colors = [];
    for (var i = 0; i < n; i++) colors.push(hslToHex((i * 360) / n + 200, 0.85, 0.65));
    return colors;
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    var a = s * Math.min(l, 1 - l);
    function f(n) {
      var k = (n + h / 30) % 12;
      var c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(c * 255).toString(16).padStart(2, '0');
    }
    return ('#' + f(0) + f(8) + f(4)).toUpperCase();
  }

  // Deterministic PRNG (mulberry32) so the fake measurements are the same on every load and in tests.
  function prng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  // Theoretical point at step i of n (x uniform, or t uniform for the parametric cycloid).
  function theoretical(def, i, n) {
    if (def.parametric) {
      var t = (2 * Math.PI * i) / (n - 1);
      return [round((10 * (t - Math.sin(t))) / (2 * Math.PI), 3), 5 * (1 - Math.cos(t))];
    }
    var x = round(X_MIN + ((X_MAX - X_MIN) * i) / (n - 1), 3);
    return [x, def.fn(x)];
  }

  function randomAccuracy(random) {
    return ACC_MIN + Math.floor(random() * (101 - ACC_MIN));
  }

  // Fake measured points: random accuracy, and the point sits (1 − acc/100)·MAX_DEV away from the curve.
  // Clamping to [0, 10] can shorten the deviation, so accuracy is recomputed from the final deviation.
  function curvePoints(def, random) {
    var points = new Array(COUNT);
    for (var i = 0; i < COUNT; i++) {
      var p = theoretical(def, i, COUNT);
      var sign = random() < 0.5 ? -1 : 1;
      var measured = round(clamp(p[1] + sign * (1 - randomAccuracy(random) / 100) * MAX_DEV, 0, 10), 3);
      var acc = Math.round(100 * (1 - Math.abs(measured - p[1]) / MAX_DEV));
      points[i] = [p[0], measured, null, acc, round(p[1], 4)];
    }
    return points;
  }

  function buildCurves(random) {
    var colors = palette(CURVES.length);
    return CURVES.map(function (def, index) {
      var reference = [];
      for (var i = 0; i < REFERENCE_COUNT; i++) {
        var p = theoretical(def, i, REFERENCE_COUNT);
        reference.push([p[0], round(p[1], 4)]);
      }
      return { index: index, name: def.name, color: colors[index], points: curvePoints(def, random), reference: reference };
    });
  }

  // Min-max to [0, 10] so both variables share one axis (same idea as the dual axes on tylervigen.com).
  function normalize(values) {
    var min = Math.min.apply(null, values);
    var span = Math.max.apply(null, values) - min || 1;
    return values.map(function (v) { return (10 * (v - min)) / span; });
  }

  // Real values with random accuracy (fake, for usability tests). The reference is a fake "expected value"
  // placed (1 − acc/100)·MAX_DEV away from the real point, so distance, color and % tell the same story.
  function buildSpurious(item, random) {
    var norm = [normalize(item.a.values), normalize(item.b.values)];
    return [item.a, item.b].map(function (v, index) {
      var points = item.years.map(function (year, i) {
        var y = round(norm[index][i], 4);
        var sign = random() < 0.5 ? -1 : 1;
        var ref = round(clamp(y + sign * (1 - randomAccuracy(random) / 100) * MAX_DEV, 0, 10), 4);
        return [year, y, v.values[i], Math.round(100 * (1 - Math.abs(y - ref) / MAX_DEV)), ref];
      });
      return {
        index: index, name: v.name, unit: v.unit, source: v.source, color: SPURIOUS_COLORS[index],
        points: points,
        reference: points.map(function (p) { return [p[0], p[4]]; })
      };
    });
  }

  // Fictional landing-site viability (docs/fLandingSites_viability.csv via scripts/build-viability.mjs):
  // one series per missionID group = daily mean of its 5 sites; x = day index from data.start.
  // Accuracy is random like the spurious datasets; reference sits (1 − acc/100)·VIAB_DEV away (0–200 scale).
  var VIAB_DEV = 50; // = MAX_DEV scaled from the 0–10 axis to 0–200
  function buildViability(data, random) {
    var colors = palette(data.groups.length);
    return data.groups.map(function (g, index) {
      var points = g.mean.map(function (v, day) {
        var sign = random() < 0.5 ? -1 : 1;
        var ref = round(clamp(v + sign * (1 - randomAccuracy(random) / 100) * VIAB_DEV, 0, 200), 2);
        return [day, v, v, Math.round(100 * (1 - Math.abs(v - ref) / VIAB_DEV)), ref];
      });
      return {
        index: index, name: g.name || 'Grupo ' + g.group, objectives: g.objectives || '', group: g.group, color: colors[index], sites: g.sites, points: points,
        reference: points.map(function (p) { return [p[0], p[4]]; })
      };
    });
  }

  // Day index -> 'dd/mm/aaaa' (UTC, so no timezone shift).
  function dayToDate(start, day) {
    return new Date(Date.parse(start + 'T00:00:00Z') + Math.round(day) * 86400000).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }

  var datasets = [{
    key: 'curvas', label: 'Curvas matemáticas (20)', kind: 'curves',
    xLabel: 'x', yLabel: 'y', xRange: [0, 10], yRange: [0, 10], xIsYear: false,
    tolerance: MAX_DEV / 2, referenceLabel: 'curva teórica', // outside the band = accuracy < 50%
    build: buildCurves
  }].concat(SPURIOUS.map(function (item) {
    return {
      key: item.key, label: 'Correlação espúria: ' + item.title, kind: 'spurious',
      title: item.title, url: item.url, r: item.r,
      xLabel: 'Ano', yLabel: 'Índice normalizado (0–10)',
      tolerance: MAX_DEV / 2, referenceLabel: 'valor esperado (fictício)', // outside the band = accuracy < 50%
      xRange: [item.years[0], item.years[item.years.length - 1]], yRange: [0, 10], xIsYear: true,
      build: function (random) { return buildSpurious(item, random); }
    };
  })).concat(root.MoonViability ? [{
    key: 'viabilidade', label: 'Viabilidade dos sítios fictícios (10 grupos)', kind: 'viability',
    xLabel: 'Data', yLabel: 'Viabilidade (média do grupo)',
    xRange: [0, root.MoonViability.days - 1], yRange: [0, 200], xIsYear: false,
    tolerance: VIAB_DEV / 2, referenceLabel: 'valor esperado (fictício)',
    xDate: function (day) { return dayToDate(root.MoonViability.start, day); },
    build: function (random) { return buildViability(root.MoonViability, random); }
  }] : []);

  // Table rows; seriesIndex null means all series of the dataset.
  function filterRows(series, seriesIndex) {
    var picked = seriesIndex === null || seriesIndex === undefined ? series : series.filter(function (s) { return s.index === seriesIndex; });
    var rows = [];
    picked.forEach(function (s) {
      s.points.forEach(function (p) { rows.push({ seriesIndex: s.index, name: s.name, x: p[0], y: p[1], raw: p[2], accuracy: p[3] }); });
    });
    return rows;
  }

  // Default: the landing-site viability (when its data file is loaded), otherwise the math curves.
  function findDataset(key) {
    var byKey = function (k) { return datasets.filter(function (d) { return d.key === k; })[0]; };
    return byKey(key) || byKey('viabilidade') || datasets[0];
  }

  // Ways to draw the point-to-curve accuracy; chosen with ?viz=<key> (header pills).
  var VIZ_MODES = [
    { key: 'cor', label: 'Cor', help: 'Cor do marcador pela assertividade.' },
    { key: 'faixa', label: 'Faixa', help: 'Faixa de tolerância em volta da referência; ponto fora da faixa = assertividade baixa.' },
    { key: 'rotulo', label: 'Rótulo', help: 'Percentual de assertividade escrito em cada ponto.' }
  ];

  // Green (100%) -> Neon Yellow (50%) -> red (0%).
  var ACC_STOPS = ['#FF6A3D', '#EAFE07', '#3DDC84'];

  function mix(a, b, t) {
    var pa = parseInt(a.slice(1), 16);
    var pb = parseInt(b.slice(1), 16);
    var out = [16, 8, 0].map(function (shift) {
      var ca = (pa >> shift) & 255;
      var cb = (pb >> shift) & 255;
      return Math.round(ca + (cb - ca) * t).toString(16).padStart(2, '0');
    });
    return ('#' + out.join('')).toUpperCase();
  }

  function makeAccuracyColor(domain) {
    return function (acc) {
      var t = clamp((acc - domain[0]) / (domain[1] - domain[0]), 0, 1);
      return t < 0.5 ? mix(ACC_STOPS[0], ACC_STOPS[1], t * 2) : mix(ACC_STOPS[1], ACC_STOPS[2], (t - 0.5) * 2);
    };
  }

  // Series that get reference/deviation/band/labels: only the filtered one, so every decoration
  // clearly belongs to the selected series (drawing several at once overlapped and mixed them up).
  function focus(activeIndex) {
    return Number.isInteger(activeIndex) ? [activeIndex] : [];
  }

  var params = root.location && root.location.search ? new URLSearchParams(root.location.search) : new URLSearchParams('');
  var active = findDataset(params.get('dataset'));
  var seed = Number(params.get('seed')) || (root.document ? Date.now() % 2147483647 : SEED);
  var all = active.build(prng(seed));
  var viz = VIZ_MODES.filter(function (m) { return m.key === params.get('viz'); })[0] || VIZ_MODES[1]; // default: faixa
  var domain = [0, 100];

  var api = {
    datasets: datasets.map(function (d) { return { key: d.key, label: d.label, kind: d.kind }; }),
    dataset: active,
    all: all,
    colors: all.map(function (s) { return s.color; }),
    vizModes: VIZ_MODES,
    viz: viz.key,
    accuracyDomain: domain,
    accuracyStops: ACC_STOPS,
    accuracyColor: makeAccuracyColor(domain),
    focus: focus,
    seed: seed,
    load: function (key) { return findDataset(key).build(prng(seed)); },
    filterRows: filterRows,
    // Switch the accuracy visualization in place (no page reload): listeners redraw only the chart.
    setViz: function (key) {
      if (key === api.viz || !VIZ_MODES.some(function (m) { return m.key === key; })) return;
      api.viz = key;
      vizListeners.forEach(function (cb) { cb(key); });
    },
    onVizChange: function (cb) { vizListeners.push(cb); }
  };
  var vizListeners = [];

  root.MoonSeries = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
