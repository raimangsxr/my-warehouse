import { beforeEach, describe, expect, it } from 'vitest';

import { ItemPhotoCaptureStateService } from './item-photo-capture-state.service';

describe('ItemPhotoCaptureStateService', () => {
  let service: ItemPhotoCaptureStateService;

  beforeEach(() => {
    service = new ItemPhotoCaptureStateService();
  });

  it('returns null when no selection was saved', () => {
    expect(service.getSnapshot()).toBeNull();
  });

  it('stores and returns photo selection snapshot', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    service.saveSelection({ file, fileLabel: 'photo.jpg', dataUrl: 'data:image/jpeg;base64,x' });

    const snapshot = service.getSnapshot();
    expect(snapshot?.fileLabel).toBe('photo.jpg');
    expect(snapshot?.dataUrl).toBe('data:image/jpeg;base64,x');
    expect(snapshot?.previewLoadFailed).toBe(false);
  });

  it('clears stored selection', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    service.saveSelection({ file, fileLabel: 'photo.jpg' });
    service.clear();

    expect(service.getSnapshot()).toBeNull();
  });

  it('marks preview failure on existing selection', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    service.saveSelection({ file, fileLabel: 'photo.jpg' });
    service.markPreviewFailure(true);

    expect(service.getSnapshot()?.previewLoadFailed).toBe(true);
  });
});
