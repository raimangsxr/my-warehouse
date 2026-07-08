import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { ScanComponent } from './scan.component';

describe('ScanComponent', () => {
  it('should create', async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    const fixture = await createStandaloneComponent(ScanComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
