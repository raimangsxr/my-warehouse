# Change 005 — Frontend test suite

## Summary

Add comprehensive Vitest unit tests for the Angular frontend. Backend already had pytest coverage (54 tests).

## Scope

- All injectable services (HTTP + local state)
- Route guards and auth interceptor
- Route configuration smoke checks
- Component create smoke tests for every standalone component

## Validation

```bash
cd frontend && npm run test -- --configuration=ci
cd backend && uv run pytest
```
