import { useState } from 'react'
import { BannerDatosViejos } from './CacheBanner'
import { PrecioNormalizado } from './PrecioNormalizado'
import './precio-normalizado.css'

const CADENA_COLORS = {
  'Jumbo':      '#00843D',
  'Disco':      '#E30613',
  'Vea':        '#F7A800',
  'Coto':       '#E8001B',
  'Día':        '#E3000F',
  'Carrefour':  '#004B98',
  'Chango Más': '#FF6B00',
}

function fmt(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

/** Porcentaje con una decimal, en formato local. Siempre en valor absoluto:
 *  el signo lo pone el texto ("bajo" / "sobre"), no el número. */
function fmtPct(n) {
  return Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** "a", "a ni b", "a, b ni c" — para enumerar lo que nadie tiene. */
function listaNi(xs) {
  if (xs.length <= 1) return xs[0] || ''
  return `${xs.slice(0, -1).join(', ')} ni ${xs[xs.length - 1]}`
}

/** "a", "a y b", "a, b y c" — para enumerar quién sí lo tiene. */
function listaY(xs) {
  if (xs.length <= 1) return xs[0] || ''
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
}

// ── Textos del paso 3 ─────────────────────────────────────────────────────────
//
// Los seis estados de una fila y el delta contra el promedio de mercado. Nada de
// esto se calcula acá: el backend manda `estado`, `delta_pct` y `promedio` ya
// resueltos (main.py:_estado_fila / _fichas). Este archivo solo los pone en
// palabras. El nombre de las unidades sale de `unidad_base`, que solo vale
// g | ml | m | u (precios_vtex.py:146).

const UNIDAD_NOMBRE = { g: 'gramos', ml: 'mililitros', m: 'metros', u: 'unidades' }
const unidadNombre = (u) => UNIDAD_NOMBRE[u] || u

/**
 * El % grande de la ficha. Es `delta_pct_sin_promo`: góndola contra góndola.
 * El `final` le resta el reintegro a un promedio que NO lo tiene, así que da
 * negativo para toda cadena con promo y no compara nada — va como línea chica.
 * Un null nunca se muestra como 0%: "no tengo con qué compararlo" y "estoy justo
 * en el promedio" son cosas distintas.
 */
function textoDelta(pct) {
  if (pct == null) return { texto: 'sin comparación por unidad', mod: 'nulo' }
  if (pct === 0)   return { texto: 'en el promedio', mod: 'neutro' }
  if (pct < 0)     return { texto: `↓ ${fmtPct(pct)}% bajo el promedio`, mod: 'bajo' }
  // Por encima del promedio no se recorta a cero: es justo la información útil.
  return { texto: `↑ ${fmtPct(pct)}% sobre el promedio`, mod: 'sobre' }
}

/** El % de una fila del detalle, en chico y al lado del $/unidad. */
function textoDeltaFila(pct) {
  if (pct == null) return null
  if (pct === 0) return { texto: '0,0%', mod: 'neutro' }
  return { texto: `${pct < 0 ? '−' : '+'}${fmtPct(pct)}%`, mod: pct < 0 ? 'bajo' : 'sobre' }
}

/**
 * Por qué una fila no muestra porcentaje. Ninguno de los cinco casos puede
 * quedarse en un guion o un cero: eran indistinguibles entre sí y ese era el bug.
 */
function descripcionEstado(d) {
  switch (d.estado) {
    case 'faltante':
      return { tag: 'no lo tiene', mod: 'faltante', nota: null }
    case 'manual':
      return { tag: 'precio cargado a mano', mod: 'info',
               nota: 'Sin precio por unidad para comparar.' }
    case 'sin_metrica':
      return { tag: 'sin unidad de contenido', mod: 'info',
               nota: 'No se puede comparar por unidad de contenido con las otras cadenas.' }
    case 'unico':
      // NO dice "única cadena que lo tiene": el backend marca `unico` cuando
      // promedio.n_cadenas < 2, y n_cadenas solo cuenta cadenas con precio por
      // unidad comparable (main.py:1795-1812 descarta las que no parsearon
      // métrica o quedaron en otra unidad). Otra cadena puede tener el producto
      // y aparecer con precio dos fichas más abajo: afirmar exclusividad sería
      // contradecir la propia pantalla.
      return { tag: 'única con precio por unidad comparable', mod: 'info',
               nota: 'Ninguna otra cadena lo trae con una unidad de contenido con la que compararlo.' }
    case 'unidad_distinta':
      return { tag: 'medido en otra unidad', mod: 'info',
               nota: `Acá viene por ${unidadNombre(d.precio_por_100u?.unidad_base)}; las otras cadenas, por ${unidadNombre(d.promedio?.unidad_base)}. El $/unidad no es comparable.` }
    default:
      return { tag: null, mod: null, nota: null }
  }
}

// ── Share helpers ─────────────────────────────────────────────────────────────

/**
 * Copia `text` al portapapeles con fallback para http / móviles.
 * Devuelve true si tuvo éxito.
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Genera la URL de la página actual con los resultados de una cadena
 * codificados en el hash, para poder compartir/recrear la vista.
 * El receptor puede leer window.location.hash para restaurar el estado.
 */
function generarUrlResultados(cadena, detalle, total) {
  const payload = { cadena, detalle, total }
  const encoded = encodeURIComponent(btoa(JSON.stringify(payload)))
  const base = window.location.origin + window.location.pathname
  return `${base}#resultado=${encoded}`
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook pequeño para manejar el estado de feedback del botón compartir.
 * Devuelve [msg, triggerShare] donde msg es null | 'copiado' | 'error'.
 */
function useShareButton() {
  const [msg, setMsg] = useState(null)

  const triggerShare = async (url) => {
    const ok = await copyToClipboard(url)
    setMsg(ok ? 'copiado' : 'error')
    setTimeout(() => setMsg(null), 2500)
  }

  return [msg, triggerShare]
}

// ─────────────────────────────────────────────────────────────────────────────

/** Botón de compartir reutilizable con feedback visual inline */
function ShareButton({ url, className = 'back-btn', title = 'Compartir resultados' }) {
  const [shareMsg, triggerShare] = useShareButton()

  return (
    <button
      className={className}
      onClick={() => triggerShare(url)}
      title={title}
      style={{ position: 'relative' }}
    >
      {shareMsg === 'copiado' ? '✓' : shareMsg === 'error' ? '✗' : '🔗'}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ResultsScreen({ results, location, radioKm, onBack, onEditBasket, onRecompare, canasta }) {
  const [tab, setTab] = useState('fichas') // fichas | optimo
  const [expanded, setExpanded] = useState(null)

  const { fichas, sin_ninguna_cadena, n_pedidos, optimo, elapsed_s, n_precios,
          fecha_datos, datos_degradados, aviso_datos, origen_precios, fuente } = results

  // El backend de Render y el frontend de Vercel despliegan por separado. Si acá
  // llega una respuesta sin `fichas`, la pantalla lo dice: degradar en silencio al
  // ranking viejo sería mostrar un podio afirmando que es la comparación nueva.
  if (!Array.isArray(fichas)) {
    return (
      <div className="results-screen">
        <div className="results-topbar">
          <button className="back-btn" onClick={onBack}>← Volver</button>
        </div>
        <div className="backend-viejo">
          El servidor devolvió un formato viejo de resultados. Probá de nuevo en un minuto;
          si sigue igual, el backend está desactualizado.
        </div>
      </div>
    )
  }

  const sinNinguna = sin_ninguna_cadena || []
  // n_comparables por construcción: la canasta pedida menos lo que no tiene nadie.
  const nComparables = Math.max((n_pedidos || 0) - sinNinguna.length, 0)

  // De dónde salieron estos precios. El backend puede servir del SEPA o de las
  // tiendas online, y el usuario tiene que poder distinguirlos: los online son
  // de hoy pero por cadena, los del SEPA son por sucursal pero pueden ser viejos.
  const online = origen_precios === 'online'
  const cadenasCaidas = Object.keys(fuente?.cadenas_fallidas || {})
  const sinMatch = fuente?.productos_sin_match || []

  const optimoItemsOk = optimo?.items?.filter(i => i.ok) || []
  const nSupersOptimo = Object.keys(optimo?.cadenas_usadas || {}).length

  const loc = location?.provincia
    ? `${location.provincia}`
    : `${radioKm}km a la redonda`

  // URL para compartir la vista completa de resultados (toda la página actual)
  const urlResultadosCompletos = window.location.href

  return (
    <div className="results-screen">
      <div className="results-topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <span className="results-loc">📍 {loc}</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {/* Compartir resultados completos */}
          <ShareButton
            url={urlResultadosCompletos}
            title="Compartir estos resultados"
          />
          <button className="back-btn" onClick={onRecompare}>↺</button>
        </div>
      </div>

      {/* El aviso de precios viejos va acá arriba, pegado a los precios. Abajo
          del todo ya existe la fecha en letra chica, pero cuando los datos son
          viejos el usuario tiene que enterarse ANTES de decidir dónde comprar. */}
      {(datos_degradados || aviso_datos) && (
        <BannerDatosViejos aviso={aviso_datos} fecha={fecha_datos} />
      )}

      {/* Con precios online no hay comparación entre sucursales de una misma
          cadena: es un precio por cadena. Decirlo evita que el usuario crea que
          el resultado es más preciso de lo que es. */}
      {online && (
        <div className="origen-precios">
          <span className="origen-precios-icono">🛒</span>
          <span className="origen-precios-texto">
            Precios de las tiendas online, actualizados hoy.
            {cadenasCaidas.length > 0
              ? ` No respondieron: ${cadenasCaidas.join(', ')}.`
              : ''}
            {sinMatch.length > 0
              ? ` Sin precio para: ${sinMatch.slice(0, 3).join(', ')}${sinMatch.length > 3 ? '…' : ''}.`
              : ''}
          </span>
        </div>
      )}

      {/* Lo que NINGUNA cadena tiene sale del divisor: no es mérito ni demérito
          de nadie. Va nombrado arriba de todo para que el "3 de 4" de las fichas
          no se lea como que se perdieron productos por el camino. */}
      {sinNinguna.length > 0 && (
        <div className="fichas-aviso">
          <span className="fichas-aviso-icono">ⓘ</span>
          <span className="fichas-aviso-texto">
            Ninguna cadena tiene {listaNi(sinNinguna)}. Quedan fuera de la comparación
            en lugar de restarle a todas.{' '}
            {nComparables > 0
              ? `Abajo se comparan los otros ${nComparables} productos de tu canasta.`
              : 'No queda ningún producto de tu canasta para comparar.'}
          </span>
        </div>
      )}

      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === 'fichas' ? 'active' : ''}`}
          onClick={() => setTab('fichas')}
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

      {tab === 'fichas' && (
        <div className="fichas-list">
          {fichas.map(ficha => (
            <FichaCadena
              key={ficha.cadena}
              ficha={ficha}
              expanded={expanded === ficha.cadena}
              onToggle={() => setExpanded(expanded === ficha.cadena ? null : ficha.cadena)}
            />
          ))}
          {fichas.length === 0 && (
            <p className="fichas-vacio">No se consultó ninguna cadena en tu zona.</p>
          )}
        </div>
      )}

      {tab === 'optimo' && optimo && (
        <div className="optimo-section">
          {/* Mismo criterio que la ficha vacía: sin productos no se imprime un
              total. fmt(0) da "$0" en el tipo más grande de la pantalla y se lee
              como "gratis", no como "no encontré nada". */}
          <div className="optimo-summary">
            {optimoItemsOk.length === 0 ? (
              <>
                <div className="optimo-total-label">Canasta óptima</div>
                <div className="optimo-vs">
                  No se encontró ninguno de los productos de tu canasta en las cadenas consultadas.
                </div>
              </>
            ) : (
              <>
                <div className="optimo-total-label">Comprando cada producto donde sale más barato</div>
                <div className="optimo-total-value">{fmt(optimo.total_optimo)}</div>
                <div className="optimo-vs">
                  {optimoItemsOk.length} de {nComparables} {nComparables === 1 ? 'producto' : 'productos'}
                  {nSupersOptimo > 0 && ` en ${nSupersOptimo} ${nSupersOptimo === 1 ? 'supermercado' : 'supermercados'}`}
                  {' · sin promos bancarias'}
                </div>
              </>
            )}
          </div>

          <div className="optimo-cadenas">
            {Object.entries(optimo.cadenas_usadas || {}).map(([cadena, prods]) => (
              <div key={cadena} className="optimo-cadena-group">
                <div className="optimo-cadena-name">
                  <span className="cadena-dot" style={{ background: CADENA_COLORS[cadena] || '#888' }} />
                  {cadena} <span className="optimo-cadena-count">({prods.length} {prods.length === 1 ? 'producto' : 'productos'})</span>
                </div>
                <div className="optimo-prods">
                  {prods.map(p => <span key={p} className="optimo-prod-tag">{p}</span>)}
                </div>
              </div>
            ))}
          </div>

          <div className="optimo-items">
            {optimoItemsOk.map(item => (
              <div key={item.producto} className="optimo-item-row">
                <div className="optimo-item-left">
                  <span className="optimo-item-name">{item.producto}</span>
                  <span
                    className="optimo-item-cadena"
                    style={{ color: CADENA_COLORS[item.cadena] || '#888' }}
                  >
                    {item.cadena}
                  </span>
                  <PrecioNormalizado precioUnit={item.precio_por_100u} />
                </div>
                <div className="optimo-item-right">
                  <span className="optimo-item-price">{fmt(item.subtotal)}</span>
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
        {online ? (
          <p className="results-staleness">
            🛒 Precios de tiendas online · {fuente?.cadenas_consultadas?.length || 0} cadenas consultadas
            {fuente?.cobertura_cadenas_pct != null && fuente.cobertura_cadenas_pct < 100
              ? ` (${fuente.cobertura_cadenas_pct}% respondió)`
              : ''}
          </p>
        ) : fecha_datos ? (
          <p className="results-staleness">
            📅 Datos SEPA del {new Date(fecha_datos + 'T12:00:00').toLocaleDateString('es-AR', {
              weekday: 'long', day: 'numeric', month: 'long'
            })}
          </p>
        ) : null}
      </div>
    </div>
  )
}

// ── FichaCadena ───────────────────────────────────────────────────────────────
//
// Una ficha por cadena. Sin podio, sin medalla de "más barato" y sin borde verde
// de ganador: el orden del array viene por cobertura y no afirma nada. Lo que
// compara es el % contra el promedio de mercado, que es independiente de cuántos
// productos tenga la ficha.

function FichaCadena({ ficha, expanded, onToggle }) {
  const [shareMsg, triggerShare] = useShareButton()

  const vacia = ficha.n_disponibles === 0
  const promo = ficha.promo
  const cuotasSolas = !!promo && ficha.reintegro <= 0 && promo.cuotas_sin_interes > 0

  const handleShare = (e) => {
    // Evitar que el click en el botón expanda/colapse la tarjeta
    e.stopPropagation()
    // La URL se arma acá y no en el cuerpo del componente a propósito:
    // generarUrlResultados usa btoa(), que tira InvalidCharacterError con
    // cualquier code point > U+00FF (una comilla tipográfica o un emoji en el
    // nombre que tipeó el usuario). En el render eso dejaba la pantalla entera
    // en blanco — no hay error boundary en el proyecto. Acá, como mucho, falla
    // el botón de compartir. El btoa sigue siendo un bug: ver Resultado, T14.
    triggerShare(generarUrlResultados(ficha.cadena, ficha.detalle, ficha.total_final))
  }

  // Una cadena en el radio que no tiene NADA de la canasta lleva ficha igual:
  // desaparecer se veía idéntico a "no está cerca tuyo". Lo que no lleva es
  // total — `fmt(0)` imprime "$0" y se lee como "gratis".
  if (vacia) {
    return (
      <div className="cadena-card ficha-vacia">
        <div className="cadena-header">
          <div className="cadena-left">
            <div className="cadena-name">
              <span className="cadena-dot" style={{ background: CADENA_COLORS[ficha.cadena] || '#888' }} />
              {ficha.cadena}
            </div>
            <div className="cadena-items">ningún producto</div>
          </div>
        </div>
        <div className="ficha-vacia-texto">
          Está en tu radio, pero no tiene nada de tu canasta.
        </div>
      </div>
    )
  }

  const delta = textoDelta(ficha.delta_pct_sin_promo)
  // El delta con promo solo aporta si efectivamente hay promo y mueve el número.
  // NO se renderiza con textoDelta(): repetir "bajo el promedio" lo presentaría
  // como una segunda comparación válida contra el mercado, que es justo lo que la
  // spec §2 prohíbe — su numerador lleva el reintegro y el promedio no.
  const deltaFinal = ficha.reintegro > 0 && ficha.delta_pct_final != null
    && ficha.delta_pct_final !== ficha.delta_pct_sin_promo
      ? `${ficha.delta_pct_final < 0 ? '−' : '+'}${fmtPct(ficha.delta_pct_final)}%`
      : null

  return (
    <div className="cadena-card" onClick={onToggle}>
      <div className="cadena-header">
        <div className="cadena-left">
          <div className="cadena-name">
            <span
              className="cadena-dot"
              style={{ background: CADENA_COLORS[ficha.cadena] || '#888' }}
            />
            {ficha.cadena}
          </div>
          <div className="cadena-items">
            {ficha.n_disponibles} de {ficha.n_comparables} productos
          </div>
          {/* El rótulo que impide leer el total como "tu canasta". */}
          <div className="ficha-rotulo">
            Comprando {ficha.n_disponibles === 1 ? 'este producto' : `estos ${ficha.n_disponibles}`} acá
          </div>
        </div>

        <div className="cadena-right">
          {ficha.reintegro > 0 ? (
            <>
              <div className="cadena-total-base">{fmt(ficha.total_envase)}</div>
              <div className="cadena-total cadena-total-final">{fmt(ficha.total_final)}</div>
              <div className="cadena-promo">
                −{fmt(ficha.reintegro)} · {promo?.label}
                {promo?.origen && (
                  <span className={`promo-origen promo-origen--${promo.origen === 'sitio' ? 'sitio' : 'manual'}`}>
                    {promo.origen === 'sitio' ? 'del sitio' : 'a mano'}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="cadena-total">{fmt(ficha.total_final)}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {/* Botón compartir esta cadena */}
            <button
              className="share-cadena-btn"
              onClick={handleShare}
              title={`Compartir precios de ${ficha.cadena}`}
            >
              {shareMsg === 'copiado' ? '✓' : shareMsg === 'error' ? '✗' : '🔗'}
            </button>
            <span className="expand-arrow">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
      </div>

      {/* Promos que NO bajan el total (cuotas sin interés). Van separadas del
          precio a propósito: junto al total parecerían un descuento aplicado. */}
      {cuotasSolas && (
        <div className="promo-sin-descuento">
          🏦 {promo.label}
          <span className="promo-nota">
            {promo.cuotas_sin_interes} cuotas sin interés — no baja el total
          </span>
          {promo.origen && (
            <span className={`promo-origen promo-origen--${promo.origen === 'sitio' ? 'sitio' : 'manual'}`}>
              {promo.origen === 'sitio' ? 'del sitio' : 'a mano'}
            </span>
          )}
        </div>
      )}

      <div className="ficha-delta-bloque">
        <div className={`ficha-delta ficha-delta--${delta.mod}`}>{delta.texto}</div>
        <div className="ficha-delta-n">
          {ficha.n_con_promedio > 0
            ? `sobre ${ficha.n_con_promedio} de ${ficha.n_comparables} productos, a precio de góndola sin promos`
            : 'ningún producto de esta ficha se puede comparar por unidad'}
        </div>
        {deltaFinal && (
          <div className="ficha-delta-promo">
            con {promo?.label}: {deltaFinal}
          </div>
        )}
      </div>

      {/* El faltante va en la tarjeta colapsada: el usuario compara sin expandir. */}
      {ficha.faltantes?.length > 0 && (
        <div className="ficha-faltantes">
          Le falta: {ficha.faltantes.join(', ')}
        </div>
      )}

      {/* Toast de feedback inline */}
      {shareMsg && (
        <div className={`share-toast ${shareMsg === 'copiado' ? 'share-toast-ok' : 'share-toast-err'}`}>
          {shareMsg === 'copiado'
            ? '✓ Link copiado al portapapeles'
            : '✗ No se pudo copiar. Copiá la URL desde la barra del navegador.'}
        </div>
      )}

      {expanded && (
        <div className="cadena-detail">
          {ficha.detalle.map(d => <FilaDetalle key={d.producto} d={d} />)}
          {ficha.reintegro > 0 && (
            <div className="detail-promo-row">
              <span>🏦 {promo?.label}</span>
              <span>−{fmt(ficha.reintegro)}</span>
            </div>
          )}
          <div className="detail-total-row">
            <span>Total a pagar</span>
            <span>{fmt(ficha.total_final)}</span>
          </div>
          <PieDetalle detalle={ficha.detalle} />
        </div>
      )}
    </div>
  )
}

// ── FilaDetalle ───────────────────────────────────────────────────────────────

function FilaDetalle({ d }) {
  const info = descripcionEstado(d)
  const delta = textoDeltaFila(d.delta_pct)
  const esFaltante = d.estado === 'faltante'

  return (
    <div className={`detail-row ${esFaltante ? 'detail-row--faltante' : ''}`}>
      <div className="fila-izq">
        <span className="detail-prod">{d.producto}</span>

        {/* Qué producto concreto representa al ítem. Depende de que
            `desc_ganadora` viaje siempre (Tarea 21): hoy las filas manual y
            sin_metrica no lo tienen, y entonces la fila va sin subtítulo. */}
        {d.precio_por_100u?.desc_ganadora && (
          <span className="fila-sub">{d.precio_por_100u.desc_ganadora}</span>
        )}

        <span className="fila-metrica">
          {/* PrecioNormalizado devuelve null solo si no hay `valor`: cubre las
              filas manual y las sin_metrica que igual traen precio_por_100u
              (pasa cuando precio_base <= 0 y main.py:1802 las saca del promedio). */}
          {!esFaltante && <PrecioNormalizado precioUnit={d.precio_por_100u} />}
          {delta && <span className={`fila-delta fila-delta--${delta.mod}`}>{delta.texto}</span>}
          {info.tag && <span className={`fila-tag fila-tag--${info.mod}`}>{info.tag}</span>}
        </span>

        {info.nota && <span className="fila-nota">{info.nota}</span>}

        {/* Saber quién sí lo tiene es accionable; un guion no. */}
        {esFaltante && d.tambien_en?.length > 0 && (
          <span className="fila-tambien-en">Sí lo {d.tambien_en.length === 1 ? 'tiene' : 'tienen'} {listaY(d.tambien_en)}</span>
        )}

        {!esFaltante && d.cantidad > 1 && (
          <span className="fila-cantidad">{d.cantidad} × {fmt(d.precio_unit)}</span>
        )}
      </div>

      <div className="fila-precio">{esFaltante ? '' : fmt(d.subtotal)}</div>
    </div>
  )
}

// ── PieDetalle ────────────────────────────────────────────────────────────────
//
// El `n` de cada promedio va SIEMPRE visible: en algunas zonas responden tres
// cadenas y en algunos productos dos, y un promedio de dos no es "el mercado".

function PieDetalle({ detalle }) {
  // Solo las filas que EFECTIVAMENTE muestran un %. El backend adjunta `promedio`
  // a toda fila comparable (main.py:1877), faltantes incluidas: filtrar por
  // `promedio` haría que el pie enumere productos que esta ficha no compara.
  const conPromedio = detalle.filter(d => d.delta_pct != null && d.promedio?.n_cadenas > 0)
  if (conPromedio.length === 0) return null

  // El backend declara el estimador para que nadie lo lea como una media.
  const estimador = conPromedio[0].promedio.estimador

  // La palabra "cadena/s" va en todos, no solo en el primero: un "yerba mate 1"
  // suelto no se lee como un n, y justo el n=1 es el que más importa mostrar.
  const ns = conPromedio.map(d => {
    const n = d.promedio.n_cadenas
    return `${d.producto} ${n} ${n === 1 ? 'cadena' : 'cadenas'}`
  })

  return (
    <p className="detalle-pie">
      El % de cada fila compara el precio por unidad de contenido contra el promedio
      {estimador ? ` (${estimador})` : ''} de las cadenas que traen ese producto con una
      unidad de contenido comparable: {ns.join(', ')}. El total de arriba es el precio real
      de los envases que se compran, no el precio por unidad.
    </p>
  )
}
