import { parsearCsvInversiones } from '../import-csv-inversiones';

describe('parsearCsvInversiones', () => {
  it('parsea filas válidas en ARS y USD', () => {
    const csv = [
      'ticker,nominales,precio,moneda,rubro,fecha',
      'GGAL,10,5500,ARS,Bancos,2026-01-15',
      'AAPL,3,180,USD,Tech,2026-02-01',
    ].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.posiciones).toEqual([
      { ticker: 'GGAL', nominales: 10, ppc: 5500, monedaOriginal: 'ARS', rubro: 'Bancos', fecha: '2026-01-15' },
      { ticker: 'AAPL', nominales: 3, ppc: 180, monedaOriginal: 'USD', rubro: 'Tech', fecha: '2026-02-01' },
    ]);
  });

  it('acepta rubro y fecha vacíos, usando fechaHoy y rubro null', () => {
    const csv = ['ticker,nominales,precio,moneda,rubro,fecha', 'GGAL,10,5500,ARS,,'].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.posiciones[0]).toEqual({
      ticker: 'GGAL',
      nominales: 10,
      ppc: 5500,
      monedaOriginal: 'ARS',
      rubro: null,
      fecha: '2026-06-01',
    });
  });

  it('funciona sin columnas rubro/fecha en el encabezado', () => {
    const csv = ['ticker,nominales,precio,moneda', 'GGAL,10,5500,ARS'].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.posiciones[0]).toEqual({
      ticker: 'GGAL',
      nominales: 10,
      ppc: 5500,
      monedaOriginal: 'ARS',
      rubro: null,
      fecha: '2026-06-01',
    });
  });

  it('reporta fila con ticker faltante sin abortar el resto', () => {
    const csv = [
      'ticker,nominales,precio,moneda',
      ',10,5500,ARS',
      'AAPL,3,180,USD',
    ].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.posiciones).toHaveLength(1);
    expect(resultado.posiciones[0].ticker).toBe('AAPL');
    expect(resultado.errores).toEqual([{ fila: 2, motivo: 'Falta el ticker' }]);
  });

  it('reporta nominales inválidos (cero, negativo o no numérico)', () => {
    const csv = [
      'ticker,nominales,precio,moneda',
      'GGAL,0,5500,ARS',
      'AAPL,abc,180,USD',
    ].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.posiciones).toHaveLength(0);
    expect(resultado.errores).toEqual([
      { fila: 2, motivo: 'Nominales inválidos' },
      { fila: 3, motivo: 'Nominales inválidos' },
    ]);
  });

  it('reporta precio inválido', () => {
    const csv = ['ticker,nominales,precio,moneda', 'GGAL,10,0,ARS'].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.posiciones).toHaveLength(0);
    expect(resultado.errores).toEqual([{ fila: 2, motivo: 'Precio inválido' }]);
  });

  it('reporta moneda inválida', () => {
    const csv = ['ticker,nominales,precio,moneda', 'GGAL,10,5500,EUR'].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.posiciones).toHaveLength(0);
    expect(resultado.errores).toEqual([{ fila: 2, motivo: 'Moneda inválida (debe ser ARS o USD)' }]);
  });

  it('reporta fecha con formato inválido', () => {
    const csv = ['ticker,nominales,precio,moneda,rubro,fecha', 'GGAL,10,5500,ARS,,15/01/2026'].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.posiciones).toHaveLength(0);
    expect(resultado.errores).toEqual([{ fila: 2, motivo: 'Fecha inválida (formato YYYY-MM-DD)' }]);
  });

  it('reporta columnas requeridas faltantes en el encabezado, sin parsear filas', () => {
    const csv = ['ticker,nominales,moneda', 'GGAL,10,ARS'].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.posiciones).toHaveLength(0);
    expect(resultado.errores).toEqual([{ fila: 1, motivo: 'Faltan columnas: precio' }]);
  });

  it('ignora líneas vacías y espacios de más', () => {
    const csv = [
      'ticker,nominales,precio,moneda',
      '',
      '  GGAL , 10 , 5500 , ARS  ',
      '',
    ].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.posiciones).toHaveLength(1);
    expect(resultado.posiciones[0].ticker).toBe('GGAL');
  });

  it('csv vacío devuelve listas vacías sin lanzar', () => {
    expect(parsearCsvInversiones('', '2026-06-01')).toEqual({ posiciones: [], errores: [] });
  });
});
