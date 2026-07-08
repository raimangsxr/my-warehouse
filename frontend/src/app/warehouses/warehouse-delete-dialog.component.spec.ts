import { ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { WarehouseDeleteDialogComponent } from './warehouse-delete-dialog.component';

describe('WarehouseDeleteDialogComponent', () => {
  const dialogRef = { close: vi.fn() };

  async function createDialog(): Promise<ComponentFixture<WarehouseDeleteDialogComponent>> {
    return createStandaloneComponent(WarehouseDeleteDialogComponent, [
      { provide: MAT_DIALOG_DATA, useValue: { warehouseName: 'Main Warehouse' } },
      { provide: MatDialogRef, useValue: dialogRef }
    ]);
  }

  it('should create', async () => {
    const fixture = await createDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('enables confirm only when name matches exactly', async () => {
    const fixture = await createDialog();
    const component = fixture.componentInstance;

    expect(component.canConfirm).toBe(false);

    component.form.controls.confirmName.setValue('Main Warehouse');
    expect(component.canConfirm).toBe(true);

    component.form.controls.confirmName.setValue('main warehouse');
    expect(component.canConfirm).toBe(false);
  });

  it('closes dialog with confirmation flag', async () => {
    const fixture = await createDialog();
    fixture.componentInstance.close(true);
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
