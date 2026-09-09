import { useState, useEffect } from 'react'

const PROVINCIAS = [
  'Buenos Aires','CABA','Córdoba','Santa Fe','Mendoza','Tucumán',
  'Entre Ríos','Salta','Misiones','Chaco','Corrientes',
  'Santiago del Estero','San Juan','Jujuy','Río Negro','Neuquén',
  'Formosa','Chubut','San Luis','Catamarca','La Rioja',
  'La Pampa','Santa Cruz','Tierra del Fuego',
]

const API = import.meta.env.VITE_API_URL || 'https://sepa-backend-bk88.onrender.com'

function _diasFallback() {
  const NOMBRES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
  const hoy = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoy); d.setDate(hoy.getDate() + i)
    const diaNum = d.getDay() === 0 ? 6 : d.getDay() - 1
    return {
      dia: diaNum,
      label: (i === 0 ? 'Hoy · ' : i === 1 ? 'Mañana · ' : '') + NOMBRES[diaNum],
      fecha: d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      promos: [],
    }
  })
}

function useDias() {
  const [dias, setDias] = useState(_diasFallback)
  useEffect(() => {
    fetch(`${API}/api/dias`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { if (d.dias?.length) setDias(d.dias) })
      .catch(err => console.warn('[useDias] fetch falló, usando días locales:', err))
  }, [])
  return dias
}

export default function HomeScreen({ radioKm, onRadioChange, onCompare, onEditBasket, error, diaSeleccionado, onDiaChange }) {
  const [geoError, setGeoError] = useState(null)
  const [loadingGeo, setLoadingGeo] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [provincia, setProvincia] = useState('')

  const dias = useDias()

  const handleGeo = () => {
    if (!navigator.geolocation) {
      setGeoError('Tu navegador no soporta geolocalización')
      setShowManual(true)
      return
    }
    setLoadingGeo(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoadingGeo(false)
        onCompare({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      },
      () => {
        setLoadingGeo(false)
        setGeoError('No se pudo obtener tu ubicación. Elegí tu provincia manualmente.')
        setShowManual(true)
      },
      { timeout: 10000 }
    )
  }

  const handleManual = () => {
    if (!provincia) return
    onCompare({ provincia })
  }

  return (
    <div className="home-screen">
      <header className="home-header">
        <div className="logo-mark">$</div>
        <h1 className="home-title">Comparador<br />de Supermercados</h1>
        <p className="home-subtitle">Encontrá dónde conviene hacer tu compra del mes</p>
      </header>

      <main className="home-main">
        {(error || geoError) && (
          <div className="error-banner">{error || geoError}</div>
        )}

        <button className="btn-primary btn-geo" onClick={handleGeo} disabled={loadingGeo}>
          {loadingGeo
            ? <><span className="btn-spinner" /> Obteniendo ubicación...</>
            : <><span className="icon-loc">◎</span> Comparar cerca mío</>
          }
        </button>

        <button className="btn-secondary" onClick={() => setShowManual(v => !v)}>
          Elegir provincia manualmente
        </button>

        {showManual && (
          <div className="manual-section">
            <select className="provincia-select" value={provincia} onChange={e => setProvincia(e.target.value)}>
              <option value="">— Seleccioná tu provincia —</option>
              {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button className="btn-primary" onClick={handleManual} disabled={!provincia}>
              Comparar en {provincia || '...'}
            </button>
          </div>
        )}

        <div className="radio-section">
          <div className="radio-header">
            <span className="radio-label">Radio de búsqueda</span>
            <span className="radio-value">{radioKm} km</span>
          </div>
          <input
            type="range" min={1} max={20} step={1} value={radioKm}
            onChange={e => onRadioChange(Number(e.target.value))}
            className="radio-slider"
          />
          <div className="radio-ticks">
            <span>1 km</span><span>10 km</span><span>20 km</span>
          </div>
        </div>

        {dias.length > 0 && (
          <div className="dia-selector">
            <span className="dia-selector-label">¿Cuándo vas a ir?</span>
            <div className="dia-selector-options">
              {dias.map(d => (
                <button
                  key={d.dia + d.fecha}
                  className={`dia-btn${diaSeleccionado === d.dia ? ' dia-btn-active' : ''}`}
                  onClick={() => onDiaChange(d.dia)}
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

        <div className="divider" />

        <button className="btn-ghost" onClick={onEditBasket}>
          ✏ Editar canasta (20 productos)
        </button>
      </main>

      <footer className="home-footer">
        <p>Datos: <strong>Sistema SEPA</strong> · Ministerio de Economía Argentina</p>
        <p>Precios actualizados al día de hoy</p>
      </footer>
    </div>
  )
}
