import { useState, useEffect, useRef } from 'react'

const UNIDADES = ['unidad', 'kg', 'gramos', 'litro', 'ml', 'pack']

const API = import.meta.env.VITE_API_URL || 'https://sepa-comparador-production.up.railway.app'

const ITEM_VACIO = {
  nombre: '',
  cantidad: 1,
  unidad: 'unidad',
  categoria: 'Otro',
  marcas_aceptadas: [],
}

function detectarUnidad(desc) {
  const d = desc.toLowerCase()
  if (/\d\s*(kg|kilo)/.test(d))            return 'kg'
  if (/\d\s*(g|gr|gramos?)\b/.test(d))     return 'gramos'
  if (/\d\s*(ml|cc)\b/.test(d))            return 'ml'
  if (/\d\s*(l|lt|lts|litros?)\b/.test(d)) return 'litro'
  return null
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

function MarcasInput({ value, onChange }) {
  const inputRef = useRef(null)

  const addMarca = (raw) => {
    const val = raw.trim()
    if (val && !value.includes(val)) onChange([...value, val])
  }

  const removeMarca = (i) => onChange(value.filter((_, j) => j !== i))

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
      <div className="chips-input" onClick={() => inputRef.current?.focus()}>
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
          Se elegirá la más barata entre estas marcas. Si ninguna aparece en SEPA, el producto quedará sin precio.
        </p>
      )}
    </div>
  )
}

// ── Share helper ──────────────────────────────────────────────────────────────

/**
 * Genera la URL compartible con la canasta codificada en el hash.
 * Usa btoa para base64 y encodeURIComponent para que sea URL-safe.
 */
function generarUrlCanasta(items) {
  const json = JSON.stringify(items)
  const encoded = encodeURIComponent(btoa(json))
  const base = window.location.origin + window.location.pathname
  return `${base}#canasta=${encoded}`
}

// ─────────────────────────────────────────────────────────────────────────────

export default function BasketScreen({ canasta, historial = [], onBack, onSave, fetchDefaultCanasta }) {
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(false)
  const [newItem, setNewItem] = useState(ITEM_VACIO)
  const [showAdd, setShowAdd] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showHistorial, setShowHistorial] = useState(false)
  const [nombreCanasta, setNombreCanasta] = useState('')
  const [unidadBloqueada, setUnidadBloqueada] = useState(false)
  const [shareMsg, setShareMsg] = useState(null) // 'copiado' | 'error' | null
  const suggestionsRef = useRef(null)

  const { suggestions, searching } = useProductSearch(newItem.nombre)
  const cacheStatus = useCacheStatus()

  useEffect(() => {
    if (suggestions.length > 0) setShowSuggestions(true)
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

  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const clearAll = () => setItems([])

  const selectSuggestion = (nombre) => {
    const unidadDetectada = detectarUnidad(nombre)
    setNewItem(p => ({
      ...p,
      nombre,
      ...(unidadDetectada ? { unidad: unidadDetectada } : {}),
    }))
    setUnidadBloqueada(!!unidadDetectada)
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
    setUnidadBloqueada(false)
    setShowAdd(false)
  }

  const resetDefault = () => {
    fetchDefaultCanasta().then(c => { if (c) setItems([...c]) })
  }

  const cargarDesdeHistorial = (entry) => {
    setItems([...entry.items])
    setNombreCanasta(entry.nombre)
    setShowHistorial(false)
  }

  const handleSave = () => {
    onSave(items, nombreCanasta.trim() || undefined)
  }

  // ── Compartir canasta ───────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!items || items.length === 0) return
    const url = generarUrlCanasta(items)
    try {
      await navigator.clipboard.writeText(url)
      setShareMsg('copiado')
    } catch {
      // Fallback por si clipboard API no está disponible (http, algunos móviles)
      try {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setShareMsg('copiado')
      } catch {
        setShareMsg('error')
      }
    }
    setTimeout(() => setShareMsg(null), 2500)
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
          {/* Compartir */}
          <button
            className="back-btn"
            onClick={handleShare}
            disabled={!items || items.length === 0}
            title="Compartir canasta por link"
            style={{ position: 'relative' }}
          >
            {shareMsg === 'copiado' ? '✓' : shareMsg === 'error' ? '✗' : '🔗'}
          </button>
          <button className="back-btn" onClick={clearAll} title="Borrar todos los productos">🗑</button>
          <button className="back-btn" onClick={resetDefault} title="Restablecer canasta default">↺</button>
        </div>
      </div>

      {/* Feedback del share */}
      {shareMsg && (
        <div className={`share-toast ${shareMsg === 'copiado' ? 'share-toast-ok' : 'share-toast-err'}`}>
          {shareMsg === 'copiado'
            ? '✓ Link copiado al portapapeles'
            : '✗ No se pudo copiar. Copiá la URL manualmente desde la barra del navegador.'}
        </div>
      )}

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

      {historial.length > 0 && (
        <div className="basket-historial-bar">
          <button className="btn-historial" onClick={() => setShowHistorial(v => !v)}>
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
                setUnidadBloqueada(false)
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="add-label">
              Marcas <span className="hint">(opcional — dejá vacío para la más barata de cualquier marca)</span>
            </label>
            <MarcasInput
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
              className={`add-input add-input-sm${unidadBloqueada ? ' input-locked' : ''}`}
              value={newItem.unidad}
              onChange={e => setNewItem(p => ({ ...p, unidad: e.target.value }))}
              disabled={unidadBloqueada}
              title={unidadBloqueada ? 'Unidad detectada automáticamente desde SEPA' : ''}
            >
              {UNIDADES.map(u => <option key={u}>{u}</option>)}
            </select>
            {unidadBloqueada && (
              <button
                className="btn-unlock"
                type="button"
                title="Editar unidad manualmente"
                onClick={() => setUnidadBloqueada(false)}
              >✎</button>
            )}
          </div>

          <div className="add-actions">
            <button className="btn-primary" onClick={addItem}>Agregar</button>
            <button className="btn-secondary" onClick={() => { setShowAdd(false); setNewItem(ITEM_VACIO); setUnidadBloqueada(false) }}>Cancelar</button>
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

