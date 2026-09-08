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
});
