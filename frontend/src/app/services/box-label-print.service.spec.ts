import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BoxLabelPrintService } from './box-label-print.service';

describe('BoxLabelPrintService', () => {
  let service: BoxLabelPrintService;

  beforeEach(() => {
    service = new BoxLabelPrintService();
  });

  it('escapes html in generated label document', () => {
    const write = vi.fn();
    const close = vi.fn();
    const document = {
      open: vi.fn(),
      write,
      close,
      querySelector: vi.fn(() => null)
    };

    const printWindow = {
      document,
      focus: vi.fn(),
      print: vi.fn(),
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      },
      onafterprint: null as (() => void) | null
    };

    vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window);

    service.printLabel({
      name: '<script>alert(1)</script>',
      short_code: 'A&B',
      qr_token: 'token"quote'
    });

    expect(write).toHaveBeenCalled();
    const html = String(write.mock.calls[0][0]);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('A&amp;B');
    expect(html).toContain('token&quot;quote');
    expect(html).toContain('https://api.qrserver.com/v1/create-qr-code/');
  });

  it('does nothing when popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(() =>
      service.printLabel({ name: 'Box', short_code: 'A1', qr_token: 'token' })
    ).not.toThrow();
  });
});
