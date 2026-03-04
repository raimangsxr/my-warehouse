import { Injectable } from '@angular/core';

import { Box } from './box.service';

type PrintableBox = Pick<Box, 'name' | 'short_code' | 'qr_token'>;

@Injectable({ providedIn: 'root' })
export class BoxLabelPrintService {
  private readonly qrServiceUrl = 'https://api.qrserver.com/v1/create-qr-code/';

  printLabel(box: PrintableBox): void {
    const printWindow = window.open('', '_blank', 'width=420,height=640');
    if (!printWindow) {
      return;
    }

    const title = this.escapeHtml(box.name);
    const shortCode = this.escapeHtml(box.short_code);
    const qrToken = this.escapeHtml(box.qr_token);
    const qrImageUrl = this.escapeHtml(this.buildQrImageUrl(box.qr_token));

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
            .name {
              margin: 0 0 6px 0;
              font-size: 22px;
              line-height: 1.2;
              color: #192338;
            }
            .code {
              margin: 0 0 14px 0;
              font-size: 15px;
              letter-spacing: 0.8px;
              color: #42536e;
            }
            .qr {
              width: 260px;
              height: 260px;
              object-fit: contain;
              margin: 0 auto;
              display: block;
            }
            .token {
              margin: 12px 0 0 0;
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
            <h1 class="name">${title}</h1>
            <p class="code">Código: ${shortCode}</p>
            <img class="qr" src="${qrImageUrl}" alt="QR caja ${title}" referrerpolicy="no-referrer" />
            <p class="token">Token QR: ${qrToken}</p>
          </article>
        </body>
      </html>
    `);
    printWindow.document.close();

    const triggerPrint = () => {
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

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
