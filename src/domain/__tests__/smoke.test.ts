describe('configuración de tests', () => {
  it('corre TypeScript correctamente', () => {
    const suma = (a: number, b: number): number => a + b;
    expect(suma(2, 2)).toBe(4);
  });
});
