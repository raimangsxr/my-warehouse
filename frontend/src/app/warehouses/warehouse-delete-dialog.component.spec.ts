import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { WarehouseDeleteDialogComponent } from './warehouse-delete-dialog.component';

describe('WarehouseDeleteDialogComponent', () => {
  it('should create', async () => {
    const fixture = await createStandaloneComponent(WarehouseDeleteDialogComponent, [
      { provide: MAT_DIALOG_DATA, useValue: { warehouseName: 'Test Warehouse' } },
      { provide: MatDialogRef, useValue: { close: vi.fn() } }
    ]);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
