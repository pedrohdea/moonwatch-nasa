// Shared page shell: nav + #home + #track + #about. Must load before table.js and boot.js.
(function (root) {
  'use strict';

  var doc = root.document;
  var lib = doc.body.getAttribute('data-lib') || 'Gráfico';
  var VARIANTS = [
    { name: 'ECharts', port: 8001 },
    { name: 'Plotly.js', port: 8002 },
    { name: 'Chart.js', port: 8003 }
  ];
  var data = root.MoonSeries.dataset;
  var total = root.MoonSeries.all.reduce(function (n, s) { return n + s.points.length; }, 0);
  var fmt = new Intl.NumberFormat('pt-BR');

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
    return '<a class="variant" href="' + url.search + url.hash + '"' + current + '>' + m.label + '</a>';
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

  var datasetOptions = root.MoonSeries.datasets.map(function (d) {
    return '<option value="' + d.key + '"' + (d.key === data.key ? ' selected' : '') + '>' + escapeHtml(d.label) + '</option>';
  }).join('');

  var datasetInfo = data.kind === 'spurious'
    ? '<p class="dataset-info">' + escapeHtml(data.title) + ' · r = ' + data.r.toFixed(4).replace('.', ',') +
      ' · cada série normalizada para 0–10; valores reais na tabela; assertividade aleatória (teste de usabilidade). Fonte: <a href="' + data.url + '" target="_blank" rel="noopener">Tyler Vigen, Spurious Correlations</a> (CC BY 4.0).</p>'
    : '<p class="dataset-info">20 tipos de curvas matemáticas, dados fictícios: 21 pontos medidos por curva (x de 0 a 10), com assertividade aleatória: quanto menor, mais longe o ponto fica da curva teórica.</p>';

  var sharedQuery = (function () {
    var q = new URLSearchParams(root.location.search);
    q.set('seed', root.MoonSeries.seed);
    return '?' + q.toString();
  })();

  var variantLinks = VARIANTS.map(function (v) {
    var protocol = root.location.protocol === 'https:' ? 'https:' : 'http:'; // file:// still links to the local servers
    var href = protocol + '//' + (root.location.hostname || 'localhost') + ':' + v.port + '/' + sharedQuery; // keep dataset, viz mode and random seed across variants
    var current = v.name === lib ? ' aria-current="page"' : '';
    return '<a class="variant" href="' + href + '"' + current + '>' + v.name + '</a>';
  }).join('');

  doc.body.insertAdjacentHTML('afterbegin',
    '<header class="topbar">' +
      '<a class="brand" href="#home">Moon<span>Watch</span></a>' +
      '<nav class="nav" aria-label="Seções">' +
        '<a href="#home">Home</a><a href="#track">Track</a><a href="#mission">Missão</a><a href="#about">About</a>' +
      '</nav>' +
      '<div class="variants" aria-label="Versões do gráfico">' + variantLinks + '</div>' +
      '<div class="variants viz" aria-label="Visualização da assertividade"><span class="variants-label">Assertividade:</span>' + vizLinks + '</div>' +
    '</header>' +
    '<main>' +
      '<section id="home" class="hero">' +
        '<div class="wrap">' +
          '<p class="eyebrow">Protótipo de usabilidade · ' + lib + '</p>' +
          '<h1>Explore curvas,<br>filtre com um clique.</h1>' +
          '<p class="lead">Curvas matemáticas e correlações espúrias no mesmo gráfico. Clique numa linha para ver só os dados dela na tabela abaixo.</p>' +
          '<div class="stats">' +
            '<div><strong>' + root.MoonSeries.all.length + '</strong><span>séries</span></div>' +
            '<div><strong>' + fmt.format(total) + '</strong><span>pontos</span></div>' +
            '<div><strong>' + data.xRange[0] + '–' + data.xRange[1] + '</strong><span>intervalo de ' + escapeHtml(data.xLabel) + '</span></div>' +
          '</div>' +
          '<a class="btn" href="#track">Ver gráfico</a>' +
        '</div>' +
      '</section>' +
      '<section id="track" class="track">' +
        '<div class="wrap">' +
          '<h2>Track</h2>' +
          '<p class="hint">Clique numa linha para filtrar. Clique em área vazia ou em “Limpar filtro” para ver tudo. Use a roda do mouse ou arraste para dar zoom.</p>' +
          '<label class="dataset-picker">Conjunto de dados ' +
            '<select id="dataset-select">' + datasetOptions + '</select>' +
          '</label>' +
          datasetInfo +
          '<p class="viz-info"><strong>Assertividade · ' + vizMode.label + ':</strong> ' + vizMode.help +
            ' Referência = ' + root.MoonSeries.dataset.referenceLabel + '.' +
            (vizMode.key === 'cor'
              ? ' <span class="acc-scale" style="background:linear-gradient(90deg,' + stops.join(',') + ')"></span> <span class="mono">' + accDomain[0] + '% → 100%</span>'
              : '') +
            ' <span id="viz-hint" class="viz-hint"></span>' +
            ' <a class="reroll" href="' + rerollHref + '">Sortear de novo</a></p>' +
          '<div class="toolbar">' +
            '<span id="filter-badge" class="badge" role="status" aria-live="polite"></span>' +
            '<button id="clear-filter" class="btn btn-ghost" type="button">Limpar filtro</button>' +
            '<button id="reset-zoom" class="btn btn-ghost" type="button">Resetar zoom</button>' +
          '</div>' +
          '<div id="fill-areas" class="fill-areas" role="status" aria-live="polite" aria-label="Área preenchida por série"></div>' +
          '<div class="toolbar vlines-bar" aria-label="Linhas verticais">' +
            '<span class="vlines-label">Linhas verticais</span>' +
            '<div id="vlines-list" class="vlines-list"></div>' +
            '<button id="vline-add" class="btn btn-ghost" type="button">+ Linha vertical</button>' +
          '</div>' +
          '<div class="toolbar vlines-bar hlines-bar" aria-label="Viabilidade mínima">' +
            '<span class="vlines-label" title="Uma linha para todas as séries: o preenchimento fica acima dela">Viabilidade mínima</span>' +
            '<div id="hlines-list" class="vlines-list"></div>' +
          '</div>' +
          '<div id="chart" class="chart" role="img" aria-label="Gráfico de linhas com seis funções matemáticas"></div>' +
          '<div class="table-box" id="table-box" tabindex="0" aria-label="Dados do gráfico">' +
            '<table class="data">' +
              '<thead id="table-head"></thead>' +
              '<tbody id="table-body"></tbody>' +
            '</table>' +
            '<div id="table-sentinel" class="sentinel">Carregando mais linhas…</div>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section id="mission" class="mission">' +
        '<div class="wrap">' +
          '<h2>Definições da missão</h2>' +
          '<p class="hint">Conceitos usados para comparar sítios e datas de pouso no polo sul lunar.</p>' +
          '<dl class="defs">' +
            '<div><dt>Objetivo</dt><dd>Ajudar planejadores, educadores e o público a comparar sítios e datas de pouso de forma rápida e intuitiva.</dd></div>' +
            '<div><dt>Sítio de pouso</dt><dd>Local candidato na superfície lunar, definido por latitude e longitude selenográficas.</dd></div>' +
            '<div><dt>Elevação</dt><dd>Ângulo do Sol ou da Terra acima (positivo) ou abaixo (negativo) do horizonte local, em graus.</dd></div>' +
            '<div><dt>Janela de iluminação</dt><dd>Período com o Sol acima do horizonte: potencial de geração de energia solar.</dd></div>' +
            '<div><dt>Janela de comunicação</dt><dd>Período com a Terra acima do horizonte: comunicação direta com a Terra (DTE), sem satélite de retransmissão.</dd></div>' +
            '<div><dt>Restrições do polo sul</dt><dd>Sol e Terra ficam baixos no horizonte, então pequenas variações de data e local mudam muito a iluminação e a comunicação.</dd></div>' +
          '</dl>' +
        '</div>' +
      '</section>' +
      '<section id="about" class="about">' +
        '<div class="wrap">' +
          '<h2>About</h2>' +
          '<p>MoonWatch é um protótipo da equipe Myr Battlesphere para o desafio <em>Lunar Landing Site Navigator</em> do NASA Space Apps Challenge 2026.</p>' +
          '<p>Esta página testa a usabilidade do gráfico antes de usar dados lunares. Há dois tipos de conjunto de dados:</p>' +
          '<ul>' +
            '<li><strong>Curvas matemáticas (fictícias)</strong>: 20 tipos de curva, de linear a cossenoidal, com 21 pontos medidos cada (x de 0 a 10, y entre 0 e 10).</li>' +
            '<li><strong>Correlações espúrias (reais)</strong>: quatro exemplos de <a href="https://www.tylervigen.com/spurious-correlations" target="_blank" rel="noopener">Spurious Correlations</a>, de Tyler Vigen (CC BY 4.0). Correlação alta não significa causa.</li>' +
          '</ul>' +
          '<p>O gráfico é desenhado a partir dos pontos da tabela. Cada ponto tem uma <strong>assertividade</strong> (0–100%): neste protótipo ela é <strong>aleatória</strong> (sorteada a cada carga; <code>?seed=N</code> repete um sorteio). Nas curvas, o ponto fica afastado da curva teórica na proporção da assertividade: 100% em cima da curva, 0% a 2,5 unidades dela. Nas correlações espúrias os valores são reais e só a assertividade é sorteada.</p>' +
          '<p>Existem três versões da mesma página, cada uma com uma biblioteca de gráficos diferente: ' + variantLinks + '. Tabela, filtro e layout são os mesmos nas três.</p>' +
        '</div>' +
      '</section>' +
    '</main>' +
    '<footer class="footer"><div class="wrap">MoonWatch · Myr Battlesphere · gráfico com ' + lib + '</div></footer>'
  );

  // Modes drawn only on focused series tell the user to pick one when nothing is focused.
  var hint = doc.getElementById('viz-hint');
  function updateHint(index) {
    var needsFocus = ['desvio', 'faixa', 'rotulo'].indexOf(root.MoonSeries.viz) >= 0;
    hint.textContent = needsFocus && root.MoonSeries.focus(index).length === 0 ? 'Clique numa linha para ver.' : '';
  }
  root.MoonCore.onFilterChange(updateHint);
  updateHint(root.MoonCore.getFilter());

  // Line chips (vertical and horizontal share the pattern): one chip per line with a number input and ×,
  // plus an add button; values kept in the URL (replaceState, no reload). Line k <-> series k (color, visibility).
  // opts: {param, listId, addId|null, removable, tag(i), color(i), visible(i), kind}
  function lineBar(set, opts) {
    var list = doc.getElementById(opts.listId);
    var add = opts.addId ? doc.getElementById(opts.addId) : null;
    var step = set.step === 1 ? '1' : '0.1';
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
          '<span class="vline-tag" style="color:' + color + '" title="' + root.MoonSeries.all[i % root.MoonSeries.all.length].name + '">' + tag + '</span>' +
          '<input type="number" step="' + step + '" min="' + set.min + '" max="' + set.max + '" value="' + l.value + '" aria-label="Posição da linha ' + kind + ' ' + tag + '">' +
          (opts.removable ? '<button type="button" class="vline-remove" aria-label="Excluir linha ' + kind + ' ' + tag + '" title="Excluir">×</button>' : '') +
        '</span>';
      }).join('') || '<span class="vlines-empty">nenhuma</span>';
    }

    list.addEventListener('input', function (e) {
      var chip = e.target.closest('.vline-chip');
      if (chip && e.target.tagName === 'INPUT') set.set(Number(chip.getAttribute('data-id')), e.target.value, 'input');
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
  var refreshVChips = lineBar(vl, {
    param: 'vlinhas', listId: 'vlines-list', addId: 'vline-add', removable: true, kind: 'vertical',
    tag: function (i) { return 'V' + (i + 1); }, color: root.MoonCore.vlineColor, visible: root.MoonCore.vlineVisible
  });
  var refreshHChips = lineBar(hl, {
    param: 'minima', listId: 'hlines-list', addId: null, removable: false, kind: 'de viabilidade mínima',
    tag: root.MoonCore.hlineLabel, color: root.MoonCore.hlineColor, visible: root.MoonCore.hlineVisible
  });

  // Filled area per series (above the minimum viability, right of Vk), refreshed on any line move.
  var areasEl = doc.getElementById('fill-areas');
  var areaFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function renderAreas() {
    var items = root.MoonCore.areas();
    areasEl.innerHTML = '<span class="fill-areas-label">Área preenchida <span class="unit">(' + data.xLabel + ' × ' + data.yLabel + ')</span></span>' +
      (items.map(function (a) {
        return '<span class="fill-area" title="' + a.name + '" style="--area-color:' + a.color + '">' +
          '<span><span class="vline-tag" style="color:' + a.color + '">' + a.label + '</span> <span class="fill-area-name">' + a.name + '</span></span>' +
          '<strong>' + areaFmt.format(a.area) + '</strong></span>';
      }).join('') || '<span class="vlines-empty">nenhuma linha vertical</span>');
  }
  vl.onChange(renderAreas);
  hl.onChange(renderAreas);
  renderAreas();

  // Legend toggles change how many lines the chart shows: chips and area cards follow.
  root.MoonCore.onVisibilityChange(function () {
    refreshVChips();
    refreshHChips();
    renderAreas();
  });

  // Switching dataset reloads the page so every chart adapter starts clean.
  doc.getElementById('dataset-select').addEventListener('change', function (e) {
    var url = new URL(root.location.href);
    url.searchParams.set('dataset', e.target.value);
    // Line positions belong to the old dataset's axes and series count: start the new one from defaults.
    url.searchParams.delete('vlinhas');
    url.searchParams.delete('minima');
    url.hash = 'track';
    root.location.href = url.toString();
  });

  root.MoonLayout = {
    lib: lib,
    chartEl: doc.getElementById('chart'),
    resetZoomButton: doc.getElementById('reset-zoom')
  };
})(window);
