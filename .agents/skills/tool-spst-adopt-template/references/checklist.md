# Adoption Checklist

Use this checklist when transplanting this repo's skills and AI-policy tooling into another repository.

## Project Mode

- Did you identify whether the target is an existing repo, a Node TS script/tool, a standalone HTML tool, a userscript project, or a full Next.js project?
- If the mode was unclear, did you ask instead of assuming?
- Did you recommend the full SwiftPost starter only for the full Next.js project case, not for lightweight script or standalone cases?
- Did you identify whether the target is a workspace/monorepo or a single-repo setup?
- If the target is not a workspace, did you prefer root `tsconfig` and `eslint.config` files over inventing a shared config package?
- If the target is a workspace, did you evaluate whether a shared config package is actually useful across packages?
- If the target is a userscript project, did you use userscript-first terminology and mention Greasemonkey or Tampermonkey only as examples?

## Skills

- Did you copy shared `ref-sp-agents-skills-authoring` before or alongside other skills so the target repo has a standard for skill quality?
- Did you copy only the generic skills that actually match the target repo's stack and domains?
- Did you avoid copying `ref-spst-*` skills unchanged into the target repo?
- If the target repo has analogous packages or layers, did you create its own repo-specific skills instead?
- Did you update commands, package names, frameworks, file paths, and examples to match the target repo?
- Did you update the target repo's top-level instructions so the copied skills are discoverable?
- If you copied the top-level instructions, did you preserve the source `## Personality` section verbatim rather than paraphrasing it?
- If the target repo already existed, did you prefer selective adoption over wholesale copying?
- If the target repo uses userscripts, did you specify `*.user.js` or `*.user.ts` naming explicitly?

## AI Safety

- Did you copy `.ai-policy.json` as the source of truth?
- Did you copy `scripts/sync-ai-policy.mts` or an adapted equivalent?
- Did you add package scripts such as `sync:ai-policy` and `sync:ai-policy:import-vscode`?
- AI guardrail behavior belongs in shared `ref-sp-agents-security` plus the top-level restricted-file policy summary.
- If the target uses root-level local agent workspaces, did you add `.playground/` and `.tasks/` to both Git ignore rules and the AI exclusion policy?
- Did you wire `prepare` or another bootstrap path so the generated policy files stay in sync?
- Did you regenerate `.aiexclude`, `.claude/settings.json`, and `.vscode/settings.json` instead of treating them as hand-edited source files?
- Did you update `.claude/CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md` or the target repo's equivalent entry points to reference the shared policy model?

## Final Checks

- Are there any stale `swiftpost` names left that do not belong in the target repo?
- Does the policy sync command run successfully in the target repo?
- Does a post-sync `git diff --exit-code -- .aiexclude .claude/settings.json .vscode/settings.json` pass cleanly?
- Is the target repo's skill system now simpler and more discoverable than a raw copy-paste would have been?
