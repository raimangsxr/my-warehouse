import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { WarehouseService } from '../services/warehouse.service';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
  });

  afterEach(() => {
    httpMock?.verify();
  });

  async function createShell() {
    const fixture = await createStandaloneComponent(ShellComponent);
    httpMock = TestBed.inject(HttpTestingController);
    return fixture;
  }

  it('should create', async () => {
    const fixture = await createShell();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows administrative navigation only for administrators', async () => {
    const fixture = await createShell();
    const warehouseService = TestBed.inject(WarehouseService);
    warehouseService.selectedWarehouseRole.set('administrator');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Miembros');
    expect(fixture.nativeElement.textContent).toContain('Configuración');

    warehouseService.selectedWarehouseRole.set('contributor');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Miembros');
    expect(fixture.nativeElement.textContent).not.toContain('Configuración');
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

});
