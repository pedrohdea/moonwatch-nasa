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

## Atualização: versões de visualização da assertividade (2026-11-14)

Pedido do Pedro: o gráfico deve ilustrar a assertividade ponto–curva. Opções apresentadas em quiz; resposta: "testa todos e faz versões no cabeçalho", com sub-agentes.

Decisões:
- 5 modos, escolhidos por `?viz=` (pílulas "Assertividade" no cabeçalho, preservando o conjunto de dados e a biblioteca): `tamanho`, `desvio` (padrão), `cor`, `faixa`, `rotulo`.
- Ponto ganha 5º campo `refY`: valor da curva teórica (curvas) ou da outra série no mesmo ano (espúrias). Cada série tem `reference` (201 amostras da curva teórica; ou os pontos da outra série).
- Escala de cor única para as 3 libs: `MoonSeries.accuracyColor` (vermelho `#FF6A3D` → Neon Yellow → verde `#3DDC84`) sobre a faixa de assertividade do conjunto.
- Foco (`MoonSeries.focus`): desvio, faixa e rótulo desenham só na série filtrada; sem filtro, em todas se houver ≤ 4 séries (espúrias). Com 20 curvas sem filtro aparece o aviso "Clique numa linha para ver."
- Tolerância da faixa: curvas ±0,4 (ruído máximo); espúrias ±1 (= 90% de concordância).
- Decorações nunca são clicáveis nem entram em legenda/tooltip, para não deslocar índices do filtro.
- 1 sub-agente (sonnet) por biblioteca, com spec comum.
- E2E percorre conjunto × modo × biblioteca (`VIZ=`, `DATASETS=`, `W=`).

## Atualização: assertividade aleatória + correções de vínculo (2026-11-14)

Pedidos do Pedro: assertividade aleatória e diferença mais evidente; bug "ao selecionar a curva amarela, mostra a assertividade da azul".

Decisões:
- Assertividade sorteada por ponto (5–100%), novo sorteio a cada carga; `?seed=N` repete. Links de biblioteca e de modo carregam o `seed`, para comparar versões com os mesmos pontos; link "Sortear de novo".
- Curvas: ponto afastado da curva teórica em `(1 − acc/100)·2,5`; faixa de tolerância ±1,25 (fora = < 50%). Correlações reais: valores reais mantidos, só a assertividade é sorteada (o traço de desvio mostra a distância real até a outra série; a cor mostra a assertividade sorteada).
- Mais evidente: escala de cor fixa 0–100%; marcador 3–14 px (`MoonSeries.markerSize`, comum às 3 libs); rótulos coloridos pela assertividade.
- Bug do vínculo (tabela): a coluna de assertividade das correlações lia sempre a 1ª série. Agora há uma coluna de assertividade por série; com filtro, só a da série escolhida. E2E verifica que a assertividade da tabela bate com a série filtrada.
- Decorações (desvio/faixa/rótulo) só na série clicada; antes, sem filtro, as duas séries de correlação desenhavam traços sobrepostos.
- Plotly: hover só mede distância até pontos; clique entre marcadores agora testa a distância ao segmento (12 px), como no Chart.js.
- E2E: `seed` fixo; ambiguidade de clique medida em pixels (16 px).
- Correlações reais: referência deixou de ser "a outra série" e virou um valor esperado fictício a `(1 − acc/100)·2,5` do ponto real. Assim, em todos os conjuntos, distância até a referência, cor e % contam a mesma coisa (antes um traço longo podia sair verde).

## Atualização: sítios de pouso com globo animado (2026-11-14)

Pedido do Pedro: ao selecionar uma missão, animação que leva até as coordenadas dela na Lua (lista de links do moon3dmap.com com lat/long). Quiz: "Nova seção" + "Fazer as 3 versões para eu comparar depois".

Decisões:
- Nova seção `#pouso` ("Sítios de pouso e impacto") em `site/shared/landing.js`, logo após `#mission`; vale para as 3 portas. Link "Pousos" no menu.
- 16 missões. Agência correta por missão (NASA, URSS); Luna 2 e Ranger 7 são sítios de impacto. URL do Moon3DMap montada de slug + lat/long (`toFixed(4)`, igual aos links colados).
- Seletor de missão único, compartilhado pelas 3 abas de renderização (troca de aba mantém a missão):
  - **Canvas**: globo ortográfico desenhado pixel a pixel em canvas 2D; zero dependência.
  - **three.js**: esfera WebGL com luz; `three.min.js` r158 (último UMD) em `site/shared/vendor/`, carregado só ao abrir a aba (não pesa nas páginas de gráfico).
  - **Moon3DMap**: iframe do moon3dmap.com com a URL da missão; `src` só é definido com a aba aberta (resto do site segue offline); link de fallback sempre visível.
