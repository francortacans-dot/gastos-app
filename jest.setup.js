// Silencia el warning de act() de React Native en los tests
global.__DEV__ = true;

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
}));

jest.mock('firebase/firestore', () => ({
  initializeFirestore: jest.fn(),
  memoryLocalCache: jest.fn(),
  persistentLocalCache: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(),
  getAuth: jest.fn(),
  getReactNativePersistence: jest.fn(),
}));

// Implementación mínima en memoria: alcanza para los tests que efectivamente
// leen/escriben (ej. persistencia del desbloqueo del PIN), y no rompe a los
// que solo necesitan que el import no explote. Se limpia después de cada test
// (ver afterEach abajo) para que un test no filtre estado al siguiente.
jest.mock('@react-native-async-storage/async-storage', () => {
  const almacen = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((clave) => Promise.resolve(almacen.has(clave) ? almacen.get(clave) : null)),
      setItem: jest.fn((clave, valor) => {
        almacen.set(clave, valor);
        return Promise.resolve();
      }),
      removeItem: jest.fn((clave) => {
        almacen.delete(clave);
        return Promise.resolve();
      }),
      __limpiarParaTests: () => almacen.clear(),
    },
  };
});

afterEach(() => {
  require('@react-native-async-storage/async-storage').default.__limpiarParaTests();
});
