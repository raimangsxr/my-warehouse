import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { createActivatedRouteMock } from '../../testing/component-test-helpers';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { ItemPhotoCaptureComponent } from './item-photo-capture.component';

function fileInputEvent(file: File): Event {
  const input = document.createElement('input');
  Object.defineProperty(input, 'files', { value: [file], writable: false });
  return { target: input } as unknown as Event;
}

function mockFileReader(): void {
  class MockFileReader {
    result: string | ArrayBuffer | null = 'data:image/jpeg;base64,YWJj';
    onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
    onerror: ((ev: ProgressEvent<FileReader>) => void) | null = null;

    readAsDataURL(): void {
      queueMicrotask(() => this.onload?.({} as ProgressEvent<FileReader>));
    }
  }

  vi.stubGlobal('FileReader', MockFileReader);
}

describe('ItemPhotoCaptureComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    mockFileReader();
  });

  afterEach(() => {
    httpMock?.verify();
  });

  async function createComponent(queryParams: Record<string, string> = {}) {
    await TestBed.configureTestingModule({
      imports: [ItemPhotoCaptureComponent],
      providers: [
        provideRouter([]),
        ...provideCommonTestProviders(),
        { provide: ActivatedRoute, useValue: createActivatedRouteMock({}, queryParams) }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(ItemPhotoCaptureComponent);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.detectChanges();
    return fixture;
  }

  it('should create', async () => {
    const fixture = await createComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('reads lockBox query params on init', async () => {
    const fixture = await createComponent({ boxId: 'box-ctx', lockBox: '1' });
    const component = fixture.componentInstance;

    expect(component.targetBoxId).toBe('box-ctx');
    expect(component.lockBoxSelection).toBe(true);
    expect(component.cancelRouterLink).toEqual(['/app/boxes', 'box-ctx']);
  });

  it('rejects invalid file type on selection', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const file = new File(['data'], 'notes.txt', { type: 'text/plain' });

    component.onFileSelected(fileInputEvent(file));

    expect(component.errorMessage).toContain('Formato no soportado');
    expect(component.hasSelectedFile).toBe(false);
  });

  it('runs analyzePhoto success flow with upload, draft and navigation', async () => {
    const fixture = await createComponent({ boxId: 'box-ctx', lockBox: 'true' });
    const component = fixture.componentInstance;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });

    component.onFileSelected(fileInputEvent(file));
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));

    component.analyzePhoto();

    const uploadReq = httpMock.expectOne((request) => request.url.includes('/photos/upload'));
    uploadReq.flush({ photo_url: 'https://cdn.test/photo.jpg', content_type: 'image/jpeg', size_bytes: 4 });

    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const draftReq = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/items/draft-from-photo`);
    expect(draftReq.request.method).toBe('POST');
    draftReq.flush({
      name: 'Hammer',
      description: 'Red hammer',
      tags: ['tools'],
      aliases: [],
      confidence: 0.9,
      warnings: [],
      llm_used: true
    });

    await fixture.whenStable();

    expect(router.navigate).toHaveBeenCalledWith(
      ['/app/items/new'],
      expect.objectContaining({
        queryParams: { boxId: 'box-ctx', lockBox: 1 },
        state: expect.objectContaining({
          uploadedPhotoUrl: 'https://cdn.test/photo.jpg'
        })
      })
    );
    expect(component.analyzing).toBe(false);
  });
});
