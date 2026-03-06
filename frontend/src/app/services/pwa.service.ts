import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

interface BeforeInstallPromptEvent extends Event {
  platforms: string[];
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

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
  readonly showIosInstallHint = computed(() => this.isIos() && !this.isInstalled() && !this.canInstall());

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
        if (event.type === 'VERSION_READY') {
          this.ngZone.run(() => this.updateAvailable.set(true));
        }
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
    if (!this.swUpdate?.isEnabled) {
      return false;
    }

    try {
      const available = await this.swUpdate.checkForUpdate();
      if (available) {
        this.updateAvailable.set(true);
      }
      return available;
    } catch {
      return false;
    }
  }

  async activateUpdate(): Promise<boolean> {
    if (!this.swUpdate?.isEnabled || !this.updateAvailable()) {
      return false;
    }

    await this.swUpdate.activateUpdate();
    this.updateAvailable.set(false);
    document.location.reload();
    return true;
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
}
