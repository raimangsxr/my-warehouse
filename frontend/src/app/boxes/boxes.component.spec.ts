import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { testBox } from '../../testing/fixtures';
import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { BoxLabelPrintService } from '../services/box-label-print.service';
import { NotificationService } from '../services/notification.service';
import { BoxesComponent } from './boxes.component';

describe('BoxesComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
  });

  afterEach(() => {
    httpMock?.verify();
  });

  async function createBoxes() {
    const fixture = await createStandaloneComponent(BoxesComponent);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne((request) => request.url.includes('/boxes/tree')).flush([]);
    return fixture;
  }

  it('should create', async () => {
    const fixture = await createBoxes();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('toggles expanded box nodes', async () => {
    const fixture = await createBoxes();
    const component = fixture.componentInstance;

    expect(component.isExpanded('box-1')).toBe(false);
    component.toggleExpanded('box-1');
    expect(component.isExpanded('box-1')).toBe(true);
    component.toggleExpanded('box-1');
    expect(component.isExpanded('box-1')).toBe(false);
  });

  it('creates a box and reloads tree', async () => {
    const fixture = await createBoxes();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');

    component.createForm.setValue({ name: 'Shelf A', parentBoxId: null });
    component.createBox();

    const createReq = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/boxes`);
    createReq.flush({ id: 'box-new', warehouse_id: 'wh-test', parent_box_id: null, name: 'Shelf A', description: null, physical_location: null, short_code: 'A1', qr_token: 'qr', is_inbound: false, version: 1, created_at: '', updated_at: '', deleted_at: null });
    httpMock.expectOne((request) => request.url.includes('/boxes/tree')).flush([]);

    expect(notificationService.success).toHaveBeenCalled();
    expect(component.createForm.value.name).toBe('');
  });

  it('renames a box and reloads tree', async () => {
    const fixture = await createBoxes();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');

    component.renameBoxId = 'box-1';
    component.renameValue = 'Renamed shelf';
    component.saveRename('box-1');

    const updateReq = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/boxes/box-1`);
    expect(updateReq.request.method).toBe('PATCH');
    expect(updateReq.request.body).toEqual({ name: 'Renamed shelf' });
    updateReq.flush(testBox({ id: 'box-1', name: 'Renamed shelf' }));
    httpMock.expectOne((request) => request.url.includes('/boxes/tree')).flush([]);

    expect(notificationService.success).toHaveBeenCalledWith('Caja renombrada correctamente.');
    expect(component.renameBoxId).toBeNull();
  });

  it('disables invalid move candidates', async () => {
    const fixture = await createBoxes();
    const component = fixture.componentInstance;
    component['parentById'] = new Map([
      ['box-child', 'box-parent'],
      ['box-parent', null]
    ]);

    const node = {
      box: testBox({ id: 'box-parent' }),
      level: 0,
      total_items_recursive: 0,
      total_boxes_recursive: 1,
      path_label: 'Root',
      children: []
    };
    const selfCandidate = { ...node, box: testBox({ id: 'box-parent' }) };
    const childCandidate = {
      box: testBox({ id: 'box-child', parent_box_id: 'box-parent' }),
      level: 1,
      total_items_recursive: 0,
      total_boxes_recursive: 0,
      path_label: 'Root > Child',
      children: []
    };

    expect(component.isMoveCandidateDisabled(node, selfCandidate)).toBe(true);
    expect(component.isMoveCandidateDisabled(node, childCandidate)).toBe(true);
  });

  it('prints box label via print service', async () => {
    const fixture = await createBoxes();
    const component = fixture.componentInstance;
    const printService = TestBed.inject(BoxLabelPrintService);
    vi.spyOn(printService, 'printLabel');
    const box = testBox({ id: 'box-print', name: 'Print me' });

    component.printLabel(box);

    expect(printService.printLabel).toHaveBeenCalledWith(box);
  });
});
