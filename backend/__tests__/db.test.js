const { getConfig, setConfig, encrypt, decrypt } = require('../db');

describe('Config helpers', () => {
  it('should set and get config values', () => {
    setConfig('test_key', 'test_value');
    expect(getConfig('test_key')).toBe('test_value');
  });

  it('should return fallback when key does not exist', () => {
    expect(getConfig('nonexistent_key', 'default')).toBe('default');
  });

  it('should return null fallback by default', () => {
    expect(getConfig('another_nonexistent')).toBeNull();
  });

  it('should overwrite existing config values', () => {
    setConfig('overwrite_key', 'first');
    expect(getConfig('overwrite_key')).toBe('first');
    setConfig('overwrite_key', 'second');
    expect(getConfig('overwrite_key')).toBe('second');
  });

  it('should convert non-string values to string', () => {
    setConfig('num_key', 42);
    expect(getConfig('num_key')).toBe('42');
  });
});

describe('Encryption helpers', () => {
  it('should encrypt and decrypt a string', () => {
    const plaintext = 'my-secret-password';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(':');
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('should return empty string for empty input', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  it('should handle null/undefined gracefully', () => {
    expect(encrypt(null)).toBe('');
    expect(encrypt(undefined)).toBe('');
    expect(decrypt(null)).toBe('');
    expect(decrypt(undefined)).toBe('');
  });

  it('should produce different ciphertexts for same plaintext (random IV)', () => {
    const a = encrypt('same-input');
    const b = encrypt('same-input');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same-input');
    expect(decrypt(b)).toBe('same-input');
  });

  it('should return blob as-is if decryption fails (legacy plain-text)', () => {
    expect(decrypt('not-encrypted')).toBe('not-encrypted');
  });

  it('should handle special characters', () => {
    const special = 'p@$$w0rd!#%^&*()_+-=[]{}|;:,.<>?';
    expect(decrypt(encrypt(special))).toBe(special);
  });

  it('should handle unicode', () => {
    const unicode = '密码пароль🔑';
    expect(decrypt(encrypt(unicode))).toBe(unicode);
  });
});
