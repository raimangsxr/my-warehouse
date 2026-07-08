import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { PwaService } from './pwa.service';

describe('PwaService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PwaService,
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: false,
            versionUpdates: new Subject(),
            checkForUpdate: async () => false,
            activateUpdate: async () => undefined
          }
        }
      ]
    });
  });

  it('creates with service worker disabled', () => {
    const service = TestBed.inject(PwaService);
    expect(service.serviceWorkerEnabled()).toBe(false);
    expect(service.currentVersionLabel()).toBeTruthy();
  });

  it('returns unavailable when install prompt is missing', async () => {
    const service = TestBed.inject(PwaService);
    await expect(service.promptInstall()).resolves.toBe('unavailable');
  });

  it('consumes pending reload success from session storage', () => {
    sessionStorage.setItem('my-warehouse:pwa-updated-version', '1.2.3');
    const service = TestBed.inject(PwaService);

    expect(service.consumePendingReloadSuccess()).toBe('1.2.3');
    expect(sessionStorage.getItem('my-warehouse:pwa-updated-version')).toBeNull();
    expect(service.currentVersionLabel()).toBe('1.2.3');
  });
});
