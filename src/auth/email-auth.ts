import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  linkWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { getFirebaseAuth } from '../firebase/app';

export async function iniciarSesion(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

/**
 * Si ya hay una sesión anónima activa en este dispositivo, vincula el email
 * a esa cuenta (mismo uid, se conservan los datos ya cargados). Si no hay
 * sesión, crea una cuenta nueva desde cero.
 */
export async function crearCuenta(email: string, password: string): Promise<void> {
  const auth = getFirebaseAuth();
  const actual = auth.currentUser;
  if (actual && actual.isAnonymous) {
    await linkWithCredential(actual, EmailAuthProvider.credential(email, password));
  } else {
    await createUserWithEmailAndPassword(auth, email, password);
  }
}

export async function recuperarContrasena(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}
