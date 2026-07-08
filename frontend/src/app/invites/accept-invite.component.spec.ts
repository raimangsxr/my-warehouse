import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { AcceptInviteComponent } from './accept-invite.component';

describe('AcceptInviteComponent', () => {
  it('should create', async () => {
    const fixture = await createStandaloneComponent(AcceptInviteComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
