import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'https://sepa-backend-bk88.onrender.com'

const DIA_LABELS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

const MEDIO_LABELS = {
  credito:   { label: 'Crédito',   icon: '💳' },
  debito:    { label: 'Débito',    icon: '🟦' },
  billetera: { label: 'Billetera', icon: '📱' },
}

// ── SVG Logos de bancos ───────────────────────────────────────────────────────
// Se usan inline SVG / img con URLs de logos públicos de alta disponibilidad.
// Fallback: iniciales en color de marca.

function BancoLogo({ bancoId }) {
  const logos = {
    'Banco Nación': (
      <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="8" fill="#003087"/>
        <text x="20" y="26" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="Arial">BNA</text>
      </svg>
    ),
    'Banco Provincia': (
      <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="8" fill="#0071BC"/>
        <text x="20" y="26" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="Arial">BPBA</text>
      </svg>
    ),
    'Banco Galicia': (
      <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="8" fill="#E31837"/>
        <text x="20" y="27" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial">G</text>
      </svg>
    ),
    'Banco Macro': (
      <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="8" fill="#FFD700"/>
        <text x="20" y="27" textAnchor="middle" fill="#1a1a1a" fontSize="11" fontWeight="bold" fontFamily="Arial">MACRO</text>
      </svg>
    ),
    'BBVA': (
      <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="8" fill="#004481"/>
        <text x="20" y="27" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="Arial">BBVA</text>
      </svg>
    ),
    'Banco Supervielle': (
      <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="8" fill="#6B2D8B"/>
        <text x="20" y="27" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial">SUPVL</text>
      </svg>
    ),
    'Banco Santander': (
      <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="8" fill="#EC0000"/>
        <text x="20" y="27" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial">SANT.</text>
      </svg>
    ),
    'Mercado Pago': (
      <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="20" fill="#00B1EA"/>
        <text x="20" y="27" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Arial">MP</text>
      </svg>
    ),
    'Ualá': (
      <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="20" fill="#7B2FBE"/>
        <text x="20" y="27" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Arial">U</text>
      </svg>
    ),
    'Personal Pay': (
      <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="20" fill="#00C2A8"/>
        <text x="20" y="27" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="Arial">PAY</text>
      </svg>
    ),
    'Naranja X': (
      <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="20" fill="#FF6200"/>
        <text x="20" y="27" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Arial">Nx</text>
      </svg>
    ),
  }
  return logos[bancoId] || (
    <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#888"/>
      <text x="20" y="27" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial">
        {bancoId?.[0] || '?'}
      </text>
    </svg>
  )
}

// ── Lógica: mejor promo gana (sin acumulación) ────────────────────────────────
/**
 * Dado un total de canasta y las promos del banco seleccionado,
 * devuelve la mejor promo aplicable (mayor ahorro real considerando tope).
 */
export function calcularMejorPromo(total, todasPromos, dia, cadena) {
  let mejorAhorro = 0
  let mejorPromo = null

  for (const p of todasPromos) {
    if (p.descuento_pct <= 0) continue
    // Filtrar por día si aplica
    if (p.dias_semana && p.dias_semana.length > 0 && !p.dias_semana.includes(dia)) continue
    // Filtrar por cadena si aplica
    if (cadena && p.cadenas_aplica && p.cadenas_aplica.length > 0 && !p.cadenas_aplica.includes(cadena)) continue

    const ahorroSinTope = total * (p.descuento_pct / 100)
    const ahorro = p.tope_reintegro > 0 ? Math.min(ahorroSinTope, p.tope_reintegro) : ahorroSinTope

    if (ahorro > mejorAhorro) {
      mejorAhorro = ahorro
      mejorPromo = { ...p, ahorro_real: ahorro }
    }
  }

  return mejorPromo
}

// ─────────────────────────────────────────────────────────────────────────────

