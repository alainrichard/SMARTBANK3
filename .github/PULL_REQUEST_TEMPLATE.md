<!-- Describe the purpose of this PR and any important details for reviewers -->

### Summary

This PR includes a set of fixes and CI improvements for SmartBank3:
- Fixes for frontend TypeScript/Next.js build
- Backend DB connection resiliency
- AI service safe-load and fallback models
- Dockerfiles and scripts for local/container builds
- Git history cleanup to remove large artifacts

### Checklist
- [ ] Tests added/updated
- [ ] CI passes
- [ ] Manual smoke tests executed

### Notes for reviewer
Please verify CI results and the AI integration. If you want me to create the PR using a token, run `scripts/create_pr.ps1` or `scripts/create_pr.sh` with `GITHUB_TOKEN` set.
