# MoonWatch — 3 sites locais com gráfico interativo (comparação de libs)

## Context

Repo `moonwatch-nasa` só tem README/LICENSE (+ `docs/PLAN.md` rascunho antigo, ainda com Horizons). Pedro quer site local, página única com âncoras `#home`, `#track`, `#about`, gráfico robusto onde clicar numa linha filtra os dados abaixo, com scroll infinito. Para comparar ferramentas: **3 versões do mesmo site, cada uma com lib de gráfico diferente, em portas diferentes**, feitas por **3 sub-agentes**. Toda atualização futura vale para as 3.

Decisões do chat (vão para `docs/PLAN.md`):
- Scroll infinito **na tabela dentro de `#track`** (caixa rolável); `#about` sempre alcançável.
- **Dados fictícios, nada da internet**: 6 séries = tipos de funções matemáticas, só para testar usabilidade.
- Design: identidade **Space Apps 2026** (Brand Guide oficial, PDF 23/05/2025).
- 3 variantes: **ECharts**, **Plotly.js**, **Chart.js** — portas 8001, 8002, 8003.
- Branch: `feat/moonwatch-site`.

## Arquitetura: núcleo compartilhado + adaptador por lib

"Sempre aplicar nas 3" = tudo que não é gráfico mora em `site/shared/` e é usado pelas 3. Só o desenho do gráfico muda.

```
site/
  shared/
    series.js      # 6 funções, 2001 pontos cada, filterRows()  (window.MoonSeries + module.exports)
    core.js        # estado do filtro: MoonCore.setFilter(i|null), onFilterChange(cb), série ativa
    table.js       # tabela com scroll infinito (lote 50, IntersectionObserver, reset ao filtrar)
    layout.js      # injeta nav + #home + #track (contêiner do gráfico, badge, botões, tabela) + #about
    style.css      # tokens Space Apps, fontes, gradiente hero, responsivo
  echarts/  index.html, chart.js, vendor/echarts.min.js        (+ symlink shared -> ../shared)
  plotly/   index.html, chart.js, vendor/plotly-basic.min.js    (+ symlink shared -> ../shared)
  chartjs/  index.html, chart.js, vendor/chart.umd.min.js, vendor/chartjs-plugin-zoom.min.js, vendor/hammer.min.js (+ symlink)
scripts/serve.sh   # sobe 3 servidores: python3 -m http.server 8001/8002/8003, cada um na pasta da variante
tests/series.test.mjs, tests/core.test.mjs   # node:test
```

Symlink `shared` dentro de cada variante: cada porta serve só sua pasta e ainda enxerga o núcleo (http.server segue symlink). Um único lugar para editar.

Contrato do adaptador (`<lib>/chart.js`), único arquivo que cada sub-agente escreve além do vendor e do `index.html`:
- `MoonChart.render(container, MoonSeries.all)` — desenha 6 séries, legenda, tooltip, zoom/pan, botão resetar zoom.
- Clique na linha → `MoonCore.setFilter(seriesIndex)`; clique em área vazia → `MoonCore.setFilter(null)`. Zoom/arrasto não filtra.
- `MoonCore.onFilterChange(i => ...)` → destaca série `i` (mais grossa) e esmaece as outras; `null` restaura.
- Cores das séries vêm de `MoonSeries.colors` (núcleo), iguais nas 3.

Como cada lib faz o clique na linha:
- ECharts 5.6.0: `series.triggerLineEvent:true` + `chart.on('click', {seriesType:'line'}, p => p.seriesIndex)`; vazio via `chart.getZr().on('click', e => !e.target)`; `dataZoom` inside+slider nativo.
- Plotly.js basic 2.35.2: `plotly_click` → `curveNumber`, `hovermode:'closest'`; vazio via clique no plot sem ponto (`plotly_click` não dispara) → listener no contêiner com flag; zoom/pan nativos, `plotly_relayout` ignorado.
- Chart.js 4.4.1 + plugin-zoom 2.0.1 + hammerjs 2.0.8: `getElementsAtEventForMode(e,'nearest',{intersect:false},true)` com tolerância de ~12 px; arrasto suprime clique (distância pointerdown→up).

## Design (Space Apps Brand Guide)

