// PrecioNormalizado.jsx
// Muestra el precio por unidad de contenido ($/kg, $/L, $/m, $/unidad (pack xN))
// y, en el title, la descripción del producto que representa al ítem en esa cadena.
//
// Props:
//   precioUnit: dict que devuelve el backend en "precio_por_100u"
//               { valor, tipo, label, desc_ganadora, cantidad_base } | null

import { partesPrecioUnitario } from "../precioUnitario";

export function PrecioNormalizado({ precioUnit, className = "" }) {
  if (!precioUnit || precioUnit.valor == null) return null;

  const { desc_ganadora } = precioUnit;

  return (
    <span
      className={`precio-normalizado ${className}`}
      title={desc_ganadora ? `Producto: ${desc_ganadora}` : undefined}
    >
      {partesPrecioUnitario(precioUnit)}
    </span>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// CantidadPackSelector.jsx (inline, exportar por separado si preferís)
// Selector de cantidad interna para ítems de tipo "pack" (huevos, papel, etc.)
//
// Uso en BasketScreen cuando unidad === "pack":
//   <CantidadPackSelector
//     opciones={[6, 12, 20, 30]}
//     valor={item.cantidad_pack}
//     onChange={(n) => actualizarItem({ ...item, cantidad_pack: n })}
//   />
// ─────────────────────────────────────────────────────────────────────────────

export function CantidadPackSelector({ opciones = [6, 12, 20, 30], valor, onChange }) {
  return (
    <div className="cantidad-pack-selector">
      <span className="cantidad-pack-label">Unidades por pack:</span>
      <div className="cantidad-pack-options">
        {opciones.map((n) => (
          <button
            key={n}
            type="button"
            className={`cantidad-pack-btn ${valor === n ? "active" : ""}`}
            onClick={() => onChange(valor === n ? null : n)}  // toggle: click en activo lo deselecciona
          >
            ×{n}
          </button>
        ))}
      </div>
    </div>
  );
}
