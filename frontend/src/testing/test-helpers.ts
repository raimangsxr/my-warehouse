import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';

export function provideCommonTestProviders(extra: Array<Provider | EnvironmentProviders> = []) {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    {
      provide: MatSnackBar,
      useValue: {
        open: vi.fn(() => ({ onAction: () => ({ subscribe: vi.fn() }) })),
        dismiss: vi.fn()
      }
    },
    ...extra
  ];
}

export function configureServiceTest<T>(serviceType: new (...args: never[]) => T, extra: Array<Provider | EnvironmentProviders> = []) {
  TestBed.configureTestingModule({
    providers: [serviceType, provideRouter([]), ...provideCommonTestProviders(extra)]
  });
  return {
    service: TestBed.inject(serviceType),
    httpMock: TestBed.inject(HttpTestingController)
  };
}

export function flushHttp(httpMock: HttpTestingController): void {
  httpMock.verify();
}
