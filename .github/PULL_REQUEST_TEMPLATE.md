## Summary

Brief description of the changes.

Fixes #(issue number)

## Issue Spec

- [ ] Linked issue uses the Implementation Spec template, or this PR explains why it is not implementation work.
- [ ] Planning gate was approved before code changes.
- [ ] Deletion / migration notes were addressed, or a follow-up issue is linked.
- [ ] For agent work, no dangling npm/package.json/tsconfig/src/agent surface remains unless this PR is explicitly deleting or temporarily adapter-gating it.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist

- [ ] Package-local build/type/lint/test checks pass for touched TypeScript server/SDK/orchestrator packages
- [ ] Agent-local ADK checks pass for touched agents (`uv`, Python syntax/import checks, `agents-cli info`, eval evidence when behavior is ready)
- [ ] Root/workspace checks were run only if shared workspace files or cross-package contracts changed
- [ ] Required package-local checks are listed in the PR body
- [ ] Documentation updated (if applicable)
- [ ] CHANGELOG.md updated
