import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { NotificationService } from '../services/notification.service';
import { WarehouseService } from '../services/warehouse.service';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  let httpMock: HttpTestingController;

  afterEach(() => httpMock?.verify());

  async function createProfile() {
    const fixture = await createStandaloneComponent(ProfileComponent);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`).flush({
      id: 'user-1', email: 'user@example.com', display_name: 'User', default_warehouse_id: 'wh-1'
    });
    fixture.detectChanges();
    return fixture;
  }

  it('shows editable name, read-only email and the simplified PWA summary', async () => {
    const fixture = await createProfile();
    const text = fixture.nativeElement.textContent;
    const email = fixture.nativeElement.querySelector('input[formcontrolname="email"]') as HTMLInputElement;

    expect(text).toContain('Nombre visible');
    expect(email.readOnly).toBe(true);
    expect(text).toContain('Versión instalada');
    expect(text).toContain('Nueva versión detectada');
    expect(text).toContain('Última comprobación');
    expect(text).not.toContain('Service Worker:');
  });

  it('shows full PWA diagnostics for an administrator of the active warehouse', async () => {
    const fixture = await createProfile();
    TestBed.inject(WarehouseService).selectedWarehouseRole.set('administrator');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Service Worker:');
    expect(fixture.nativeElement.textContent).toContain('Prompt de instalación:');
  });

  it('updates display name through the profile API', async () => {
    const fixture = await createProfile();
    const notification = TestBed.inject(NotificationService);
    vi.spyOn(notification, 'success');
    fixture.componentInstance.profileForm.controls.displayName.setValue('  Nuevo  ');
    fixture.componentInstance.saveProfile();

    const request = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ display_name: 'Nuevo' });
    request.flush({
      id: 'user-1', email: 'user@example.com', display_name: 'Nuevo', default_warehouse_id: 'wh-1'
    });

    expect(notification.success).toHaveBeenCalledWith('Perfil actualizado correctamente.');
  });

  it('changes password outside warehouse settings', async () => {
    const fixture = await createProfile();
    fixture.componentInstance.passwordForm.setValue({
      currentPassword: 'oldpass12', newPassword: 'newpass12'
    });
    fixture.componentInstance.changePassword();

    const request = httpMock.expectOne(`${environment.apiBaseUrl}/auth/change-password`);
    expect(request.request.body).toEqual({ current_password: 'oldpass12', new_password: 'newpass12' });
    request.flush({ message: 'Password changed' });
  });
});
