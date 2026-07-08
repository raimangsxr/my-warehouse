import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let snackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    snackBar = { open: vi.fn(() => ({ onAction: () => ({ subscribe: vi.fn() }) })) };

    TestBed.configureTestingModule({
      providers: [NotificationService, { provide: MatSnackBar, useValue: snackBar }]
    });

    service = TestBed.inject(NotificationService);
  });

  it('opens success snackbar with close action', () => {
    service.success('Guardado');

    expect(snackBar.open).toHaveBeenCalledWith(
      'Guardado',
      'Cerrar',
      expect.objectContaining({
        duration: 3200,
        panelClass: ['app-snackbar', 'app-snackbar-success']
      })
    );
  });

  it('opens error snackbar with longer duration', () => {
    service.error('Falló');

    expect(snackBar.open).toHaveBeenCalledWith(
      'Falló',
      'Cerrar',
      expect.objectContaining({
        duration: 5200,
        panelClass: ['app-snackbar', 'app-snackbar-error']
      })
    );
  });

  it('opens action snackbar with custom label', () => {
    service.action('Actualización', 'Aplicar', 'info', 10000);

    expect(snackBar.open).toHaveBeenCalledWith(
      'Actualización',
      'Aplicar',
      expect.objectContaining({
        duration: 10000,
        panelClass: ['app-snackbar', 'app-snackbar-info']
      })
    );
  });
});
