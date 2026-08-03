import { obtenerCotizacion, obtenerCotizacionConCache } from '../dolar';
import type { RateCache } from '../dolar';

const respuestaOficialMock = {
  moneda: 'USD',
  casa: 'oficial',
  nombre: 'Oficial',
  compra: 1465,
  venta: 1515,
  fechaActualizacion: '2026-08-03T13:00:00.000Z',
};

describe('obtenerCotizacion', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('pide la cotización oficial a la URL correcta y la normaliza', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => respuestaOficialMock,
    });

    const resultado = await obtenerCotizacion('oficial');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://dolarapi.com/v1/dolares/oficial',
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(resultado).toEqual({
      casa: 'oficial',
      compra: 1465,
      venta: 1515,
      fechaActualizacion: '2026-08-03T13:00:00.000Z',
    });
  });

  it('pide la cotización blue a la URL correcta', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...respuestaOficialMock, casa: 'blue' }),
    });

    await obtenerCotizacion('blue');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://dolarapi.com/v1/dolares/blue',
      expect.anything()
    );
  });

  it('lanza un error si la respuesta no es ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(obtenerCotizacion('oficial')).rejects.toThrow();
  });
});

describe('obtenerCotizacionConCache', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  function crearCacheFake(inicial: Record<string, any> = {}): RateCache & { datos: Record<string, any> } {
    const datos = { ...inicial };
    return {
      datos,
      async guardar(c) {
        datos[c.casa] = c;
      },
      async leer(casa) {
        return datos[casa] ?? null;
      },
    };
  }

  it('si la red responde, guarda en cache y devuelve el valor fresco', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => respuestaOficialMock,
    });
    const cache = crearCacheFake();

    const resultado = await obtenerCotizacionConCache('oficial', cache);

    expect(resultado.venta).toBe(1515);
    expect(cache.datos.oficial.venta).toBe(1515);
  });

  it('si la red falla, devuelve el último valor cacheado', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('sin conexión'));
    const cache = crearCacheFake({
      oficial: { casa: 'oficial', compra: 1000, venta: 1050, fechaActualizacion: '2026-07-01T00:00:00.000Z' },
    });

    const resultado = await obtenerCotizacionConCache('oficial', cache);

    expect(resultado.venta).toBe(1050);
  });

  it('si la red falla y no hay cache, propaga el error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('sin conexión'));
    const cache = crearCacheFake();

    await expect(obtenerCotizacionConCache('oficial', cache)).rejects.toThrow();
  });
});
