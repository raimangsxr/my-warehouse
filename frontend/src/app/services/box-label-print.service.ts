import { Injectable } from '@angular/core';

import { Box } from './box.service';

type PrintableBox = Pick<Box, 'name' | 'short_code' | 'qr_token'>;

@Injectable({ providedIn: 'root' })
export class BoxLabelPrintService {
  private readonly qrServiceUrl = 'https://api.qrserver.com/v1/create-qr-code/';
  private readonly alignedContentWidthPx = 260;
  private readonly baseNameFontSizePx = 22;
  private readonly minNameFontSizePx = 18;
  private readonly maxNameFontSizePx = 96;

  printLabel(box: PrintableBox): void {
    const printWindow = window.open('', '_blank', 'width=420,height=640');
    if (!printWindow) {
      return;
    }

    const title = this.escapeHtml(box.name);
    const shortCode = this.escapeHtml(box.short_code);
    const qrToken = this.escapeHtml(box.qr_token);
    const qrImageUrl = this.escapeHtml(this.buildQrImageUrl(box.qr_token));
    const alignedContentWidth = `${this.alignedContentWidthPx}px`;

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Etiqueta ${shortCode}</title>
          <style>
            :root {
              color-scheme: light;
              font-family: "Roboto", "Helvetica Neue", Arial, sans-serif;
            }
            body {
              margin: 0;
              background: #f4f6fb;
              padding: 16px;
            }
            .label {
              width: 340px;
              margin: 0 auto;
              background: #fff;
              border: 1px solid #d7deea;
              border-radius: 14px;
              padding: 18px;
              box-sizing: border-box;
              text-align: center;
            }
            .label-main {
              width: min(100%, ${alignedContentWidth});
              margin: 0 auto;
            }
            .name {
              margin: 0 0 6px 0;
              width: 100%;
              font-size: ${this.baseNameFontSizePx}px;
              line-height: 1.05;
              color: #192338;
              white-space: nowrap;
            }
            .name-text {
              display: inline-block;
            }
            .code {
              margin: 0 0 14px 0;
              width: 100%;
              font-size: 15px;
              letter-spacing: 0.8px;
              color: #42536e;
            }
            .qr {
              width: 100%;
              aspect-ratio: 1;
              height: auto;
              object-fit: contain;
              margin: 0;
              display: block;
            }
            .token {
              width: min(100%, ${alignedContentWidth});
              margin: 12px auto 0;
              color: #5a6b86;
              font-size: 12px;
              word-break: break-all;
            }
            @media print {
              body {
                margin: 0;
                background: #fff;
                padding: 0;
              }
              .label {
                width: 100%;
                border: 0;
                border-radius: 0;
                padding: 10mm;
              }
            }
          </style>
        </head>
        <body>
          <article class="label">
            <div class="label-main">
              <h1 class="name"><span class="name-text">${title}</span></h1>
              <p class="code">Código: ${shortCode}</p>
              <img class="qr" src="${qrImageUrl}" alt="QR caja ${title}" referrerpolicy="no-referrer" />
            </div>
            <p class="token">Token QR: ${qrToken}</p>
          </article>
        </body>
      </html>
    `);
    printWindow.document.close();
    const fitName = () => this.fitNameToQrWidth(printWindow.document);
    printWindow.requestAnimationFrame(fitName);

    const triggerPrint = () => {
      fitName();
      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
      };
    };

    const qrImage = printWindow.document.querySelector('img.qr') as HTMLImageElement | null;
    if (qrImage && !qrImage.complete) {
      let printTriggered = false;
      const safeTrigger = () => {
        if (printTriggered) {
          return;
        }
        printTriggered = true;
        triggerPrint();
      };

      qrImage.addEventListener('load', safeTrigger, { once: true });
      qrImage.addEventListener('error', safeTrigger, { once: true });
      setTimeout(safeTrigger, 1200);
      return;
    }

    setTimeout(triggerPrint, 150);
  }

  private buildQrImageUrl(token: string): string {
    const params = new URLSearchParams({
      size: '280x280',
      data: token
    });
    return `${this.qrServiceUrl}?${params.toString()}`;
  }

  private fitNameToQrWidth(doc: Document): void {
    const nameElement = doc.querySelector<HTMLElement>('.name');
    const textElement = doc.querySelector<HTMLElement>('.name-text');
    const contentElement = doc.querySelector<HTMLElement>('.label-main');
    if (!nameElement || !textElement || !contentElement) {
      return;
    }

    const availableWidth = contentElement.clientWidth;
    if (!availableWidth) {
      return;
    }

    nameElement.style.whiteSpace = 'nowrap';
    nameElement.style.overflowWrap = 'normal';
    nameElement.style.fontSize = `${this.baseNameFontSizePx}px`;
    textElement.style.display = 'inline-block';

    const measuredWidth = textElement.getBoundingClientRect().width;
    if (!measuredWidth) {
      return;
    }

    let fittedFontSize = (this.baseNameFontSizePx * availableWidth) / measuredWidth;
    fittedFontSize = Math.max(this.minNameFontSizePx, Math.min(this.maxNameFontSizePx, fittedFontSize));
    nameElement.style.fontSize = `${fittedFontSize}px`;

    let iterations = 0;
    while (textElement.getBoundingClientRect().width > availableWidth && fittedFontSize > this.minNameFontSizePx && iterations < 40) {
      fittedFontSize -= 0.5;
      nameElement.style.fontSize = `${fittedFontSize}px`;
      iterations += 1;
    }

    if (textElement.getBoundingClientRect().width > availableWidth) {
      nameElement.style.whiteSpace = 'normal';
      nameElement.style.overflowWrap = 'anywhere';
      nameElement.style.fontSize = `${this.minNameFontSizePx}px`;
      nameElement.style.lineHeight = '1.1';
      textElement.style.display = 'inline';
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
