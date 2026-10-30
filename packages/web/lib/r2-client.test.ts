import { isOwnedUploadKey } from './r2-client';

describe('isOwnedUploadKey', () => {
  it('accepts the caller\'s own upload keys', () => {
    expect(isOwnedUploadKey('uploads/user_1/abc-123-note.pdf', 'user_1')).toBe(true);
  });

  it('rejects another user\'s key, even with a similar prefix', () => {
    expect(isOwnedUploadKey('uploads/user_2/abc-note.pdf', 'user_1')).toBe(false);
    expect(isOwnedUploadKey('uploads/user_10/abc-note.pdf', 'user_1')).toBe(false);
  });

  it('rejects keys outside uploads/, empty names and non-strings', () => {
    expect(isOwnedUploadKey('other/user_1/abc.pdf', 'user_1')).toBe(false);
    expect(isOwnedUploadKey('uploads/user_1/', 'user_1')).toBe(false);
    expect(isOwnedUploadKey(undefined, 'user_1')).toBe(false);
    expect(isOwnedUploadKey(42, 'user_1')).toBe(false);
    expect(isOwnedUploadKey('uploads/user_1/abc.pdf', '')).toBe(false);
  });

  it('rejects path tricks and very long keys', () => {
    expect(isOwnedUploadKey('uploads/user_1/../user_2/abc.pdf', 'user_1')).toBe(false);
    expect(isOwnedUploadKey('uploads/user_1/./abc.pdf', 'user_1')).toBe(false);
    expect(isOwnedUploadKey(`uploads/user_1/${'a'.repeat(2000)}`, 'user_1')).toBe(false);
  });
});
