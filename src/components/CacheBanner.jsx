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
 * Cubre los estados que el backend distingue desde el roadmap 0.2/0.3.
 * El caso importante es `datos_degradados`: ahí `listo` es true, así que el
 * banner viejo — que solo se mostraba con `!listo` — desaparecía y el usuario
 * veía precios de hace días sin ningún aviso.
 *
 * `listo` es del SEPA, no de la app: desde que los precios salen de las webs de
 * las cadenas, `listo: false` es el estado NORMAL y no significa que falte nada.
 * Por eso el caso 4 mira `fuente_precios` antes de hablar de errores.
 *
 * Sin botones (etapa 1 del retiro del SEPA, 18/10): eran lo único de la
 * interfaz que disparaba la descarga manual del SEPA, y esa descarga no mira
 * FUENTE_PRECIOS en el backend. La función del hook queda sin llamadores
 * hasta la etapa 3.
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
    return (
      <div className="cache-banner cache-banner--viejo">
        <span className="cache-banner-icono">🕐</span>
        <span className="cache-banner-texto">
          {s.aviso_datos || `Mostrando precios del ${fechaCorta(s.fecha_datos)}: el SEPA no respondió.`}
        </span>
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

  // 4. El SEPA no está cargado, pero los precios salen de las webs de las
  //    cadenas: la app funciona igual, y con datos más frescos. No es una falla
  //    y no se presenta como tal. Antes acá salía "⚠ Datos no cargados" o "No se
  //    pudieron cargar los precios" —las dos falsas— y el error crudo del
  //    backend impreso en pantalla, con la URL del dataset del SEPA adentro.
  //    Acá estaba el botón de carga manual del SEPA: se fue en la etapa 1.
  if (s.fuente_precios && s.fuente_precios !== 'sepa') {
    return (
      <div className="cache-banner cache-banner--info">
        <span className="cache-banner-icono">🛒</span>
        <span className="cache-banner-texto">
          Precios tomados de las webs de los supermercados.
        </span>
      </div>
    )
  }

  // 5. Configurado para depender solo del SEPA y falló: acá sí no hay precios.
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
        </div>
      </div>
    )
  }

  // 6. Sin datos y sin ningún intento todavía.
  return (
    <div className="cache-banner">
      <span className="cache-banner-texto">⚠ Datos no cargados.</span>
    </div>
  )
}
