import { calcularAngulos } from '../pie-chart-math';

describe('calcularAngulos', () => {
  it('reparte 360 grados proporcionalmente al valor de cada porción', () => {
    const resultado = calcularAngulos([
      { etiqueta: 'Ocio', valor: 50, color: '#16a97e' },
      { etiqueta: 'Vacaciones', valor: 50, color: '#2563eb' },
    ]);

    expect(resultado[0].porcentaje).toBeCloseTo(50);
    expect(resultado[0].anguloInicio).toBe(0);
    expect(resultado[0].anguloFin).toBe(180);
    expect(resultado[1].anguloInicio).toBe(180);
    expect(resultado[1].anguloFin).toBe(360);
  });

  it('ignora las porciones de valor 0', () => {
    const resultado = calcularAngulos([
      { etiqueta: 'Ocio', valor: 100, color: '#16a97e' },
      { etiqueta: 'Vacío', valor: 0, color: '#2563eb' },
    ]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].etiqueta).toBe('Ocio');
  });

  it('devuelve un array vacío si el total es 0', () => {
    expect(calcularAngulos([{ etiqueta: 'Ocio', valor: 0, color: '#16a97e' }])).toEqual([]);
  });

  it('con tres porciones desiguales, los ángulos son consecutivos y suman 360', () => {
    const resultado = calcularAngulos([
      { etiqueta: 'A', valor: 25, color: '#111' },
      { etiqueta: 'B', valor: 25, color: '#222' },
      { etiqueta: 'C', valor: 50, color: '#333' },
    ]);

    expect(resultado[0].anguloInicio).toBe(0);
    expect(resultado[2].anguloFin).toBe(360);
    expect(resultado[1].anguloInicio).toBe(resultado[0].anguloFin);
    expect(resultado[2].anguloInicio).toBe(resultado[1].anguloFin);
  });
});
