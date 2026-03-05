import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

type NotificationTone = 'success' | 'error' | 'info';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private readonly snackBar: MatSnackBar) {}

  success(message: string): void {
    this.open(message, 'success', 3200);
  }

  error(message: string): void {
    this.open(message, 'error', 5200);
  }

  info(message: string): void {
    this.open(message, 'info', 3800);
  }

  private open(message: string, tone: NotificationTone, duration: number): void {
    const config: MatSnackBarConfig = {
      duration,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: ['app-snackbar', `app-snackbar-${tone}`]
    };

    this.snackBar.open(message, 'Cerrar', config);
  }
}
