import { hashPin, pinEsValido, verificarPin } from '../pin';

// El mock automático de jest-expo para expo-crypto devuelve valores vacíos/rotos
// para digestStringAsync (no un hash SHA-256 real), así que lo pisamos acá con la
// implementación real de Node. Mock local (no global) para no afectar otros tests.
jest.mock('expo-crypto', () => ({
  __esModule: true,
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
  digestStringAsync: (algorithm: string, str: string) => {
    if (algorithm !== 'SHA256') {
      throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
    return Promise.resolve(
      require('node:crypto')
        .createHash('sha256')
        .update(str)
        .digest('hex')
    );
  },
}));

describe('pinEsValido', () => {
  it('acepta un PIN de 4 dígitos', () => {
    expect(pinEsValido('1234')).toBe(true);
  });

  it('rechaza menos de 4 dígitos', () => {
    expect(pinEsValido('123')).toBe(false);
  });

  it('rechaza más de 4 dígitos', () => {
    expect(pinEsValido('12345')).toBe(false);
  });

  it('rechaza caracteres no numéricos', () => {
    expect(pinEsValido('12ab')).toBe(false);
  });
});

describe('hashPin y verificarPin', () => {
  it('un PIN correcto verifica contra su propio hash', async () => {
    const hash = await hashPin('4269');
    await expect(verificarPin('4269', hash)).resolves.toBe(true);
  });

  it('un PIN incorrecto no verifica', async () => {
    const hash = await hashPin('4269');
    await expect(verificarPin('0000', hash)).resolves.toBe(false);
  });

  it('el hash de PINes distintos es distinto', async () => {
    const hashA = await hashPin('1111');
    const hashB = await hashPin('2222');
    expect(hashA).not.toBe(hashB);
  });
});
