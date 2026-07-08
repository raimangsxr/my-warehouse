import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  it('should create', async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    const fixture = await createStandaloneComponent(HomeComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
