import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { NotificationService } from '../services/notification.service';
import { PwaService } from '../services/pwa.service';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;
  let pwaService: PwaService;

  beforeEach(() => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
  });

  afterEach(() => {
    httpMock?.verify();
  });

  async function createShell() {
    const fixture = await createStandaloneComponent(ShellComponent);
    httpMock = TestBed.inject(HttpTestingController);
    pwaService = TestBed.inject(PwaService);
    return fixture;
  }

  it('should create', async () => {
    const fixture = await createShell();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('logs out and navigates to login', async () => {
    const fixture = await createShell();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture.componentInstance.logout();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('does not close sidenav on desktop when closeIfMobile is called', async () => {
    const fixture = await createShell();
    const component = fixture.componentInstance;
    component.isMobile = false;
    const close = vi.fn();
    component.sidenav = { close } as never;

    component.closeIfMobile();
    expect(close).not.toHaveBeenCalled();
  });

  it('shows unavailable install message when prompt is unavailable', async () => {
    const fixture = await createShell();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'info');
    vi.spyOn(pwaService, 'promptInstall').mockResolvedValue('unavailable');
    vi.spyOn(pwaService, 'showIosInstallHint').mockReturnValue(false);

    await component.installApp();

    expect(notificationService.info).toHaveBeenCalledWith(
      'La instalación estará disponible cuando el navegador valide la PWA en HTTPS.'
    );
  });

  it('shows info when applyAppUpdate has no pending update', async () => {
    const fixture = await createShell();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'info');
    vi.spyOn(pwaService, 'activateUpdate').mockResolvedValue({ status: 'none' });

    await component.applyAppUpdate();

    expect(notificationService.info).toHaveBeenCalledWith('No hay actualizaciones pendientes para aplicar.');
  });
});
