# Roadmap

## 0.1 — Open foundation

- [x] Public product and trust model
- [x] Local CSV import and schema inference
- [x] Deterministic method recommendations
- [x] Inspectable R proposals
- [x] Explicit approval flow
- [x] Tests for domain rules
- [ ] Accessibility and cross-browser audit

## 0.2 — Reproducible local analysis

- [x] webR proof of concept for approved base-R analyses
- [x] Reproducible synthetic wellbeing generator
- [x] Custom synthetic variable schemas with optional presets
- [x] Direct variable mapping independent of the agent
- [x] Portable `.opal` v1 bundle for existing R data/results and explicitly attached model runs
- [x] Per-analysis source snapshots, mapping, code, runtime and timestamps (imported claims are not independently authenticated)
- Structured tables, plots, effect sizes, and assumption checks
- Export to HTML, PDF, Quarto, and R script
- Obsidian result embedding after the project format stabilises

## 0.2a — Local model observatory slice

- [x] Save a bounded, format-neutral snapshot from one publisher for offline catalogue search
- [x] Scope model keys by source and derive download availability from runner capabilities
- [x] Connect to locally installed LM Studio models for an explicit download and run path
- [x] Save and search local model prompts and responses
- More source adapters, pagination, incremental refresh, and richer source metadata
- Additional local execution surfaces for non-GGUF and non-language experiments
- General experiment records with typed inputs, outputs, and provenance, linked to analyses and datasets
- [x] Portable utility project with source-linked R analyses and explicit model-run attachments
- General typed experiment record and environment/state trace replay remain separate work
- [x] Offline packaged webR assets for first-time R execution after dependency installation

## 0.3 — Aster

- Provider-neutral agent protocol
- Schema-first context with opt-in row access
- Structured proposal validation
- Explanation modes for learners and experts
- Red-team suite for prompt injection and unsafe code generation

## 0.4 — Extension ecosystem

- Signed analysis packages
- Locked R environments
- Extension permissions
- Public catalogue and compatibility checks

## 1.0 — Research-ready

- Independent statistical validation
- Stable project format and migration policy
- Reproducibility fixtures across supported R versions
- Security review and published threat model
- Complete accessibility conformance report
