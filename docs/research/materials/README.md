# Research materials

Research and data used to build MoonWatch (NASA Space Apps Challenge).

| Path | Content |
|---|---|
| `DATA_SOURCES.md` | Dataset sources, citations and disclaimer |
| `moonwatch.pdf` | MoonWatch presentation |
| `lunar-mission-database-schema.pdf` | Star-schema of the lunar mission database |
| `data/v1/` | First dataset version (dimension `d*` and fact `f*` tables) |
| `data/south_pole/` | South-pole dataset (adds `dTerrain`, `fLaunchScore`, `fViability`) |

`data/south_pole/fViability.csv.gz` is gzip-compressed: the raw CSV (124 MB) exceeds GitHub's 100 MB file limit.
Decompress with `gunzip -k data/south_pole/fViability.csv.gz`.
