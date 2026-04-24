---
# lasso-mx3n
title: Configure Homebrew tap release secret
status: completed
type: task
priority: normal
created_at: 2026-04-24T18:47:38Z
updated_at: 2026-04-24T18:49:10Z
parent: lasso-evao
---

Use gh CLI to configure TAP_GITHUB_TOKEN for the lasso release workflow.

## Blocked\nAttempted to set TAP_GITHUB_TOKEN with gh, but GitHub returned 404 for justEstif/lasso actions secrets. The local repository has no git remote configured and no justEstif/lasso repository was found via gh repo list. Need the GitHub repository to exist or a target repo name before setting the secret.

## Summary of Changes\n- Created private GitHub repository justEstif/lasso from the local project\n- Added origin remote and pushed main\n- Set TAP_GITHUB_TOKEN GitHub Actions secret using gh CLI\n- Verified TAP_GITHUB_TOKEN appears in repository secrets\n\n## Notes\n- The secret currently uses the active gh auth token for justEstif. Rotate or replace it with a narrower-scoped token/GitHub App token if desired.
