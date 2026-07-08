import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { ItemPhotoCaptureComponent } from './item-photo-capture.component';

describe('ItemPhotoCaptureComponent', () => {
  it('should create', async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    const fixture = await createStandaloneComponent(ItemPhotoCaptureComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
