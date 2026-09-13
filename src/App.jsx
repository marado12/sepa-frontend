import posthog from 'posthog-js'
import { useState, useCallback, useEffect } from 'react'
import HomeScreen from './components/HomeScreen'
import ResultsScreen from './components/ResultsScreen'
import BasketScreen from './components/BasketScreen'
import BancosScreen from './components/BancosScreen'
import { useCacheStatus } from './useCacheStatus'
import './index.css'

posthog.init('phc_uEmS3FzSdncCKRCNPu82HChfR9mF77TKtPTThVVEuWt7', { api_host: 'https://eu.posthog.com' })

const STORAGE_KEY = 'sepa_canasta_historial'
const MAX_HISTORIAL = 5

// ── Helpers localStorage ──────────────────────────────────────────────────────

function leerHistorial() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function guardarEnHistorial(canasta, nombre) {
  const historial = leerHistorial()
  const nueva = {
    id: Date.now(),
    nombre: nombre || `Canasta ${new Date().toLocaleDateString('es-AR')}`,
    fecha: new Date().toISOString(),
    items: canasta,
  }
  const idx = historial.findIndex(h => h.nombre === nueva.nombre)
  if (idx !== -1) {
    historial[idx] = nueva
  } else {
    historial.unshift(nueva)
  }
  const recortado = historial.slice(0, MAX_HISTORIAL)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recortado))
  return recortado
}

// ── Hash sharing helpers ──────────────────────────────────────────────────────

/**
 * Intenta leer una canasta desde el hash de la URL.
 * Formato: #canasta=<base64(JSON)>
 * Retorna el array de items o null si no hay nada válido.
 */
function leerCanastaDesdHash() {
  try {
    const hash = window.location.hash // e.g. "#canasta=eyJpdGVtcy..."
    if (!hash.startsWith('#canasta=')) return null
    const encoded = hash.slice('#canasta='.length)
    if (!encoded) return null
    const json = atob(decodeURIComponent(encoded))
    const items = JSON.parse(json)
    if (!Array.isArray(items) || items.length === 0) return null
    return items
  } catch {
    return null
  }
}

// ── Métricas de PostHog ───────────────────────────────────────────────────────

/**
 * Lo que se manda en `comparacion_completada`, derivado de `fichas`.
 *
 * `ahorro_maximo` se eliminó: era `peor − mejor` del ranking, o sea la diferencia
 * entre dos canastas de cobertura distinta — exactamente el número que el Bloque A
 * paso 3 vino a matar.
 *
 * `n_cadenas` se renombró a `n_fichas` porque cambiaba de población sin cambiar de
 * nombre: era `ranking.length` (cadenas CON precio) y pasaría a ser `fichas.length`
 * (cadenas CONSULTADAS, vacías incluidas). Mismo evento y misma propiedad con dos
 * definiciones distintas mezcladas en una sola serie. `contrato` permite cortarla.
 */
