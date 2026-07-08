import { describe, expect, it } from 'vitest';

import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { ItemListComponent } from './item-list.component';

describe('ItemListComponent', () => {
  it('should create', async () => {
    const fixture = await createStandaloneComponent(ItemListComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
