import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { MembersComponent } from './members.component';

describe('MembersComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    httpMock.verify();
  });

  async function createMembers() {
    const fixture = await createStandaloneComponent(MembersComponent);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/members`).flush([
      { user_id: 'u1', warehouse_id: 'wh-1', email: 'admin@example.com', display_name: 'Admin', role: 'administrator', created_at: '2026-01-01' },
      { user_id: 'u2', warehouse_id: 'wh-1', email: 'guest@example.com', display_name: null, role: 'contributor', created_at: '2026-01-02' },
    ]);
    fixture.detectChanges();
    return fixture;
  }

  it('shows members and the fixed permissions matrix', async () => {
    const fixture = await createMembers();
    expect(fixture.componentInstance.members).toHaveLength(2);
    expect(fixture.componentInstance.permissions.some((permission) => !permission.contributor)).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Permisos efectivos');
  });

  it('updates a member role', async () => {
    const fixture = await createMembers();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');
    component.setPendingRole('u2', 'administrator');
    component.saveRole(component.members[1]);

    const update = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/members/u2`);
    expect(update.request.body).toEqual({ role: 'administrator' });
    update.flush({ ...component.members[1], role: 'administrator' });
    httpMock.expectOne(`${environment.apiBaseUrl}/warehouses`).flush([
      { id: 'wh-1', name: 'Main', created_by: 'u1', created_at: '2026-01-01', role: 'administrator' },
    ]);

    expect(component.members[1].role).toBe('administrator');
    expect(notificationService.success).toHaveBeenCalled();
  });

  it('explains why the last administrator cannot be demoted', async () => {
    const fixture = await createMembers();
    const component = fixture.componentInstance;
    component.setPendingRole('u1', 'contributor');
    component.saveRole(component.members[0]);
    httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/members/u1`).flush(
      { detail: 'Warehouse must keep at least one administrator' },
      { status: 409, statusText: 'Conflict' }
    );
    expect(component.errorMessage).toContain('al menos un Administrador');
  });

  it('confirms and removes another member from the visible list', async () => {
    const fixture = await createMembers();
    const component = fixture.componentInstance;
    const authService = TestBed.inject(AuthService);
    const notificationService = TestBed.inject(NotificationService);
    authService.currentUser.set({
      id: 'u1', email: 'admin@example.com', display_name: 'Admin', default_warehouse_id: 'wh-1'
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(notificationService, 'success');

    component.removeMember(component.members[1]);

    expect(window.confirm).toHaveBeenCalledWith(
      '¿Retirar a guest@example.com de este warehouse? Perderá el acceso inmediatamente.'
    );
    const request = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/members/u2`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ message: 'Member removed' });
    expect(component.members.map((member) => member.user_id)).toEqual(['u1']);
    expect(notificationService.success).toHaveBeenCalledWith('Miembro retirado correctamente.');
  });

  it('cancels removal and hides the action for the current member', async () => {
    const fixture = await createMembers();
    const component = fixture.componentInstance;
    const authService = TestBed.inject(AuthService);
    authService.currentUser.set({
      id: 'u1', email: 'admin@example.com', display_name: 'Admin', default_warehouse_id: 'wh-1'
    });
    fixture.detectChanges();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.removeMember(component.members[1]);

    httpMock.expectNone(`${environment.apiBaseUrl}/warehouses/wh-1/members/u2`);
    expect(component.members).toHaveLength(2);
    const element = fixture.nativeElement as HTMLElement;
    const removeButtons = Array.from(
      element.querySelectorAll<HTMLButtonElement>('button[aria-label^="Retirar a"]')
    );
    expect(removeButtons).toHaveLength(1);
    expect(removeButtons[0].getAttribute('aria-label')).toContain('guest@example.com');
  });

  it('keeps the member visible and explains a missing target', async () => {
    const fixture = await createMembers();
    const component = fixture.componentInstance;
    const authService = TestBed.inject(AuthService);
    const notificationService = TestBed.inject(NotificationService);
    authService.currentUser.set({
      id: 'u1', email: 'admin@example.com', display_name: 'Admin', default_warehouse_id: 'wh-1'
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(notificationService, 'error');

    component.removeMember(component.members[1]);
    httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/members/u2`).flush(
      { detail: 'Member not found' },
      { status: 404, statusText: 'Not Found' }
    );

    expect(component.members).toHaveLength(2);
    expect(component.errorMessage).toBe('El miembro ya no pertenece al warehouse.');
    expect(notificationService.error).toHaveBeenCalledWith(component.errorMessage);
  });
});
