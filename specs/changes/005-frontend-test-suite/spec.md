# Feature Specification: Frontend test suite

**Change**: 005-frontend-test-suite  
**Contract**: ops-platform

## User Story

As a maintainer, I need automated frontend unit tests so regressions are caught in CI alongside backend pytest.

## Acceptance Criteria

1. **Given** the frontend codebase, **When** `npm run test -- --configuration=ci` runs, **Then** all Vitest specs pass.
2. **Given** a service that calls the API, **When** tests run, **Then** HTTP contracts are verified with `HttpTestingController`.
3. **Given** each standalone component, **When** tests run, **Then** at least a create smoke test exists.
4. **Given** `release-images.yml`, **When** a release is created, **Then** frontend tests run before Docker image build.

## Notes

- Angular 20 uses `@angular/build:unit-test` with Vitest + jsdom.
- Backend pytest suite (13 files, 54 tests) predates this change and remains unchanged.
