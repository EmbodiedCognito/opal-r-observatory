# Security policy

## Supported versions

Opal is pre-release software. Security fixes are applied only to the latest version.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting feature when it becomes available for this repository.

Include the affected version, reproduction steps, potential impact, and any suggested mitigation. Please avoid accessing other users' data or running destructive tests.

## Security model

The current prototype executes approved, catalogue-generated R through webR in a browser worker. Imported datasets are not sent to an agent service. The pinned webR 0.6.0 npm package supplies local runtime assets at build time rather than fetching them during an analysis.

The optional local observatory service binds to `127.0.0.1`, stores published model metadata and local run prompts/responses in a user-owned file, and does not persist imported CSV rows. Online refresh sends an optional model search query to Hugging Face. A saved catalogue record does not grant execution rights: download eligibility is checked by the selected runner adapter. The current download path explicitly delegates public GGUF transfers to a loopback LM Studio server; inference uses only a model reported as installed by that server. Configure LM Studio authentication with `LM_STUDIO_API_TOKEN` if enabled.

Execution features must assume that generated R, uploaded datasets, packages, result payloads, and model responses are untrusted. Opal does not currently expose a free-form R evaluator. Controls must include isolation, strict resource limits, output sanitisation, dependency locking, explicit data-flow disclosure, and per-action approval.

API credentials must never be stored in browser bundles or committed to the repository.

## Project files

`.opal` files can contain raw dataset rows and deliberately attached model prompts/responses. They are unencrypted local downloads with an explicit UI warning; Opal does not upload them. Imported strings are displayed as text, never HTML or executable R. Imports have a 20 MB byte limit and a cumulative one-million-cell allocation limit and strict shape, reference, count and identity validation. Restoring a setup regenerates supported catalogue code and requires fresh approval rather than trusting the saved code. User confirmation precedes replacement of current work. Recorded output and provenance in an imported file are unverified claims, not cryptographically authenticated evidence.

A bounded (2 MB) local recovery copy of the project is stored in this tab's session storage, including data rows and explicitly attached conversations. This is accessible to this origin's scripts, like the running app's memory, and is not encrypted. It is not uploaded. Tab closure normally removes it, though browser session restoration may retain it. Invalid recovery is left untouched; quota or size failures retain the previous copy and display a save-required warning. Recovery does not restore execution approvals or pending runs.
