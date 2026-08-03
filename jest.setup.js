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

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {},
}));

// El mock automático de jest-expo para expo-crypto devuelve randomUUID() = undefined
// (ver node_modules/expo-crypto/mocks/ExpoCrypto.ts), así que lo pisamos acá con la
// implementación real de Node para que los repos que generan ids con Crypto.randomUUID()
// tengan ids reales y únicos en los tests.
jest.mock('expo-crypto', () => ({
  __esModule: true,
  randomUUID: () => require('node:crypto').randomUUID(),
}));
