import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  it('should create', async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    const fixture = await createStandaloneComponent(SettingsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
