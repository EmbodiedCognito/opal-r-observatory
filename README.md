# Opal R Observatory

**Map the question. Keep the machinery visible.**

Opal is an open, agent-guided visual environment for statistical analysis in R. It combines the approachability of a visual statistics package with inspectable R code and an explicit human-approval boundary for agent actions.

> [!IMPORTANT]
> Opal is an early research prototype, not validated statistical or clinical software. The current browser release generates reproducible analysis plans but does not execute R. Never treat generated recommendations as a substitute for statistical expertise.

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
- Require explicit approval before recording an analysis plan
- Inspect data, proposals, results, and R code in dedicated workspaces
- Run a deterministic example project without external services

## Architecture

```text
Browser workbench
├── Dataset adapter (CSV now; Arrow/Parquet planned)
├── Schema inference
├── Method catalogue and deterministic recommendation rules
├── Aster proposal boundary
├── Approval ledger
└── Runtime adapter interface
    ├── Local R / WebR (planned)
    └── Isolated server R sessions (planned)
```

The deterministic recommendation layer is intentionally separate from any language model. A future Aster service may explain intent and construct proposals, but only validated commands can cross the approval boundary.

Read [ARCHITECTURE.md](docs/ARCHITECTURE.md), [ROADMAP.md](docs/ROADMAP.md), and [SECURITY.md](SECURITY.md) before contributing to runtime or agent features.

## Development

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run check
```

## Project status

Version `0.1.0` is a front-end foundation and interaction specification. It does not yet provide:

- real R execution
- language-model integration
- persistent projects
- validated statistical reporting
- plugin installation

Those omissions are deliberate and visible in the UI.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Proposals involving agent execution, user data, R package installation, or remote services require a threat model.

## License

Apache-2.0. See [LICENSE](LICENSE).
