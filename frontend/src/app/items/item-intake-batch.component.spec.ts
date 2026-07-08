import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { ItemIntakeBatchComponent } from './item-intake-batch.component';

describe('ItemIntakeBatchComponent', () => {
  it('should create', async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    const fixture = await createStandaloneComponent(ItemIntakeBatchComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
