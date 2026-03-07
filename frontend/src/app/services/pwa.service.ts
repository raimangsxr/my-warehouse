import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

import { APP_VERSION } from '../core/app-version';

interface BeforeInstallPromptEvent extends Event {
  platforms: string[];
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

type VersionAppData = {
  version?: string;
};

export type PwaUpdateActivationResult =
  | { status: 'updated'; version: string }
  | { status: 'none' }
  | { status: 'error'; version: string | null; message: string };

const POST_RELOAD_UPDATE_KEY = 'my-warehouse:pwa-updated-version';

@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly ngZone = inject(NgZone);
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  readonly serviceWorkerEnabled = signal(Boolean(this.swUpdate?.isEnabled));
  readonly canInstall = signal(false);
  readonly isInstalled = signal(this.detectStandalone());
  readonly isIos = signal(this.detectIos());
  readonly updateAvailable = signal(false);
  readonly lastUpdateCheck = signal<string | null>(null);
  readonly currentVersionLabel = signal(APP_VERSION);
  readonly latestVersionLabel = signal<string | null>(null);
  readonly lastUpdateError = signal<string | null>(null);
  readonly showIosInstallHint = computed(() => this.isIos() && !this.isInstalled() && !this.canInstall());
  readonly versionSummary = computed(() => ({
    current: this.currentVersionLabel(),
    latest: this.latestVersionLabel(),
    updateAvailable: this.updateAvailable()
  }));

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.ngZone.run(() => {
        this.deferredPrompt = event as BeforeInstallPromptEvent;
        this.canInstall.set(!this.isInstalled());
      });
    });

    window.addEventListener('appinstalled', () => {
      this.ngZone.run(() => {
        this.deferredPrompt = null;
        this.canInstall.set(false);
        this.isInstalled.set(true);
      });
    });

    const standaloneMedia = window.matchMedia('(display-mode: standalone)');
    const syncDisplayMode = () => {
      this.ngZone.run(() => {
        const standalone = this.detectStandalone();
        this.isInstalled.set(standalone);
        if (standalone) {
          this.canInstall.set(false);
        }
      });
    };

    standaloneMedia.addEventListener('change', syncDisplayMode);

    if (this.swUpdate?.isEnabled) {
      this.swUpdate.versionUpdates.subscribe((event) => {
        this.ngZone.run(() => {
          this.lastUpdateError.set(null);
          if (event.type === 'NO_NEW_VERSION_DETECTED') {
            this.currentVersionLabel.set(this.resolveVersionLabel(event.version.appData, APP_VERSION));
            this.latestVersionLabel.set(null);
            this.updateAvailable.set(false);
            return;
          }
          if (event.type === 'VERSION_DETECTED') {
            this.latestVersionLabel.set(this.resolveVersionLabel(event.version.appData, null, event.version.hash));
            return;
          }
          if (event.type === 'VERSION_INSTALLATION_FAILED') {
            const version = this.resolveVersionLabel(event.version.appData, null, event.version.hash);
            this.latestVersionLabel.set(version);
            this.lastUpdateError.set(`No se pudo descargar la versión ${version}.`);
            return;
          }
          if (event.type === 'VERSION_READY') {
            this.currentVersionLabel.set(
              this.resolveVersionLabel(event.currentVersion.appData, this.currentVersionLabel(), event.currentVersion.hash)
            );
            this.latestVersionLabel.set(
              this.resolveVersionLabel(event.latestVersion.appData, null, event.latestVersion.hash)
            );
            this.updateAvailable.set(true);
          }
        });
      });
      queueMicrotask(() => {
        void this.checkForUpdate();
      });
    }
  }

  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferredPrompt || this.isInstalled()) {
      return 'unavailable';
    }

    const prompt = this.deferredPrompt;
    this.deferredPrompt = null;
    this.canInstall.set(false);

    await prompt.prompt();
    const choice = await prompt.userChoice;
    return choice.outcome;
  }

  async checkForUpdate(): Promise<boolean> {
    this.lastUpdateCheck.set(new Date().toISOString());
    this.lastUpdateError.set(null);
    if (!this.swUpdate?.isEnabled) {
      return false;
    }

    try {
      const available = await this.swUpdate.checkForUpdate();
      if (available) {
        this.updateAvailable.set(true);
      } else {
        this.latestVersionLabel.set(null);
      }
      return available;
    } catch {
      this.lastUpdateError.set('No se pudo comprobar si existe una versión nueva.');
      return false;
    }
  }

  async activateUpdate(): Promise<PwaUpdateActivationResult> {
    if (!this.swUpdate?.isEnabled || !this.updateAvailable()) {
      return { status: 'none' };
    }

    const targetVersion = this.latestVersionLabel();
    try {
      if (targetVersion) {
        sessionStorage.setItem(POST_RELOAD_UPDATE_KEY, targetVersion);
      }
      await this.swUpdate.activateUpdate();
      this.updateAvailable.set(false);
      document.location.reload();
      return { status: 'updated', version: targetVersion || this.currentVersionLabel() };
    } catch {
      const message = targetVersion
        ? `No se pudo aplicar la versión ${targetVersion}.`
        : 'No se pudo aplicar la actualización disponible.';
      this.lastUpdateError.set(message);
      return { status: 'error', version: targetVersion, message };
    }
  }

  consumePendingReloadSuccess(): string | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }
    const version = sessionStorage.getItem(POST_RELOAD_UPDATE_KEY);
    if (!version) {
      return null;
    }
    sessionStorage.removeItem(POST_RELOAD_UPDATE_KEY);
    this.currentVersionLabel.set(version);
    this.latestVersionLabel.set(null);
    this.updateAvailable.set(false);
    return version;
  }

  private detectStandalone(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const navigatorStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    return window.matchMedia('(display-mode: standalone)').matches || navigatorStandalone;
  }

  private detectIos(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }

    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  private resolveVersionLabel(appData: object | undefined, fallback: string | null, hash?: string): string {
    const version = (appData as VersionAppData | undefined)?.version?.trim();
    if (version) {
      return version;
    }
    if (fallback) {
      return fallback;
    }
    if (hash) {
      return `build ${hash.slice(0, 8)}`;
    }
    return APP_VERSION;
  }
}