- Animação (Canvas e three.js usam o mesmo estado `{lat, lon, zoom}`): afasta, gira pelo caminho mais curto em longitude (ex.: um sítio perto de 177° E → Luna 9 cruza 180°) e aproxima até o sítio, ~2,6 s, easing cúbico. `prefers-reduced-motion` pula direto. `requestAnimationFrame` só roda durante a animação.
- Textura: NASA SVS CGI Moon Kit, LROC color 2k (domínio público), convertida de TIF para JPG (378 KB) em `site/shared/vendor/moon-2k.jpg`. Crédito ao lado do globo.
- Matemática pura (projeção ortográfica, caminho mais curto, interpolação, rotação do three.js) exportada via `module.exports` e testada em `tests/landing.test.mjs`. Gancho `window.MoonLanding` para o E2E.
- Pontos fictícios (pedido do Pedro: "salvei um csv com pontos fictícios na Lua; mostrar na animação"): `dLandingSites.csv` movido de `docs/` para `site/shared/data/` (o site precisa servi-lo). 50 pontos, 10 grupos de 5 por `missionID`; os IDs não correspondem às 19 missões, então viram o grupo "Pontos fictícios (CSV)" no seletor.
  - Centro do grupo = média dos vetores unitários (correto perto do polo e de 180°); zoom calculado para separar os 5 pontos (até 120×). Acima de ~10× a textura 2k só desfoca: Canvas passou a amostrar com filtro bilinear (antes, vizinho mais próximo pixelava).
  - Pontos de todos os grupos aparecem em laranja no globo; o grupo escolhido fica amarelo e ganha tabela (ID, nome, lat, long, PRSID, NEARESTCOLD).
  - Moon3DMap: sem slug para ponto fictício, usa `https://moon3dmap.com/pt/?lat=…&long=…`.
  - Zoom interpolado em escala log (1,8× → 120× fica uniforme). Linha inválida no CSV é descartada.
- Revisão (Pedro: "ficou muito zoom; seletor de múltipla escolha; enquadrar autoscale todos os pontos"):
  - Grupos do CSV saíram do `<select>` de missão e viraram checkboxes ("Pontos fictícios (CSV)", com Todos/Nenhum). `MoonLanding.setGroups(keys)`.
  - Autoscale (`frameSites`): centro = média dos vetores unitários dos pontos marcados; zoom para o ponto mais distante ficar a ~80% da metade da vista; mínimo 1× (disco inteiro), máximo 6× (antes 120×). Um grupo sozinho (5 pontos a < 0,2°) fica num único aglomerado; os valores estão na tabela.
  - Tabela lista os pontos de todos os grupos marcados (com coluna Grupo). Missão e grupos: o último escolhido define a vista.
  - Pontos do CSV desenhados por cima dos marcadores das missões (grupo 4 tem as mesmas coordenadas do Apollo 14).

## Atualização: conjunto "Viabilidade" no gráfico (2026-11-14)

Pedido do Pedro: usar `docs/fLandingSites_viability.csv` (LANDINGSITEID, DATE, VIABILITY; 50 sítios × 731 dias, 2024-01-01 a 2025-12-31, valores 0–200). Quiz: "Viabilidade em gráfico", "10 grupos, média diária", "Só dados agora".

Decisões:
- `?dataset=viabilidade`: uma série por grupo (missionID de `dLandingSites.csv`) = média diária dos 5 sítios; 10 séries × 731 pontos.
- Dados: `scripts/build-viability.mjs` gera `site/shared/data/viability.js` (39 KB) a partir dos 2 CSVs; valida dia consecutivo e linha inválida. O CSV de origem fica em `docs/` (estava aberto no LibreOffice). Rodar o script de novo se o CSV mudar.
- `viability.js` carregado antes de `series.js` nas 3 páginas; sem ele o conjunto simplesmente não aparece.
- Eixo x = índice do dia (0 = 01/01/2024), porque mostrar data no eixo exige mexer nos 3 `chart.js`, que outra sessão estava editando (preenchimento entre curva e linhas). A tabela mostra Data + Dia + Viabilidade. **Pendente:** formatar o eixo x e o tooltip como data nos 3 adaptadores (`MoonSeries.dataset.xDate(day)` já existe).
- Assertividade aleatória como nas correlações espúrias; referência a `(1 − acc/100)·50` (desvio máximo escalado de 0–10 para 0–200); faixa ±25.
- Teste: `tests/viability.test.mjs` (média recalculada do CSV bruto; contrato do ponto).

## Atualização: linhas-guia, áreas e simplificação (2026-11-15)

