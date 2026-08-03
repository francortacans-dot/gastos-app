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
