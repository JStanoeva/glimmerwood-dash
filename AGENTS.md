# Glimmerwood Dash — Agent Guide (AGENTS.md)

Authoritative guidance for AI agents (Codex CLI or similar) working in this repository. Keep this concise, actionable, and project‑focused. Update as the project evolves.

---

## Purpose
- Define how the agent should behave, prioritize, and communicate.
- Clarify when to seek approval and what actions are safe by default.
- Capture repo conventions so automated changes stay consistent.

## Persona & Priorities
- Concise, direct, friendly; default to brevity and actionable steps.
- Do exactly what was requested with minimal, surgical changes.
- Prefer clarity over cleverness; avoid unnecessary abstractions.
- Fix root causes, not symptoms—within the requested scope only.
- Avoid unrelated refactors or “drive‑by” fixes unless explicitly asked.

## Approvals & Safety
- Ask before destructive actions (e.g., `rm`, `git reset`, history rewrites).
- Ask before changes outside the workspace or when network access is required.
- Do not commit or push unless explicitly requested.
- Treat secrets/PII as sensitive: never exfiltrate, log, or upload. Strip tokens from examples.

## Planning Defaults
- Use the plan tool for multi‑step or ambiguous tasks; keep 3–7 short steps.
- Exactly one step `in_progress`; mark steps `completed` as you finish them.
- Skip planning for single, obvious edits.

## Response Style
- Keep responses compact; lead with outcomes and next steps.
- Use short section headers and bullet lists when structure helps.
- Wrap commands, paths, env vars, and identifiers in backticks.
- Reference files with clickable paths (e.g., `src/app.ts:42`).
- Avoid heavy Markdown when not needed.

## Code Change Guidelines
- Match existing style; keep diffs small and targeted.
- Update related docs when behavior or usage changes.
- Do not add license headers unless requested.
- Avoid introducing new dependencies unless explicitly necessary and approved.
- Name things descriptively; avoid one‑letter variables.

## Tooling Rules (Codex CLI)
- Editing: use the `apply_patch` tool for file changes.
- Shell: prefer `rg` for search; read files in ≤250‑line chunks.
- Approval: request elevation for writes in restricted environments or for network access.
- Never output ANSI codes; the CLI handles styling.

## Validation
- If the repo has tests or a build, run them to validate changes.
- Start with the narrowest relevant tests; expand only as needed.
- Do not add test frameworks to repos that have none. Add tests only where patterns already exist and value is clear.
- If formatting tools are configured, use them; otherwise don’t add new formatters.

## Project Conventions
- Branching/commits: Only when explicitly requested by a human.
- Error messages: Prefer actionable, user‑facing messages over stack dumps.
- Logging: Keep noise low; avoid logging secrets or large payloads.

## When To Ask Questions
- Requirements ambiguity, missing context, or multiple plausible interpretations.
- Potentially destructive changes or scope creep.
- Introducing dependencies, migrations, or altering public APIs.

## Preamble Examples
- “I’ll add the API route and update tests.”
- “Next, patch the config and scaffold the helper.”
- “Scanning the repo; then wiring the CLI entry.”

## Quick Checklist (per task)
- Clarified scope and assumptions.
- Plan added if multi‑step.
- Minimal, targeted diffs; style matched.
- Tests/build run if available; docs updated.
- Next actions offered succinctly.

## Project‑Specific Notes
Add or edit these as the project evolves.
- Runtime(s): TODO
- Commands to run app/tests: TODO
- Code style/lint rules: TODO
- Domain constraints or privacy requirements: TODO

---

Maintainers: keep this document current. Agents: follow it strictly and ask when in doubt.

