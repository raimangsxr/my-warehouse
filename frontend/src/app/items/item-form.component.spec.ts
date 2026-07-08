import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { testItem } from '../../testing/fixtures';
import { createActivatedRouteMock } from '../../testing/component-test-helpers';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { BoxTreeNode } from '../services/box.service';
import { NotificationService } from '../services/notification.service';
import { ItemFormComponent } from './item-form.component';

describe('ItemFormComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
  });

  afterEach(() => {
    httpMock?.verify();
  });

  async function createForm(routeParams: Record<string, string> = {}, queryParams: Record<string, string> = {}) {
    await TestBed.configureTestingModule({
      imports: [ItemFormComponent],
      providers: [
        provideRouter([]),
        ...provideCommonTestProviders(),
        { provide: ActivatedRoute, useValue: createActivatedRouteMock(routeParams, queryParams) }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(ItemFormComponent);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    httpMock.expectOne((request) => request.url.includes('/boxes/tree')).flush([]);
    return fixture;
  }

  it('should create for new item', async () => {
    const fixture = await createForm();
    expect(fixture.componentInstance.pageTitle).toBe('Nuevo artículo');
  });

  it('switches create mode between item and box', async () => {
    const fixture = await createForm();
    const component = fixture.componentInstance;

    component.setCreateEntityType('box');
    expect(component.pageTitle).toBe('Nueva caja');
    expect(component.primaryActionLabel).toBe('Crear caja');
  });

  it('builds box path label from cached map', async () => {
    const fixture = await createForm();
    const component = fixture.componentInstance;
    const node: BoxTreeNode = {
      box: {
        id: 'box-1',
        warehouse_id: 'wh-test',
        parent_box_id: null,
        name: 'Root',
        description: null,
        physical_location: null,
        short_code: 'R1',
        qr_token: 'qr',
        is_inbound: false,
        version: 1,
        created_at: '',
        updated_at: '',
        deleted_at: null
      },
      level: 0,
      total_items_recursive: 0,
      total_boxes_recursive: 0
    };

    component['boxPathById'].set('box-1', 'Warehouse > Root');
    expect(component.boxPathLabel(node)).toBe('Warehouse > Root');
  });

  it('saves a new item via API', async () => {
    const fixture = await createForm();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');

    component.form.setValue({
      name: 'New hammer',
      boxId: 'box-test',
      description: '',
      physicalLocation: '',
      photoUrl: '',
      tags: 'tools',
      aliases: ''
    });
    component.save();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/items`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      box_id: 'box-test',
      name: 'New hammer',
      tags: ['tools']
    });
    req.flush(testItem({ id: 'item-new', name: 'New hammer' }));

    expect(notificationService.success).toHaveBeenCalledWith('Artículo creado correctamente.');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/home');
  });

  it('loads item in edit mode from route id', async () => {
    const fixture = await createForm({ id: 'item-edit' });
    const component = fixture.componentInstance;
    const item = testItem({
      id: 'item-edit',
      name: 'Existing item',
      box_id: 'box-1',
      description: 'Details',
      tags: ['tools', 'metal'],
      aliases: ['alias-a']
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/items/item-edit`);
    req.flush(item);

    expect(component.pageTitle).toBe('Editar artículo');
    expect(component.form.value.name).toBe('Existing item');
    expect(component.form.value.boxId).toBe('box-1');
    expect(component.form.value.tags).toBe('tools, metal');
    expect(component.form.value.aliases).toBe('alias-a');
  });
});
