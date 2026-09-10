import { useState, useEffect, useCallback, useRef } from 'react'

export const API = import.meta.env.VITE_API_URL || 'https://sepa-backend-bk88.onrender.com'

const ESTADO_INICIAL = {
  listo: false,
  en_progreso: false,
  datos_degradados: false,
  fecha_datos: null,
  aviso_datos: null,
  origen: null,
  ultimo_error: null,
  ultimo_intento: null,
  intentos_fallidos: 0,
  max_reintentos: null,
  proximo_reintento: null,
  // `sepa` | `online` | `auto`. Decide si que el SEPA no esté cargado es un
  // problema real o un detalle: con `online`/`auto` la app funciona igual, con
  // precios de las webs de las cadenas.
  fuente_precios: null,
  // No viene del backend: marca que /api/status no contestó (Render dormido,
  // sin red, CORS). Antes esto se tragaba en silencio y era indistinguible
  // de "el caché no está listo".
  sinRespuesta: false,
  // Falso hasta la primera respuesta (o el primer fallo). Evita el parpadeo
  // de "Datos no cargados" mientras el fetch inicial está en vuelo.
  recibido: false,
}

/**
 * Estado del caché SEPA del backend.
 *
 * Reemplaza al hook local que vivía dentro de BasketScreen y solo leía
 * `listo` y `en_progreso` — justo los dos campos que el ítem 0.3 del roadmap
 * declaró insuficientes para saber por qué la app no tiene datos.
 */
export function useCacheStatus({ intervaloMs = 5000 } = {}) {
  const [estado, setEstado] = useState(ESTADO_INICIAL)
  const [refrescando, setRefrescando] = useState(false)
  const intervalRef = useRef(null)

  const leer = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/status`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      setEstado({
        listo:             d.listo ?? false,
        en_progreso:       d.en_progreso ?? false,
        datos_degradados:  d.datos_degradados ?? false,
        fecha_datos:       d.fecha_datos ?? null,
        aviso_datos:       d.aviso_datos ?? null,
        origen:            d.origen ?? null,
        ultimo_error:      d.ultimo_error ?? null,
        ultimo_intento:    d.ultimo_intento ?? null,
        intentos_fallidos: d.intentos_fallidos ?? 0,
        max_reintentos:    d.max_reintentos ?? null,
        proximo_reintento: d.proximo_reintento ?? null,
        fuente_precios:    d.fuente_precios ?? null,
        sinRespuesta:      false,
        recibido:          true,
      })
      return d
    } catch {
      setEstado(prev => ({ ...prev, sinRespuesta: true, recibido: true }))
      return null
    }
  }, [])

  useEffect(() => {
    let cancelado = false

    const parar = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const tick = async () => {
      const d = await leer()
      if (cancelado || !d) return
      // Antes frenaba con `listo` a secas. En modo degradado `listo` también es
      // true, así que hay que seguir mirando: es la única forma de que el banner
      // de "precios viejos" desaparezca solo cuando el SEPA vuelva.
      if (d.listo && !d.datos_degradados) return parar()
      // Si los precios no salen del SEPA, esperar a que cargue no cambia nada de
      // lo que ve el usuario. Sin esto, con el SEPA caído cada pestaña abierta
      // pegaba a /api/status cada 5s para siempre. Mientras haya una descarga en
      // curso sí se sigue: es la única forma de que el botón muestre el avance.
      if (d.fuente_precios && d.fuente_precios !== 'sepa' && !d.en_progreso) parar()
    }

    // El interval se asigna ANTES del primer tick para que parar() tenga algo
    // que limpiar si la primera respuesta ya viene lista.
    intervalRef.current = setInterval(tick, intervaloMs)
    tick()

    return () => { cancelado = true; parar() }
  }, [leer, intervaloMs])

  /** Dispara POST /refresh y reanuda el polling si estaba frenado. */
  const refrescar = useCallback(async () => {
    setRefrescando(true)
    try {
      await fetch(`${API}/refresh`, { method: 'POST' })
      setEstado(prev => ({ ...prev, en_progreso: true, ultimo_error: null }))
      if (!intervalRef.current) {
        intervalRef.current = setInterval(leer, intervaloMs)
      }
    } catch {
      // El polling va a reflejar el resultado real; no inventamos éxito acá.
    } finally {
      setRefrescando(false)
    }
  }, [leer, intervaloMs])

  return { ...estado, refrescar, refrescando }
}

/** "2026-09-08" → "08/09". Devuelve null si no hay fecha. */
export function fechaCorta(iso) {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}` : iso
}
