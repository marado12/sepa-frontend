// PrecioNormalizado.jsx
// Muestra el precio normalizado por unidad base con su label ($/100g, $/100ml, $/unidad)
// y la descripción del producto ganador en el SEPA.
//
// Props:
//   precioUnit: dict que devuelve el backend en "precio_por_100u"
//               { valor, tipo, label, desc_ganadora, cantidad_base } | null

export function PrecioNormalizado({ precioUnit, className = "" }) {
  if (!precioUnit || precioUnit.valor == null) return null;

  const { valor, label, desc_ganadora } = precioUnit;

  return (
    <span
      className={`precio-normalizado ${className}`}
      title={desc_ganadora ? `Producto SEPA: ${desc_ganadora}` : undefined}
    >
      {label} ${valor.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
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
