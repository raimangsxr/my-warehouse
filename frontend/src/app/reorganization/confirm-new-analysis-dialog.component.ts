import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-confirm-new-analysis-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Nuevo análisis</h2>
    <mat-dialog-content>
      <p>
        Al lanzar un nuevo análisis, la sesión actual quedará archivada y se perderán las sugerencias pendientes.
      </p>
      <p>¿Deseas continuar?</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" [mat-dialog-close]="false">Cancelar</button>
      <button mat-flat-button color="primary" type="button" [mat-dialog-close]="true">
        <mat-icon>auto_fix_high</mat-icon>
        Nuevo análisis
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmNewAnalysisDialogComponent {
  constructor(public readonly dialogRef: MatDialogRef<ConfirmNewAnalysisDialogComponent>) {}
}
