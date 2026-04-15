---
name: create-pr
description: Build, test, run local code review, create PR to develop, and trigger GitHub review. Use when code is done and ready for PR.
argument-hint: "[optional: PR title override]"
---

# Create PR Skill

Automate the "code is done" workflow: build, test, local review, push, create PR, trigger GitHub review. Run after implementation is complete.

## Workflow

### Step 1: Build

```bash
pnpm run build
```

If the build fails: diagnose, fix the issue, commit the fix, re-run. If it fails again after one fix attempt, stop and report to the user.

### Step 2: Test

Check if tests exist and run them:

```bash
pnpm run test 2>/dev/null || echo "No test script"
```

Same failure policy: fix once, retry. If still failing, stop and report.

### Step 3: Local code review

Invoke the `superpowers:requesting-code-review` skill to review changes relative to the `develop` branch.

If the review surfaces issues:
1. Fix the issues
2. Commit the fixes
3. Re-invoke the review
4. Repeat up to **3 iterations** total

If after 3 iterations issues remain, present the outstanding items and ask the user whether to proceed anyway.

### Step 4: Check for existing PR

```bash
gh pr list --head "$(git branch --show-current)" --json number,url --jq '.[0]'
```

If a PR already exists: report its URL, push new commits (run the push command from Step 5), skip PR creation, and **always run Step 6** (request GitHub review).

### Step 5: Push and create PR

Push the branch:

```bash
git push -u origin "$(git branch --show-current)"
```

Determine the conventional commit prefix from the changes:
- Bug fix → `fix:`
- New feature → `feat:`
- Refactor → `refactor:`
- Default → `feat:`

Create the PR:

```bash
gh pr create \
  --base develop \
  --title "<prefix>: <summary under 72 chars>" \
  --body "$(cat <<'EOF'
## Summary
- <bullet 1: what changed>
- <bullet 2: why>

## Test plan
- [ ] Builds pass
- [ ] Tests pass
- [ ] <specific test guidance>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If `$ARGUMENTS` is provided and non-empty, use it as the PR title instead of generating one.

Store the PR number from the output.

### Step 6: Request GitHub review (MANDATORY)

**This step must ALWAYS run — whether creating a new PR or pushing to an existing one.**

```bash
gh pr comment <PR_NUMBER> --body "@claude please review"
```

Do NOT skip this step. Do NOT end without running this command.

### Step 7: Report to user

Print:
- PR URL
- Confirmation that `@claude please review` was posted

## Instructions

- Always target `develop` branch for PRs (never `main`)
- PR titles must be under 72 characters
- If tests or build fail and you can't fix them, do NOT create the PR — report to user
- The local code review is mandatory — treat its feedback seriously, fix real issues
- The `@claude please review` comment is mandatory — never skip it
- Use `pnpm` (never `npm`)
