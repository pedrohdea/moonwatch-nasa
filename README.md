# moonwatch-nasa
Project MoonWatch - from Space Apps Challenge - by Myr Battlesphere Team

About the Team
https://www.spaceappschallenge.org/2026/find-a-team/myr_battlesphere/

NASA’s Commercial Lunar Payload Services (CLPS) program and other lunar missions depend on careful selection of landing sites and dates that balance the needs of both science and engineering teams. One of the most significant challenges in this process is understanding the local lighting and communication environment at a potential landing site. 

## Rodar local

Site em http://localhost:8003/, gráficos com Chart.js 4.4.1 + chartjs-plugin-zoom 2.0.1 (bibliotecas locais).

```bash
./scripts/serve.sh   # sobe o site na porta 8003 (Node, sem cache do navegador); Ctrl+C para
node --test          # testes do núcleo (tests/*.test.mjs)
# E2E (clique na linha, área vazia, arrastes, legenda, scroll infinito):
google-chrome --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/mw-e2e about:blank &
node tests/e2e.mjs   # W=390 node tests/e2e.mjs para largura de celular
```

- Página única com âncoras `#home`, `#track`, `#mission` (Definições da missão), `#about`.
- Clique numa linha do gráfico: a tabela abaixo mostra só os dados daquela série. Clique em área vazia ou em "Limpar filtro" para ver tudo.
- Tabela equivalente ao gráfico logo abaixo dele, com scroll infinito (50 linhas por vez) dentro da própria caixa.
- Tempo de percurso (linhas verticais arrastáveis): uma por série do gráfico (V1…Vn, com a cor da série n), cada uma com setinha ▼ na borda de cima do gráfico. Arraste a seta para mudar a posição, digite no chip da linha, "×" exclui e "+ Tempo de percurso" adiciona de volta (máximo = número de séries). Posições na URL (`?vlinhas=`).
- Viabilidade mínima: uma única linha horizontal amarela, comum a todas as séries, com setinha ◀ na borda direita do gráfico para arrastar e um campo para digitar. Valor na URL (`?minima=`).
- Tempo de percurso segue a legenda: esconder uma série esconde a linha vertical dela, o preenchimento e o cartão de área dela.
- O gráfico mostra só as linhas, sem pontos (exceto no modo de assertividade "Cor", que precisa dos marcadores).
- Preenchimento: cada curva é pintada (cor da série, translúcida) entre ela e a viabilidade mínima, só onde a curva está acima dessa linha e à direita da linha vertical da série (Vk). Com filtro, só a série escolhida. Acompanha o arrasto das linhas.
- Seletor "Conjunto de dados" (`?dataset=<chave>`):
  - `curvas` — 20 tipos de curva matemática, dados fictícios, 21 pontos medidos por curva (linear, quadrática, parabólica, cúbica, quártica, polinomial, exponencial, logarítmica, hiperbólica, racional, modular, inversa, potência, radical, por partes, implícita, paramétrica, trigonométrica, senoidal, cossenoidal).
  - `barco`, `milho`, `malta`, `sarah` — correlações espúrias reais de [Tyler Vigen](https://www.tylervigen.com/spurious-correlations) (CC BY 4.0). Cada série é normalizada para 0–10 no gráfico; a tabela mostra os valores reais, uma linha por ano, como no site original.
- O gráfico é desenhado a partir dos pontos da tabela (retas ligando os pontos). Cada ponto tem **assertividade** (0–100%), mostrada na tabela e no tooltip:
  - curvas: proximidade do ponto medido à curva teórica (ruído fixo por semente, 75–100%);
  - aleatória neste protótipo (5–100%, novo sorteio a cada carga; `?seed=N` repete). O ponto fica a `(1 − acc/100)·2,5` da referência: 100% em cima dela.
- Versões da visualização da assertividade no cabeçalho (`?viz=<modo>`):
  - `cor` — cor do marcador (vermelho → amarelo → verde);
  - `faixa` (padrão) — faixa de tolerância em volta da referência;
  - `rotulo` — `NN%` escrito em cada ponto.
  Referência = curva teórica (curvas) ou valor esperado fictício (correlações espúrias). Faixa e rótulo aparecem só na série clicada, para não misturar séries.
- E2E: `VIZ=faixa,cor DATASETS=curvas node tests/e2e.mjs` limita modos e conjuntos.
- `viabilidade` — viabilidade fictícia dos 50 sítios (`docs/fLandingSites_viability.csv`), uma série por grupo (média diária dos 5 sítios), 731 dias. Eixo x em dias (data na tabela). Se o CSV mudar: `node scripts/build-viability.mjs`.
- Seção `#pouso` (menu "Pousos"): escolha uma missão (19 sítios de pouso/impacto) ou marque grupos de pontos fictícios (`site/shared/data/dLandingSites.csv`, múltipla escolha) e o globo gira e enquadra todos os pontos (autoscale). Três versões em abas: Canvas (sem dependência), three.js (carregado só ao abrir a aba) e Moon3DMap (iframe, precisa de internet). Textura NASA SVS CGI Moon Kit (LROC, domínio público).
- Bibliotecas ficam em `site/chartjs/vendor/`; funciona sem internet (só as fontes do Google caem para fontes do sistema).

### Banco de dados (SQLite)

```bash
node scripts/build-db.mjs   # gera data/moonwatch.sqlite (git-ignored) a partir dos 2 CSVs
```

Esquema estrela, montado com o `node:sqlite` nativo do Node 22 (sem dependência):

| Tabela/view | Origem | Chave |
|---|---|---|
| `d_landing_sites` (id, name, lat, long, mission_id, prs_id, nearest_cold) | `site/shared/data/dLandingSites.csv` | `id` |
| `f_viability` (landing_site_id, date, viability) | `docs/fLandingSites_viability.csv` | (`landing_site_id`, `date`); `landing_site_id` → `d_landing_sites.id` |
| `v_viability` | join das duas | — |

O build valida cabeçalhos, números, datas e chaves estrangeiras, e carrega tudo numa transação (se algo falhar, não sobra banco pela metade).

Estrutura: tudo que não é gráfico (dados, filtro, tabela, linhas-guia, layout, CSS) fica em `site/shared/`; `site/chartjs/chart.js` é o adaptador do Chart.js. Plano e decisões: [`docs/PLAN.md`](docs/PLAN.md).

About the Challenge
https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/

Missions to the Moon’s south pole face extreme lighting and communication constraints, and planning them takes careful coordination between science and engineering teams. Tools for determining Sun and Earth positions at candidate landing sites exist, but their complicated interfaces make it difficult to evaluate critical information with efficiency. Your challenge is to create an intuitive tool or application that lets mission planners, educators, and the public compare landing sites and dates quickly, visualizing Sun and Earth positions relative to the horizon to assess power generation potential and direct-to-Earth communication windows.
