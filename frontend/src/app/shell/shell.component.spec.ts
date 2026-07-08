import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  it('should create', async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    const fixture = await createStandaloneComponent(ShellComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
