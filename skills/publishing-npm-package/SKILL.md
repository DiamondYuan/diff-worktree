---
name: publishing-npm-package
description: Use when releasing this repository or another npm package, especially when the task involves reviewing changes, choosing a version bump, updating package.json, creating a release commit, and running npm publish from a clean git worktree.
---

# Publishing NPM Package

## Overview

Release from the repository state that actually exists, not from assumptions.

Core principle: inspect the current diff first, choose the version bump deliberately, and publish only from a clean tree with an explicit release commit.

## When to Use

Use this skill when the user asks to:

- publish to npm
- bump the package version
- prepare a release commit
- check changes before a release
- update `package.json` and run `npm publish`

Do not use this skill for prerelease planning, changelog drafting, or multi-package monorepo release orchestration unless the task is still centered on one publishable npm package.

## Quick Reference

| Step | Command or file | What to confirm |
| --- | --- | --- |
| Review changes | `git status --short`, `git diff`, `git log --oneline -5` | What changed and whether the tree is clean |
| Confirm version | `package.json` | Current version and required semver bump |
| Update version | `package.json` | `version` matches the intended release |
| Commit | `git add package.json ...`, `git commit -m "chore(release): vX.Y.Z"` | Release commit exists |
| Publish | `npm publish` | Run only after the tree is clean |

## Workflow

1. Inspect the repository state.
   Run `git status --short` first.
   If there are unrelated or unfinished changes, stop and resolve that before publishing.

2. Review what is actually being released.
   Use `git diff` and recent commits to understand whether the change is patch, minor, or major.
   Do not guess the version bump from memory.

3. Confirm the current package version.
   Read `package.json` and identify the existing `version`.

4. Choose the next version explicitly.
   Use semver:
   - patch: fixes, no public API expansion
   - minor: backward-compatible features
   - major: breaking changes

5. Update `package.json`.
   Change only the version and any release metadata that must ship with this release.

6. Verify the release diff.
   Re-check `git diff` so the release commit contains exactly the intended changes.

7. Commit the release.
   Create a dedicated commit such as `chore(release): v0.2.1`.
   Do not combine the version bump with unrelated edits.

8. Publish.
   Run `npm publish` only after:
   - `package.json` has the new version
   - the release commit exists
   - the working tree is clean

## Version Decision Guide

| Change type | Bump |
| --- | --- |
| Bug fix, internal improvement, no API change | patch |
| New backward-compatible CLI option, route, or capability | minor |
| Renamed commands, removed behavior, incompatible output or API | major |

If the correct bump is ambiguous, summarize the relevant changes and ask the user to confirm before editing `package.json`.

## Common Mistakes

- Publishing with a dirty worktree. This makes the release unreproducible.
- Updating `package.json` before reviewing the actual diff. Version selection should follow the change, not precede it.
- Folding unrelated files into the release commit.
- Running `npm publish` before confirming the new version is committed.
- Reusing the old version number and getting an npm duplicate-version failure.

## Minimal Example

```bash
git status --short
git diff
git log --oneline -5
sed -n '1,80p' package.json
git add package.json
git commit -m "chore(release): v0.2.1"
npm publish
```

Adapt the version number and staged files to the actual release.
