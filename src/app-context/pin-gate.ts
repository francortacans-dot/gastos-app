import { useState } from 'react';
import { hashPin, verificarPin } from '../auth/pin';

interface ParametrosPinGate {
  pinHashGuardado: string | null;
  guardarHash: (hash: string) => void | Promise<void>;
}

export function usePinGate({ pinHashGuardado, guardarHash }: ParametrosPinGate) {
  const [desbloqueado, setDesbloqueado] = useState(false);

  async function intentarDesbloquear(pin: string): Promise<boolean> {
    if (!pinHashGuardado) return false;
    const ok = await verificarPin(pin, pinHashGuardado);
    if (ok) setDesbloqueado(true);
    return ok;
  }

  async function guardarPin(pin: string): Promise<void> {
    const hash = await hashPin(pin);
    await guardarHash(hash);
    setDesbloqueado(true);
  }

  return { desbloqueado, pinGuardado: pinHashGuardado, intentarDesbloquear, guardarPin };
}
