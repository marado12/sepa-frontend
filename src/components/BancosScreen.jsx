import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'https://sepa-comparador-production.up.railway.app'

// Día de la semana → label corto
const DIA_LABELS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

// Ícono por banco
const BANCO_ICONS = {
  'Banco Nación':    '🏦',
  'Banco Provincia': '🏛',
  'Banco Supervielle':'🔷',
  'Banco Galicia':   '🟣',
  'Mercado Pago':    '💙',
}

const MEDIO_LABELS = {
  credito:   { label: 'Crédito', icon: '💳' },
  debito:    { label: 'Débito',  icon: '🟦' },
  billetera: { label: 'Billetera', icon: '📱' },
}

/**
 * Pantalla de selección de banco.
 *
 * Props:
 *   cadenas        — array de cadenas encontradas en la zona (para filtrar bancos relevantes)
 *   diaSeleccionado — número 0–6 para destacar promos del día
 *   onAplicar(bancosSeleccionados) — callback con [{ banco_id, medios: [] }, ...]
 *   onOmitir()     — callback cuando el usuario omite el paso
 */
export default function BancosScreen({ cadenas = [], diaSeleccionado, onAplicar, onOmitir }) {
  const [bancos, setBancos] = useState([])
  const [loading, setLoading] = useState(true)
  // seleccion: { [banco_id]: Set<'credito'|'debito'|'billetera'> }
  const [seleccion, setSeleccion] = useState({})

  const dia = diaSeleccionado ?? new Date().getDay() === 0 ? 6 : new Date().getDay() - 1

  useEffect(() => {
    const query = cadenas.length > 0 ? `?cadenas=${cadenas.join(',')}` : ''
    fetch(`${API}/api/bancos${query}`)
      .then(r => r.json())
      .then(d => {
        setBancos(d.bancos || [])
        setLoading(false)
      })
      .catch(() => {
        // Fallback: mostrar bancos hardcodeados si la API falla
        setBancos(BANCOS_FALLBACK)
        setLoading(false)
      })
  }, [cadenas.join(',')])

  // Toggle del checkbox principal del banco
  const toggleBanco = (bancoId, medios) => {
    setSeleccion(prev => {
      const next = { ...prev }
      if (next[bancoId]) {
        delete next[bancoId]
      } else {
        // Al activar, pre-seleccionar todos los medios disponibles
        next[bancoId] = new Set(medios)
      }
      return next
    })
  }

  // Toggle de un medio específico dentro de un banco ya seleccionado
  const toggleMedio = (bancoId, medio, todosLosMedios) => {
    setSeleccion(prev => {
      const current = new Set(prev[bancoId] || [])
      if (current.has(medio)) {
        current.delete(medio)
        // Si quedan 0 medios seleccionados, desactivar el banco
        if (current.size === 0) {
          const next = { ...prev }
          delete next[bancoId]
          return next
        }
      } else {
        current.add(medio)
      }
      return { ...prev, [bancoId]: current }
    })
  }

  const handleAplicar = () => {
    const bancosSeleccionados = Object.entries(seleccion).map(([banco_id, mediosSet]) => ({
      banco_id,
      medios: [...mediosSet],
    }))
    onAplicar(bancosSeleccionados)
  }

  const nSeleccionados = Object.keys(seleccion).length

  return (
    <div className="bancos-screen">
      {/* Header */}
      <div className="bancos-header">
        <div className="bancos-header-top">
          <div className="bancos-icon-wrap">🏦</div>
          <div>
            <h2 className="bancos-title">¿Con qué banco pagás?</h2>
            <p className="bancos-subtitle">
              Calculamos el reintegro exacto para vos
            </p>
          </div>
        </div>
      </div>

      {/* Lista de bancos */}
      <div className="bancos-list">
        {loading ? (
          <div className="bancos-loading">
            <div className="loading-spinner" style={{ width: 32, height: 32, margin: '2rem auto' }} />
          </div>
        ) : bancos.length === 0 ? (
          <p className="bancos-empty">No hay promos bancarias disponibles para las cadenas de tu zona.</p>
        ) : (
          bancos.map(banco => {
            const estaSeleccionado = !!seleccion[banco.id]
            const mediosSeleccionados = seleccion[banco.id] || new Set()
            const promosHoy = banco.promos_hoy || []
            const tienePromoHoy = banco.tiene_promo_hoy

            return (
              <div
                key={banco.id}
                className={`banco-card${estaSeleccionado ? ' banco-card-selected' : ''}`}
              >
                {/* Fila principal — checkbox + nombre */}
                <div
                  className="banco-card-header"
                  onClick={() => toggleBanco(banco.id, banco.medios)}
                >
                  <div className="banco-card-left">
                    <div className={`banco-checkbox${estaSeleccionado ? ' checked' : ''}`}>
                      {estaSeleccionado && <span className="banco-check-mark">✓</span>}
                    </div>
                    <span className="banco-icon">{BANCO_ICONS[banco.id] || '🏦'}</span>
                    <div className="banco-info">
                      <span className="banco-label">{banco.label}</span>
                      {tienePromoHoy && (
                        <span className="banco-hoy-badge">Promo hoy</span>
                      )}
                    </div>
                  </div>
                  <span className="banco-expand-arrow">{estaSeleccionado ? '▲' : '▼'}</span>
                </div>

                {/* Nota / condiciones */}
                {banco.nota && (
                  <p className="banco-nota">{banco.nota}</p>
                )}

                {/* Chips de medio de pago — siempre visibles */}
                <div className="banco-medios">
                  {banco.medios.map(medio => {
                    const info = MEDIO_LABELS[medio] || { label: medio, icon: '💳' }
                    const activo = estaSeleccionado && mediosSeleccionados.has(medio)
                    return (
                      <button
                        key={medio}
                        className={`medio-chip${activo ? ' medio-chip-active' : ''}`}
                        onClick={e => {
                          e.stopPropagation()
                          if (!estaSeleccionado) {
                            // Activar banco + este medio
                            setSeleccion(prev => ({
                              ...prev,
                              [banco.id]: new Set([medio]),
                            }))
                          } else {
                            toggleMedio(banco.id, medio, banco.medios)
                          }
                        }}
                      >
                        <span>{info.icon}</span>
                        <span>{info.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Promos activas del banco */}
                {estaSeleccionado && banco.todas_promos && banco.todas_promos.length > 0 && (
                  <div className="banco-promos">
                    {banco.todas_promos
                      .filter(p => p.descuento_pct > 0 || p.cuotas_sin_interes > 0)
                      .map((p, i) => {
                        const esHoy = !p.dias_semana || p.dias_semana.length === 0 || p.dias_semana.includes(dia)
                        return (
                          <div key={i} className={`promo-pill${esHoy ? ' promo-pill-hoy' : ''}`}>
                            <span className="promo-pill-pct">
                              {p.cuotas_sin_interes > 0 && p.descuento_pct === 0
                                ? `${p.cuotas_sin_interes} cuotas s/i`
                                : `${p.descuento_pct}% off`}
                            </span>
                            <span className="promo-pill-cadenas">
                              {p.cadenas_aplica.length > 0
                                ? p.cadenas_aplica.join(', ')
                                : 'Todas las cadenas'}
                            </span>
                            {p.dias_semana && p.dias_semana.length > 0 && (
                              <span className="promo-pill-dias">
                                {p.dias_semana.map(d => DIA_LABELS[d]).join('/')}
                              </span>
                            )}
                            {p.tope_reintegro > 0 && (
                              <span className="promo-pill-tope">
                                tope ${new Intl.NumberFormat('es-AR').format(p.tope_reintegro)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer con acciones */}
      <div className="bancos-footer">
        {nSeleccionados > 0 && (
          <p className="bancos-footer-hint">
            {nSeleccionados} banco{nSeleccionados > 1 ? 's' : ''} seleccionado{nSeleccionados > 1 ? 's' : ''}
            {' — '}aplicamos las mejores promos disponibles
          </p>
        )}
        <button
          className="btn-primary btn-aplicar"
          onClick={handleAplicar}
          disabled={nSeleccionados === 0}
        >
          {nSeleccionados > 0
            ? `Ver resultados con reintegros`
            : `Seleccioná al menos un banco`}
        </button>
        <button className="btn-ghost btn-omitir" onClick={onOmitir}>
          Omitir — ver resultados sin promos
        </button>
      </div>
    </div>
  )
}

// ── Fallback si la API no responde ────────────────────────────────────────────
const BANCOS_FALLBACK = [
  {
    id: 'Banco Nación',
    label: 'Banco Nación',
    medios: ['credito'],
    nota: 'Requiere tarjeta de crédito y pago con QR MODO',
    cadenas_principales: ['Carrefour', 'Chango Más', 'Coto', 'Disco', 'Vea', 'Jumbo', 'Día'],
    tiene_promo_hoy: true,
    promos_hoy: [],
    todas_promos: [
      { nombre: 'BNA 30% Miércoles Carrefour', descuento_pct: 30, tope_reintegro: 12000, cadenas_aplica: ['Carrefour'], dias_semana: [2], medio: 'credito', cuotas_sin_interes: 0 },
      { nombre: 'BNA 20% Lunes Chango Más', descuento_pct: 20, tope_reintegro: 25000, cadenas_aplica: ['Chango Más'], dias_semana: [0], medio: 'credito', cuotas_sin_interes: 0 },
    ],
  },
  {
    id: 'Banco Provincia',
    label: 'Banco Provincia / Cuenta DNI',
    medios: ['debito'],
    nota: 'Cuenta DNI (débito/saldo). Solo válido en Provincia de Buenos Aires',
    cadenas_principales: ['Carrefour', 'Chango Más', 'Coto', 'Día'],
    tiene_promo_hoy: true,
    promos_hoy: [],
    todas_promos: [
      { nombre: 'CuentaDNI 30% Jueves Coto', descuento_pct: 30, tope_reintegro: 0, cadenas_aplica: ['Coto'], dias_semana: [3], medio: 'debito', cuotas_sin_interes: 0 },
      { nombre: 'CuentaDNI 20% Jueves Chango Más', descuento_pct: 20, tope_reintegro: 0, cadenas_aplica: ['Chango Más'], dias_semana: [3], medio: 'debito', cuotas_sin_interes: 0 },
      { nombre: 'CuentaDNI 10% Miércoles Carrefour', descuento_pct: 10, tope_reintegro: 0, cadenas_aplica: ['Carrefour'], dias_semana: [2], medio: 'debito', cuotas_sin_interes: 0 },
    ],
  },
  {
    id: 'Banco Supervielle',
    label: 'Banco Supervielle',
    medios: ['debito'],
    nota: 'Solo jubilados con haberes en Supervielle',
    cadenas_principales: ['Jumbo', 'Disco', 'Vea', 'Chango Más'],
    tiene_promo_hoy: false,
    promos_hoy: [],
    todas_promos: [
      { nombre: 'Supervielle 20% Martes Cencosud', descuento_pct: 20, tope_reintegro: 25000, cadenas_aplica: ['Jumbo', 'Disco', 'Vea', 'Chango Más'], dias_semana: [1], medio: 'debito', cuotas_sin_interes: 0 },
    ],
  },
  {
    id: 'Banco Galicia',
    label: 'Banco Galicia',
    medios: ['credito'],
    nota: '12 cuotas sin interés en Cencosud (Jumbo, Disco, Vea)',
    cadenas_principales: ['Jumbo', 'Disco', 'Vea'],
    tiene_promo_hoy: true,
    promos_hoy: [],
    todas_promos: [
      { nombre: 'Galicia 12 cuotas s/i Cencosud', descuento_pct: 0, tope_reintegro: 0, cadenas_aplica: ['Jumbo', 'Disco', 'Vea'], dias_semana: [], medio: 'credito', cuotas_sin_interes: 12 },
    ],
  },
  {
    id: 'Mercado Pago',
    label: 'Mercado Pago',
    medios: ['billetera'],
    nota: 'Promo variable — verificar en la app antes de ir',
    cadenas_principales: ['Carrefour', 'Coto', 'Día', 'Vea', 'Chango Más'],
    tiene_promo_hoy: true,
    promos_hoy: [],
    todas_promos: [
      { nombre: 'MercadoPago 25% QR', descuento_pct: 25, tope_reintegro: 0, cadenas_aplica: ['Carrefour', 'Coto', 'Día', 'Vea', 'Chango Más'], dias_semana: [], medio: 'billetera', cuotas_sin_interes: 0 },
    ],
  },
]
