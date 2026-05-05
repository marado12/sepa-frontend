import { useState, useCallback, useEffect } from 'react'
import HomeScreen from './components/HomeScreen'
import ResultsScreen from './components/ResultsScreen'
import BasketScreen from './components/BasketScreen'
import './index.css'

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

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState('home') // home | loading | results | basket
  const [location, setLocation] = useState(null)
  const [radioKm, setRadioKm] = useState(5)
  const [canasta, setCanasta] = useState(null) // null = usar default del backend
  const [diaSeleccionado, setDiaSeleccionado] = useState(null) // null = día actual
  const [results, setResults] = useState(null)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState(null)

  const API = import.meta.env.VITE_API_URL || 'https://sepa-comparador-production.up.railway.app'

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

  const handleCompare = useCallback(async (loc) => {
    setLocation(loc)
    setScreen('loading')
    setError(null)

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
        canasta: canasta || [],   // [] = el backend usa la canasta default
        promos: [],
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
      setResults(data)
      setScreen('results')
    } catch (e) {
      clearInterval(interval)
      setError(e.message)
      setScreen('home')
    }
  }, [API, radioKm, canasta, diaSeleccionado])

  // Al guardar desde BasketScreen: actualiza estado + persiste en historial
  const handleSaveCanasta = useCallback((items, nombre) => {
    setCanasta(items)
    guardarEnHistorial(items, nombre)
    setScreen('home')
  }, [setCanasta])

  if (screen === 'basket') {
    return (
      <BasketScreen
        canasta={canasta}
        historial={leerHistorial()}
        onBack={() => setScreen('home')}
        onSave={handleSaveCanasta}
        fetchDefaultCanasta={fetchDefaultCanasta}
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
        onRecompare={() => handleCompare(location)}
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
