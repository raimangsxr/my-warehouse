import { Injectable } from '@angular/core';

const PHOTO_CAPTURE_STATE_MAX_AGE_MS = 15 * 60 * 1000;

interface ItemPhotoCaptureState {
  file: File;
  fileLabel: string;
  dataUrl: string | null;
  previewLoadFailed: boolean;
  updatedAt: number;
}

@Injectable({ providedIn: 'root' })
export class ItemPhotoCaptureStateService {
  private state: ItemPhotoCaptureState | null = null;

  saveSelection(payload: {
    file: File;
    fileLabel: string;
    dataUrl?: string | null;
    previewLoadFailed?: boolean;
  }): void {
    this.state = {
      file: payload.file,
      fileLabel: payload.fileLabel,
      dataUrl: payload.dataUrl ?? null,
      previewLoadFailed: payload.previewLoadFailed ?? false,
      updatedAt: Date.now()
    };
  }

  markPreviewFailure(failed: boolean): void {
    if (!this.state) {
      return;
    }
    this.state = {
      ...this.state,
      previewLoadFailed: failed,
      updatedAt: Date.now()
    };
  }

  getSnapshot(): { file: File; fileLabel: string; dataUrl: string | null; previewLoadFailed: boolean } | null {
    if (!this.state) {
      return null;
    }
    if (Date.now() - this.state.updatedAt > PHOTO_CAPTURE_STATE_MAX_AGE_MS) {
      this.state = null;
      return null;
    }
    return {
      file: this.state.file,
      fileLabel: this.state.fileLabel,
      dataUrl: this.state.dataUrl,
      previewLoadFailed: this.state.previewLoadFailed
    };
  }

  clear(): void {
    this.state = null;
  }
}