export default function BancosScreen({ cadenas = [], diaSeleccionado, onAplicar, onOmitir }) {
  const [bancos, setBancos] = useState([])
  const [loading, setLoading] = useState(true)
  const [seleccion, setSeleccion] = useState({}) // { [banco_id]: Set<medios> }

  const dia = diaSeleccionado ?? (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)

  useEffect(() => {
    const query = cadenas.length > 0 ? `?cadenas=${cadenas.join(',')}` : ''
    fetch(`${API}/api/bancos${query}`)
      .then(r => r.json())
      .then(d => { setBancos(d.bancos || []); setLoading(false) })
      .catch(() => { setBancos(BANCOS_FALLBACK); setLoading(false) })
  }, [cadenas.join(',')])

  const toggleBanco = (bancoId, medios) => {
    setSeleccion(prev => {
      const next = { ...prev }
      if (next[bancoId]) { delete next[bancoId] }
      else { next[bancoId] = new Set(medios) }
      return next
    })
  }

  const toggleMedio = (bancoId, medio) => {
    setSeleccion(prev => {
      const current = new Set(prev[bancoId] || [])
      if (current.has(medio)) {
        current.delete(medio)
        if (current.size === 0) {
          const next = { ...prev }; delete next[bancoId]; return next
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

  // Agrupar bancos por categoría para mostrar sección de billeteras separada
  const bancosTradicionales = bancos.filter(b => !b.es_billetera)
  const billeteras = bancos.filter(b => b.es_billetera)

  return (
    <div className="bancos-screen">
      <div className="bancos-header">
        <div className="bancos-header-top">
          <div className="bancos-icon-wrap">🏦</div>
          <div>
            <h2 className="bancos-title">¿Con qué banco pagás?</h2>
            <p className="bancos-subtitle">Aplicamos la mejor promo disponible — sin acumular</p>
          </div>
        </div>
      </div>

      <div className="bancos-aclaracion">
        <span className="bancos-aclaracion-icon">ℹ️</span>
        <span>Las promos bancarias <strong>no se acumulan</strong>. Calculamos la que te da mayor ahorro real (con tope incluido).</span>
      </div>

      <div className="bancos-list">
        {loading ? (
          <div className="bancos-loading">
            <div className="loading-spinner" style={{ width: 32, height: 32, margin: '2rem auto' }} />
          </div>
        ) : bancos.length === 0 ? (
          <p className="bancos-empty">No hay promos disponibles para las cadenas de tu zona.</p>
        ) : (
          <>
            {bancosTradicionales.length > 0 && (
              <>
                <p className="bancos-section-label">Bancos</p>
                {bancosTradicionales.map(banco => (
                  <BancoCard
                    key={banco.id}
                    banco={banco}
                    dia={dia}
                    estaSeleccionado={!!seleccion[banco.id]}
                    mediosSeleccionados={seleccion[banco.id] || new Set()}
                    onToggleBanco={() => toggleBanco(banco.id, banco.medios)}
                    onToggleMedio={(medio) => toggleMedio(banco.id, medio)}
                    onActivarConMedio={(medio) => setSeleccion(prev => ({ ...prev, [banco.id]: new Set([medio]) }))}
                  />
                ))}
              </>
            )}
            {billeteras.length > 0 && (
              <>
                <p className="bancos-section-label" style={{ marginTop: '1.2rem' }}>Billeteras virtuales</p>
                {billeteras.map(banco => (
                  <BancoCard
                    key={banco.id}
                    banco={banco}
                    dia={dia}
                    estaSeleccionado={!!seleccion[banco.id]}
                    mediosSeleccionados={seleccion[banco.id] || new Set()}
                    onToggleBanco={() => toggleBanco(banco.id, banco.medios)}
                    onToggleMedio={(medio) => toggleMedio(banco.id, medio)}
                    onActivarConMedio={(medio) => setSeleccion(prev => ({ ...prev, [banco.id]: new Set([medio]) }))}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      <div className="bancos-footer">
        {nSeleccionados > 0 && (
          <p className="bancos-footer-hint">
            {nSeleccionados} medio{nSeleccionados > 1 ? 's' : ''} seleccionado{nSeleccionados > 1 ? 's' : ''}
            {' — '}usamos la mejor promo de cada cadena
          </p>
        )}
        <button
          className="btn-primary btn-aplicar"
          onClick={handleAplicar}
          disabled={nSeleccionados === 0}
        >
          {nSeleccionados > 0 ? 'Ver resultados con reintegros' : 'Seleccioná al menos un banco'}
        </button>
        <button className="btn-ghost btn-omitir" onClick={onOmitir}>
          Omitir — ver resultados sin promos
        </button>
      </div>
    </div>
  )
}

// ── BancoCard ─────────────────────────────────────────────────────────────────

function BancoCard({ banco, dia, estaSeleccionado, mediosSeleccionados, onToggleBanco, onToggleMedio, onActivarConMedio }) {
  const tienePromoHoy = banco.tiene_promo_hoy

  // Calcular la mejor promo hoy para previsualización
  const mejorPromoHoy = banco.todas_promos
    ? banco.todas_promos
        .filter(p => p.descuento_pct > 0 && (!p.dias_semana?.length || p.dias_semana.includes(dia)))
        .sort((a, b) => b.descuento_pct - a.descuento_pct)[0]
    : null

  return (
    <div className={`banco-card${estaSeleccionado ? ' banco-card-selected' : ''}`}>
      <div className="banco-card-header" onClick={onToggleBanco}>
        <div className="banco-card-left">
          <div className={`banco-checkbox${estaSeleccionado ? ' checked' : ''}`}>
            {estaSeleccionado && <span className="banco-check-mark">✓</span>}
          </div>
          <div className="banco-logo-wrap">
            <BancoLogo bancoId={banco.id} />
          </div>
          <div className="banco-info">
            <span className="banco-label">{banco.label}</span>
            <div className="banco-badges-row">
              {tienePromoHoy && mejorPromoHoy && (
                <span className="banco-hoy-badge">🔥 {mejorPromoHoy.descuento_pct}% hoy</span>
              )}
              {tienePromoHoy && !mejorPromoHoy && (
                <span className="banco-hoy-badge">Promo hoy</span>
              )}
            </div>
          </div>
        </div>
        <span className="banco-expand-arrow">{estaSeleccionado ? '▲' : '▼'}</span>
      </div>

      {banco.nota && <p className="banco-nota">{banco.nota}</p>}

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
                if (!estaSeleccionado) onActivarConMedio(medio)
                else onToggleMedio(medio)
              }}
            >
              <span>{info.icon}</span>
              <span>{info.label}</span>
            </button>
          )
        })}
      </div>

      {estaSeleccionado && banco.todas_promos && banco.todas_promos.length > 0 && (
        <div className="banco-promos">
          <p className="banco-promos-title">Promos disponibles <span className="banco-promos-hint">(se aplica la mejor)</span></p>
          {banco.todas_promos
            .filter(p => p.descuento_pct > 0 || p.cuotas_sin_interes > 0)
            .sort((a, b) => b.descuento_pct - a.descuento_pct)
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
                    {p.cadenas_aplica?.length > 0 ? p.cadenas_aplica.join(', ') : 'Todas las cadenas'}
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
                  {!esHoy && <span className="promo-pill-nodia">No aplica hoy</span>}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

// ── Fallback si la API no responde ────────────────────────────────────────────
const BANCOS_FALLBACK = [
  {
    id: 'Banco Nación',
    label: 'Banco Nación',
    medios: ['credito'],
    es_billetera: false,
    nota: 'Requiere tarjeta de crédito BNA o pago con QR MODO',
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
    es_billetera: false,
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
    id: 'Banco Galicia',
    label: 'Banco Galicia',
    medios: ['credito'],
    es_billetera: false,
    nota: '12 cuotas sin interés en Cencosud (Jumbo, Disco, Vea)',
    cadenas_principales: ['Jumbo', 'Disco', 'Vea'],
    tiene_promo_hoy: true,
    promos_hoy: [],
    todas_promos: [
      { nombre: 'Galicia 12 cuotas s/i Cencosud', descuento_pct: 0, tope_reintegro: 0, cadenas_aplica: ['Jumbo', 'Disco', 'Vea'], dias_semana: [], medio: 'credito', cuotas_sin_interes: 12 },
    ],
  },
  {
    id: 'Banco Macro',
    label: 'Banco Macro',
    medios: ['credito', 'debito'],
    es_billetera: false,
    nota: 'Promos en supermercados seleccionados',
    cadenas_principales: ['Carrefour', 'Jumbo', 'Disco'],
    tiene_promo_hoy: true,
    promos_hoy: [],
    todas_promos: [
      { nombre: 'Macro 25% Martes Carrefour', descuento_pct: 25, tope_reintegro: 15000, cadenas_aplica: ['Carrefour'], dias_semana: [1], medio: 'credito', cuotas_sin_interes: 0 },
      { nombre: 'Macro 20% Jueves Cencosud', descuento_pct: 20, tope_reintegro: 20000, cadenas_aplica: ['Jumbo', 'Disco', 'Vea'], dias_semana: [3], medio: 'credito', cuotas_sin_interes: 0 },
    ],
  },
  {
    id: 'BBVA',
    label: 'BBVA',
    medios: ['credito', 'debito'],
    es_billetera: false,
    nota: 'Promos variables — verificar en la app BBVA',
    cadenas_principales: ['Carrefour', 'Coto', 'Jumbo'],
    tiene_promo_hoy: false,
    promos_hoy: [],
    todas_promos: [
      { nombre: 'BBVA 20% Viernes Carrefour', descuento_pct: 20, tope_reintegro: 15000, cadenas_aplica: ['Carrefour'], dias_semana: [4], medio: 'credito', cuotas_sin_interes: 0 },
      { nombre: 'BBVA 15% Miércoles Coto', descuento_pct: 15, tope_reintegro: 10000, cadenas_aplica: ['Coto'], dias_semana: [2], medio: 'debito', cuotas_sin_interes: 0 },
    ],
  },
  {
    id: 'Banco Supervielle',
    label: 'Banco Supervielle',
    medios: ['debito'],
    es_billetera: false,
    nota: 'Solo jubilados con haberes en Supervielle',
    cadenas_principales: ['Jumbo', 'Disco', 'Vea', 'Chango Más'],
    tiene_promo_hoy: false,
    promos_hoy: [],
    todas_promos: [
      { nombre: 'Supervielle 20% Martes Cencosud', descuento_pct: 20, tope_reintegro: 25000, cadenas_aplica: ['Jumbo', 'Disco', 'Vea', 'Chango Más'], dias_semana: [1], medio: 'debito', cuotas_sin_interes: 0 },
    ],
  },
  {
    id: 'Banco Santander',
    label: 'Banco Santander',
    medios: ['credito'],
    es_billetera: false,
    nota: 'Promos en cadenas seleccionadas',
    cadenas_principales: ['Carrefour', 'Día'],
    tiene_promo_hoy: false,
    promos_hoy: [],
    todas_promos: [
      { nombre: 'Santander 20% Lunes Carrefour', descuento_pct: 20, tope_reintegro: 12000, cadenas_aplica: ['Carrefour'], dias_semana: [0], medio: 'credito', cuotas_sin_interes: 0 },
    ],
  },
  // ── Billeteras virtuales ───────────────────────────────────────────────────
  {
    id: 'Mercado Pago',
    label: 'Mercado Pago',
    medios: ['billetera'],
    es_billetera: true,
    nota: 'Promo variable — verificar en la app antes de ir al super',
    cadenas_principales: ['Carrefour', 'Coto', 'Día', 'Vea', 'Chango Más'],
    tiene_promo_hoy: true,
    promos_hoy: [],
    todas_promos: [
      { nombre: 'MercadoPago 25% QR', descuento_pct: 25, tope_reintegro: 5000, cadenas_aplica: ['Carrefour', 'Coto', 'Día', 'Vea', 'Chango Más'], dias_semana: [], medio: 'billetera', cuotas_sin_interes: 0 },
    ],
  },
  {
    id: 'Ualá',
    label: 'Ualá',
    medios: ['billetera'],
    es_billetera: true,
    nota: 'Pagá con QR en el super. Promos variables según convenio',
    cadenas_principales: ['Carrefour', 'Día', 'Chango Más'],
    tiene_promo_hoy: true,
    promos_hoy: [],
    todas_promos: [
      { nombre: 'Ualá 20% QR supermercados', descuento_pct: 20, tope_reintegro: 3000, cadenas_aplica: ['Carrefour', 'Día', 'Chango Más'], dias_semana: [], medio: 'billetera', cuotas_sin_interes: 0 },
    ],
  },
  {
    id: 'Personal Pay',
    label: 'Personal Pay',
    medios: ['billetera'],
    es_billetera: true,
    nota: 'Billetera virtual de Personal. Verificar promos vigentes en la app',
    cadenas_principales: ['Carrefour', 'Jumbo', 'Disco'],
    tiene_promo_hoy: false,
    promos_hoy: [],
    todas_promos: [
      { nombre: 'Personal Pay 15% QR', descuento_pct: 15, tope_reintegro: 4000, cadenas_aplica: ['Carrefour', 'Jumbo', 'Disco'], dias_semana: [], medio: 'billetera', cuotas_sin_interes: 0 },
    ],
  },
  {
    id: 'Naranja X',
    label: 'Naranja X',
    medios: ['billetera', 'credito'],
    es_billetera: true,
    nota: 'Tarjeta y billetera. Promos frecuentes en supermercados',
    cadenas_principales: ['Carrefour', 'Coto', 'Día'],
    tiene_promo_hoy: true,
    promos_hoy: [],
    todas_promos: [
      { nombre: 'Naranja X 30% Miércoles', descuento_pct: 30, tope_reintegro: 8000, cadenas_aplica: ['Carrefour', 'Coto', 'Día'], dias_semana: [2], medio: 'billetera', cuotas_sin_interes: 0 },
      { nombre: 'Naranja X 15% resto de días', descuento_pct: 15, tope_reintegro: 4000, cadenas_aplica: ['Carrefour', 'Coto', 'Día'], dias_semana: [], medio: 'credito', cuotas_sin_interes: 0 },
    ],
  },
]