- Linhas verticais: uma por série (padrão e máximo), cor da série, seguem a legenda (série escondida = sem linha, sem preenchimento, sem cartão); trocar de conjunto de dados recomeça do padrão.
- Linha horizontal única "Viabilidade mínima" (amarela, `?minima=`), comum a todas as séries; preenchimento de cada série = acima dela e à direita da sua vertical; cartões grandes com a área (shoelace) por série.
- Só as setinhas arrastam (corpos das linhas roubavam cliques nas curvas); gráfico só com linhas, sem pontos.
- Gráfico logo abaixo do seletor de dados; controles e tabela embaixo.
- Modos de assertividade "Tamanho" e "Desvio" removidos a pedido; restam Cor, Faixa (padrão) e Rótulo.
- Só Chart.js (porta 8003): versões ECharts e Plotly.js removidas a pedido.
- "Linhas verticais" renomeadas para "Tempo de percurso". Nova linha "Partida" (branca, `?partida=`, campo de data no conjunto de viabilidade): Vk = Partida + tempo k; mover a Partida desloca todas as Vk mantendo os tempos (guardados mesmo se a linha bater na borda do eixo); arrastar/digitar uma Vk muda só o tempo dela. Padrão: tempos distribuídos entre a Partida e o fim do eixo.
- Filtro de série também filtra o tempo de percurso (linha, chip) e os cartões de área.
- 3 missões removidas da lista do globo, da documentação e dos testes a pedido (16 missões).

## Update: English site and code (2026-11-15)

User request: whole site and code in English, NASA-style mission wording. Keys renamed (datasets `curves`/`boat`/`corn`/`malta`/`sarah`/`viability`; confidence modes `color`/`band`/`label`; URL params `transit`/`threshold`/`departure`; anchor `#sites`), en-US numbers, ISO 8601 dates. Glossary: Confidence, Departure, Transit time, Minimum viability, Viable area, Landing & Impact Sites, Mission Definitions, Direct-to-Earth (DTE). This plan file keeps its earlier sections in Portuguese as the decision log.

## Update: NASA 3D assets in Landing & Impact Sites (2026-11-15)

Request: use NASA options 1 (SVS Moon 3D models), 3 (NASA 3D Resources) and 4 (Moon Trek). Quiz decisions: version `moon_small.glb` in the repo; keep everything local (offline, repo +~74 MB); keep the Moon3DMap tab and add a Terrain 3D tab.

