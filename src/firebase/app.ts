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

function faltaVariable(nombre: string): never {
  throw new Error(
    `Falta la variable de entorno ${nombre}. Copiá .env.example a .env y completá las credenciales de Firebase.`
  );
}

/**
 * Metro solo inlinea en el build de producción los accesos ESTÁTICOS del
 * tipo `process.env.EXPO_PUBLIC_X`. Un `process.env[variable]` dinámico
 * (ej. dentro de un for-of sobre un array de nombres) no se reemplaza y
 * queda `undefined` en runtime, tirando siempre este error aunque el
 * `.env` esté bien completado. Por eso cada variable se lee con su propio
 * acceso estático en vez de iterar un array de nombres.
 */
function leerConfiguracion() {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? faltaVariable('EXPO_PUBLIC_FIREBASE_API_KEY');
  const authDomain =
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? faltaVariable('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN');
  const projectId =
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? faltaVariable('EXPO_PUBLIC_FIREBASE_PROJECT_ID');
  const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? faltaVariable('EXPO_PUBLIC_FIREBASE_APP_ID');

  return { apiKey, authDomain, projectId, appId };
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
