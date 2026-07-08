import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { routes } from '../app/routes';
import { provideCommonTestProviders } from './test-helpers';

export function createActivatedRouteMock(
  params: Record<string, string> = {},
  queryParams: Record<string, string> = {}
) {
  const paramMap = convertToParamMap(params);
  const queryParamMap = convertToParamMap(queryParams);

  return {
    snapshot: { paramMap, queryParamMap },
    paramMap: of(paramMap),
    queryParamMap: of(queryParamMap)
  };
}

export async function createStandaloneComponent<T>(
  component: Type<T>,
  extraProviders: Parameters<typeof provideCommonTestProviders>[0] = []
): Promise<ComponentFixture<T>> {
  await TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideRouter(routes),
      ...provideCommonTestProviders(extraProviders),
      {
        provide: ActivatedRoute,
        useValue: createActivatedRouteMock()
      }
    ]
  }).compileComponents();

  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return fixture;
}
