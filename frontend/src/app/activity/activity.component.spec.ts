import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { ActivityComponent } from './activity.component';

describe('ActivityComponent', () => {
  it('should create', async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    const fixture = await createStandaloneComponent(ActivityComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
