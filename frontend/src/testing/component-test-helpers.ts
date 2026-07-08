import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { routes } from '../app/routes';
import { provideCommonTestProviders } from './test-helpers';

type ComponentType = new (...args: never[]) => unknown;

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
  component: ComponentType,
  extraProviders: Parameters<typeof provideCommonTestProviders>[0] = []
) {
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

  const fixture = TestBed.createComponent(component as never);
  fixture.detectChanges();
  return fixture;
}
