import { importarInversiones } from '../importar-inversiones';
import type { Repos } from '../create-repo';
import type { Investment } from '../../domain/types';
import type { PosicionImportada } from '../../domain/import-csv-inversiones';

function posicion(parcial: Partial<PosicionImportada> = {}): PosicionImportada {
  return {
    ticker: 'GGAL',
    nominales: 10,
    ppc: 5500,
    monedaOriginal: 'ARS',
    rubro: null,
    fecha: '2026-06-01',
    ...parcial,
  };
}

function crearReposFake() {
  const guardadas: Omit<Investment, 'id'>[] = [];
  let contador = 0;

  const repos = {
    investments: {
      agregar: jest.fn(async (inversion: Omit<Investment, 'id'>) => {
        guardadas.push(inversion);
        contador += 1;
        return { ...inversion, id: `inv${contador}` };
      }),
    },
  };

  return { repos: repos as unknown as Repos, guardadas };
}

describe('importarInversiones', () => {
  it('guarda cada posición en ARS como Investment OPEN, sin cotización', async () => {
    const { repos, guardadas } = crearReposFake();

    const resultado = await importarInversiones(repos, [posicion({ ticker: 'GGAL' })], null);

    expect(resultado.creadas).toHaveLength(1);
    expect(resultado.errores).toHaveLength(0);
    expect(guardadas[0]).toMatchObject({ ticker: 'GGAL', monedaOriginal: 'ARS', cotizacionUsada: null, status: 'OPEN' });
  });

  it('guarda posiciones en USD usando la cotización actual', async () => {
    const { repos, guardadas } = crearReposFake();
    const posiciones = [posicion({ ticker: 'AAPL', ppc: 180, monedaOriginal: 'USD' })];

    const resultado = await importarInversiones(repos, posiciones, 1500);

    expect(resultado.creadas).toHaveLength(1);
    expect(guardadas[0].cotizacionUsada).toBe(1500);
    // 180 USD * 1500 * 100 centavos = 27000000 centavos ARS por nominal
    expect(guardadas[0].costoCentavosArsUnitario).toBe(27000000);
  });

  it('reporta como error las filas en USD si no hay cotización disponible, sin bloquear las de ARS', async () => {
    const { repos, guardadas } = crearReposFake();
    const posiciones = [
      posicion({ ticker: 'GGAL', monedaOriginal: 'ARS' }),
      posicion({ ticker: 'AAPL', monedaOriginal: 'USD' }),
    ];

    const resultado = await importarInversiones(repos, posiciones, null);

    expect(resultado.creadas).toHaveLength(1);
    expect(guardadas).toHaveLength(1);
    expect(resultado.errores).toHaveLength(1);
    expect(resultado.errores[0].posicion.ticker).toBe('AAPL');
  });

  it('lista vacía no llama al repo y devuelve resultado vacío', async () => {
    const { repos, guardadas } = crearReposFake();

    const resultado = await importarInversiones(repos, [], null);

    expect(resultado.creadas).toHaveLength(0);
    expect(resultado.errores).toHaveLength(0);
    expect(guardadas).toHaveLength(0);
  });
});
