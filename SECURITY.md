# Security policy

## Supported versions

Opal is pre-release software. Security fixes are applied only to the latest version.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting feature when it becomes available for this repository.

Include the affected version, reproduction steps, potential impact, and any suggested mitigation. Please avoid accessing other users' data or running destructive tests.

## Security model

The current prototype executes approved, catalogue-generated R through webR in a browser worker. Imported datasets are not sent to an agent service. The runtime is downloaded from the official webR CDN on first use and is pinned to a specific release URL.

Execution features must assume that generated R, uploaded datasets, packages, result payloads, and model responses are untrusted. Opal does not currently expose a free-form R evaluator. Controls must include isolation, strict resource limits, output sanitisation, dependency locking, explicit data-flow disclosure, and per-action approval.

API credentials must never be stored in browser bundles or committed to the repository.
