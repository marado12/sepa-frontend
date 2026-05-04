import { useState, useEffect } from 'react'

const CATEGORIAS = ['Lácteos','Panadería','Secos','Aceites','Infusiones','Carnes','Limpieza','Higiene','Conservas','Bebidas','Otro']

export default function BasketScreen({ canasta, onBack, onSave, fetchDefaultCanasta }) {
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(false)
  const [newItem, setNewItem] = useState({ nombre: '', cantidad: 1, unidad: 'unidad', categoria: 'Otro' })
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (canasta) {
      setItems([...canasta])
    } else {
      setLoading(true)
      fetchDefaultCanasta().then(c => {
        setItems(c ? [...c] : [])
        setLoading(false)
      })
    }
  }, [])

  const updateQty = (i, delta) => {
    setItems(prev => prev.map((item, idx) =>
      idx === i ? { ...item, cantidad: Math.max(0.5, +(item.cantidad + delta).toFixed(1)) } : item
    ))
  }

  const removeItem = (i) => {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  const addItem = () => {
    if (!newItem.nombre.trim()) return
    setItems(prev => [...prev, {
      ...newItem,
      palabras_clave: [newItem.nombre.toLowerCase()],
      marca: '',
      cantidad_texto: '',
    }])
    setNewItem({ nombre: '', cantidad: 1, unidad: 'unidad', categoria: 'Otro' })
    setShowAdd(false)
  }

  const resetDefault = () => {
    fetchDefaultCanasta().then(c => {
      if (c) setItems([...c])
    })
  }

  if (loading || !items) {
    return (
      <div className="basket-screen">
        <div className="loading-content">
          <div className="loading-spinner" />
          <p>Cargando canasta...</p>
        </div>
      </div>
    )
  }

  const byCategory = items.reduce((acc, item, idx) => {
    const cat = item.categoria || 'Otro'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push({ ...item, _idx: idx })
    return acc
  }, {})

  return (
    <div className="basket-screen">
      <div className="basket-topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h2 className="basket-title">Mi Canasta</h2>
        <button className="back-btn" onClick={resetDefault}>Restablecer</button>
      </div>

      <div className="basket-summary">
        <span>{items.length} productos</span>
      </div>

      <div className="basket-list">
        {Object.entries(byCategory).map(([cat, catItems]) => (
          <div key={cat} className="basket-category">
            <div className="basket-cat-header">{cat}</div>
            {catItems.map(item => (
              <div key={item._idx} className="basket-item">
                <div className="basket-item-info">
                  <span className="basket-item-name">{item.nombre}</span>
                  <span className="basket-item-unit">{item.unidad}</span>
                </div>
                <div className="basket-item-controls">
                  <button className="qty-btn" onClick={() => updateQty(item._idx, -1)}>−</button>
                  <span className="qty-value">{item.cantidad}</span>
                  <button className="qty-btn" onClick={() => updateQty(item._idx, 1)}>+</button>
                  <button className="remove-btn" onClick={() => removeItem(item._idx)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="add-item-form">
          <input
            className="add-input"
            placeholder="Nombre del producto"
            value={newItem.nombre}
            onChange={e => setNewItem(p => ({ ...p, nombre: e.target.value }))}
          />
          <div className="add-row">
            <input
              type="number"
              className="add-input add-input-sm"
              placeholder="Cant."
              min={0.5}
              step={0.5}
              value={newItem.cantidad}
              onChange={e => setNewItem(p => ({ ...p, cantidad: +e.target.value }))}
            />
            <input
              className="add-input add-input-sm"
              placeholder="Unidad"
              value={newItem.unidad}
              onChange={e => setNewItem(p => ({ ...p, unidad: e.target.value }))}
            />
            <select
              className="add-input"
              value={newItem.categoria}
              onChange={e => setNewItem(p => ({ ...p, categoria: e.target.value }))}
            >
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="add-actions">
            <button className="btn-primary" onClick={addItem}>Agregar</button>
            <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button className="btn-add-item" onClick={() => setShowAdd(true)}>
          + Agregar producto
        </button>
      )}

      <div className="basket-footer">
        <button className="btn-primary btn-save" onClick={() => onSave(items)}>
          Guardar canasta
        </button>
      </div>
    </div>
  )
}
