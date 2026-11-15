## Data Sources

MoonWatch combines public NASA datasets with synthetic placeholder data. The viability score is a **mock formula** built to show how the dashboard works. It is meant to be replaced by NASA's own model and non-public mission data.

### NASA datasets

| Dataset | Provider | Used for | Tables |
|---|---|---|---|
| [LOLA Polar Illumination & Earth Visibility maps](https://pgda.gsfc.nasa.gov/products/69) | NASA GSFC, Lunar Reconnaissance Orbiter (LRO), LOLA instrument | Average sunlight and Earth visibility per landing site | `_lola_site_averages` |
| [LOLA topography (south pole DEMs)](https://pgda.gsfc.nasa.gov/products/81) | NASA GSFC, LRO / LOLA | Elevation, slope, horizon angles, distance to permanently shadowed regions (PSRs) | `dTerrain` |
| [Diviner Lunar Radiometer derived products](https://pds-geosciences.wustl.edu/missions/lro/diviner.htm) | NASA PDS Geosciences Node, LRO / Diviner | Rock abundance, maximum temperature in nearby PSRs | `dTerrain` |
| [DONKI – Space Weather Database Of Notifications, Knowledge, Information](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | NASA GSFC, Community Coordinated Modeling Center (CCMC) | Solar flares, coronal mass ejections (CMEs), solar energetic particle (SEP) events by date | `fEvents` |
| [TSIS-1 TIM Total Solar Irradiance, daily](https://www.earthdata.nasa.gov/data/catalog/ges-disc-tsis-tsi-l3-24hr-05) | NASA / LASP, via GES DISC and [LISIRD](https://lasp.colorado.edu/lisird/) | Daily total solar irradiance | `fSolarActivity` |
| [JPL Horizons ephemeris system](https://ssd.jpl.nasa.gov/horizons/) | NASA JPL, Solar System Dynamics | Daily Earth–Moon distance and Earth visibility per site | `fLandingSites_distance`, `fLandingSites_solarPosition` |
| [Artemis III candidate landing regions (Oct 2024 update)](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/) | NASA | Names and locations of the south-pole regions the sites are grouped into | `dTerrain` (REGION), `dLandingSites` |

### Other public data

| Data | Source | Tables |
|---|---|---|
| Launch site coordinates | Real coordinates of existing launch sites (e.g. Kennedy Space Center, Baikonur, Kourou). Site names are fictional. | `dLaunchSites` |

### Synthetic / placeholder data

These tables were generated for the prototype. They keep the schema a real deployment would need, but the values are **not real**.

| Table | Content |
|---|---|
| `dMission` | Fictional missions and objectives |
| `dEquipment` | Fictional equipment, costs and condition |
| `dMission_equipment` | Mission ↔ equipment links |
| `dLandingSites` | Site names (fictional) and coordinates generated around each candidate region |
| `dResourceLogistic` | Resource estimates per site |
| `fLaunchSites_forecast` | Daily weather at launch sites  |
| `fLandingSites_viability` | Output of the mock viability formula |

### Citations

- Mazarico, E., Neumann, G.A., Smith, D.E., Zuber, M.T., Torrence, M.H. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus*, 211, 1066–1081.
- Barker, M.K., et al. (2021). Improved LOLA elevation maps for south pole landing sites: Error estimates and their impact on illumination conditions. *Planetary and Space Science*, 203, 105119. https://doi.org/10.1016/j.pss.2020.105119
- Bandfield, J.L., et al. (2011). Lunar surface rock abundance and regolith fines temperatures derived from LRO Diviner Radiometer data. *J. Geophys. Res.*, 116, E00H02. https://doi.org/10.1029/2011JE003866
- Paige, D.A., et al. (2010). Diviner Lunar Radiometer observations of cold traps in the Moon's south polar region. *Science*, 330, 479–482.
- Space weather data courtesy of the Community Coordinated Modeling Center (CCMC) at NASA Goddard Space Flight Center, via DONKI.

### Disclaimer

MoonWatch is a prototype built for the NASA Space Apps Challenge. It is not affiliated with or endorsed by NASA. Viability scores come from a placeholder model and partly synthetic data, and must not be used for real mission planning.
