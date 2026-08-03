import * as Crypto from 'expo-crypto';

/** Un PIN válido son exactamente 4 dígitos numéricos. */
export function pinEsValido(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** Devuelve el hash SHA-256 del PIN, en hexadecimal. Nunca se guarda el PIN en texto plano. */
export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

export async function verificarPin(pin: string, hashGuardado: string): Promise<boolean> {
  const hashIngresado = await hashPin(pin);
  return hashIngresado === hashGuardado;
}
