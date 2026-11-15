# Sun/Earth az/el no solo lunar — pesquisa + validação

Data: 2026-11-14. Arquivos neste diretório:
- `moonAzEl.js` — protótipo `sunEarthAzEl(lat, lon, date)` (astronomy-engine 2.1.19)
- `validate.js` — compara com JPL Horizons (cache em `horizons_*.txt`), saída `errors.json`
- `horizon.py` — máscara de horizonte (360 bins) a partir do DEM LOLA COG (lê só a janela via HTTP range)
- `dem/horizon_*.json` — perfis de horizonte calculados
- `windows.js` — % de tempo com Sol / Terra acima do horizonte de terreno (jan/2027)

## Recomendação

**astronomy-engine** (npm `astronomy-engine`, cosinekitty, MIT, sem dependências).
- `astronomy.browser.min.js` = 113.7 KB (46.7 KB gzip). Funciona offline, um único `<script>`, global `Astronomy`.
- Tem `RotationAxis(Body.Moon, t)` = modelo IAU/WGCCRE (ra, dec do polo + ângulo W do meridiano, com os
  termos de libração física E1..E13). Com isso monta-se o frame fixo da Lua (≈ Mean-Earth/polar-axis, ME).
- Também tem `Libration(t)` (libração ótica geocêntrica — **não** serve pro frame fixo; usar `RotationAxis`).
- Performance: ~0.045 ms/ponto (2160 pontos em 96 ms no Node) → 1 ano horário ≈ 0.4 s.

Descartados:
- **timecraftjs** (SPICE/CSPICE em WASM): precisão máxima, mas WASM ~ MBs + kernels (de440 ~100 MB+, ou
  subset SPK ~MB, `moon_pa_de440` PCK, FK/LSK). Overkill; precisão extra irrelevante diante do erro do DEM.
- **Implementação própria** (IAU 2015 + Meeus): é exatamente o que astronomy-engine já faz, com
  efemérides VSOP87/ELP truncadas melhores que Meeus de baixa precisão. Não reinventar.

## Frame / convenções
- Frame fixo: IAU/WGCCRE Moon (aproximação do **MOON_ME**; Horizons usa `MEAN_ME (high precision)` de DE441).
  Diferença medida vs Horizons MEAN_ME: ≤0.0033° (tabela abaixo). PA vs ME difere ~0.03° (~875 m): os DEMs
  LOLA/PGDA estão em **MOON_ME** — use lat/lon ME (consistente com este código).
- Lat/lon selenocêntricas, longitude **leste positiva** (−137 = 137°W = 223°E). Esfera R = 1737.4 km.
- Azimute: graus a partir do norte local, sentido horário (leste = 90°), igual Horizons.
  No polo sul "norte" = direção que se afasta do polo.