Site `spaceappschallenge.org` recusa TLS daqui; valores vieram do PDF em `assets.spaceappschallenge.org`.
- Tokens `:root`: `--deep-blue:#07173F` (fundo), `--electric-blue:#0042A6`, `--neon-blue:#0960E1`, `--blue-yonder:#2E96F5`, `--neon-yellow:#EAFE07` (só destaque, nunca fundo), `--rocket-red:#E43700`, `--martian-red:#8E1100`, `--white:#FFF`.
- Hero: gradiente linear 45° Electric Blue → Deep Blue. Texto só sobre Deep Blue, Electric Blue ou branco.
- Fontes (Google Fonts, OFL; fallback `system-ui`/`monospace` offline): títulos Fira Sans 900/700; corpo Overpass 400/700; números Fira Code.
- Cores das 6 séries com contraste ≥ 3:1 sobre `#07173F` (Blue Yonder, Neon Yellow, Rocket Red claro, branco, azul claro, coral/ciano).

## Dados (`shared/series.js`)

x ∈ [0, 10], passo 0.005 → 2001 pontos/série, 12 006 linhas. Todas em y ∈ [0, 10]:
Linear `x` · Quadrática `x²/10` · Cúbica `x³/100` · Exponencial `10(e^(x/4)−1)/(e^2.5−1)` · Logarítmica `10·ln(1+x)/ln(11)` · Senoidal `5+5·sin(x)`.

## Etapas, responsáveis e tempo

Total ≈ 60–80 min (núcleo sequencial + 3 sub-agentes em paralelo).

| # | Etapa | Quem | Checkpoint | Tempo |
|---|---|---|---|---|
| 1 | Branch `feat/moonwatch-site`; reescrever `docs/PLAN.md` | eu | branch criada | 5 min |
| 2 | Núcleo: `series.js`, `core.js`, `table.js`, `layout.js`, `style.css` + testes node | eu | `node --test tests/` verde | 20–25 min |
| 3 | `scripts/serve.sh` + estrutura das 3 pastas com symlink | eu | 3 portas respondem 200 | 5 min |
| 4a | Variante ECharts | sub-agente 1 (sonnet) | clique filtra, zoom ok | 10–15 min |
| 4b | Variante Plotly.js | sub-agente 2 (sonnet) | idem | 10–15 min (paralelo) |
| 4c | Variante Chart.js | sub-agente 3 (sonnet) | idem | 10–15 min (paralelo) |
| 5 | Revisão cruzada + hardening nas 3 (clique vazio, zoom não filtra, legenda oculta + filtro, troca de filtro no meio do scroll, 390 px, console sem erro; screenshot headless se houver Chrome) | eu | checklist verde nas 3 | 12–15 min |
| 6 | README ("Rodar local", comparação das libs) + commit | eu | commit na branch | 5 min |

Sub-agentes: `sonnet` (mais barato que dá conta de API de lib + eventos; haiku arrisca errar detalhes de clique/zoom). Cada um recebe: contrato do adaptador, caminhos do núcleo, versão da lib, regra "não editar `shared/`" (mudança no núcleo volta para mim, para valer nas 3).

Gotchas entre etapas:
- 2→4: contrato `MoonCore`/`MoonSeries`/`MoonChart` congelado antes dos sub-agentes; sem ESM (funciona em `file://`).
- 4: sub-agente não edita `shared/`; se precisar, reporta e eu aplico (vale para as 3).
- 4b: Plotly basic não inclui WebGL; 12k pontos em SVG ok.
- 4c: plugin-zoom precisa de hammerjs carregado antes.
- 5: trocar filtro reobserva sentinela da tabela (já no núcleo).

## Verificação

Automática:
- `node --test tests/` (séries: 6 × 2001, y ∈ [0,10]; core: setFilter notifica, null limpa; filterRows).
- `node --check` em cada `chart.js`.
- `curl -s -o /dev/null -w "%{http_code}"` nas portas 8001/8002/8003 → 200.

Manual (`scripts/serve.sh`, abrir `localhost:8001`, `:8002`, `:8003`):
- Menu leva a `#home`, `#track`, `#about`.
- Clicar na curva Senoidal → tabela só Senoidal, badge "2001 linhas", série destacada.
- Clicar área vazia / "Limpar filtro" → 12 006 linhas.
- Rolar tabela → +50 por vez; `#about` acessível.
- Zoom/pan não filtra; resetar volta.
- ~390 px sem scroll horizontal da página.