function metricasComparacion(data) {
  const fichas = data?.fichas ?? []
  const sinNinguna = data?.sin_ninguna_cadena ?? []
  // `fichas` ya viene ordenado por cobertura desc: el primero es el de más cobertura.
  const mejorCobertura = fichas[0]
  return {
    contrato: 'fichas_v1',
    n_fichas: fichas.length,
    n_cadenas_con_precio: fichas.filter(f => f.n_disponibles > 0).length,
    cobertura_max: mejorCobertura?.n_disponibles ?? 0,
    // n_comparables por construcción: la canasta pedida menos lo que no tiene nadie.
    n_comparables: Math.max((data?.n_pedidos ?? 0) - sinNinguna.length, 0),
    n_pedidos: data?.n_pedidos ?? 0,
    n_sin_ninguna_cadena: sinNinguna.length,
    delta_pct_mejor_cobertura: mejorCobertura?.delta_pct_sin_promo ?? null,
    elapsed_s: data?.elapsed_s,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState('home') // home | loading | bancos | results | basket
  const [location, setLocation] = useState(null)
  const [radioKm, setRadioKm] = useState(5)
  const [canasta, setCanasta] = useState(null) // null = usar default del backend
  const [diaSeleccionado, setDiaSeleccionado] = useState(null) // null = día actual
  const [results, setResults] = useState(null)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState(null)
  // Datos crudos del /api/comparar antes de aplicar promos (para la pantalla de bancos)
  const [pendingCompareData, setPendingCompareData] = useState(null)

  const API = import.meta.env.VITE_API_URL || 'https://sepa-backend-bk88.onrender.com'

  // Estado del caché SEPA. Vive acá y baja por props para que haya un solo
  // poller contra /api/status, sin importar en qué pantalla esté el usuario.
  const cacheStatus = useCacheStatus()

  // ── Leer canasta compartida desde hash al montar ──────────────────────────
  useEffect(() => {
    const itemsDesdeHash = leerCanastaDesdHash()
    if (itemsDesdeHash) {
      setCanasta(itemsDesdeHash)
      // Limpiar el hash de la URL sin recargar ni agregar entrada al historial
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  const fetchDefaultCanasta = useCallback(async () => {
    if (canasta) return canasta
    try {
      const res = await fetch(`${API}/api/canasta/default`)
      const data = await res.json()
      setCanasta(data.canasta)
      return data.canasta
    } catch {
      return null
    }
  }, [API, canasta])

  // ── Paso 1: comparar sin promos y guardar resultado intermedio ───────────
  const handleCompare = useCallback(async (loc) => {
    setLocation(loc)
    setScreen('loading')
    setError(null)

    posthog.capture('comparacion_iniciada', {
      radio_km: radioKm,
      tiene_canasta_custom: !!canasta,
      dia_seleccionado: diaSeleccionado,
      tipo_ubicacion: loc.lat != null ? 'gps' : 'provincia',
    })

    const msgs = [
      'Conectando con datos SEPA...',
      'Descargando precios del gobierno (puede tomar 30s la primera vez)...',
      'Procesando miles de productos...',
      '¡Casi listo! Calculando la mejor opción para vos...',
    ]
    let mi = 0
    setLoadingMsg(msgs[mi])
    const interval = setInterval(() => {
      mi = Math.min(mi + 1, msgs.length - 1)
      setLoadingMsg(msgs[mi])
    }, 4000)

    try {
      const body = {
        radio_km: radioKm,
        canasta: canasta || [],
        // Sin promos ni bancos — se eligen en la siguiente pantalla
        promos: [],
        bancos_seleccionados: [],
        ...(diaSeleccionado !== null && { dia: diaSeleccionado }),
      }
      if (loc.lat != null) {
        body.lat = loc.lat
        body.lon = loc.lon
      } else {
        body.provincia = loc.provincia
      }

      const res = await fetch(`${API}/api/comparar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      clearInterval(interval)

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Error ${res.status}`)
      }

      const data = await res.json()
      // Guardar resultado y pasar a pantalla de selección de bancos
      setPendingCompareData({ data, body })
      setScreen('bancos')
    } catch (e) {
      clearInterval(interval)
      posthog.capture('comparacion_error', {
        mensaje: e.message,
        tipo_ubicacion: loc.lat != null ? 'gps' : 'provincia',
      })
      setError(e.message)
      setScreen('home')
    }
  }, [API, radioKm, canasta, diaSeleccionado])

  // ── Paso 2a: el usuario eligió bancos → re-comparar con promos ───────────
  const handleAplicarBancos = useCallback(async (bancosSeleccionados) => {
    if (!pendingCompareData) return
    const { body } = pendingCompareData

    setScreen('loading')
    setLoadingMsg('Aplicando reintegros bancarios...')

    try {
      const bodyConBancos = {
        ...body,
        bancos_seleccionados: bancosSeleccionados,
        promos: [],
      }
      const res = await fetch(`${API}/api/comparar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyConBancos),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Error ${res.status}`)
      }

      const data = await res.json()
      posthog.capture('comparacion_completada', {
        ...metricasComparacion(data),
        con_bancos: bancosSeleccionados.length,
      })
      setResults(data)
      setScreen('results')
    } catch (e) {
      setError(e.message)
      setScreen('home')
    }
  }, [API, pendingCompareData])

  // ── Paso 2b: el usuario omite bancos → usar resultado sin promos ─────────
  const handleOmitirBancos = useCallback(() => {
    if (!pendingCompareData) { setScreen('home'); return }
    const { data } = pendingCompareData
    posthog.capture('comparacion_completada', {
      ...metricasComparacion(data),
      con_bancos: 0,
      sin_promos: true,
    })
    setResults(data)
    setScreen('results')
  }, [pendingCompareData])

  // Al guardar desde BasketScreen: actualiza estado + persiste en historial
  const handleSaveCanasta = useCallback((items, nombre) => {
    setCanasta(items)
    guardarEnHistorial(items, nombre)
    setScreen('home')
  }, [setCanasta])

  if (screen === 'basket') {
    return (
      <BasketScreen
        cacheStatus={cacheStatus}
        canasta={canasta}
        historial={leerHistorial()}
        onBack={() => setScreen('home')}
        onSave={handleSaveCanasta}
        fetchDefaultCanasta={fetchDefaultCanasta}
      />
    )
  }

  if (screen === 'bancos') {
    // Extraer las cadenas encontradas para filtrar bancos relevantes.
    // El filtro por n_disponibles > 0 NO es opcional: `fichas` trae todas las
    // cadenas consultadas, incluidas las que no tienen ningún producto. Sin
    // filtrar, BancosScreen recibe cadenas vacías y ensancha la lista de promos
    // en silencio (las usa como query param en /api/promos).
    const cadenasEncontradas = pendingCompareData?.data?.fichas
      ?.filter(f => f.n_disponibles > 0)
      .map(f => f.cadena) || []
    return (
      <BancosScreen
        cadenas={cadenasEncontradas}
        diaSeleccionado={diaSeleccionado}
        onAplicar={handleAplicarBancos}
        onOmitir={handleOmitirBancos}
      />
    )
  }

  if (screen === 'results' && results) {
    return (
      <ResultsScreen
        results={results}
        location={location}
        radioKm={radioKm}
        onBack={() => setScreen('home')}
        onEditBasket={() => setScreen('basket')}
        onRecompare={() => setScreen('bancos')}
      />
    )
  }

  if (screen === 'loading') {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner" />
          <p className="loading-msg">{loadingMsg}</p>
          <p className="loading-hint">Los datos son del Sistema de Precios y Disponibilidad (SEPA) del Ministerio de Economía</p>
        </div>
      </div>
    )
  }

  return (
    <HomeScreen
      cacheStatus={cacheStatus}
      radioKm={radioKm}
      onRadioChange={setRadioKm}
      onCompare={handleCompare}
      onEditBasket={() => { fetchDefaultCanasta(); setScreen('basket') }}
      error={error}
      diaSeleccionado={diaSeleccionado}
      onDiaChange={setDiaSeleccionado}
    />
  )
}
