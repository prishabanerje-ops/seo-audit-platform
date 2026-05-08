// backend/__tests__/checks/s15-images.test.js
import { describe, it, expect } from 'vitest';
import { runImageChecks } from '../../services/checks/s15-images.js';

const page = (images) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  _images: images,
});

describe('runImageChecks', () => {
  it('passes for image with good alt text', () => {
    const r = runImageChecks([page([{ src: 'https://example.com/hero.webp', alt: 'Hero image showing car insurance', missing: false, fileSizeBytes: 50000 }])], {});
    expect(r).toHaveLength(0);
  });
  it('flags img_alt_missing for image with no alt attribute', () => {
    const r = runImageChecks([page([{ src: 'https://example.com/img.png', alt: undefined, missing: true }])], {});
    expect(r.some(x => x.check_id === 'img_alt_missing')).toBe(true);
  });
  it('flags img_alt_descriptive for generic alt like "image"', () => {
    const r = runImageChecks([page([{ src: 'https://example.com/img.png', alt: 'image', missing: false }])], {});
    expect(r.some(x => x.check_id === 'img_alt_descriptive')).toBe(true);
  });
  it('flags img_file_size for image > 200KB', () => {
    const r = runImageChecks([page([{ src: 'https://example.com/big.jpg', alt: 'A good alt', missing: false, fileSizeBytes: 300000 }])], {});
    expect(r.some(x => x.check_id === 'img_file_size')).toBe(true);
  });
  it('flags img_broken for 4xx image', () => {
    const r = runImageChecks([page([{ src: 'https://example.com/broken.png', alt: 'alt', missing: false, statusCode: 404 }])], {});
    expect(r.some(x => x.check_id === 'img_broken')).toBe(true);
  });
});
