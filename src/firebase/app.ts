import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  type Firestore,
} from 'firebase/firestore';
import { initializeAuth, getAuth, getReactNativePersistence, type Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const VARIABLES_REQUERIDAS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
] as const;

function leerConfiguracion() {
  for (const variable of VARIABLES_REQUERIDAS) {
    if (!process.env[variable]) {
      throw new Error(
        `Falta la variable de entorno ${variable}. Copiá .env.example a .env y completá las credenciales de Firebase.`
      );
    }
  }
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
  };
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(leerConfiguracion());
  }
  return app;
}

/**
 * En web, usa cache persistente en IndexedDB (offline real).
 * En nativo, Firestore JS SDK no soporta persistencia en disco: usa cache en
 * memoria y la Task 6 (cola local con expo-sqlite) cubre el offline real ahí.
 */
export function getFirestoreDb(): Firestore {
  if (!db) {
    db = initializeFirestore(getFirebaseApp(), {
      localCache: Platform.OS === 'web' ? persistentLocalCache({}) : memoryLocalCache(),
    });
  }
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth =
      Platform.OS === 'web'
        ? getAuth(getFirebaseApp())
        : initializeAuth(getFirebaseApp(), {
            persistence: getReactNativePersistence(AsyncStorage),
          });
  }
  return auth;
}
