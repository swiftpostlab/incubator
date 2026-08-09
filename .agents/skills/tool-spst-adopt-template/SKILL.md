---
name: tool-spst-adopt-template
description: "Adopt the SwiftPost Site Template skill and agent-security setup into another repo. Use when: porting this template's repo-local guidance elsewhere, choosing whether this template fits a new project, or transplanting the local AI policy sync workflow."
metadata:
  shareable-skills.owner-prefix: "spst"
  shareable-skills.owner: "swiftpostlabs/swiftpost-site-template"
  shareable-skills.domain: "agents"
  shareable-skills.visibility: "repo-local"
  shareable-skills.reason: "This workflow is specifically for adopting this template's local setup elsewhere."
argument-hint: "What kind of target project is this: existing repo, Node TS script, standalone HTML, userscript, full Next.js project, or other?"
---

# Adopt SwiftPost Site Template

## Purpose

Help an agent transplant the most valuable reusable skills from this repository into another repository without copying SwiftPost-specific assumptions blindly. Use this skill to decide what to copy as-is, what to adapt, what to rename, and how to bring the AI-safety tooling across cleanly.

## When to use this skill

- Setting up a new repo with a similar AI skill system.
- Copying the best reusable guidance from this repo into another codebase.
- Bringing the AI policy sync workflow, source files, and generated outputs to another repo.
- Creating a first pass of project skills in another repo based on this one.

## First Step: Choose The Adoption Mode

If the target situation is not already explicit, ask first instead of dumping all guidance at once.

Pick one of these modes:

1. Existing repo that is already set up
2. New Node + TypeScript script/tool repo
3. New standalone HTML tool
4. New userscript project
5. New full Next.js project
6. Other or unclear

If the user has not made the target clear, ask which mode they want and whether they want:

- the full skill system,
- only the AI-safety tooling,
- or only selected reusable skills.

Treat this as a small interactive decision step. Choose the mode first, then give only the relevant transplant guidance.

## Recommended Skills By Mode

Use this matrix as the compact default recommendation after the mode is known.

| Mode | Default recommendation |
|------|------------------------|
| Existing repo already set up | shared `ref-sp-agents-skills-authoring`, shared `tool-sp-maintain-skills`, selective `ref-sp-agents-security`, then only the domain skills that match the existing stack |
| New Node + TypeScript script/tool repo | shared `ref-sp-agents-skills-authoring`, shared `tool-sp-maintain-skills`, adapted `ref-spst-dev-code-conventions`, optional `ref-sp-agents-security` |
| New standalone HTML tool | shared `ref-sp-agents-skills-authoring` only if a skill system is desired, optional `ref-sp-agents-security`, otherwise prefer lightweight project-specific guidance |
| New userscript project | shared `ref-sp-agents-skills-authoring` only if needed, optional `ref-sp-agents-security`, then create a project-specific userscript skill |
| New full Next.js project | recommend this repo as starter, then adapt `ref-spst-dev-site-architecture`, `ref-spst-js-styling`, `ref-spst-js-next`, `ref-spst-dev-code-conventions`, `ref-sp-agents-security`, and package-specific skills as needed |
| Other or unclear | ask first; do not recommend a full transplant until the project type is explicit |

## Config Structure: Workspace Or Single Repo

After identifying the mode, decide whether the target should use shared config packages or root config files.

- If the target is a real workspace or monorepo with multiple packages/apps, suggest a shared config package similar to this repo's `packages/config`.
- If the target is a single repo or lightweight project, prefer root config files instead of inventing a config package.

For a non-workspace pattern, `web-pages` is the reference shape:

- root `eslint.config.mjs`
- root `tsconfig.base.json`
- root `tsconfig.json` for Node/script code
- optional extra root tsconfig files such as `tsconfig.web.json` for browser-side code

Treat this as a common base plus focused per-surface rules:

- keep a shared TypeScript baseline in `tsconfig.base.json`
- keep a shared ESLint entrypoint in root `eslint.config.*`
- divide file-specific rules by surface: web, scripts, and userscripts

