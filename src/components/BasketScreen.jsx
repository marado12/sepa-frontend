import { useState, useEffect, useRef } from 'react'

const CATEGORIAS = ['Lácteos','Panadería','Secos','Aceites','Infusiones','Carnes','Limpieza','Higiene','Conservas','Bebidas','Otro']
const UNIDADES = ['unidad', 'kg', 'gramos', 'litro', 'ml', 'pack']

const API = import.meta.env.VITE_API_URL || 'https://sepa-comparador-production.up.railway.app'

const ITEM_VACIO = {
  nombre: '',
  cantidad: 1,
  unidad: 'unidad',
  categoria: 'Otro',
  marca: '',
  marcas_aceptadas: [],
}

function useCacheStatus() {
  const [status, setStatus] = useState({ listo: false, en_progreso: false })
  useEffect(() => {
    let interval
    const check = async () => {
      try {
        const res = await fetch(`${API}/api/status`)
        const data = await res.json()
        setStatus({ listo: data.listo ?? false, en_progreso: data.en_progreso ?? false })
        if (data.listo) clearInterval(interval)
      } catch { /* silencioso */ }
    }
    check()
    interval = setInterval(check, 5000)
    return () => clearInterval(interval)
  }, [])
  return status
}

function _diasFallback() {
  const NOMBRES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
  const hoy = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoy); d.setDate(hoy.getDate() + i)
    const diaNum = d.getDay() === 0 ? 6 : d.getDay() - 1 // JS: 0=Dom → SEPA: 6=Dom
    return {
      dia: diaNum,
      label: (i === 0 ? 'Hoy · ' : i === 1 ? 'Mañana · ' : '') + NOMBRES[diaNum],
      fecha: d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      promos: [],
    }
  })
}

function useDias() {
  const [dias, setDias] = useState(_diasFallback) // ← muestra días inmediatamente
  useEffect(() => {
    fetch(`${API}/api/dias`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => { if (d.dias?.length) setDias(d.dias) })
      .catch(err => console.warn('[useDias] fetch falló, usando días locales:', err))
  }, [])
  return dias
}

function useProductSearch(query) {
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`${API}/api/buscar-productos?q=${encodeURIComponent(query)}&limite=8`)
        const data = await res.json()
        setSuggestions(data.sugerencias || [])
      } catch {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  return { suggestions, searching }
}

