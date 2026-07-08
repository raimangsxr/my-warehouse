import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { WarehousesComponent } from './warehouses.component';

describe('WarehousesComponent', () => {
  it('should create', async () => {
    const fixture = await createStandaloneComponent(WarehousesComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