For scripts, prefer explicit module-oriented extensions:

- TypeScript scripts: `.mts` and `.ts` when appropriate
- JavaScript modules: `.mjs`
- CommonJS only when required: `.cts` or `.cjs`

CommonJS is allowed when necessary, but prefer ESM/module-based files by default.

For userscripts, prefer dedicated userscript file names and rules:

- use `*.user.js` or `*.user.ts`
- keep userscript-specific linting separate from generic browser code
- if needed, add userscript-specific ESLint support such as `eslint-plugin-userscripts`: `https://www.npmjs.com/package/eslint-plugin-userscripts`

Use the simpler root-config pattern for:

- standalone HTML repos
- userscript repos
- small Node + TypeScript script/tool repos
- single-app repos that do not need shared config reuse across packages

Use a shared config package pattern for:

- monorepos
- multi-package workspaces
- setups where multiple apps/packages must share the same lint and TS baseline

## Mode 1: Existing Repo Already Set Up

Use this mode when the target repo already has code, tooling, and conventions.

- Inspect the existing stack before recommending any copied skill.
- Prefer selective adoption over wholesale copying.
- Bring over shared `ref-sp-agents-skills-authoring` and `tool-sp-maintain-skills` first if the target wants a maintainable skill system.
- Bring over shared `ref-sp-agents-security` only if the target actually wants policy-driven multi-agent restrictions.
- Do not recommend this repo as a starter when the target repo already exists unless the user is effectively rebuilding it.

## Mode 2: New Node + TypeScript Script/Tool Repo

Use this mode for small automation repos, CLIs, script collections, or utility projects.

- Prefer copying shared `ref-sp-agents-skills-authoring`, shared `tool-sp-maintain-skills`, and adapted pieces of `ref-spst-dev-code-conventions`.
- Copy the AI-safety tooling only if the target wants multi-agent restrictions and generated policy outputs.
- Do not recommend the full SwiftPost Next.js template as a starter for this case.
- Remove Next.js, React, MUI, and app-shell assumptions from any copied guidance.
- Prefer root `eslint.config.*` and root `tsconfig*.json` files rather than creating a shared config package unless the target is already a workspace.
- Use the shared root config as the base, then keep script-specific rules scoped to `.mts`, `.mjs`, `.cts`, and `.cjs` files as needed.
- Prefer `.mts` or `.mjs` over CommonJS unless the environment forces `.cts` or `.cjs`.

## Mode 3: New Standalone HTML Tool

Use this mode when the user wants a self-contained browser tool or single-page utility.

- Usually copy no more than the skill-system patterns and, optionally, AI-safety tooling.
- Do not recommend the full SwiftPost Next.js template as a starter for a standalone HTML file.
- If the target repo is being created only for standalone HTML utilities, adapt or author HTML-specific skills instead of copying app-framework guidance.
- Prefer root config files if any config files are needed at all; do not introduce a config package here.

## Mode 4: New Userscript Project

Use this mode when the output is meant to run as a userscript on top of an existing website. Greasemonkey and Tampermonkey are examples of the environment, but the primary concept is a userscript project.

- Treat this like a lightweight script-oriented repo, not like a web app.
- Copy only the minimal reusable skills that help with structure and maintenance.
- Do not recommend the full SwiftPost Next.js template as a starter for this case.
- Prefer creating a project-specific userscript skill rather than copying framework-centric skills.
- Prefer root config files instead of a shared config package.
- Name userscript entry files with `*.user.js` or `*.user.ts` explicitly.
- Keep userscript rules separate from generic web or Node rules inside the shared root ESLint/tsconfig setup.
- If the repo needs richer userscript linting, consider adding `eslint-plugin-userscripts` and scoping it to userscript files.

## Mode 5: New Full Next.js Project

Use this mode when the user wants a real app project and the target needs a starter structure.

This is the case where recommending this repository as a starter is appropriate.

Recommend these starter options:

