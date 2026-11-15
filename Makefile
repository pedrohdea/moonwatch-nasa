# MoonWatch — local build and server. Works on Linux, macOS and Windows (GNU make + Node.js >= 22.13).
# Every recipe is a single `node` command, so it runs the same under sh, Git Bash, PowerShell or cmd.
# Usage: make            (same as `make start`: build, then serve http://localhost:8003/)
#        make help

PORT ?= 8003
NODE ?= node

.DEFAULT_GOAL := start
.PHONY: help check build data db start serve test e2e assets clean

help: ## List the targets
	@$(NODE) -e "const t=require('fs').readFileSync('Makefile','utf8').match(/^[a-z0-9-]+:.*?## .*$$/gm)||[];t.forEach(l=>{const[n,d]=l.split(/:.*?## /);console.log(n.padEnd(8),d)})"

check: ## Check the Node.js version (>= 22.13, needed by node:sqlite)
	@$(NODE) -e "const[a,b]=process.versions.node.split('.').map(Number);if(a<22||(a===22&&b<13)){console.error('Node.js >= 22.13 required, found '+process.versions.node);process.exit(1)}console.log('Node.js '+process.versions.node+' OK')"

data: check ## Rebuild site/shared/data/viability.js from the CSVs in docs/
	$(NODE) scripts/build-viability.mjs

db: check ## Rebuild the SQLite database data/moonwatch.sqlite (git-ignored)
	$(NODE) --no-warnings scripts/build-db.mjs

build: data db ## Build everything the page needs (data + database)

start: build serve ## Build, then serve the whole page locally

serve: check ## Serve the page on http://localhost:$(PORT)/ (Ctrl+C stops)
	$(NODE) scripts/serve.mjs --port $(PORT)

test: check ## Unit tests (tests/*.test.mjs)
	$(NODE) --test

e2e: check ## Browser tests: needs `make serve` and Chrome with --remote-debugging-port=9333 (see docs/HOWTO-run-locally.md)
	$(NODE) tests/e2e.mjs

assets: check ## Download the NASA assets again (~74 MB, already versioned; only to refresh them)
	$(NODE) scripts/fetch-nasa-assets.mjs

clean: ## Remove generated files that are not versioned (data/moonwatch.sqlite)
	$(NODE) -e "require('fs').rmSync('data/moonwatch.sqlite',{force:true});console.log('removed data/moonwatch.sqlite')"
