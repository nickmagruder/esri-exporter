---
name: code-review
description: "Review a pull request along two separate axes: Standards (does the diff follow this repo's documented coding standards?) and Spec (does it do what the linked issue asked?). Use when reviewing a pull request or a branch against main. Repos vendor it as .github/skills/code-review/ for Copilot's PR review."
---

<!--
Adapted from mattpocock/skills, skills/engineering/code-review/SKILL.md
(commit 7739eaed7f8f3915437a8def198a6d0d7206dbc7), MIT License,
Copyright (c) 2026 Matt Pocock. Changes: runs unattended in pull request
review (fixed point is the PR base, spec is the linked issue, never asks the
user); one pass in two sections instead of parallel sub-agents; standards
sources for clankers-managed repos added. This is a vendored copy: the
canonical file is clankers skills/pr-review/SKILL.md (source, license and
adaptations in UPSTREAM.md there). Edit the canonical file and re-sync.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
-->

# Two-axis pull request review

Review the pull request's diff along two axes and report them separately:

- **Standards:** does the code follow this repo's documented standards?
- **Spec:** does the code do what the originating issue asked for?

A change can pass one and fail the other: code that follows every standard
but builds the wrong thing, or code that does exactly what the issue asked
but breaks the conventions. Reporting them apart stops one from masking the
other.

This review runs unattended. Never ask the user a question; when something is
missing, say so in the report and carry on.

## 1. The diff

Review the pull request's changes against its base branch (the merge-base
with `main`), commit by commit where that helps. Skip generated files and
`package-lock.json` churn unless the change is the point of the PR.

Outside GitHub's reviewer (for example in a local agent session), don't
switch branches: the PR branch may be checked out in another worktree. Read
the diff with `gh pr diff <number>` or
`git diff origin/main...origin/<branch>`, and files with
`git show origin/<branch>:<path>`. Say in the report which checks you did not
run (tests, lint) rather than assuming they pass.

## 2. The spec

Find the originating issue, in this order:

1. `Closes #N`, `Fixes #N` or `Resolves #N` in the PR description.
2. Issue references (`#N`) in the PR title, description or commit messages.
3. A linked issue in the PR's Development sidebar.
4. A plan file under `docs/` the PR updates for this work (for example a
   checklist item it ticks in a phase doc).

Read the issue's body, its "Done when" checklist if it has one, and any
comments that change the scope. If there is no spec, the Spec axis reports
"No linked issue: Spec not reviewed" and nothing else.

## 3. The standards

The standards sources, in priority order:

1. `CONTRIBUTING.md` or `CODING_STANDARDS.md` (coding standards, how changes
   are made)
2. `AGENTS.md` (working rules, conventions)
3. `.github/copilot-instructions.md` and any `.github/instructions/*.instructions.md`
   whose `applyTo` matches a changed file
4. `SECURITY.md` (what counts as a security issue here)
5. When the review runs locally and `~/.claude/clankers/standards/` exists,
   the files there that match the change (they lose to the repo's own files)

On top of what the repo documents, the Standards axis carries this **smell
baseline** from Fowler's _Refactoring_ (ch. 3). Two rules bind it:

- **The repo overrides.** Where a documented standard endorses something the
  baseline would flag, drop the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible
  Feature Envy"), never a hard violation. Skip anything Prettier, ESLint,
  TypeScript or markdownlint already enforce.

Each smell: what it is → how to fix it.

- **Mysterious Name:** a function, variable or type whose name doesn't reveal
  what it does or holds. → Rename it; if no honest name comes, the design is
  murky.
- **Duplicated Code:** the same logic shape in more than one hunk or file. →
  Extract the shared shape and call it from both.
- **Feature Envy:** a function that reaches into another module's data more
  than its own. → Move it next to the data it envies.
- **Data Clumps:** the same few fields or parameters keep travelling together.
  → Bundle them into one type and pass that.
- **Primitive Obsession:** a string or number standing in for a domain concept
  that deserves its own type. → Give the concept a small type.
- **Repeated Switches:** the same `switch` or `if` cascade on the same value in
  several places. → One map or one function both sites share.
- **Shotgun Surgery:** one logical change forces scattered edits across many
  files. → Gather what changes together into one module.
- **Divergent Change:** one file edited for several unrelated reasons. → Split
  it so each module changes for one reason.
- **Speculative Generality:** abstractions, parameters or hooks for needs the
  spec doesn't have. → Delete them; inline until a real need shows.
- **Message Chains:** long `a.b().c().d()` navigation the caller shouldn't
  depend on. → Hide the walk behind one function.
- **Middle Man:** a function or class that mostly just delegates. → Call the
  real target directly.
- **Refused Bequest:** an implementer that ignores or overrides most of what it
  inherits. → Use composition instead.

## 4. Review each axis on its own

Do the Standards pass first, then the Spec pass. Don't let findings from one
colour the other.

**Standards:** report, per file and hunk, (a) every place the diff breaks a
documented standard, citing the file and rule, and (b) any baseline smell,
named, with the hunk quoted. Mark documented-standard breaches as hard
violations and smells as judgement calls. Security rules from `AGENTS.md`,
`CONTRIBUTING.md` and the security instructions are always hard violations.

**Spec:** report (a) requirements the issue asked for that are missing or
partial, (b) behaviour in the diff the issue didn't ask for (scope creep),
and (c) requirements that look implemented but wrong. Quote the issue line for
each finding.

Where the review can comment on lines (GitHub's PR review), leave an inline
comment on the lines a finding points at. Elsewhere, give `file:line` in the
report instead.

List every hard violation. For judgement calls, keep the ones worth acting
on; drop a smell you'd only mention in passing.

## 5. Summary

In the review summary, give the two reports under `## Standards` and
`## Spec`. Don't merge or rerank findings across axes. End with one line:
the number of findings per axis and the worst issue within each axis (if
any). Don't pick a single winner across axes.
