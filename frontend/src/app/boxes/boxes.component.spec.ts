import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { BoxesComponent } from './boxes.component';

describe('BoxesComponent', () => {
  it('should create', async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    const fixture = await createStandaloneComponent(BoxesComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
