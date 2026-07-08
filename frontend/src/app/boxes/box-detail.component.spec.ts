import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { BoxDetailComponent } from './box-detail.component';

describe('BoxDetailComponent', () => {
  it('should create', async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    const fixture = await createStandaloneComponent(BoxDetailComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
