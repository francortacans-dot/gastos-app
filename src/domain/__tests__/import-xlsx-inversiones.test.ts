import * as XLSX from 'xlsx';
import { parsearXlsxInversiones } from '../import-xlsx-inversiones';

function xlsxDeFilas(filas: (string | number)[][]): Uint8Array {
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Hoja1');
  const base64 = XLSX.write(libro, { type: 'base64', bookType: 'xlsx' });
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

describe('parsearXlsxInversiones', () => {
  it('parsea posiciones válidas de la primera hoja', () => {
    const bytes = xlsxDeFilas([
      ['ticker', 'nominales', 'precio', 'moneda', 'rubro', 'fecha'],
      ['BMA', 10, 9.42, 'ARS', 'Bancos-ARG', '2026-08-11'],
    ]);

    const { posiciones, errores } = parsearXlsxInversiones(bytes, '2026-09-08');

    expect(errores).toEqual([]);
    expect(posiciones).toEqual([
      { ticker: 'BMA', nominales: 10, ppc: 9.42, monedaOriginal: 'ARS', rubro: 'Bancos-ARG', fecha: '2026-08-11' },
    ]);
  });

  it('usa la fecha de hoy cuando la columna fecha viene vacía', () => {
    const bytes = xlsxDeFilas([
      ['ticker', 'nominales', 'precio', 'moneda'],
      ['GGAL', 5, 100, 'ARS'],
    ]);

    const { posiciones } = parsearXlsxInversiones(bytes, '2026-09-08');

    expect(posiciones[0].fecha).toBe('2026-09-08');
  });

  it('reporta error cuando faltan columnas requeridas', () => {
    const bytes = xlsxDeFilas([['ticker', 'nominales']]);

    const { posiciones, errores } = parsearXlsxInversiones(bytes, '2026-09-08');

    expect(posiciones).toEqual([]);
    expect(errores[0].motivo).toMatch(/Faltan columnas/);
  });

  it('reconoce y remapea el export "Mis Instrumentos" de IOL', () => {
    const bytes = xlsxDeFilas([
      [
        'Ticker',
        'Tipo de Instrumento',
        'Descripcion',
        'Nominales',
        'Garantías',
        'Precio',
        'Fecha',
        'Porcentaje de tenencia',
        'Precio promedio de compra',
        'Valor actual',
        'Valor inicial',
        'Rendimiento',
        'Variación (%)',
        'Porcentaje de rendimiento',
        'Días promedio de tenencia',
        'TNA',
        'Moneda',
      ],
      ['BMA', 'Acciones', 'BANCO MACRO S.A."B" 1 V. ESCRIT', 10, 0, 8.12, '11:54', 1.7, 9.42, 81, 94, -13, '-0.12 (-1.42%)', -13.8, 40, '-125.93%', 'Pesos'],
      ['XLU', 'Cedears', 'CEDEAR UTILITIES SELECT SECTOR SPDR FUND', 32, 0, 3.015, '11:53', 2.03, 3.156875, 96, 101, -5, '+0.01 (0.34%)', -4.49, 123, '-13.34%', 'Dólares'],
    ]);

    const { posiciones, errores } = parsearXlsxInversiones(bytes, '2026-09-08');

    expect(errores).toEqual([]);
    expect(posiciones).toEqual([
      { ticker: 'BMA', nominales: 10, ppc: 9.42, monedaOriginal: 'ARS', rubro: 'Acciones', fecha: '2026-09-08' },
      { ticker: 'XLU', nominales: 32, ppc: 3.156875, monedaOriginal: 'USD', rubro: 'Cedears', fecha: '2026-09-08' },
    ]);
  });
});
