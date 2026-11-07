# Opal R Observatory

**Map the question. Keep the machinery visible.**

Opal is an open local workbench for inspecting statistical analyses in R and exploring published AI models. It combines visual R controls with visible generated code and a saved model catalogue that can be searched offline.

> [!IMPORTANT]
> Opal is an early research prototype, not validated statistical or clinical software. It can run five supported base-R analyses in the browser with locally installed webR assets; this is not a general R console. Never treat generated recommendations as a substitute for statistical expertise.

## Why Opal

Most analytics tools force a choice between convenience and transparency. Visual interfaces can hide the model specification; code-first tools can exclude learners; AI assistants can perform consequential actions without making their reasoning or state clear.

Opal is built around three commitments:

1. **The analysis remains visible.** Every visual choice maps to inspectable code and assumptions.
2. **The researcher remains responsible.** Aster proposes; the user reviews, edits, and approves.
3. **The data boundary remains explicit.** The browser prototype analyses schemas locally. Future runtimes must declare when data crosses a process or network boundary.

## Current capabilities

- Import CSV data entirely in the browser
- Infer initial measurement types and flag them for verification
- Recommend compatible descriptive and inferential methods
- Generate reproducible R plans for descriptive analysis, correlation, t-tests, ANOVA, and linear regression
- Require explicit approval before running an analysis
- Execute approved base-R analyses locally in the browser through webR
- Display captured R output alongside the exact code and runtime version
- Build reproducible synthetic datasets from a custom variable schema
- Use optional study presets as editable starting points
- Override inferred measurement types and map variables through direct controls
- Inspect data, proposals, results, and R code in dedicated workspaces
- Run a deterministic example project without external services
- Refresh a bounded snapshot of published model metadata from Hugging Face, across advertised formats
- Search saved models and saved LM Studio runs without a network connection
- Deliberately request a model download and run installed language models through the local LM Studio API

## Architecture

```text
Browser workbench
├── Dataset adapter (CSV now; Arrow/Parquet planned)
├── Schema inference
├── Method catalogue and deterministic recommendation rules
├── Aster proposal boundary
├── Session-only approval and result history
├── Model discovery and local run interface
└── Runtime adapter interface
    ├── Browser R / webR (bundled from the pinned npm package)
    └── Isolated server R sessions (planned)

Loopback Node service
├── Source-neutral saved model catalogue and run history
├── Source adapters (Hugging Face is the first implementation)
└── Runner adapters (LM Studio chat and GGUF download are the first implementation)
```

The deterministic recommendation layer is intentionally separate from any language model. A future Aster service may explain intent and construct proposals, but only validated commands can cross the approval boundary.

Read [ARCHITECTURE.md](docs/ARCHITECTURE.md), [ROADMAP.md](docs/ROADMAP.md), and [SECURITY.md](SECURITY.md) before contributing to runtime or agent features.

## Development

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

For the model observatory during development, run `npm run server` in a second terminal. The Vite development server proxies `/api` to the local service.

## Run the local workbench

Install dependencies while online, then run:

```bash
npm ci
npm run local
```

Open `http://127.0.0.1:4317`. The built interface, fonts, base-R analyses, saved catalogue, and installed-model runs work locally without internet access. `npm run local` rebuilds the interface from installed dependencies, including a copy of webR's runtime assets. The service listens only on loopback and stores catalogue entries and model prompts/responses in `~/.opal-r-observatory/workbench.json` (or `OPAL_DATA_DIR/workbench.json`). Imported CSV rows stay in the browser session and are not written to this file.

In **Models**, click **Refresh online** to save up to 100 recently modified Hugging Face model records, optionally narrowed by a publisher query. GGUF is not a catalogue filter: other formats and tasks remain searchable even when LM Studio cannot use them. Each refresh adds or updates entries; offline search covers only records you have saved. Refresh requires internet access. This is one bounded source snapshot, not a comprehensive index or synchronisation mechanism. Advertised format labels come from publisher tags and are not independently verified.

To download or run a model, start LM Studio 0.4 or newer's local API server on `127.0.0.1:1234`. Select a saved public GGUF entry and explicitly request its download, then select an installed language model for a run. A new download requires internet access; running an installed model and searching saved runs can be done offline. If LM Studio requires an API token, set `LM_STUDIO_API_TOKEN` in the local service's environment. The service never sends prompts to Hugging Face.

Source adapters supply records with a source-scoped ID, optional descriptive fields, and advertised formats. Runner adapters decide which records they can download and which installed models they can execute. A record can therefore exist and be searchable without a compatible runner. The current UI has one LM Studio chat surface; adding a different computation or experiment type calls for its own execution and result interface, not narrowing the catalogue to fit this surface. The existing version 1 catalogue and run history load into the version 2 format without dropping entries.

Quality checks:

```bash
npm run check
```

## Project status

Version `0.2.0-dev` is a local analysis foundation. It does not yet provide:

- Aster agent integration or automatic interpretation of statistical results
- persistent R projects (the model catalogue and local model runs are saved)
- a comprehensive publisher index, general model-weight manager, or runner for non-GGUF and non-language workflows
- a common portable experiment record linking model runs, R analyses, datasets, and provenance
- publication-ready statistical reporting or independent validation
- plugin installation

Those omissions are deliberate and visible in the UI.

## Local R runtime

Opal installs [webR 0.6.0](https://github.com/r-wasm/webr/releases/tag/v0.6.0) as a pinned npm dependency. The build copies its JavaScript workers and WebAssembly assets into the locally served interface; R starts only after a user approves an analysis. Imported rows are materialised in that browser worker and are not sent to the local model catalogue service.

The webR runtime and R are separately licensed GPL software. Opal does not commit their binaries to this repository; the installed package supplies them at build time. See the [webR project](https://github.com/r-wasm/webr) for source and licence details.

Installing dependencies initially requires a connection and downloads a substantial R runtime. Once installed and built locally, base-R analyses do not fetch runtime assets from a CDN.

## Dual interface

Opal's visual controls are the source of truth. Aster may explain or populate those controls, but every analysis must remain fully configurable without an agent. Agent proposals and direct manipulation produce the same inspectable R plan.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Proposals involving agent execution, user data, R package installation, or remote services require a threat model.

## License

Apache-2.0. See [LICENSE](LICENSE).
