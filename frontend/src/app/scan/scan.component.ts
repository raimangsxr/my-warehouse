import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { BoxService } from '../services/box.service';
import { WarehouseService } from '../services/warehouse.service';

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule
  ],
  template: `
    <div class="app-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Escáner QR</h1>
          <p class="page-subtitle">Escanea con cámara o resuelve el token manualmente</p>
        </div>
      </header>

      <mat-card class="surface-card">
        <mat-progress-bar *ngIf="scanning" mode="indeterminate" />
        <mat-card-content>
          <p class="status-line">
            Si el navegador soporta escaneo nativo, activa cámara. Si no, pega el token QR manual.
          </p>

          <div class="inline-actions" style="margin-top: 10px">
            <button mat-flat-button color="primary" type="button" (click)="startCameraScan()" [disabled]="scanning">
              <mat-icon>videocam</mat-icon>
              Iniciar cámara
            </button>
            <button mat-stroked-button type="button" (click)="stopCameraScan()" [disabled]="!scanning">
              <mat-icon>videocam_off</mat-icon>
              Detener
            </button>
          </div>

          <div class="item-card" style="margin-top: 12px; padding: 10px">
            <video #videoEl autoplay playsinline muted style="width: 100%; max-width: 560px; border-radius: 10px"></video>
          </div>

          <div class="form-row" style="margin-top: 14px">
            <mat-form-field class="grow">
              <mat-label>Token QR (manual)</mat-label>
              <mat-icon matPrefix>qr_code_2</mat-icon>
              <input matInput [(ngModel)]="manualToken" />
            </mat-form-field>
            <div class="inline-actions">
              <button mat-flat-button color="primary" type="button" (click)="resolveManualToken()" [disabled]="!manualToken.trim()">
                Abrir caja
              </button>
            </div>
          </div>

          <div class="error" *ngIf="errorMessage" style="margin-top: 10px">{{ errorMessage }}</div>
          <div class="status-message" *ngIf="statusMessage" style="margin-top: 10px">{{ statusMessage }}</div>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class ScanComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>;

  manualToken = '';
  scanning = false;
  errorMessage = '';
  statusMessage = '';

  private mediaStream: MediaStream | null = null;
  private scanTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly boxService: BoxService,
    private readonly warehouseService: WarehouseService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const routeToken = this.route.snapshot.paramMap.get('qrToken') || this.route.snapshot.queryParamMap.get('token');
    if (routeToken) {
      this.manualToken = routeToken;
      this.resolveToken(routeToken);
    }
  }

  ngOnDestroy(): void {
    this.stopCameraScan();
  }

  async startCameraScan(): Promise<void> {
    this.errorMessage = '';
    this.statusMessage = '';

    const video = this.videoEl?.nativeElement || null;
    if (!video) {
      this.errorMessage = 'No se pudo inicializar el video.';
      return;
    }

    const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: new (config: { formats: string[] }) => BarcodeDetectorLike })
      .BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      this.errorMessage = 'Este navegador no soporta BarcodeDetector. Usa el token manual.';
      return;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      video.srcObject = this.mediaStream;
      this.scanning = true;
      this.statusMessage = 'Escaneando...';

      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      this.scanTimer = setInterval(async () => {
        if (!this.scanning) {
          return;
        }
        try {
          const results = await detector.detect(video);
          const token = results.find((r) => !!r.rawValue)?.rawValue?.trim();
          if (token) {
            this.manualToken = token;
            this.stopCameraScan();
            this.resolveToken(token);
          }
        } catch {
          // keep scanning silently
        }
      }, 700);
    } catch {
      this.errorMessage = 'No se pudo acceder a la cámara. Revisa permisos del navegador.';
    }
  }

  stopCameraScan(): void {
    this.scanning = false;
    this.statusMessage = '';
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    const video = this.videoEl?.nativeElement || null;
    if (video) {
      video.srcObject = null;
    }
  }

  resolveManualToken(): void {
    this.resolveToken(this.manualToken.trim());
  }

  private resolveToken(token: string): void {
    if (!token) {
      return;
    }
    this.errorMessage = '';
    this.statusMessage = 'Resolviendo QR...';
    this.boxService.resolveByQrToken(token).subscribe({
      next: (lookup) => {
        this.warehouseService.setSelectedWarehouseId(lookup.warehouse_id);
        this.statusMessage = '';
        this.router.navigateByUrl(`/app/boxes/${lookup.box_id}`);
      },
      error: (err) => {
        this.statusMessage = '';
        if (err?.status === 403) {
          this.errorMessage = 'No tienes acceso al warehouse de este QR.';
          return;
        }
        if (err?.status === 404) {
          this.errorMessage = 'QR no válido o caja no encontrada.';
          return;
        }
        this.errorMessage = 'No se pudo resolver el QR.';
      }
    });
  }
}
