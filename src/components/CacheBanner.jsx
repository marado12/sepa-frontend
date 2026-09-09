import { fechaCorta } from '../useCacheStatus'

/** "2026-09-09T05:12:03" → "05:12" */
function horaCorta(iso) {
  if (!iso) return null
  const m = /T(\d{2}:\d{2})/.exec(iso)
  return m ? m[1] : null
}

/**
 * Aviso de "estos precios no son de hoy". Presentacional puro, sin polling.
 *
 * Lo usa ResultsScreen con el `aviso_datos` que devolvió /api/comparar: esa
 * respuesta es la afirmación autoritativa sobre los precios que el usuario
 * está mirando en pantalla, más confiable que un /api/status leído después.
 */
export function BannerDatosViejos({ aviso, fecha }) {
  if (!aviso && !fecha) return null
  return (
    <div className="cache-banner cache-banner--viejo">
      <span className="cache-banner-icono">🕐</span>
      <span className="cache-banner-texto">
        {aviso || `Estos precios son del ${fechaCorta(fecha)}, no de hoy.`}
      </span>
    </div>
  )
}

/**
 * Banner de estado del caché SEPA.
 *
 * Presentacional: recibe el estado de useCacheStatus(), que vive una sola vez
 * en App.jsx. Así hay un único poller para toda la app en vez de uno por
 * pantalla, y el footer de HomeScreen puede leer la misma fecha que el banner.
 *
 * Cubre los cuatro estados que el backend distingue desde el roadmap 0.2/0.3.
 * El caso importante es `datos_degradados`: ahí `listo` es true, así que el
 * banner viejo — que solo se mostraba con `!listo` — desaparecía y el usuario
 * veía precios de hace días sin ningún aviso.
 */
export default function CacheBanner({ estado }) {
  const s = estado
  if (!s) return null

  // Todavía no sabemos nada: no mostrar nada en vez de mentir.
  if (!s.recibido) return null

  // Datos de hoy y todo en orden: no molestar.
  if (s.listo && !s.datos_degradados) return null

  // 1. El backend no contesta (en Render, dormido, tarda ~1 min en despertar).
  if (s.sinRespuesta) {
    return (
      <div className="cache-banner cache-banner--error">
        <span className="cache-spinner" />
        <span className="cache-banner-texto">
          Sin respuesta del servidor. Si estuvo inactivo, tarda cerca de un minuto en despertar.
        </span>
      </div>
    )
  }

  // 2. Datos viejos en uso: el SEPA falló pero la app sigue funcionando.
  if (s.datos_degradados) {
    const ocupado = s.refrescando || s.en_progreso
    return (
      <div className="cache-banner cache-banner--viejo">
        <span className="cache-banner-icono">🕐</span>
        <span className="cache-banner-texto">
          {s.aviso_datos || `Mostrando precios del ${fechaCorta(s.fecha_datos)}: el SEPA no respondió.`}
        </span>
        <button className="cache-banner-btn" onClick={s.refrescar} disabled={ocupado}>
          {ocupado ? 'Reintentando…' : 'Reintentar'}
        </button>
      </div>
    )
  }

  // 3. Descarga en curso.
  if (s.en_progreso) {
    return (
      <div className="cache-banner">
        <span className="cache-spinner" />
        <span className="cache-banner-texto">
          Procesando datos del día (~2 min)… Las sugerencias estarán disponibles pronto.
          {s.intentos_fallidos > 0 && s.max_reintentos
            ? ` Reintento ${Math.min(s.intentos_fallidos + 1, s.max_reintentos)} de ${s.max_reintentos}.`
            : ''}
        </span>
      </div>
    )
  }

  // 4. Sin datos, con causa conocida. Antes acá decía solo "Datos no cargados".
  if (s.ultimo_error) {
    const hora = horaCorta(s.ultimo_intento)
    return (
      <div className="cache-banner cache-banner--error">
        <div className="cache-banner-cuerpo">
          <span className="cache-banner-texto">
            <strong>No se pudieron cargar los precios.</strong>
            {s.intentos_fallidos > 0 && ` Falló ${s.intentos_fallidos} ${s.intentos_fallidos === 1 ? 'vez' : 'veces'}.`}
            {hora && ` Último intento ${hora}.`}
          </span>
          <code className="cache-banner-detalle">{s.ultimo_error}</code>
        </div>
        <button className="cache-banner-btn" onClick={s.refrescar} disabled={s.refrescando}>
          {s.refrescando ? 'Reintentando…' : 'Reintentar'}
        </button>
      </div>
    )
  }

  // 5. Sin datos y sin ningún intento todavía.
  return (
    <div className="cache-banner">
      <span className="cache-banner-texto">⚠ Datos no cargados.</span>
      <button className="cache-banner-btn" onClick={s.refrescar} disabled={s.refrescando}>
        {s.refrescando ? 'Iniciando…' : 'Iniciar carga'}
      </button>
    </div>
  )
}
