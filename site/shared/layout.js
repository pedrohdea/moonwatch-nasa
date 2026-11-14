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

  var datasetOptions = root.MoonSeries.datasets.map(function (d) {
    return '<option value="' + d.key + '"' + (d.key === data.key ? ' selected' : '') + '>' + escapeHtml(d.label) + '</option>';
  }).join('');

  var datasetInfo = data.kind === 'spurious'
    ? '<p class="dataset-info">' + escapeHtml(data.title) + ' · r = ' + data.r.toFixed(4).replace('.', ',') +
      ' · cada série normalizada para 0–10; valores reais na tabela; assertividade = concordância das duas séries no ano. Fonte: <a href="' + data.url + '" target="_blank" rel="noopener">Tyler Vigen, Spurious Correlations</a> (CC BY 4.0).</p>'
    : '<p class="dataset-info">20 tipos de curvas matemáticas, dados fictícios: 21 pontos medidos por curva (x de 0 a 10). O gráfico liga os pontos da tabela; o tamanho do marcador mostra a assertividade.</p>';

  var variantLinks = VARIANTS.map(function (v) {
    var protocol = root.location.protocol === 'https:' ? 'https:' : 'http:'; // file:// still links to the local servers
    var href = protocol + '//' + (root.location.hostname || 'localhost') + ':' + v.port + '/' + root.location.search; // keep the chosen dataset across variants
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
          '<div class="toolbar">' +
            '<span id="filter-badge" class="badge" role="status" aria-live="polite"></span>' +
            '<button id="clear-filter" class="btn btn-ghost" type="button">Limpar filtro</button>' +
            '<button id="reset-zoom" class="btn btn-ghost" type="button">Resetar zoom</button>' +
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
          '<p>O gráfico é desenhado a partir dos pontos da tabela. Cada ponto tem uma <strong>assertividade</strong> (0–100%): nas curvas, quão perto o ponto medido está da curva teórica; nas correlações espúrias, quanto as duas séries normalizadas concordam naquele ano.</p>' +
          '<p>Existem três versões da mesma página, cada uma com uma biblioteca de gráficos diferente: ' + variantLinks + '. Tabela, filtro e layout são os mesmos nas três.</p>' +
        '</div>' +
      '</section>' +
    '</main>' +
    '<footer class="footer"><div class="wrap">MoonWatch · Myr Battlesphere · gráfico com ' + lib + '</div></footer>'
  );

  // Switching dataset reloads the page so every chart adapter starts clean.
  doc.getElementById('dataset-select').addEventListener('change', function (e) {
    var url = new URL(root.location.href);
    url.searchParams.set('dataset', e.target.value);
    url.hash = 'track';
    root.location.href = url.toString();
  });

  root.MoonLayout = {
    lib: lib,
    chartEl: doc.getElementById('chart'),
    resetZoomButton: doc.getElementById('reset-zoom')
  };
})(window);
