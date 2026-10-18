// precioUnitario.js
// El texto del precio por unidad que muestra PrecioNormalizado. Peso y volumen
// salen en $/kg y $/L, sin decimales; el resto ($/m, $/unidad (pack xN)) sale
// como hasta ahora: el label del backend y el monto con hasta 2 decimales.
//
// JS puro, sin JSX, para poder verificarlo con node.

// unidad_base → [factor desde precio_base (1 g o 1 ml), sufijo]
export const ESCALA_UI = { g: [1000, "/kg"], ml: [1000, "/L"] };

export function partesPrecioUnitario(p) {
  const escala = ESCALA_UI[p.unidad_base];
  if (escala) {
    const [factor, sufijo] = escala;
    // valor es el precio de 100 g o 100 ml: × 10 da el de 1 kg o 1 L.
    const v = p.precio_base != null ? p.precio_base * factor : p.valor * 10;
    return "$" + Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(v) + sufijo;
  }
  return `${p.label} $${p.valor.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}
