import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../core/environment';
import { GeminiModelId, SettingsService } from './settings.service';
import { configureServiceTest, flushHttp } from '../../testing/test-helpers';

describe('SettingsService', () => {
  let service: SettingsService;
  let httpMock: ReturnType<typeof configureServiceTest<SettingsService>>['httpMock'];

  beforeEach(() => {
    ({ service, httpMock } = configureServiceTest(SettingsService));
  });

  afterEach(() => {
    flushHttp(httpMock);
  });

  it('loads smtp settings for warehouse', () => {
    service.getSmtpSettings('wh-1').subscribe();

    const req = httpMock.expectOne((request) => request.url === `${environment.apiBaseUrl}/settings/smtp`);
    expect(req.request.params.get('warehouse_id')).toBe('wh-1');
    req.flush({ warehouse_id: 'wh-1', host: null, port: null, username: null, encryption_mode: null, from_address: null, from_name: null, has_password: false, password_masked: null });
  });

  it('updates llm settings', () => {
    const payload = {
      provider: 'gemini',
      language: 'es' as const,
      model_priority: ['gemini-2.5-flash'] as GeminiModelId[],
      intake_parallelism: 2,
      auto_tags_enabled: true,
      auto_alias_enabled: false
    };

    service.updateLlmSettings('wh-1', payload).subscribe();

    const req = httpMock.expectOne((request) => request.url === `${environment.apiBaseUrl}/settings/llm`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({ warehouse_id: 'wh-1', provider: 'gemini', language: 'es', model_priority: ['gemini-2.5-flash'], intake_parallelism: 2, auto_tags_enabled: true, auto_alias_enabled: false, has_api_key: false, api_key_value: null });
  });

  it('triggers smtp test email', () => {
    service.testSmtpSettings('wh-1', 'ops@example.com').subscribe();

    const req = httpMock.expectOne((request) => request.url === `${environment.apiBaseUrl}/settings/smtp/test`);
    expect(req.request.body).toEqual({ to_email: 'ops@example.com' });
    req.flush({ message: 'sent' });
  });
});
