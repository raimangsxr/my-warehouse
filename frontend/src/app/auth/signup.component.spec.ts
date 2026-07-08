import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { SignupComponent } from './signup.component';

describe('SignupComponent', () => {
  it('should create', async () => {
    const fixture = await createStandaloneComponent(SignupComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
