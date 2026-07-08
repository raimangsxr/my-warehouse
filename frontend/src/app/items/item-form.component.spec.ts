import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { ItemFormComponent } from './item-form.component';

describe('ItemFormComponent', () => {
  it('should create', async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    const fixture = await createStandaloneComponent(ItemFormComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
