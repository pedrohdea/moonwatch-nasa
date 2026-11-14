# moonwatch-nasa
Project MoonWatch - from Space Apps Challenge - by Myr Battlesphere Team

About the Team
https://www.spaceappschallenge.org/2026/find-a-team/myr_battlesphere/

NASA’s Commercial Lunar Payload Services (CLPS) program and other lunar missions depend on careful selection of landing sites and dates that balance the needs of both science and engineering teams. One of the most significant challenges in this process is understanding the local lighting and communication environment at a potential landing site. 

## Rodar local

Três versões do mesmo site, cada uma com uma biblioteca de gráficos diferente:

| Versão | Porta | Biblioteca |
|---|---|---|
| ECharts | http://localhost:8001/ | Apache ECharts 5.6.0 |
| Plotly.js | http://localhost:8002/ | plotly.js-basic 2.35.2 |
| Chart.js | http://localhost:8003/ | Chart.js 4.4.1 + chartjs-plugin-zoom 2.0.1 |

```bash
./scripts/serve.sh   # sobe as 3 portas; Ctrl+C para todas
node --test          # testes do núcleo (tests/*.test.mjs)
# E2E nas 3 versões (clique na linha, área vazia, arraste, scroll infinito):
google-chrome --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/mw-e2e about:blank &
node tests/e2e.mjs   # W=390 node tests/e2e.mjs para largura de celular
```

- Página única com âncoras `#home`, `#track`, `#mission` (Definições da missão), `#about`.
- Clique numa linha do gráfico: a tabela abaixo mostra só os dados daquela série. Clique em área vazia ou em "Limpar filtro" para ver tudo.
- Tabela equivalente ao gráfico logo abaixo dele, com scroll infinito (50 linhas por vez) dentro da própria caixa.
- Seletor "Conjunto de dados" (`?dataset=<chave>`):
  - `curvas` — 20 tipos de curva matemática, dados fictícios, 21 pontos medidos por curva (linear, quadrática, parabólica, cúbica, quártica, polinomial, exponencial, logarítmica, hiperbólica, racional, modular, inversa, potência, radical, por partes, implícita, paramétrica, trigonométrica, senoidal, cossenoidal).
  - `barco`, `milho`, `malta`, `sarah` — correlações espúrias reais de [Tyler Vigen](https://www.tylervigen.com/spurious-correlations) (CC BY 4.0). Cada série é normalizada para 0–10 no gráfico; a tabela mostra os valores reais, uma linha por ano, como no site original.
- O gráfico é desenhado a partir dos pontos da tabela (marcadores ligados por retas). Cada ponto tem **assertividade** (0–100%), mostrada na tabela, no tooltip e no tamanho do marcador:
  - curvas: proximidade do ponto medido à curva teórica (ruído fixo por semente, 75–100%);
  - correlações espúrias: concordância das duas séries normalizadas no ano, `100·(1 − |A − B|/10)`.
- Bibliotecas ficam em `site/<versão>/vendor/`; funciona sem internet (só as fontes do Google caem para fontes do sistema).

Estrutura: tudo que não é gráfico (dados, filtro, tabela, layout, CSS) fica em `site/shared/` e vale para as 3 versões. Cada versão só tem seu `chart.js` (adaptador da biblioteca). Plano e decisões: [`docs/PLAN.md`](docs/PLAN.md).

About the Challenge
https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/

Missions to the Moon’s south pole face extreme lighting and communication constraints, and planning them takes careful coordination between science and engineering teams. Tools for determining Sun and Earth positions at candidate landing sites exist, but their complicated interfaces make it difficult to evaluate critical information with efficiency. Your challenge is to create an intuitive tool or application that lets mission planners, educators, and the public compare landing sites and dates quickly, visualizing Sun and Earth positions relative to the horizon to assess power generation potential and direct-to-Earth communication windows.
