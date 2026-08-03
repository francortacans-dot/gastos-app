export interface Porcion {
  etiqueta: string;
  valor: number;
  color: string;
}

export interface PorcionConAngulo {
  etiqueta: string;
  color: string;
  porcentaje: number;
  anguloInicio: number;
  anguloFin: number;
}

/** Convierte un listado de porciones (con su valor absoluto) en ángulos de 0 a 360. */
export function calcularAngulos(porciones: Porcion[]): PorcionConAngulo[] {
  const total = porciones.reduce((acc, p) => acc + p.valor, 0);
  if (total <= 0) return [];

  let anguloActual = 0;
  const resultado: PorcionConAngulo[] = [];

  for (const porcion of porciones) {
    if (porcion.valor <= 0) continue;
    const porcentaje = (porcion.valor / total) * 100;
    const anguloInicio = anguloActual;
    const anguloFin = anguloActual + (porcion.valor / total) * 360;
    resultado.push({ etiqueta: porcion.etiqueta, color: porcion.color, porcentaje, anguloInicio, anguloFin });
    anguloActual = anguloFin;
  }

  return resultado;
}
