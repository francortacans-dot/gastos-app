import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  linkWithCredential,
  reauthenticateWithCredential,
  updatePassword,
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

/** Requiere reautenticación reciente: pide la contraseña actual antes de cambiarla. */
export async function cambiarContrasena(passwordActual: string, passwordNueva: string): Promise<void> {
  const usuario = getFirebaseAuth().currentUser;
  if (!usuario || !usuario.email) throw new Error('No hay una sesión con email activa.');
  await reauthenticateWithCredential(usuario, EmailAuthProvider.credential(usuario.email, passwordActual));
  await updatePassword(usuario, passwordNueva);
}

/** Reautentica con la contraseña de la cuenta. Se usa para "olvidé mi PIN". */
export async function reautenticar(password: string): Promise<void> {
  const usuario = getFirebaseAuth().currentUser;
  if (!usuario || !usuario.email) throw new Error('No hay una sesión con email activa.');
  await reauthenticateWithCredential(usuario, EmailAuthProvider.credential(usuario.email, password));
}
