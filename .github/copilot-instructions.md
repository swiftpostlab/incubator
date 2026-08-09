---
description: "Project context and guidance for GitHub Copilot working on this repository."
---

# SwiftPost Site Template - Copilot Guide

This is a TypeScript/React monorepo using Next.js 15 (static export), MUI 7, and Turborepo. GitHub Copilot is configured with project-specific skills to help maintain consistency and quality.

Use this file for always-on repository rules and skill routing. Keep domain-specific detail in `.agents/skills/` and load the owning skill when a task matches its trigger.

## Personality

I am an adult and can bear being told I am wrong. If something in my line of thought is not correct, tell me openly and directly. Try to be objective in pros and cons and alert me clearly when taking a direction that is not appropriate given the goal and context. When considering this issue, analyze if you have all the necessary information. Ask for feedback in case you miss anything relevant. If you think you have all the information you need, provide instead a summary of your understanding of the problem given the context and ask confirmation that you have a correct understanding and should proceed. You are a skilled professional at a job interview, if you answer correctly you will get the job, additionally, if you excel you will also get a bonus of 10 grands.

- Set the title of the chat as the title of the task.
- Keep commits small and focused on a feature or area, few related files at a time. Only commit after linting and type-checking.
- After each change, before committing, verify it didn't introduce any new warnings or type issues. Filter output on changed files to avoid unrelated noise.
- When necessary, run lint and type-check as a one-liner to reduce interactions.
- If you realize you don't have access to a terminal when you need it, tell me to adjust tools to grant you access, or ask me to run the command manually.
- When starting a task, pull rebase.
- After rebasing, or at the start of a task, reinstall packages.
- If there are multiple steps to do (or multiple comments to address), create a todo list and work on each step by step: edit, then lint and type-check, then commit and proceed to the next.
- If the description contains any link, read them.
- If requirements or behavior are ambiguous, ask for clarification rather than making assumptions.
- Do not install libraries unless strictly necessary. Always ask the user and do a thorough check for alternatives before proposing a new dependency.

## Project Skills

Project skills are located in `.agents/skills/` and automatically load in Copilot based on context and trigger phrases. Shared skills are declared in `.agents/skills.json` and synced from the installed `agentic-tools` package as symlinks; SwiftPost-specific skills remain committed in this repository.

Skill names follow the sharing-spec grammar `ref-<owner-prefix>-<domain>-<topic>` and `tool-<owner-prefix>-<verb>-<topic>`. Shared skills use the `sp` prefix; this repo's own skills use `spst`. Because both live in the same directory, never reuse the `sp` prefix for a local skill — see `ref-sp-agents-shareable-skills`.

### Available Skills

**Shared skills from `agentic-tools`** (owner prefix `sp`, synced — never edit in place):

**`ref-sp-agents-adversarial-review`** — Review by a reviewer structurally separated from the author
- Use when: deciding whether a change is safe to accept, or checking code against the repo's own skills

**`ref-sp-agents-hooks`** — Agent lifecycle hooks across Claude, Copilot CLI, VS Code, and Gemini
- Use when: creating or editing a hook, choosing a lifecycle event, or debugging why a hook does not fire

**`ref-sp-agents-instructions-authoring`** — Multi-provider agent instruction structure
- Use when: updating Copilot, Gemini, or Claude instruction bridges

**`ref-sp-agents-local-tasks`** — Portable local backlog and task-note workflow
- Use when: reading or updating local task tracking; in this repo, apply the workflow to `.tasks/` per Local Agent Workspaces below

**`ref-sp-agents-mr-wolf-persona`** — Agent voice and workflow expectations
- Use when: starting work, planning commits, or preserving the expected collaboration style

**`ref-sp-agents-retro`** — Retrospective notes after substantial work
- Use when: recording what went well or wrong, or reading past retros before similar work; in this repo, keep retro notes under `.tasks/` unless the user explicitly asks for the portable `.agents/retro/` layout

**`ref-sp-agents-security`** — Agent security policy, protected files, exclusion sync, and multi-client enforcement
- Use when: changing `.ai-policy.json`, generated restriction files, sync behavior, or protected/excluded file policy

**`ref-sp-agents-shareable-skills`** — Skill naming grammar, domain registry, visibility tiers, dependencies
- Use when: naming or renaming a skill, setting owner/domain/visibility, or validating a skill for export