function MarcasAceptadasInput({ value, onChange }) {
  const inputRef = useRef(null)

  const addMarca = (raw) => {
    const val = raw.trim()
    if (val && !value.includes(val)) {
      onChange([...value, val])
    }
  }

  const removeMarca = (i) => {
    onChange(value.filter((_, j) => j !== i))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addMarca(e.target.value)
      e.target.value = ''
    } else if (e.key === 'Backspace' && e.target.value === '' && value.length > 0) {
      removeMarca(value.length - 1)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        className="chips-input"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((m, i) => (
          <span key={i} className="chip">
            {m}
            <button type="button" onClick={() => removeMarca(i)}>×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          placeholder={value.length === 0 ? 'Ej: La Serenísima — Enter para agregar' : 'Agregar otra…'}
          onKeyDown={handleKeyDown}
          onBlur={(e) => {
            if (e.target.value.trim()) {
              addMarca(e.target.value)
              e.target.value = ''
            }
          }}
        />
      </div>
      {value.length > 0 && (
        <p className="hint-warning">
          ⚠ Solo se buscarán precios de estas marcas. Si ninguna aparece en SEPA, el producto quedará sin precio.
        </p>
      )}
    </div>
  )
}

export default function BasketScreen({ canasta, historial = [], onBack, onSave, fetchDefaultCanasta }) {
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(false)
  const [newItem, setNewItem] = useState(ITEM_VACIO)
  const [showAdd, setShowAdd] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showHistorial, setShowHistorial] = useState(false)
  const [nombreCanasta, setNombreCanasta] = useState('')
  // diaSeleccionado: se inicializa con hoy, se puede cambiar con el selector
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => {
    const hoy = new Date().getDay()
    return hoy === 0 ? 6 : hoy - 1 // JS Dom=0 → SEPA Lun=0
  })
  const suggestionsRef = useRef(null)

  const { suggestions, searching } = useProductSearch(newItem.nombre)
  const cacheStatus = useCacheStatus()
  const dias = useDias()

  // Cuando el backend devuelve días con promos, actualizar selección al primero si cambió
  useEffect(() => {
    if (dias.length > 0 && diaSeleccionado === null) {
      setDiaSeleccionado(dias[0].dia)
    }
  }, [dias, diaSeleccionado])

  // Mostrar sugerencias automáticamente cuando llegan del servidor
  useEffect(() => {
    if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }, [suggestions])

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

  useEffect(() => {
    const handler = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const updateQty = (i, delta) => {
    setItems(prev => prev.map((item, idx) =>
      idx === i ? { ...item, cantidad: Math.max(0.5, +(item.cantidad + delta).toFixed(1)) } : item
    ))
  }

  const removeItem = (i) => {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  const clearAll = () => {
    setItems([])
  }

  const selectSuggestion = (nombre) => {
    setNewItem(p => ({ ...p, nombre }))
    setShowSuggestions(false)
  }

  const addItem = () => {
    if (!newItem.nombre.trim()) return
    setItems(prev => [...prev, {
      ...newItem,
      palabras_clave: [newItem.nombre.toLowerCase()],
      cantidad_texto: '',
    }])
    setNewItem(ITEM_VACIO)
    setShowAdd(false)
  }

  const resetDefault = () => {
    fetchDefaultCanasta().then(c => {
      if (c) setItems([...c])
    })
  }

  const cargarDesdeHistorial = (entry) => {
    setItems([...entry.items])
    setNombreCanasta(entry.nombre)
    setShowHistorial(false)
  }

  const handleSave = () => {
    onSave(items, nombreCanasta.trim() || undefined, diaSeleccionado)
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
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button className="back-btn" onClick={clearAll} title="Borrar todos los productos">🗑</button>
          <button className="back-btn" onClick={resetDefault} title="Restablecer canasta default">↺</button>
        </div>
      </div>

      {/* Banner estado del cache */}
      {!cacheStatus.listo && (
        <div className="cache-banner">
          {cacheStatus.en_progreso
            ? <><span className="cache-spinner" /> Procesando datos del día (~2 min)… Las sugerencias estarán disponibles pronto.</>
            : <>⚠ Datos no cargados. <button className="cache-banner-btn" onClick={async () => {
                await fetch(`${API}/refresh`, { method: 'POST' })
              }}>Iniciar carga</button></>
          }
        </div>
      )}

      {/* Selector de día */}
      {dias.length > 0 && (
        <div className="dia-selector">
          <span className="dia-selector-label">¿Cuándo vas a ir?</span>
          <div className="dia-selector-options">
            {dias.map(d => (
              <button
                key={d.dia + d.fecha}
                className={`dia-btn${diaSeleccionado === d.dia ? ' dia-btn-active' : ''}`}
                onClick={() => setDiaSeleccionado(d.dia)}
                title={d.promos.length > 0 ? `Promos: ${d.promos.join(', ')}` : 'Sin promos especiales'}
              >
                <span className="dia-btn-label">{d.label}</span>
                <span className="dia-btn-fecha">{d.fecha}</span>
                {d.promos.length > 0 && <span className="dia-btn-promo">🏷 {d.promos.length}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {historial.length > 0 && (
        <div className="basket-historial-bar">
          <button
            className="btn-historial"
            onClick={() => setShowHistorial(v => !v)}
          >
            📋 Canastas guardadas ({historial.length})
          </button>
          {showHistorial && (
            <ul className="historial-list">
              {historial.map(entry => (
                <li key={entry.id} className="historial-item" onClick={() => cargarDesdeHistorial(entry)}>
                  <span className="historial-nombre">{entry.nombre}</span>
                  <span className="historial-meta">
                    {entry.items.length} productos · {new Date(entry.fecha).toLocaleDateString('es-AR')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
                  {item.marcas_aceptadas?.length > 0 && (
                    <span className="basket-item-marcas">
                      {item.marcas_aceptadas.join(' · ')}
                    </span>
                  )}
                  {!item.marcas_aceptadas?.length && item.marca && (
                    <span className="basket-item-unit">{item.marca}</span>
                  )}
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
          <div className="autocomplete-wrapper" ref={suggestionsRef}>
            <input
              className="add-input"
              placeholder="Nombre del producto"
              value={newItem.nombre}
              autoComplete="off"
              onChange={e => {
                setNewItem(p => ({ ...p, nombre: e.target.value }))
                setShowSuggestions(true)
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            />
            {searching && <span className="autocomplete-searching">🔍</span>}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="autocomplete-list">
                {suggestions.map((s, i) => (
                  <li key={i} className="autocomplete-item" onMouseDown={() => selectSuggestion(s)}>
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <input
            className="add-input"
            placeholder="Marca preferida (opcional, scoring suave)"
            value={newItem.marca}
            onChange={e => setNewItem(p => ({ ...p, marca: e.target.value }))}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="add-label">
              Marcas aceptadas <span className="hint">(filtra estrictamente — dejar vacío = cualquier marca)</span>
            </label>
            <MarcasAceptadasInput
              value={newItem.marcas_aceptadas}
              onChange={(val) => setNewItem(p => ({ ...p, marcas_aceptadas: val }))}
            />
          </div>

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
            <select
              className="add-input add-input-sm"
              value={newItem.unidad}
              onChange={e => setNewItem(p => ({ ...p, unidad: e.target.value }))}
            >
              {UNIDADES.map(u => <option key={u}>{u}</option>)}
            </select>
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
            <button className="btn-secondary" onClick={() => { setShowAdd(false); setNewItem(ITEM_VACIO) }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button className="btn-add-item" onClick={() => setShowAdd(true)}>
          + Agregar producto
        </button>
      )}

      <div className="basket-footer">
        <input
          className="add-input basket-nombre-input"
          placeholder="Nombre para guardar (ej: Casa, Trabajo…)"
          value={nombreCanasta}
          onChange={e => setNombreCanasta(e.target.value)}
        />
        <button className="btn-primary btn-save" onClick={handleSave}>
          Guardar canasta
        </button>
      </div>
    </div>
  )
}

