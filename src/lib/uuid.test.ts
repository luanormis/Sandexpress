import { isCanonicalUuid } from './uuid';

describe('uuid helpers', () => {
  it('accepts canonical UUID values regardless of version nibble', () => {
    expect(isCanonicalUuid('018f4c2a-7b6d-7c8e-9f10-123456789abc')).toBe(true);
    expect(isCanonicalUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects non UUID values', () => {
    expect(isCanonicalUuid('guarda-sol-5')).toBe(false);
    expect(isCanonicalUuid('018f4c2a-7b6d-7c8e-zf10-123456789abc')).toBe(false);
  });
});
