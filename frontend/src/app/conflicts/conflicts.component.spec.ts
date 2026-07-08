import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { ConflictsComponent } from './conflicts.component';

describe('ConflictsComponent', () => {
  it('should create', async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    const fixture = await createStandaloneComponent(ConflictsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
