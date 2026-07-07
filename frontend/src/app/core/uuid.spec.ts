import { describe, expect, it } from 'vitest';

import { generateUuid } from './uuid';

describe('generateUuid', () => {
  it('returns a RFC-4122 style UUID string', () => {
    const uuid = generateUuid();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('returns unique values on successive calls', () => {
    const first = generateUuid();
    const second = generateUuid();
    expect(first).not.toBe(second);
  });
});
