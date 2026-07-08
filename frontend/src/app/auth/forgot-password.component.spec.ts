import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  it('should create', async () => {
    const fixture = await createStandaloneComponent(ForgotPasswordComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
