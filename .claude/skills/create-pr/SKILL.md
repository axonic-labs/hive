---
name: create-pr
description: Build, test, run local code review, create PR to main, and trigger GitHub review. Use when code is done and ready for PR.
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

### Step 3: Self-review

Review your own diff against `main`:

```bash
git diff origin/main...HEAD
```

Check for:
- Leftover debug code, console.logs, TODOs
- Unused imports or variables
- Security issues (hardcoded secrets, injection vectors)
- Anything that doesn't match the existing code style

If issues are found: fix them and commit the fixes. Repeat up to **3 iterations**. If issues remain, present them to the user and ask whether to proceed.

### Step 4: Check for existing PR

```bash
gh pr list --head "$(git branch --show-current)" --json number,url --jq '.[0]'
```

If a PR already exists: report its URL, skip PR creation, but still push new commits and trigger review (Step 6).

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
  --base main \
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

### Step 6: Request GitHub review

```bash
gh pr comment <PR_NUMBER> --body "@claude please review"
```

### Step 7: Report to user

Print:
- PR URL
- Reminder that @claude review has been requested

## Instructions

- Always target `main` branch for PRs
- PR titles must be under 72 characters
- If tests or build fail and you can't fix them, do NOT create the PR — report to user
- Take self-review seriously — fix real issues before creating the PR
- Use `pnpm` (never `npm`)
