import { useState, useCallback } from 'react'
import HomeScreen from './components/HomeScreen'
import ResultsScreen from './components/ResultsScreen'
import BasketScreen from './components/BasketScreen'
import './index.css'

export default function App() {
  const [screen, setScreen] = useState('home') // home | loading | results | basket
  const [location, setLocation] = useState(null) // { lat, lon } | { provincia }
  const [radioKm, setRadioKm] = useState(5)
  const [canasta, setCanasta] = useState(null) // null = usar default del backend
  const [results, setResults] = useState(null)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState(null)

  const API = import.meta.env.VITE_API_URL || 'https://TU-APP.up.railway.app'

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
        canasta: [],
        promos: [],
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
  }, [API, radioKm])

  if (screen === 'basket') {
    return (
      <BasketScreen
        canasta={canasta}
        onBack={() => setScreen('home')}
        onSave={(c) => { setCanasta(c); setScreen('home') }}
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
    />
  )
}