## Status da execução (2026-11-14)

- Núcleo `site/shared/` + 3 adaptadores (`site/echarts`, `site/plotly`, `site/chartjs`) prontos; cada adaptador feito por um sub-agente (sonnet).
- `.gitignore` do template Python ignorava `/site` (mkdocs); linha comentada.
- `index.html` das 3 versões gerado igual (só muda lib e vendor), para manter as 3 em sincronia.
- Bug corrigido no Plotly: `plotly_click` dispara antes do `click` DOM, e o handler de área vazia limpava o filtro logo em seguida. Correção: comparar timestamp (janela de 300 ms).
- Verificação: `node --test` (4/4) e `tests/e2e.mjs` via Chrome headless em 1280 px e 390 px — todos os checks OK nas 3 versões.
- Pendências conhecidas: modebar do Plotly em inglês (basic não traz locale pt-BR); mini-preview do slider do ECharts cinza (cosmético).

## Atualização: conjuntos de dados (2026-11-14)

Pedido do Pedro: usar como exemplo os gráficos de https://www.tylervigen.com/spurious-correlations e a lista de 20 tipos de curva; cada gráfico com a tabela equivalente embaixo.

Decisões:
- `shared/series.js` passa a ter conjuntos de dados, escolhidos por `?dataset=<chave>` (seletor na seção Track). Trocar de conjunto recarrega a página: os adaptadores não precisam saber redesenhar.
- `curvas`: 20 curvas da lista, x de 0 a 10, y entre 0 e 10, 2001 pontos cada. Paramétrica = cicloide (x não uniforme, mas crescente — necessário para a decimation do Chart.js).
- 4 correlações espúrias reais (barco, milho, malta, sarah). Dados extraídos das páginas e validados: o r de Pearson recalculado bate com o da página até a 7ª casa nos 4 casos.
- Duas grandezas com unidades diferentes no mesmo eixo: cada série normalizada min-max para 0–10 (equivale aos 2 eixos Y do site original). Valor real fica no 3º campo do ponto e aparece no tooltip e na tabela.
- Tabela equivalente: espúrias em formato largo (Ano | série A | série B), como no site original; clique numa linha do gráfico deixa só Ano + aquela coluna. Curvas mantêm formato longo (uma linha por ponto), porque a Paramétrica não compartilha os x das outras.
- Contrato dos adaptadores: faixas e títulos dos eixos vêm de `MoonSeries.dataset`; anos sem separador de milhar. Os 3 adaptadores atualizados por 3 sub-agentes (sonnet).
- `tests/e2e.mjs` virou genérico: acha em cada série o ponto mais isolado e o ponto vazio mais distante das linhas; roda em `curvas` e `sarah`.

## Atualização: gráfico a partir da tabela + assertividade (2026-11-14)

Pedido do Pedro: não mostrar fórmula no site; o gráfico deve surgir a partir dos pontos da tabela; cada ponto tem uma assertividade.

Decisões:
- Fórmula removida da tabela e do site (fica só como documentação no código de `series.js`).
- Curvas: 21 pontos "medidos" por curva (x de 0 a 10, passo 0,5) em vez de 2001 pontos teóricos. Medido = valor teórico + ruído limitado a ±0,4, gerado por PRNG com semente fixa (mesmos dados em toda carga e nos testes).
- Ponto = `[x, y, valorReal|null, assertividade]`. Gráfico desenha marcadores em todos os pontos ligados por retas (sem suavização), então cada marcador = uma linha da tabela.
- Assertividade (0–100%):
  - curvas: `100 − 25·|medido − teórico|/0,4` (75–100%);
  - espúrias: concordância das séries normalizadas no ano, `100·(1 − |A − B|/10)`, igual para as duas séries daquele ano.
- Exibição: coluna "Assertividade" com barra na tabela; tooltip; tamanho do marcador proporcional nos 3 gráficos.
- E2E: linhas interpoladas entre pontos; clique ambíguo (séries sobrepostas, ex. Malta) vira SKIP e o filtro é aplicado via `MoonCore` para os demais checks.
- Plotly: `hoverdistance` 20 → 12 px (igual ao Chart.js), senão com 20 curvas no celular não sobra área vazia para limpar o filtro.
