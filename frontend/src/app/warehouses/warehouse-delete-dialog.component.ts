import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface WarehouseDeleteDialogData {
  warehouseName: string;
}

@Component({
  selector: 'app-warehouse-delete-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Eliminar almacén</h2>
    <mat-dialog-content>
      <p class="warning-text">
        Esta acción es <strong>permanente e irreversible</strong>. Se borrarán cajas, artículos, fotos,
        lotes, configuración e historial asociados a «{{ data.warehouseName }}».
      </p>
      <p>Escribe el nombre exacto del almacén para confirmar:</p>
      <form [formGroup]="form">
        <mat-form-field class="full-width">
          <mat-label>Nombre del almacén</mat-label>
          <input matInput formControlName="confirmName" [placeholder]="data.warehouseName" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close(false)">Cancelar</button>
      <button
        mat-flat-button
        color="warn"
        type="button"
        [disabled]="!canConfirm"
        (click)="close(true)"
      >
        Eliminar permanentemente
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .warning-text {
        margin-bottom: 1rem;
        line-height: 1.5;
      }

      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class WarehouseDeleteDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<WarehouseDeleteDialogComponent, boolean>);
  readonly data = inject<WarehouseDeleteDialogData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    confirmName: ['', [Validators.required]],
  });

  get canConfirm(): boolean {
    return this.form.controls.confirmName.value === this.data.warehouseName;
  }

  close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}
