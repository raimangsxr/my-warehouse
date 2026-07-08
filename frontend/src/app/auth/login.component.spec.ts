import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  it('should create', async () => {
    const fixture = await createStandaloneComponent(LoginComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
