import { MAX_UPLOAD_BYTES, checkFile } from './gallery';

const fileOf = (type: string, size: number) =>
  new File([new Uint8Array(size)], 'pet', { type });

describe('checkFile', () => {
  it('accepts a JPEG and a PNG under 5 MB', () => {
    expect(checkFile(fileOf('image/jpeg', 1000))).toBeNull();
    expect(checkFile(fileOf('image/png', 1000))).toBeNull();
  });

  it('rejects other types', () => {
    expect(checkFile(fileOf('image/gif', 1000))).toBe('Only JPEG and PNG images are allowed.');
  });

  it('rejects files over 5 MB', () => {
    expect(checkFile(fileOf('image/png', MAX_UPLOAD_BYTES + 1))).toContain('too large');
  });

  it('rejects empty files', () => {
    expect(checkFile(fileOf('image/png', 0))).toBe('That file is empty.');
  });
});