- Elevação geométrica + aberração estelar no Sol (~20"); sem refração (sem atmosfera).

## Código (núcleo)
```js
const A = Astronomy; // ou require('astronomy-engine')
function eqjToMoonFixed(t) {           // Rz(W)·Rx(90°−dec)·Rz(90°+ra)
  const ax = A.RotationAxis(A.Body.Moon, t);
  const a = (90 + ax.ra * 15) * D2R;   // GOTCHA: ax.ra está em HORAS siderais
  const b = (90 - ax.dec) * D2R, w = ax.spin * D2R;
  return mul(rz(w), mul(rx(b), rz(a)));
}
// Terra: -GeoMoon(t)  (EQJ, AU)  ;  Sol: -HelioVector(Moon) + v_moon·(dist/c)  (aberração)
// v_fixo = M · v_EQJ ; tira o vetor do sítio (R·up) ; projeta em (east, north, up) → az/el
```
Arquivo completo: `moonAzEl.js` (~50 linhas).

## Validação vs JPL Horizons (jan/2027, horário, 745 pontos por linha)
Query: `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='Elon,lat,0'`, `QUANTITIES='4'`,
`ANG_FORMAT='DEG'`, `CSV_FORMAT='YES'`, `EXTRA_PREC='YES'` em https://ssd.jpl.nasa.gov/api/horizons.api

| Sítio | lat, lon (E+) | Corpo | max |Δel| ° | max |Δaz| ° | max separação ° | faixa el Horizons ° |
|---|---|---|---|---|---|---|
| Equador | 0, 0 | Sol | 0.0030 | 0.100* | 0.0033 | −89.1 … 89.5 |
| Equador | 0, 0 | Terra | 0.0018 | 0.023* | 0.0025 | 80.0 … 87.4 |
| Connecting Ridge (aprox.) | −89.45, −137 | Sol | 0.0021 | 0.0030 | 0.0033 | 0.05 … 1.52 |
| Connecting Ridge (aprox.) | −89.45, −137 | Terra | 0.0019 | 0.0025 | 0.0025 | −7.54 … 6.15 |
| Mons Mouton (aprox.) | −84.6, 31 | Sol | 0.0019 | 0.0031 | 0.0033 | −4.45 … 5.99 |
| Mons Mouton (aprox.) | −84.6, 31 | Terra | 0.0020 | 0.0025 | 0.0025 | −2.19 … 10.77 |

\* Erro de azimute grande só perto do zênite (az mal definido); separação angular real ≤ 0.0033°.

**Erro máximo ≤ 0.0035° (~12″)** — 1/80 do diâmetro do Sol (0.53°). Muito abaixo do erro do DEM.

Sanity checks:
- Terra no polo sul oscila ~±7° (−7.5…+6.2 em −89.45°); passagens ascendentes por 0° a cada 27.21 e 27.29 d (mês dracônico 27.21 d). OK.
- Sol a −89.45° entre 0.05° e 1.5° (jan = verão austral lunar). OK.
- (0,0): Terra entre 80° e 87.4° de elevação (libração). OK.

## Horizonte / terreno
Fonte: PGDA "A New View of the Lunar South Pole from LOLA" https://pgda.gsfc.nasa.gov/products/90
(Barker et al.) — todos **COG GeoTIFF**, polar estereográfico sul, MOON_ME, esfera 1737.4 km, float32 alturas (m).
- `LDEM_80S_80MPP_ADJ.TIF` 181 MB (80–90°S, 7600², blocos 512, overviews 2/4/8/16)
- `LDEM_80S_40MPP_ADJ.TIF` 685 MB, `LDEM_80S_20MPP_ADJ.TIF` 2.6 GB, `LDEM_83S_10MPP_ADJ.TIF` 4.8 GB
- 5 m/px por sítio (Artemis candidates): https://pgda.gsfc.nasa.gov/products/78 (`Site01..` `_final_adj_5mpp_surf.tif`)
- Não existe produto de horizonte pronto no PGDA (só hillshade). Pesquisadores (Mazarico et al. 2011) calculam
  horizonte a partir do DEM — mesma ideia abaixo.

Abordagem offline (feita): `horizon.py` lê via `/vsicurl/` (GDAL range requests) **só a janela** de ±150 km
em volta do sítio (sem baixar o arquivo inteiro), converte cada pixel para 3D (esfera + altura), calcula
az/el a partir do sítio (+2 m de mastro) e guarda o **máximo por bin de 1°** → JSON com 360 números.
Curvatura incluída implicitamente pela geometria 3D.

Resultado (80 m/px, raio 150 km):
- Connecting Ridge aprox. (−89.45, −137): altura 1957 m, horizonte −3.73 … −0.13° (média −1.91) → crista: horizonte abaixo do plano.
- Mons Mouton centro IAU (−84.6, 31): altura 5049 m, horizonte +0.43 … +8.26° (média 3.63) → ponto NÃO é o cume
  (Mons Mouton ~6 km); está na encosta. Coordenada precisa ser corrigida (IAU Gazetteer).
- **IM-2 Athena (pouso real, verificado, Wikipedia): (−84.7906, 29.1957)**: altura 5321 m, horizonte −1.64 … +4.07° (média 1.08).
- Tempo: ~2 min por sítio (download por range; estimativa ≤ ~55 MB por janela = 3750² float32 antes de compressão; arquivo inteiro 181 MB não baixado).
- Cume no DEM (overview 1.28 km/px): máx 6975 m em (−84.66, 39.2) num raio de 40 km de (−84.6, 31).

Janelas jan/2027 (horário, centro do Sol vs máscara) — `windows.js`:

| Sítio | Sol (com terreno) | Sol (horizonte plano) | Terra visível | Ambos |
|---|---|---|---|---|
| Connecting Ridge aprox. | 100.0% | 100.0% | 45.2% | 45.2% |
| Mons Mouton centro IAU (−84.6, 31) | 39.1% | 51.1% | 48.7% | 31.3% |
| IM-2 Athena (−84.7906, 29.1957) | 45.4% | 51.2% | 69.4% | 43.1% |

Terreno muda o resultado em 12 p.p. em Mons Mouton → máscara é obrigatória.

Tamanho do dado embarcado: 360 floats com 2 casas ≈ 2.6 KB JSON (~1 KB gzip) por sítio. 100 sítios ≈ 260 KB.
Uma grade de candidatos (ex. 50×50 pontos) = 2500 × 2.6 KB ≈ 6.5 MB (ou ~1.8 MB em Int16 centésimos de grau binário).

Uso no browser: `visível = el > horizon[floor(az)]` (opcional: interpolar e considerar meio disco solar 0.27°
para fração do disco iluminada).

Limitações: 80 m/px subestima horizonte próximo (<1–2 km); para sítio final usar 20 m (perto) + 80 m (longe)
ou 5 m PGDA products/78. Raio 150 km: além disso queda por curvatura d²/2R ≥ 6.5 km, só montanhas enormes contam
Coordenadas: Mons Mouton centro 84.6°S 31.0°E (Wikipedia/IAU) e IM-2 verificadas; Connecting Ridge (−89.45, −137) aproximada, mas confirmada como ponto alto de crista no DEM.

## Gotchas
1. `RotationAxis().ra` em **horas** (×15), `dec` em graus, `spin` em graus (não normalizado).
2. Usar `RotationAxis(Body.Moon)` (frame fixo), não `Libration()` (libração geocêntrica ótica, para visualização da Terra).
3. Tempo: entrada UTC (`Date`); astronomy-engine converte UT→TT internamente via ΔT (modelo Espenak/Meeus). Horizons
   também usa UTC na tabela. ΔT incerto no futuro (~1 s) → irrelevante (Lua gira 0.00015°/s).
4. Light-time: Terra 1.3 s (ignorado); Sol ~8.3 min — vetor `HelioVector(Moon)` + aberração (~20″) basta;
   Horizons "apparent" inclui também deflexão relativística (desprezível).
5. Frames: DEM PGDA e Horizons usam **MOON_ME**; dados de SPICE "MOON_PA" diferem ~0.03° (~875 m).
6. Longitude: Horizons SITE_COORD = E-lon 0..360, `lon,lat,alt`(ordem invertida!).
7. Azimute no polo: definido pelo meridiano local; próximo de −90° muda rápido com lon — use as lat/lon exatas.
8. Sol é disco 0.53°: "nascer" = borda superior; elevação do Sol ~±1.5° no polo → máscara de 0.1° importa.

Nota: erro de efeméride não depende do sítio (mesma separação máx. nos 3 sítios) → IM-2 não re-validado no Horizons.

## URLs
- astronomy-engine: https://www.npmjs.com/package/astronomy-engine — https://github.com/cosinekitty/astronomy
- WGCCRE 2015: https://astropedia.astrogeology.usgs.gov/download/Docs/WGCCRE/WGCCRE2015reprint.pdf
- Horizons API: https://ssd.jpl.nasa.gov/api/horizons.api (doc https://ssd-api.jpl.nasa.gov/doc/horizons.html)
- PGDA DEMs: https://pgda.gsfc.nasa.gov/products/90 — 5 m sítios: https://pgda.gsfc.nasa.gov/products/78
- Mons Mouton: https://en.wikipedia.org/wiki/Mons_Mouton — IAU Gazetteer https://planetarynames.wr.usgs.gov

## Validação da máscara de horizonte vs fonte independente (follow-up)
Fonte: PGDA products/69 (Mazarico et al. 2011, atualizado 2016-08): `AVGVISIB_85S_060M_201608.TIF` (32 MB) e
`_EARTH.TIF` (24 MB). São médias de 18.6 anos, 60 m/px, int16 com **escala valor/250 = %** (máx. 25000 = 100% Terra).
Os `_COG.TIF` listados na página dão 404 (HTML); usei os TIF normais baixados em `../ill/`.
Não achei tabela publicada com lat/lon + %. Os pontos de teste são os máximos locais do próprio mapa PGDA (`pgda_points.json`).
Gläser et al. 2014 (EPSC, https://elib.dlr.de/94242/) dá 92.3% a 2 m e 95.66% a 10 m no Connecting Ridge (DTM 20 m, 19 anos), sem coordenadas.

Nosso cálculo: `horizon.py` (LDEM 80 m, raio 150 km, mastro 0 m) e `compare.js`. Média 2009-07…2028-02 a cada 3 h, com fração do disco solar.

| Ponto | lat | lon | PGDA Sol % | nosso 2027 % | nosso 18.6a disco % | Δ Sol | PGDA Terra % | nosso Terra % | Δ Terra |
|---|---|---|---|---|---|---|---|---|---|
| Connecting Ridge (pico) | −89.4749 | −137.443 | 88.4 | 86.9 | 86.4 | −2.0 | 58.1 | 53.0 | −5.1 |
| Borda Shackleton | −89.6864 | −162.937 | 87.1 | 85.3 | 84.9 | −2.2 | 53.7 | 49.2 | −4.5 |
| Borda de Gerlache | −88.8089 | 123.756 | 86.0 | 85.2 | 85.2 | −0.8 | 56.5 | 55.8 | −0.7 |
| Malapert | −86.0011 | 2.055 | 81.9 | 71.7 | 71.3 | −10.6 | 58.7 | 59.0 | +0.3 |
| CR original (aprox.) | −89.45 | −137.0 | 45.4 | 90.9 | 90.6 | +45.2 | 51.1 | 53.1 | +2.0 |

Leitura:
- Nos picos de crista o erro fica entre −0.8 e −2.2 p.p. de Sol e entre −0.7 e −5 p.p. de Terra. A cadeia está ok.
- 2027 fica próximo da média de 18.6 anos (±0.5 p.p.).
- O mapa PGDA é muito "pontudo": no 3×3 em volta de cada pico o valor vai de 17–40% até 86–88%.
  Dezenas de metros mudam tudo. Em (−89.45, −137) o PGDA dá 45% e nós 91%, com 0..86% nos vizinhos.
  Nossa máscara ignora o terreno a <300 m e usa DEM de 80 m, então **não captura a encosta local nem a auto-sombra**.
- Malapert −10.6 p.p.: o pico do mapa de 60 m não coincide com o pixel do DEM de 80 m (altura e encosta diferentes).
  Outra possibilidade é horizonte distante além de 150 km. Não investigado.
- Recomendação: amostrar direto o mapa PGDA (Sol e Terra, 18.6 anos) como "verdade" de média por sítio.
  A máscara serve para as janelas no tempo, com DEM de 20 m perto do sítio (≤5 km) e de 80 m longe.
  Ao exibir %, avisar que a sensibilidade é de ~100 m.