- `scripts/fetch-nasa-assets.mjs` vendors everything into `site/shared/vendor/` (`nasa/` + `three/`) and writes `nasa/SOURCES.md`. `.gitattributes` marks `*.glb`, `*.stl`, `*.jpg` binary; no git-lfs.
- three.js r158 moved from the UMD `three.min.js` (removed) to ES modules: import map `three` in `site/chartjs/index.html`, loaders imported dynamically from the classic `landing.js` (still lazy, only when a 3D tab opens).
- three.js tab (option 1): `moon_small.glb`, scaled by half its box width (bounding sphere of a sphere's box is √3·R), `GLB_YAW = -π/2` measured with screenshots (lon 0 faces -Z in the SVS frame). Frontal light so no site sits in the dark. Fallback: textured sphere.
- Canvas tab (option 4): CGI Moon Kit 2k first, then the 16×8 Moon Trek LRO WAC tiles (zoom 3, 256 px) stitched into a 4096×2048 texture; same equirectangular frame (top-left -180°, 90°). `MoonLanding.renderers.canvas.texture` reports the source for the E2E.
- Terrain 3D tab (option 3): Apollo 11/12/14/15/16 STL height maps, centered and scaled to 2 units, colored by height NASA blue → Neon Yellow, slow turntable + drag. Gotchas: the STLs ship zero normals (`computeVertexNormals`) and inverted winding (`DoubleSide`); `geometry.translate()` recomputes `boundingBox` in place (clone it first); the Lunar Module GLB is Draco-compressed (vendored `DRACOLoader` + decoder). LM not to scale. Other missions: "3D terrain available for Apollo 11, 12, 14, 15 and 16".
- Tests: unit (Trek tile grid, STL mission mapping), E2E (Trek texture 4096×2048, GLB source, Terrain 3D for Apollo 11 + LM, message for Luna 9), desktop and 390 px.

## Plan: hook video as full-screen intro (2026-11-15) — approved, then replaced (see below)

Request: use `docs/video/hook_newspaper.mp4` (5 s, 1920×1080, 14.7 MB, no audio; "The Lunar Gazette": "At the lunar south pole, a four-day launch slip can mean months of waiting, and millions lost", made in session `session_018cxk3pLr2GZZbmfUKRTaof` by `docs/video/hook_newspaper.py`) in the opening of the site. Quiz decisions: **full-screen intro** that plays and then reveals the hero; site loads a **720p compressed** copy; version **only the `.py` and fonts** of `docs/video/` (fonts are SIL OFL, `OFL.txt` included); the original mp4 stays out of git (regenerable).

Steps (small, verifiable):
1. Asset. `site/shared/media/hook_newspaper.mp4` = `ffmpeg -i docs/video/hook_newspaper.mp4 -vf scale=1280:-2 -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart -an` (target 1–2 MB). Poster `hook_newspaper.jpg` = last frame (stamp visible), `-sseof -0.1 -frames:v 1`. `.gitattributes`: `*.mp4 binary`. `.gitignore`: `docs/video/*.mp4`, `docs/video/.ruff_cache/`. Command recorded in README.
2. `site/shared/intro.js` (classic script after `layout.js`). Fixed full-screen overlay `#intro` (deep-blue background, `<video muted playsinline autoplay preload="auto" poster>`, `object-fit: contain` = letterbox on phones), yellow **Skip** button (focused on open; Esc also skips), page scroll locked while open.
   - On `ended`: hold the last frame ~1.2 s (the stamp is the punchline), fade out 600 ms, remove the overlay, focus the hero `h1`.
   - Never blocks the site: if `play()` is rejected, the video errors, or it is not playing after 3 s, the overlay is removed at once.
3. When it shows: pure `shouldShowIntro({hash, search, reducedMotion, seen})`, exported for node tests.
   - Shows on the first visit of the session (`sessionStorage`, try/catch).
   - Skipped for deep links (hash other than `#home`, e.g. `#sites`), `?intro=0` and `prefers-reduced-motion`.
   - `?intro=1` forces it. The existing E2E URLs all use `#track`/`#sites`, so they stay unaffected.
4. Hero: small ghost button "▶ Watch intro" reopens the overlay. Text alternative: visually hidden headline inside the overlay (`aria-label` on the dialog).
5. Tests and docs:
   - Unit: `shouldShowIntro` cases.
   - E2E: `/?intro=1` shows `#intro` and the video plays; Skip removes it; after `ended` it is removed (wait ~7 s); `#sites` has no intro; 390 px has no horizontal scroll and the console stays clean.
   - README and this file updated; one commit.

Acceptance (manual): fresh tab `http://localhost:8003/` → intro plays, stamp, fade into the hero; reload in the same tab → no intro; Skip / Esc work; `/#sites` → no intro; OS "reduce motion" → no intro; phone portrait → letterboxed video, Skip reachable; offline still works.

Simplest-solution check: native `<video>` + ~60 lines of JS/CSS; no library. No sub-agents (one coupled change).
Risk: every new session waits up to ~6 s before seeing the hero unless Skip is used.

### Change: intro section instead of the full-screen overlay (2026-11-15)

Pedro, after seeing the overlay working: "roda o video de intro dentro da secção, cria uma secção em cima. em loop, com botão de stop." Implemented instead of the overlay:
- New section `#intro` above `#home` (`site/shared/intro.js`): 16:9 frame inside `.wrap`, `<video muted loop playsinline autoplay>` + poster, yellow **Stop / Play** button (bottom right). Reduced motion: no autoplay, poster shown, button says Play.
- Dropped: overlay, Skip/Esc, once-per-session rule, `?intro=`, "Watch intro" button, `shouldShowIntro` unit test.
- Kept from the plan: 720p web copy (1.3 MB) + poster in `site/shared/media/`, `docs/video/*.mp4` ignored, `.py` + OFL fonts versioned. `scripts/serve.mjs` gained MIME types (mp4, jpg, json, wasm).
- E2E: section sits right before `#home`, video loops and plays, Stop pauses, Play resumes.
- Follow-up (Pedro: "faz auto stop, ao final do video"): no `loop`; the video plays once and stops on the last frame (stamp); the button turns into Play, which replays from the start.
- Follow-up (Pedro: "adiciona outra secção, no mesmo modelo, no fim com outro video: docs/video/closing_moonwatch.mp4"): `site/shared/intro.js` became `site/shared/videos.js`, one config per video. New `#closing` section after `#about` with `closing_moonwatch.mp4` (web copy 0.57 MB). It stops at 4.5 s because the video fades to dark after 4.6 s; the poster is that frame. Both videos now start when half of the frame is visible (IntersectionObserver), so the closing one does not play off screen.
- Gotcha: `scripts/serve.mjs` did not answer HTTP `Range`, so `<video>` was not seekable (`seekable` = [0, 0]) and the 4.5 s stop jumped back to 0. The server now returns 206 + `Content-Range` (any static host already does).
