import { useState } from 'react'

const CADENA_COLORS = {
  'Jumbo':      '#00843D',
  'Disco':      '#E30613',
  'Vea':        '#F7A800',
  'Coto':       '#E8001B',
  'Día':        '#E3000F',
  'Carrefour':  '#004B98',
  'Chango Más': '#FF6B00',
}

const CADENA_EMOJI = {
  'Jumbo': '🟢', 'Disco': '🔴', 'Vea': '🟡',
  'Coto': '🔴', 'Día': '🔴', 'Carrefour': '🔵', 'Chango Más': '🟠',
}

function fmt(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function pct(a, b) {
  if (!b || b === 0) return 0
  return Math.round((a / b) * 100)
}

export default function ResultsScreen({ results, location, radioKm, onBack, onEditBasket, onRecompare }) {
  const [tab, setTab] = useState('ranking') // ranking | optimo
  const [expanded, setExpanded] = useState(null)

  const { ranking, optimo, elapsed_s, n_precios } = results

  const best = ranking[0]
  const worst = ranking[ranking.length - 1]
  const savings = worst && best ? worst.total_final - best.total_final : 0

  const loc = location?.provincia
    ? `${location.provincia}`
    : `${radioKm}km a la redonda`

  return (
    <div className="results-screen">
      <div className="results-topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <span className="results-loc">📍 {loc}</span>
        <button className="back-btn" onClick={onRecompare}>↺</button>
      </div>

      {savings > 0 && (
        <div className="savings-banner">
          <span className="savings-text">Ahorrás hasta</span>
          <span className="savings-amount">{fmt(savings)}</span>
          <span className="savings-text">eligiendo bien</span>
        </div>
      )}

      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === 'ranking' ? 'active' : ''}`}
          onClick={() => setTab('ranking')}
        >
          Por supermercado
        </button>
        <button
          className={`tab-btn ${tab === 'optimo' ? 'active' : ''}`}
          onClick={() => setTab('optimo')}
        >
          Canasta óptima
        </button>
      </div>

      {tab === 'ranking' && (
        <div className="ranking-list">
          {ranking.map((item, i) => (
            <div
              key={item.cadena}
              className={`cadena-card ${i === 0 ? 'cadena-best' : ''}`}
              onClick={() => setExpanded(expanded === item.cadena ? null : item.cadena)}
            >
              <div className="cadena-header">
                <div className="cadena-left">
                  {i === 0 && <div className="best-badge">Más barato</div>}
                  <div className="cadena-name">
                    <span
                      className="cadena-dot"
                      style={{ background: CADENA_COLORS[item.cadena] || '#888' }}
                    />
                    {item.cadena}
                  </div>
                  <div className="cadena-items">
                    {item.n_encontrados}/{item.n_total} productos encontrados
                  </div>
                </div>
                <div className="cadena-right">
                  <div className="cadena-total">{fmt(item.total_final)}</div>
                  {item.reintegro > 0 && (
                    <div className="cadena-promo">
                      -{fmt(item.reintegro)} con {item.mejor_promo}
                    </div>
                  )}
                  <span className="expand-arrow">{expanded === item.cadena ? '▲' : '▼'}</span>
                </div>
              </div>

              {expanded === item.cadena && (
                <div className="cadena-detail">
                  <div className="detail-row detail-header">
                    <span>Producto</span>
                    <span>Precio unit.</span>
                    <span>Subtotal</span>
                  </div>
                  {item.detalle.map(d => (
                    <div
                      key={d.producto}
                      className={`detail-row ${!d.ok ? 'detail-missing' : ''}`}
                    >
                      <span className="detail-prod">{d.producto}</span>
                      <span>{d.ok ? fmt(d.precio_unit) : '—'}</span>
                      <span>{d.ok ? fmt(d.subtotal) : '—'}</span>
                    </div>
                  ))}
                  {item.reintegro > 0 && (
                    <div className="detail-promo-row">
                      <span>🏦 {item.mejor_promo}</span>
                      <span>-{fmt(item.reintegro)}</span>
                    </div>
                  )}
                  <div className="detail-total-row">
                    <span>Total a pagar</span>
                    <span>{fmt(item.total_final)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'optimo' && (
        <div className="optimo-section">
          <div className="optimo-summary">
            <div className="optimo-total-label">Total canasta óptima</div>
            <div className="optimo-total-value">{fmt(optimo.total_optimo)}</div>
            {savings > 0 && best && (
              <div className="optimo-vs">
                vs {fmt(best.total_final)} en {best.cadena} solo
              </div>
            )}
          </div>

          <div className="optimo-cadenas">
            {Object.entries(optimo.cadenas_usadas).map(([cadena, prods]) => (
              <div key={cadena} className="optimo-cadena-group">
                <div className="optimo-cadena-name">
                  <span className="cadena-dot" style={{ background: CADENA_COLORS[cadena] || '#888' }} />
                  {cadena} <span className="optimo-cadena-count">({prods.length} productos)</span>
                </div>
                <div className="optimo-prods">
                  {prods.map(p => <span key={p} className="optimo-prod-tag">{p}</span>)}
                </div>
              </div>
            ))}
          </div>

          <div className="optimo-items">
            {optimo.items.filter(i => i.ok).map(item => (
              <div key={item.producto} className="optimo-item-row">
                <div className="optimo-item-left">
                  <span className="optimo-item-name">{item.producto}</span>
                  <span
                    className="optimo-item-cadena"
                    style={{ color: CADENA_COLORS[item.cadena] || '#888' }}
                  >
                    {item.cadena}
                  </span>
                </div>
                <div className="optimo-item-right">
                  <span className="optimo-item-price">{fmt(item.precio_unit)}</span>
                  {item.ahorro > 0 && (
                    <span className="optimo-item-saving">-{fmt(item.ahorro)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="results-footer">
        <button className="btn-ghost" onClick={onEditBasket}>✏ Editar canasta</button>
        <p className="results-meta">
          {n_precios?.toLocaleString('es-AR')} precios procesados en {elapsed_s}s
        </p>
      </div>
    </div>
  )
}
