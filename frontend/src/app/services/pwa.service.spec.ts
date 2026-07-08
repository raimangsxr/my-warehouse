import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PwaService } from './pwa.service';

function providePwaService(swUpdate: {
  isEnabled: boolean;
  versionUpdates?: Subject<unknown>;
  checkForUpdate?: () => Promise<boolean>;
  activateUpdate?: () => Promise<boolean>;
}) {
  TestBed.configureTestingModule({
    providers: [
      PwaService,
      {
        provide: SwUpdate,
        useValue: {
          versionUpdates: new Subject(),
          checkForUpdate: async () => false,
          activateUpdate: async () => true,
          ...swUpdate
        }
      }
    ]
  });
}

describe('PwaService', () => {
  beforeEach(() => {
    providePwaService({ isEnabled: false });
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

  it('checkForUpdate returns false when service worker is disabled', async () => {
    const service = TestBed.inject(PwaService);

    await expect(service.checkForUpdate()).resolves.toBe(false);
    expect(service.updateAvailable()).toBe(false);
  });

  it('checkForUpdate returns true when update is available', async () => {
    providePwaService({
      isEnabled: true,
      checkForUpdate: vi.fn(async () => true)
    });
    const service = TestBed.inject(PwaService);
    await new Promise((r) => setTimeout(r, 0));

    await expect(service.checkForUpdate()).resolves.toBe(true);
    expect(service.updateAvailable()).toBe(true);
    expect(service.lastUpdateCheck()).toBeTruthy();
  });

  it('activateUpdate returns none when no update is available', async () => {
    const service = TestBed.inject(PwaService);

    await expect(service.activateUpdate()).resolves.toEqual({ status: 'none' });
  });

  it('activateUpdate returns error when activation fails', async () => {
    providePwaService({
      isEnabled: true,
      checkForUpdate: vi.fn(async () => false),
      activateUpdate: vi.fn(async () => {
        throw new Error('activation failed');
      })
    });
    const service = TestBed.inject(PwaService);
    service.updateAvailable.set(true);
    service.latestVersionLabel.set('1.2.4');

    await expect(service.activateUpdate()).resolves.toEqual({
      status: 'error',
      version: '1.2.4',
      message: 'No se pudo aplicar la versión 1.2.4.'
    });
    expect(service.lastUpdateError()).toBe('No se pudo aplicar la versión 1.2.4.');
  });
});
