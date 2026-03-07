import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';

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

  action(message: string, actionLabel: string, tone: NotificationTone = 'info', duration = 9000): MatSnackBarRef<TextOnlySnackBar> {
    const config = this.buildConfig(tone, duration);
    return this.snackBar.open(message, actionLabel, config);
  }

  private open(message: string, tone: NotificationTone, duration: number): void {
    const config = this.buildConfig(tone, duration);
    this.snackBar.open(message, 'Cerrar', config);
  }

  private buildConfig(tone: NotificationTone, duration: number): MatSnackBarConfig {
    return {
      duration,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: ['app-snackbar', `app-snackbar-${tone}`]
    };
  }
}
