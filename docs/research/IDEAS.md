# MoonWatch — Ideias para Lunar Landing Site Navigator

Status: pesquisa concluída (A1 desafio parcial, A2 cálculo validado, A3 UX de memória) + protótipo no browser validado.

## Validado (evidência reproduzida nesta sessão)
1. **Efeméride no browser**: astronomy-engine (114 KB min, MIT, offline). `RotationAxis(Body.Moon)` = modelo IAU/WGCCRE -> frame ≈ MOON_ME.
   Erro vs JPL Horizons (DE441, MEAN_ME), jan/2027 horário, 745 pts:
   | Sítio | Sol sep. máx | Terra sep. máx |
   |---|---|---|
   | (0,0) | 0.0033° | 0.0025° |
   | Connecting Ridge (-89.45,-137) | 0.0033° | 0.0025° |
   | Mons Mouton (-84.6, 31) | 0.0033° | 0.0025° |
   Sanidade: Terra no polo oscila -7.5…+6.2° (período ~27.2 d, dracônico); Sol a -89.45° fica 0.05…1.5°.
2. **Máscara de horizonte**: LOLA LDEM_80S_80MPP (PGDA products/90, COG GeoTIFF), leitura parcial via `/vsicurl/` (sem baixar 181 MB), raio 150 km, bins 1°. ~2.6 KB JSON por sítio.
   Terreno muda o resultado: Sol visível cai 6–12 pontos vs horizonte plano => máscara obrigatória.
3. **Métricas** (`proto/metrics.js`, teste `node --test` 2/2 verde). Browser (Chrome headless) == Node, idênticos.
   Jan/2027, 30 dias, DTE ≥ 5°:
   | Sítio | Iluminado | Maior escuro | DTE | Maior apagão | Sol+Terra |
   |---|---|---|---|---|---|
   | Connecting Ridge (aprox.) | 100% | 0 h | 16.0% | 342 h | 16.0% |
   | IM-2 Athena | 46.9% | 314 h | 40.1% | 249 h | 31.1% |
   | Mons Mouton centro IAU | 40.4% | 339 h | 40.4% | 248 h | 27.8% |
   ATENÇÃO: 30 dias de janeiro engana (Connecting Ridge 100% é efeito sazonal).
   Ano 2027 inteiro, sensibilidade do limiar DTE (elevação absoluta mínima da Terra, além do terreno):
   | Sítio | Iluminado | Maior escuro | DTE @0/2/5° | Maior apagão @0/2/5° | Sol+Terra @0/2/5° |
   |---|---|---|---|---|---|
   | Connecting Ridge (aprox.) | 91.2% | 107 h | 45.2/35.3/17.2% | 360/422/548 h | 43.5/34.0/16.6% |
   | IM-2 Athena | 43.7% | 459 h | 71.9/60.1/44.7% | 191/267/363 h | 32.6/27.7/21.2% |
   | Mons Mouton centro IAU | 31.6% | 549 h | 56.5/56.5/45.1% | 291/291/361 h | 20.9/20.9/17.3% |
   - Limiar DTE (5°) NÃO tem fonte: é parâmetro do planejador; mostrar sensibilidade, não número único.
   - Insight qualitativo (robusto a qualquer limiar): crista mais iluminada (Connecting Ridge) é a pior em comunicação; IM-2 inverte. Trade-off energia x DTE é o que a ferramenta revela.
   - CORREÇÃO: (-89.45, -137) NÃO é crista. PGDA dá 45.4% ali; nosso 91% é falso (máscara ignora terreno < 300 m e auto-sombra). Tabela acima vale como teste do pipeline, não como dado do Connecting Ridge.

5. **Máscara vs fonte independente** — PGDA products/69 (Mazarico 2011, v2016-08, média 18.6 anos, 60 m; escala valor/250 = % inferida, não documentada). Nosso: DEM 80 m, raio 150 km, mastro 0 m, fração do disco, média 2009–2028 a cada 3 h.
   | Ponto | lat | lon | PGDA Sol | nosso Sol | Δ | PGDA Terra | nossa Terra | Δ |
   |---|---|---|---|---|---|---|---|---|
   | Pico Connecting Ridge | -89.4749 | -137.443 | 88.4 | 86.4 | -2.0 | 58.1 | 53.0 | -5.1 |
   | Borda Shackleton | -89.6864 | -162.937 | 87.1 | 84.9 | -2.2 | 53.7 | 49.2 | -4.5 |
   | Borda de Gerlache | -88.8089 | 123.756 | 86.0 | 85.2 | -0.8 | 56.5 | 55.8 | -0.7 |
   | Malapert | -86.0011 | 2.055 | 81.9 | 71.3 | -10.6 | 58.7 | 59.0 | +0.3 |
   | Ponto original CR (aprox.) | -89.45 | -137.0 | 45.4 | 90.6 | +45.2 | 51.1 | 53.1 | +2.0 |
   - Picos: pipeline valida (Sol -0.8 a -2.2 p.p.; Terra -0.7 a -5 p.p.). Malapert: -10.6 p.p. sem causa investigada.
   - Gläser 2014: Connecting Ridge 92.3% a 2 m (19 anos, DEM 20 m), sem coordenada — compatível.
   - % muda de ~20% a ~88% em 60–180 m: sensível a ~100 m de posição. Avisar na UI.
   - Insight energia x DTE: rebaixado a hipótese. Nos picos validados, Terra 49–56% (nosso) / 54–59% (PGDA) vs IM-2 ~72% (máscara não validada no IM-2). Revalidar IM-2 contra PGDA antes de usar no pitch.

