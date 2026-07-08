import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  it('should create', async () => {
    const fixture = await createStandaloneComponent(ResetPasswordComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
