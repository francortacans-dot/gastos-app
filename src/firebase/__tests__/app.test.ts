describe('getFirebaseApp', () => {
  it('lanza un error descriptivo si faltan variables de entorno', () => {
    const originales = { ...process.env };
    delete process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

    jest.resetModules();
    const { getFirebaseApp } = require('../app');

    expect(() => getFirebaseApp()).toThrow(/EXPO_PUBLIC_FIREBASE_API_KEY/);

    process.env = originales;
  });
});
