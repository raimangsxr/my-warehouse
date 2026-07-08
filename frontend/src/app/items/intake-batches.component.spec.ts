import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { IntakeBatchesComponent } from './intake-batches.component';

describe('IntakeBatchesComponent', () => {
  it('should create', async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    const fixture = await createStandaloneComponent(IntakeBatchesComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
