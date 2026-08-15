import { DEFAULT_FEATURES, FEATURE_LABELS, sanitizeFeatureKey } from './features';

describe('admin ready menu release', () => {
  it('keeps the ready menu blocked for every new tenant', () => {
    expect(DEFAULT_FEATURES.ready_menu).toBe(false);
  });

  it('accepts only the canonical ready menu feature key', () => {
    expect(sanitizeFeatureKey('ready_menu')).toBe('ready_menu');
    expect(FEATURE_LABELS.ready_menu).toMatch(/admin/i);
  });
});
