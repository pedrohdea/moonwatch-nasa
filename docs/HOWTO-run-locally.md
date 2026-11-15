# How to run MoonWatch locally

The whole page runs from your machine: no internet needed, except for the optional Moon3DMap tab. All libraries and NASA assets are already in the repository.

## 1. Requirements

| | Linux | macOS | Windows |
|---|---|---|---|
| **Git** | `sudo apt install git` (or your distro's package manager) | `xcode-select --install` | [Git for Windows](https://git-scm.com/download/win) (includes Git Bash) |
| **Node.js ≥ 22.13** | [nodejs.org](https://nodejs.org/) or `nvm install 22` | [nodejs.org](https://nodejs.org/) or `brew install node@22` | [nodejs.org](https://nodejs.org/) or `winget install OpenJS.NodeJS.LTS` |
| **GNU make** (optional) | usually installed (`sudo apt install make`) | comes with `xcode-select --install` | `winget install ezwinports.make` or `choco install make` |

No `npm install` is needed: the project has no dependencies.

## 2. Get the code

```bash
git clone https://github.com/pedrohdea/moonwatch-nasa.git
cd moonwatch-nasa
```

## 3. Build and start the page

With make (Linux, macOS, Windows):

```bash
make            # same as `make start`: builds the data, then serves the page
```

Then open **http://localhost:8003/**. Stop the server with `Ctrl+C`.

Without make (any OS, same result):

```bash
node scripts/build-viability.mjs
node --no-warnings scripts/build-db.mjs
node scripts/serve.mjs
```

### Other targets

| Command | What it does |
|---|---|
| `make help` | Lists the targets |
| `make build` | Rebuilds `site/shared/data/viability.js` and `data/moonwatch.sqlite` from the CSVs in `docs/` |
| `make serve` | Serves the page without rebuilding |
| `make serve PORT=8080` | Uses another port (or `node scripts/serve.mjs --port 8080`) |
| `make test` | Unit tests (`node --test`) |
| `make e2e` | Browser tests (see below) |
| `make assets` | Downloads the NASA assets again (~74 MB, only to refresh them) |
| `make clean` | Removes `data/moonwatch.sqlite` |

## 4. Browser tests (optional)

Start the server in one terminal (`make serve`), then Chrome in debug mode in another:

```bash
# Linux
google-chrome --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/mw-e2e about:blank
# macOS
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/mw-e2e about:blank
# Windows (PowerShell)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --remote-debugging-port=9333 --user-data-dir=$env:TEMP\mw-e2e about:blank
```

Then run `make e2e` (`W=390 make e2e` on Linux/macOS checks the phone width).

## Troubleshooting

- **`Node.js >= 22.13 required`**: update Node.js; the database step uses the built-in `node:sqlite`.
- **Port 8003 already in use**: `make serve PORT=8080`, then open http://localhost:8080/.
- **`make: command not found` on Windows**: install make (table above) or use the three `node` commands.
- **Blank globe or missing styles on Windows**: pull the latest version; the server no longer depends on the `site/chartjs/shared` symlink, which Windows checks out as a plain file.