- Repository: `https://github.com/swiftpostlab/swiftpost-site-template`
- Zip download: `https://github.com/swiftpostlab/swiftpost-site-template/archive/refs/heads/main.zip`
- Git clone URL: `https://github.com/swiftpostlab/swiftpost-site-template.git`

Use this recommendation when the user wants a full Next.js project with a usable starting structure rather than a narrow transplant of individual skills.

Even in this mode, the copied guidance must still be adapted to the new repo's real stack, branding, package names, and scope.

- If the target is a monorepo or is expected to host multiple packages, keeping a shared config package like `packages/config` is appropriate.
- If the target is just one app repo, consider simplifying to root `eslint.config.*` and root `tsconfig*.json` files instead of preserving workspace overhead by default.

## Mode 6: Other Or Unclear

If the target does not fit the modes above, or if the request is ambiguous:

- ask what kind of project it is,
- ask whether the project already exists,
- ask whether the goal is starter scaffolding, selective skill adoption, or AI-safety tooling only.

## What to Prefer Copying First

Start with the skills that are most transferable across projects:

- shared `ref-sp-agents-skills-authoring` for how skills should be structured and maintained.
- shared `tool-sp-maintain-skills` for keeping top-level instructions slim and moving detail into the right skills.
- `ref-spst-dev-code-conventions` if the target repo is also TypeScript/React or close enough to adapt it quickly.
- `ref-spst-dev-site-architecture`, `ref-spst-js-styling`, and `ref-spst-js-next` only if the target repo has the same broad problem space.
- shared `ref-sp-agents-local-tasks`, `ref-sp-agents-retro`, and `tool-sp-handle-agents-local-tasks` if the target repo wants local task tracking and retrospectives; this template uses their portable `.agents/` layout directly, so no path translation is needed.

Do **not** copy SwiftPost-specific skills unchanged into another repo. Skills such as `ref-spst-js-elysium`, `ref-spst-dev-main-package`, and `ref-spst-dev-config-package` should be treated as examples of package-specific skills, not as generic reusable guidance.

## Top-Level Instructions: Personality Export

When this skill tells an agent to export or transplant the repo's top-level instructions into another repo, the `## Personality` section from the root `AGENTS.md` should be exported verbatim, not paraphrased. That block is itself inlined from `ref-sp-agents-mr-wolf-persona`, which stays canonical — prefer re-inlining from the skill when the target repo carries it.

- Keep the personality text exactly as written unless the user explicitly asks to rewrite it.
- Treat this as intentional author voice, not incidental wording to be normalized.
- Adapt surrounding repo-specific workflow, commands, file paths, and stack references as needed, but do not silently rewrite the personality block during adoption.
- If the target repo wants a different personality, ask or state that this is a deliberate deviation from the source template rather than folding it into a generic rewrite.

## AI-Safety Tooling to Adopt

For the AI-safety system, the important source files are:

- `.ai-policy.json` as the source of truth.
- `scripts/sync-ai-policy.mts` as the sync implementation.
- `package.json` scripts that run the sync, especially `sync:ai-policy`, `sync:ai-policy:import-vscode`, and the `prepare` hook.
- the root `AGENTS.md` as the single source of truth, plus thin `.claude/CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md` bridges, if the target repo wants the same cross-agent routing pattern.
- `.agents/playground/`, `.agents/tasks/`, and `.agents/retro/` as ignored local agent workspaces, each with a committed placeholder `.gitignore` so the directory survives a clone.

Generated files should usually be regenerated in the target repo instead of copied as authoritative source:

- `.aiexclude`
- `.claude/settings.json`
- `.vscode/settings.json`

If the target repo keeps this repo's Gemini/native exclusion pattern, keep `.aiexclude` at the repo root. Do not move it into `.gemini/`; Gemini CLI's `.geminiignore` is a separate mechanism.

Copying generated outputs temporarily is acceptable to bootstrap the target repo, but the source of truth must still become `.ai-policy.json` plus the sync script.