### Recomendação de dados (pós-validação)
- % média Sol/Terra por sítio: amostrar direto o mapa PGDA 69 (~56 MB uma vez, offline) -> 1 número por sítio no JSON. Fonte citável.
- Janelas no tempo (Gantt, polar, métricas): máscara 360 bins com DEM 20 m perto (≤ 5 km) + 80 m longe, e incluir terreno próximo (< 300 m).
- Coordenadas: usar o máximo local do PGDA dentro da região, não coordenada aproximada.
4. **Protótipo**: `proto/index.html` (polar de céu com terreno + Gantt 3 sítios + 5 métricas). Screenshot `proto/shot.png`.

## Gotchas técnicos (A2)
- `RotationAxis().ra` em HORAS: x15.
- Usar `RotationAxis`, não `Libration()` (libração ótica geocêntrica).
- Horizons `SITE_COORD` = `'Elon,lat,alt'` (ordem invertida).
- MOON_PA vs MOON_ME ~0.03° (~875 m): DEM e Horizons em ME.
- DEM 80 m subestima horizonte próximo (<1–2 km); sítio final: 20 m / 5 m (products/78).
- Sol = disco 0.53°: limiar pelo centro superestima/subestima; stretch = fração do disco visível.

## Roadmap recomendado (para levar ao repo)
1. `site/shared/vendor/astronomy.browser.min.js` + `site/shared/ephem.js` (port do `moonAzEl.js`) + `metrics.js` + teste.
2. Script offline `scripts/horizon.py` gera `site/shared/data/horizons/<sitio>.json` para os 9 Artemis III + CLPS (coordenadas: buscar fonte).
3. Gráfico atual vira elevação x tempo (Sol/Terra) com linha H = limiar DTE; linhas V = janela [pouso, fim] => métricas recalculam ao arrastar.
4. Nova seção polar de céu (Canvas, sem lib) + Gantt comparativo; globo `#pouso` vira seletor de sítios.
5. Stretch: "próxima data boa" (varre 1 ano, score Sol+Terra), calendário de calor, panorama 360°, fração do disco solar, pt-BR/EN.

## Lacuna central
Site atual = gráfico/tabela/globo com dados fictícios. Falta o núcleo do desafio:
az/el reais de Sol e Terra por sítio + máscara de horizonte do terreno.

## Ideias (fonte: A3, de memória — validar URLs/DOIs)
### Visualizações
1. Polar de céu (az x el): silhueta do horizonte + trilha do Sol + elipse de libração da Terra. Mostra por que terreno decide tudo no polo.
2. Elevação x tempo (gráfico atual): Y = elevação, Sol e Terra, sombra abaixo da máscara.
3. Gantt por sítio: faixas Sol / Terra / ambos. Melhor idioma para comparar sítios.
4. Calendário de calor dia x hora: "Sol e Terra visíveis" -> achar data de pouso.
5. Panorama 360° (tira de azimute) com silhueta, Sol e Terra — apelo público/educador.
6. Tabela de pontuação ordenável por sítio.

### Reuso das features atuais
- Linha H = elevação mínima (preset 5° DTE; ~1° painel solar).
- Linhas V: V1 = pouso, V2 = fim (+14 d), métricas só em [V1, V2], recalculo ao arrastar; estado na URL = link compartilhável.
- Tabela = efeméride horária (az/el Sol, az/el Terra, flags).
- Globo = seletor de sítios (`?sites=`) -> abre Gantt + ranking.

### 5 métricas por sítio/janela
1. Fração iluminada.
2. Maior escuridão contínua (h) — bateria/sobrevivência.
3. Fração DTE (Terra > máscara e > 5°).
4. Maior apagão de comunicação (h).
5. Sobreposição Sol+Terra (janela operacional).
Extra: "próxima data boa" = próximo V1 com score acima do limiar.

### MVP vs stretch
MVP: JSON pré-computado 1 ano/1 h por sítio; painel 5 métricas; Gantt; elevação x tempo; polar em Canvas; máscara aproximada rotulada; pt-BR/EN; paleta Okabe-Ito.
Stretch: máscara LOLA real (3–5 sítios), calendário de calor, panorama 360°, ranking de datas, export CSV/PNG, modo educador, PWA.

### Riscos
- Sem máscara LOLA real os números absolutos não servem para decisão: rotular "aproximado".

## Desafio e contexto (fonte: A1 — parcial)
- Página do desafio não lida (erro de certificado TLS). Resumo do desafio já está no README. Aba Resources: pendente — Pedro colar.
- Critérios: impact, creativity, validity, relevance, presentation (judging-awards-guide).
- Lacuna de mercado: Horizons/SPICE exatos mas sem terreno nem comparação visual; Moon Trek/QuickMap online e pesados; PGDA/LOLA (Mazarico 2011, pgda products/69) mapas estáticos. Nenhum compara sítios x datas lado a lado, offline, com horizonte. => pitch do MoonWatch.

### Sítios com coordenada confirmada
| Sítio | lat | lon | Fonte |
|---|---|---|---|
| IM-2 Athena (Mons Mouton) | -84.79 | 29.20 | Wikipedia IM-2 |
| Alvo IM-2 (LROC) | -84.78 | 29.13 | lroc.asu.edu/images/1401 |
| Chandrayaan-3 | -69.373 | 32.319 | memória — conferir |
| Chang'e-6 | -41.6 | -153.99 | memória — conferir |

Artemis III (out/2024, 9 regiões ~15x15 km): Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain. Coordenadas sem fonte ainda.
Chang'e-7 (2026): borda de Shackleton, ponto exato não divulgado.

### Física (memória — validar com A2)
- Obliquidade do eixo lunar ~1,54° => Sol máx ~1,5° + (90 - |lat|) no polo.
- Libração ±6,7° lat / ±7,7° lon => Terra oscila ~±7° no horizonte polar.
- Cristas polares: 77–88% do tempo iluminadas (PGDA 69).