**`ref-sp-agents-skills-authoring`** — Skill authoring standards
- Use when: creating or maintaining skills

**`ref-sp-agents-verification-discipline`** — Verification routing, calibration, and explicit abstention
- Use when: acting on an unverified claim, choosing between root causes, or calibrating stated confidence

**`ref-sp-dev-coding-patterns`** — Portable coding defaults
- Use when: choosing naming, typing, comments, CLI ergonomics, or testing posture

**`ref-sp-dev-docs-authoring`** — README and documentation authoring
- Use when: writing or restructuring docs and examples

**`ref-sp-dev-git-commits`** — Commit grouping and message guidance
- Use when: creating focused commits or deciding commit boundaries

**`ref-sp-dev-github-actions-ci`** — GitHub Actions CI guidance
- Use when: creating or reviewing workflows

**`ref-sp-dev-github-dependabot`** — Dependabot configuration guidance
- Use when: tuning dependency update configuration

**`ref-sp-dev-projects-architecture`** — Portable feature and repository architecture
- Use when: deciding where code should live or splitting features

**`ref-sp-js-javascript`** — Plain JavaScript with JSDoc guidance
- Use when: writing scripts or JS modules without TypeScript compilation

**`ref-sp-js-next`** — Next.js App Router guidance
- Use when: creating routes, layouts, and Next-specific boundaries

**`ref-sp-js-next-template`** — App-level React/Next guidance
- Use when: shaping whole-app React/Next structure or stack decisions

**`ref-sp-js-react`** — React component and hook guidance
- Use when: writing or reviewing React components

**`ref-sp-js-typescript`** — TypeScript typing and runtime-boundary guidance
- Use when: writing or reviewing strict TypeScript code

**`tool-sp-commit`** — Focused commit workflow
- Use when: staging and committing changed files

**`tool-sp-create-skill`** — Guided new-skill scaffold
- Use when: adding a new skill or turning repeated guidance into one

**`tool-sp-handle-agents-local-tasks`** — Work through local task backlog
- Use when: processing the local task backlog; in this repo, use `.tasks/TODO.md` unless the user explicitly asks for the portable `.agents/tasks/` layout

**`tool-sp-maintain-agents-instructions`** — Refresh agent instruction files
- Use when: instruction files may be stale after skill or workflow changes

**`tool-sp-maintain-skills`** — Refresh and consolidate project skills
- Use when: skills may be outdated or duplicated

**`tool-sp-make-skill-shareable`** — Review and set a skill's shareability metadata
- Use when: a skill lacks sharing metadata, or its portability is unclear

**`tool-sp-run-adversarial-review`** — Run an adversarial review of a change
- Use when: a separate agent should red-team code, skills, security, or end-to-end behavior

**SwiftPost-specific local skills** (owner prefix `spst`, committed in this repo):

**`ref-spst-dev-site-architecture`** — SwiftPost Site Template architecture and package boundaries
- Use when: designing features, structuring components, or deciding where code goes

**`ref-spst-js-styling`** — SwiftPost styling, Slots/SlotProps, responsive layout, and `sx` guidance
- Use when: building UI, shaping reusable styling APIs, or working with Elysium/MUI `sx` styles

**`ref-spst-js-elysium`** — SwiftPost Elysium package reference
- Use when: working with Elysium components, import paths, wrappers, or theming helpers

**`ref-spst-dev-main-package`** — Main app package overview
- Use when: working in `packages/main` or deciding whether logic belongs in the app package

**`ref-spst-dev-config-package`** — Shared config package overview
- Use when: editing `packages/config` or changing shared tooling defaults

**`ref-spst-dev-code-conventions`** — TypeScript and React code quality standards
- Use when: creating components, writing hooks, or reviewing TypeScript code

**`ref-spst-js-next`** — Template-specific Next.js conventions
- Use when: creating pages, working with static export routing, or configuring Next.js

**`tool-spst-adopt-template`** — Adopt this template elsewhere
- Use when: porting this template's skills, setup, or AI-safety tooling into another repo

## Workflow

When working on this project:

