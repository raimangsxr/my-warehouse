import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { NotificationService } from '../services/notification.service';
import { SyncService } from '../services/sync.service';
import { GeminiModelId } from '../services/settings.service';
import { SettingsComponent } from './settings.component';

const smtpSettings = {
  warehouse_id: 'wh-test',
  host: null,
  port: null,
  username: null,
  encryption_mode: null,
  from_address: null,
  from_name: null,
  has_password: false,
  password_masked: null
};

const llmSettings = {
  warehouse_id: 'wh-test',
  provider: 'gemini',
  language: 'es' as const,
  model_priority: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] as GeminiModelId[],
  intake_parallelism: 2,
  auto_tags_enabled: true,
  auto_alias_enabled: true,
  has_api_key: false,
  api_key_value: null
};

describe('SettingsComponent', () => {
  let httpMock: HttpTestingController;
  let syncService: SyncService;

  beforeEach(() => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
  });

  afterEach(() => {
    httpMock?.verify();
  });

  async function createSettings() {
    const fixture = await createStandaloneComponent(SettingsComponent);
    httpMock = TestBed.inject(HttpTestingController);
    syncService = TestBed.inject(SyncService);
    httpMock.expectOne((request) => request.url.includes('/settings/smtp')).flush(smtpSettings);
    httpMock.expectOne((request) => request.url.includes('/settings/llm')).flush(llmSettings);
    return fixture;
  }

  it('should create', async () => {
    const fixture = await createSettings();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('returns gemini model labels', async () => {
    const fixture = await createSettings();
    const label = fixture.componentInstance.getGeminiModelLabel('gemini-2.5-flash');
    expect(label).toContain('2.5');
  });

  it('reorders model priority list', async () => {
    const fixture = await createSettings();
    const component = fixture.componentInstance;
    component.llmModelPriority = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    component.moveModelPriority(0, 1);
    expect(component.llmModelPriority[0]).toBe('gemini-2.5-flash-lite');
  });

  it('shows the real SMTP test success returned by the backend', async () => {
    const fixture = await createSettings();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');
    component.smtpTestEmail = 'target@example.com';

    component.testSmtp();

    expect(component.smtpLoading).toBe(true);
    const req = httpMock.expectOne((request) => request.url.endsWith('/settings/smtp/test'));
    expect(req.request.body).toEqual({ to_email: 'target@example.com' });
    req.flush({ message: 'Correo de prueba enviado a target@example.com.' });

    expect(component.smtpLoading).toBe(false);
    expect(component.smtpMessage).toBe('Correo de prueba enviado a target@example.com.');
    expect(notificationService.success).toHaveBeenCalledWith(component.smtpMessage);
  });

  it('shows the sanitized backend detail when the SMTP test fails', async () => {
    const fixture = await createSettings();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'error');
    component.smtpTestEmail = 'target@example.com';

    component.testSmtp();

    const req = httpMock.expectOne((request) => request.url.endsWith('/settings/smtp/test'));
    req.flush(
      { detail: 'El servidor SMTP rechazó las credenciales.' },
      { status: 502, statusText: 'Bad Gateway' }
    );

    expect(component.smtpLoading).toBe(false);
    expect(component.smtpError).toBe('El servidor SMTP rechazó las credenciales.');
    expect(notificationService.error).toHaveBeenCalledWith(component.smtpError);
  });

  it('exports warehouse snapshot', async () => {
    const fixture = await createSettings();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');
    vi.spyOn(component as unknown as { downloadSnapshot: (snapshot: unknown) => void }, 'downloadSnapshot').mockImplementation(() => {});

    component.exportWarehouse();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/export`);
    req.flush({ warehouse: { id: 'wh-test' }, boxes: [], items: [] });

    expect(component.transferMessage).toBe('Export generado correctamente.');
    expect(notificationService.success).toHaveBeenCalledWith('Export generado correctamente.');
  });

  it('force syncs warehouse via sync service', async () => {
    const fixture = await createSettings();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');
    vi.spyOn(syncService, 'forceSync').mockResolvedValue({
      queueCountBefore: 1,
      queueCountAfter: 0,
      applied: 2,
      skipped: 0,
      conflicts: 0,
      lastSeq: 42
    });

    await component.forceSync();

    expect(syncService.forceSync).toHaveBeenCalledWith('wh-test');
    expect(component.syncMessage).toContain('Sync completado');
    expect(notificationService.success).toHaveBeenCalled();
    expect(component.syncLoading).toBe(false);
  });

  it('imports warehouse JSON successfully', async () => {
    const fixture = await createSettings();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');

    const payload = { warehouse: { id: 'wh-test' }, boxes: [], items: [] };
    const file = new File([JSON.stringify(payload)], 'export.json', { type: 'application/json' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    await component.importWarehouse({ target: input } as unknown as Event);

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/import`);
    expect(req.request.method).toBe('POST');
    req.flush({
      message: 'Importado',
      boxes_upserted: 2,
      items_upserted: 5,
      stock_movements_upserted: 1
    });

    expect(component.transferMessage).toContain('Boxes: 2');
    expect(notificationService.success).toHaveBeenCalledWith('Importación completada correctamente.');
  });

  it('shows error for invalid import JSON', async () => {
    const fixture = await createSettings();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'error');

    const file = new File(['not-json'], 'bad.json', { type: 'application/json' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    await component.importWarehouse({ target: input } as unknown as Event);

    expect(component.transferError).toBe('Archivo JSON inválido.');
    expect(notificationService.error).toHaveBeenCalledWith('Archivo JSON inválido.');
    httpMock.expectNone(`${environment.apiBaseUrl}/warehouses/wh-test/import`);
  });
});