## Procedure

1. Inventory the target repo.
   - Identify its stack, package manager, language, framework, and directory layout.
   - Identify which of this repo's skills are genuinely reusable there.
   - Identify which SwiftPost-specific skills need equivalents rather than copies.
   - Identify whether the situation is an existing repo, a lightweight script/tool, a userscript repo, or a full app starter case.
   - Identify whether the target is a workspace/monorepo or a single-repo setup.
2. Copy the reusable base skills.
   - Bring over shared `ref-sp-agents-skills-authoring` first so subsequent copied skills have a standard to conform to.
   - Bring over shared `tool-sp-maintain-skills` so the target repo can slim and reorganize copied guidance safely.
   - Copy other generic skills only when the target repo actually matches their domain.
   - If copying the top-level instructions, copy the source `## Personality` section verbatim before adapting the rest of the document.
3. Adapt the copied content to the target repo.
   - Replace package names, commands, file paths, frameworks, and examples with the target repo's real stack.
   - Do not paraphrase the copied `## Personality` section unless the user explicitly wants a different one.
   - Remove SwiftPost-specific references that do not belong.
   - If the target repo has equivalent package-specific areas, create its own package skills instead of preserving `swiftpost-` names.
   - If the target is not a workspace, collapse shared config package ideas into root config files where that keeps the setup simpler.
4. Adopt the AI-safety source files.
   - Copy `.ai-policy.json` and `scripts/sync-ai-policy.mts`.
   - Add the sync scripts to the target repo's `package.json`.
   - Wire the target repo's Copilot, Claude, and Gemini entry-point docs to honor the shared policy model.
   - For this repo's pattern specifically, keep the real guidance in the root `AGENTS.md`, keep `GEMINI.md` at repo root, and keep Claude's entry file at `.claude/CLAUDE.md`; each bridge is a single `@` import resolving to the root `AGENTS.md`. Use `tool-sp-setup-agent-repo` to audit the result.
   - Regenerate outputs in the target repo instead of preserving stale generated files from this repo.
5. Regenerate the target repo outputs.
   - Run `yarn sync:ai-policy` or the equivalent adapted package-manager command.
   - Ensure `.aiexclude`, `.claude/settings.json`, and `.vscode/settings.json` are generated from policy, not hand-maintained.
6. Validate the transplant.
   - Confirm the copied skills are discoverable from the target repo's top-level instructions.
   - Confirm no stale SwiftPost names remain unless they are intentionally retained as examples.
   - Confirm the AI-policy sync produces deterministic outputs.

## Decision Rules

- If a skill is obviously reusable across many repos, keep its generic name.
- If a skill depends on repo-only packages or wrappers, create a repo-specific replacement skill in the target repo.
- If the target repo does not use TypeScript, React, Next.js, or the same folder conventions, adapt aggressively instead of preserving wording.
- If the target repo wants the AI-safety tooling but not the full skill system, copy only the policy source files, sync script, and cross-agent routing docs.
- If the user wants a full Next.js starter, recommend this repo directly. If they want a script, standalone HTML tool, userscript, or an already-existing repo retrofit, prefer selective adoption instead.
- If the target is a workspace, a shared config package can make sense. If it is not a workspace, prefer root `tsconfig` and `eslint.config` files like the `web-pages` repo pattern.
- Call them userscripts. Mention Greasemonkey or Tampermonkey only as examples of userscript environments, not as the primary project type.
- If the top-level instructions are copied, preserve the source `## Personality` section verbatim unless the user explicitly requests a different personality.
- If ownership is unclear, prefer copying less and asking what the target repo actually wants to standardize.

## Validation Commands

Adapt these to the target repo's package manager if it does not use Yarn:

```sh
yarn sync:ai-policy
git diff --exit-code -- .aiexclude .claude/settings.json .vscode/settings.json
```

## Reference

Use the [adoption checklist](./references/checklist.md) to verify the transplant is complete and not preserving SwiftPost-specific details by accident.