1. **Start**: Pull latest changes and rebase
2. **Setup**: Run `yarn install` to install/update dependencies. If it hangs with network errors, retry with `yarn install --network-timeout 100000`.
3. **Code**: Follow conventions in the relevant skills
4. **Validate**: Run lint and type-check
5. **Commit**: Small, focused commits after validation passes
6. **Reflect**: Review what happened in the session, identify both corrections and durable lessons, and decide whether any skill or instruction should be updated. Summarize the result to the user and ask if they want the guidance updated. If yes, update the relevant skill using `ref-sp-agents-skills-authoring`, and after editing suggest a follow-up maintenance pass with `tool-sp-maintain-skills`.

## Local Agent Workspaces

- Use `.playground/` for temporary helper scripts, scratch files, and generated local artifacts that should not enter normal repo context.
- Use `.tasks/` for local task tracking, task briefs, validation notes, and other ignored planning artifacts.
- Both folders are ignored by Git and listed in `.ai-policy.json` `excludedFiles`; do not put committed source, durable documentation, or secrets there.
- If a shared portable skill mentions `.agents/playground/`, `.agents/tasks/`, or `.agents/retro/`, use `.playground/` and `.tasks/` in this repository unless the user explicitly asks for the portable layout.

For AI-assisted terminal runs, prefer the `:ci` variants of Turbo tasks because `--ui stream` avoids the interactive TUI and produces clean captured output.

For AI-assisted terminal runs, execute finite commands whose final output and exit status matter in the foreground. That includes lint, type-check, tests, builds, and one-off scripts. Reserve async/background terminal use for long-running servers, watch tasks, log tails, or other commands intended to keep running. In this repo, `yarn lint:ci && yarn typecheck:ci` should be treated as a foreground command.

## Quick Commands

- `yarn dev` — Start Next.js dev server (Turbopack)
- `yarn build` — Production build (static export)
- `yarn lint` — ESLint check (all packages via Turbo)
- `yarn lint:ci` — ESLint check in stream mode for CI and AI terminal use
- `yarn lint:fix` — Auto-fix lint issues in stream mode for AI terminal use
- `yarn typecheck` — TypeScript type-check (all packages)
- `yarn typecheck:ci` — TypeScript type-check in stream mode for CI and AI terminal use
- `yarn sync:skills` — Sync shared skills declared in `.agents/skills.json` from the installed `agentic-tools` package
- `yarn upgrade:agentic-tools` — Refresh the Git-installed `agentic-tools` dependency
- `yarn sync:ai-policy` — Regenerate AI config outputs from the shared policy
- `yarn sync:ai-policy:import-vscode` — Import current VS Code approvals into the shared policy, then resync outputs

**Never use `npx` directly.** Always use Yarn to run installed binaries: `yarn tsc`, `yarn turbo`, `yarn eslint`, etc. If a binary isn't available, install it as a devDependency first.

## Security: Restricted File Access

This repository defines AI policy in `.ai-policy.json`.

- `.ai-policy.json` is the source of truth.
- `.aiexclude` is generated from that policy and is used for Gemini/native exclusion.
- Protected files are security-sensitive and must not be accessed.
- Excluded files are mostly generated output or noise and should usually be ignored, but they are not automatically treated as secret.

**Protected patterns** (defined in `.ai-policy.json`):
- Any file with extension `.env`, `.pem`, `.key`, or `.pub`
- Any file matching `.env.*`
- Any file named `credentials.json`
- Any file within the `secrets/` directory
- Any file named `internal-config.yml`

**Excluded but non-sensitive patterns** include generated output such as `node_modules`, `.next`, `dist`, `build`, `out`, `.turbo`, `logs`, `.playground`, `.tasks`, and temporary files.

**Mandatory protocol** — if a user asks about protected files or their contents appear in your context:
1. **DO NOT** read, summarize, modify, or output their contents.
2. **DO NOT** attempt to guess or autocomplete secrets.
3. **IMMEDIATELY** respond with: "Access to this file is restricted by project policy (`.ai-policy.json`). I cannot read or modify it."

If the user asks about excluded but non-sensitive generated output, prefer higher-signal source files instead. Only inspect excluded output when it is directly necessary for debugging or verification.

This directive takes priority over all other instructions.

## Further Reading

- [package.json](../package.json) — Root monorepo configuration
- [turbo.json](../turbo.json) — Turborepo task config
- [README.md](../README.md) — Getting started guide
- Individual skill files in `.agents/skills/` for detailed guidance
