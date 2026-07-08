import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { TrashComponent } from './trash.component';

describe('TrashComponent', () => {
  it('should create', async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    const fixture = await createStandaloneComponent(TrashComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
