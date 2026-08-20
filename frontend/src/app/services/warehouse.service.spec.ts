import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../core/environment';
import { WarehouseService } from './warehouse.service';
import { configureServiceTest, flushHttp } from '../../testing/test-helpers';

describe('WarehouseService', () => {
  let service: WarehouseService;
  let httpMock: ReturnType<typeof configureServiceTest<WarehouseService>>['httpMock'];

  beforeEach(() => {
    ({ service, httpMock } = configureServiceTest(WarehouseService));
  });

  afterEach(() => {
    flushHttp(httpMock);
  });

  it('lists warehouses', () => {
    service.list().subscribe((warehouses) => {
      expect(warehouses).toHaveLength(1);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'wh-1', name: 'Main', created_by: 'u1', created_at: '2026-01-01', role: 'administrator' }]);
  });

  it('creates a warehouse', () => {
    service.create('Secondary').subscribe((warehouse) => {
      expect(warehouse.name).toBe('Secondary');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Secondary' });
    req.flush({ id: 'wh-2', name: 'Secondary', created_by: 'u1', created_at: '2026-01-02', role: 'administrator' });
  });

  it('deletes a warehouse with confirmation name', () => {
    service.delete('wh-1', 'Main').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ confirm_name: 'Main' });
    req.flush({ message: 'deleted' });
  });

  it('stores selected warehouse id in localStorage', () => {
    service.setSelectedWarehouseId('wh-1');
    expect(service.getSelectedWarehouseId()).toBe('wh-1');

    service.clearSelectedWarehouseId();
    expect(service.getSelectedWarehouseId()).toBeNull();
  });

  it('creates invite for warehouse', () => {
    service.createInvite('wh-1', { email: 'guest@example.com', role: 'contributor' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/invites`);
    expect(req.request.body).toEqual({ email: 'guest@example.com', role: 'contributor' });
    req.flush({
      warehouse_id: 'wh-1',
      invite_token: 'token',
      invite_url: 'https://example.com/invite',
      expires_at: '2026-01-02',
      role: 'contributor',
      email_delivery_status: 'sent',
      email_delivery_message: 'Invitación enviada por correo.'
    });
  });

  it('loads members and updates a role', () => {
    service.members('wh-1').subscribe((members) => expect(members[0].role).toBe('contributor'));
    const membersRequest = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/members`);
    membersRequest.flush([{ user_id: 'u2', warehouse_id: 'wh-1', email: 'guest@example.com', display_name: 'Guest', role: 'contributor', created_at: '2026-01-01' }]);

    service.updateMemberRole('wh-1', 'u2', 'administrator').subscribe();
    const updateRequest = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/members/u2`);
    expect(updateRequest.request.method).toBe('PATCH');
    expect(updateRequest.request.body).toEqual({ role: 'administrator' });
    updateRequest.flush({ user_id: 'u2', warehouse_id: 'wh-1', email: 'guest@example.com', display_name: 'Guest', role: 'administrator', created_at: '2026-01-01' });
  });

  it('tracks the selected warehouse role when the list changes', () => {
    service.setSelectedWarehouseId('wh-1');
    service.list().subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/warehouses`).flush([
      { id: 'wh-1', name: 'Main', created_by: 'u1', created_at: '2026-01-01', role: 'contributor' }
    ]);

    expect(service.selectedWarehouseRole()).toBe('contributor');
    expect(service.isSelectedWarehouseAdministrator()).toBe(false);
  });

  it('loads warehouse activity feed', () => {
    service.activity('wh-1', 10).subscribe((events) => {
      expect(events).toHaveLength(1);
    });

    const req = httpMock.expectOne((request) => request.url === `${environment.apiBaseUrl}/warehouses/wh-1/activity`);
    expect(req.request.params.get('limit')).toBe('10');
    req.flush([{ id: 'evt-1', warehouse_id: 'wh-1', actor_user_id: 'u1', event_type: 'item.created', entity_type: 'item', entity_id: 'i1', metadata: {}, created_at: '2026-01-01' }]);
  });
});
