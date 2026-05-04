import { useState } from 'react'

const PROVINCIAS = [
  'Buenos Aires','CABA','Córdoba','Santa Fe','Mendoza','Tucumán',
  'Entre Ríos','Salta','Misiones','Chaco','Corrientes',
  'Santiago del Estero','San Juan','Jujuy','Río Negro','Neuquén',
  'Formosa','Chubut','San Luis','Catamarca','La Rioja',
  'La Pampa','Santa Cruz','Tierra del Fuego',
]

export default function HomeScreen({ radioKm, onRadioChange, onCompare, onEditBasket, error }) {
  const [geoError, setGeoError] = useState(null)
  const [loadingGeo, setLoadingGeo] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [provincia, setProvincia] = useState('')

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
      (err) => {
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
          <div className="error-banner">
            {error || geoError}
          </div>
        )}

        <button
          className="btn-primary btn-geo"
          onClick={handleGeo}
          disabled={loadingGeo}
        >
          {loadingGeo ? (
            <><span className="btn-spinner" /> Obteniendo ubicación...</>
          ) : (
            <><span className="icon-loc">◎</span> Comparar cerca mío</>
          )}
        </button>

        <button
          className="btn-secondary"
          onClick={() => setShowManual(v => !v)}
        >
          Elegir provincia manualmente
        </button>

        {showManual && (
          <div className="manual-section">
            <select
              className="provincia-select"
              value={provincia}
              onChange={e => setProvincia(e.target.value)}
            >
              <option value="">— Seleccioná tu provincia —</option>
              {PROVINCIAS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              className="btn-primary"
              onClick={handleManual}
              disabled={!provincia}
            >
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
            type="range"
            min={1}
            max={20}
            step={1}
            value={radioKm}
            onChange={e => onRadioChange(Number(e.target.value))}
            className="radio-slider"
          />
          <div className="radio-ticks">
            <span>1 km</span>
            <span>10 km</span>
            <span>20 km</span>
          </div>
        </div>

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
