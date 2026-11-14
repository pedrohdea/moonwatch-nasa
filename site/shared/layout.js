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
  var total = root.MoonSeries.all.reduce(function (n, s) { return n + s.points.length; }, 0);
  var fmt = new Intl.NumberFormat('pt-BR');

  var variantLinks = VARIANTS.map(function (v) {
    var protocol = root.location.protocol === 'https:' ? 'https:' : 'http:'; // file:// still links to the local servers
    var href = protocol + '//' + (root.location.hostname || 'localhost') + ':' + v.port + '/';
    var current = v.name === lib ? ' aria-current="page"' : '';
    return '<a class="variant" href="' + href + '"' + current + '>' + v.name + '</a>';
  }).join('');

  doc.body.insertAdjacentHTML('afterbegin',
    '<header class="topbar">' +
      '<a class="brand" href="#home">Moon<span>Watch</span></a>' +
      '<nav class="nav" aria-label="Seções">' +
        '<a href="#home">Home</a><a href="#track">Track</a><a href="#about">About</a>' +
      '</nav>' +
      '<div class="variants" aria-label="Versões do gráfico">' + variantLinks + '</div>' +
    '</header>' +
    '<main>' +
      '<section id="home" class="hero">' +
        '<div class="wrap">' +
          '<p class="eyebrow">Protótipo de usabilidade · ' + lib + '</p>' +
          '<h1>Explore curvas,<br>filtre com um clique.</h1>' +
          '<p class="lead">Seis famílias de funções matemáticas no mesmo gráfico. Clique numa linha para ver só os dados dela na tabela abaixo.</p>' +
          '<div class="stats">' +
            '<div><strong>' + root.MoonSeries.all.length + '</strong><span>séries</span></div>' +
            '<div><strong>' + fmt.format(total) + '</strong><span>pontos</span></div>' +
            '<div><strong>0–10</strong><span>intervalo de x</span></div>' +
          '</div>' +
          '<a class="btn" href="#track">Ver gráfico</a>' +
        '</div>' +
      '</section>' +
      '<section id="track" class="track">' +
        '<div class="wrap">' +
          '<h2>Track</h2>' +
          '<p class="hint">Clique numa linha para filtrar. Clique em área vazia ou em “Limpar filtro” para ver tudo. Use a roda do mouse ou arraste para dar zoom.</p>' +
          '<div class="toolbar">' +
            '<span id="filter-badge" class="badge" role="status" aria-live="polite"></span>' +
            '<button id="clear-filter" class="btn btn-ghost" type="button">Limpar filtro</button>' +
            '<button id="reset-zoom" class="btn btn-ghost" type="button">Resetar zoom</button>' +
          '</div>' +
          '<div id="chart" class="chart" role="img" aria-label="Gráfico de linhas com seis funções matemáticas"></div>' +
          '<div class="table-box" id="table-box" tabindex="0" aria-label="Dados do gráfico">' +
            '<table class="data">' +
              '<thead><tr><th>#</th><th>Função</th><th>Fórmula</th><th class="num">x</th><th class="num">y</th></tr></thead>' +
              '<tbody id="table-body"></tbody>' +
            '</table>' +
            '<div id="table-sentinel" class="sentinel">Carregando mais linhas…</div>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section id="about" class="about">' +
        '<div class="wrap">' +
          '<h2>About</h2>' +
          '<p>MoonWatch é um protótipo da equipe Myr Battlesphere para o desafio <em>Lunar Landing Site Navigator</em> do NASA Space Apps Challenge 2026.</p>' +
          '<p>Esta página testa a usabilidade do gráfico antes de usar dados reais. <strong>Os dados são fictícios</strong>: seis funções (linear, quadrática, cúbica, exponencial, logarítmica e senoidal) com x de 0 a 10 em passos de 0,005, todas escaladas para y entre 0 e 10.</p>' +
          '<p>Existem três versões da mesma página, cada uma com uma biblioteca de gráficos diferente: ' + variantLinks + '. Tabela, filtro e layout são os mesmos nas três.</p>' +
        '</div>' +
      '</section>' +
    '</main>' +
    '<footer class="footer"><div class="wrap">MoonWatch · Myr Battlesphere · gráfico com ' + lib + '</div></footer>'
  );

  root.MoonLayout = {
    lib: lib,
    chartEl: doc.getElementById('chart'),
    resetZoomButton: doc.getElementById('reset-zoom')
  };
})(window);
