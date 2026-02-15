import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { getExperiences } from '../api/experiences'
import { getProfile } from '../api/users'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })
import './Experiences.css'

const TIER_KEYS = ['free', '$', '$$', '$$$']
const TIER_LABELS = { free: 'Free', $: 'Under $25', '$$': '$25-75', '$$$': '$75+' }

const TIER_COLORS = {
  free: '#00ff88',
  $: '#4a5d4a',
  '$$': '#d97706',
  '$$$': '#6b2d3a',
}

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

function FitBounds({ experiences, selectedIndex }) {
  const map = useMap()
  const points = useMemo(() => {
    return experiences
      .filter((e) => e.lat != null && e.lng != null)
      .map((e) => [e.lat, e.lng])
  }, [experiences])
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 })
    }
  }, [map, points])
  return null
}

function MapMarkers({ experiences, selectedIndex, onSelect }) {
  return (
    <>
      {experiences.map((exp, idx) => (
        <Marker
          key={idx}
          position={[exp.lat, exp.lng]}
          eventHandlers={{ click: () => onSelect(idx) }}
        >
          <Popup>
            <strong>{exp.name}</strong>
            <br />
            {exp.description}
            <br />
            <span className="exp-popup-cost">${exp.estimated_cost?.toFixed(0) ?? 0}</span>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

export default function Experiences() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [location, setLocation] = useState(() => localStorage.getItem('experiences_location') || '')
  const [tierFilter, setTierFilter] = useState('all')
  const [selectedIndex, setSelectedIndex] = useState(null)

  const load = useCallback((loc) => {
    setLoading(true)
    setError('')
    getExperiences(loc || undefined)
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load experiences'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(location || undefined)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('experiences_location')
    if (saved) return
    getProfile()
      .then((user) => {
        const city = (user?.profile_questionnaire?.city_or_area || '').trim()
        if (city) {
          setLocation(city)
          load(city)
        }
      })
      .catch(() => {})
  }, [load])

  const handleLocationSubmit = (e) => {
    e.preventDefault()
    const val = location.trim()
    if (val) localStorage.setItem('experiences_location', val)
    load(val || undefined)
  }

  const filteredExperiences = useMemo(() => {
    if (!data?.experiences) return []
    const list = data.experiences
    if (tierFilter === 'all') return list
    return list.filter((e) => e.price_tier === tierFilter)
  }, [data, tierFilter])

  const remainingCents = data?.budget?.remaining_cents ?? 0
  const totalCents = data?.budget?.total_cents ?? 1

  if (loading && !data) {
    return (
      <div className="experiences-page">
        <div className="experiences-header">
          <h1 className="page-title">Short-term Experiences</h1>
        </div>
        <div className="experiences-loading">
          <p>Loading experiences...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="experiences-page">
      <div className="experiences-header">
        <h1 className="page-title">Short-term Experiences</h1>
        <form className="experiences-location-form" onSubmit={handleLocationSubmit}>
          <input
            className="input experiences-location-input"
            type="text"
            placeholder="City or area (optional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <button type="submit" className="btn btn-ghost">Search</button>
        </form>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {data && (
        <>
          <div className="experiences-budget-bar">
            <div className="experiences-budget-label">
              <span>Short-term budget</span>
              <span className="experiences-budget-value">
                ${(remainingCents / 100).toFixed(0)} left
              </span>
            </div>
            <div className="experiences-budget-track">
              <div
                className="experiences-budget-fill"
                style={{
                  width: `${Math.min(100, (100 * (totalCents - remainingCents)) / Math.max(1, totalCents))}%`,
                }}
              />
            </div>
          </div>

          <div className="experiences-tabs">
            <button
              type="button"
              className={`experiences-tab ${tierFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTierFilter('all')}
            >
              All
            </button>
            {TIER_KEYS.map((t) => (
              <button
                key={t}
                type="button"
                className={`experiences-tab ${tierFilter === t ? 'active' : ''}`}
                onClick={() => setTierFilter(t)}
              >
                {TIER_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="experiences-layout">
            <div className="experiences-cards">
              {filteredExperiences.length === 0 ? (
                <p className="text-muted">
                  {!data?.experiences?.length
                    ? data?.ai_status === 'no_api_key'
                      ? 'No experiences generated. Add BACKBOARD_API_KEY to the project root .env (Docker) or backend/.env (local), then restart the backend.'
                      : data?.ai_status === 'api_error'
                        ? 'Suggestions temporarily unavailable. Check backend logs for details (e.g. Backboard API error).'
                        : 'No experiences generated. Add BACKBOARD_API_KEY to the backend .env to enable AI suggestions.'
                    : 'No experiences in this tier.'}
                </p>
              ) : (
                filteredExperiences.map((exp, idx) => {
                  const globalIdx = data.experiences?.indexOf(exp) ?? idx
                  const withinBudget = (exp.estimated_cost || 0) * 100 <= remainingCents
                  return (
                    <div
                      key={idx}
                      className={`experience-card ${selectedIndex === globalIdx ? 'selected' : ''} ${!withinBudget ? 'over-budget' : ''}`}
                      onClick={() => setSelectedIndex(selectedIndex === globalIdx ? null : globalIdx)}
                    >
                      <div className="experience-card-header">
                        <span
                          className="experience-tier"
                          style={{ color: TIER_COLORS[exp.price_tier] || TIER_COLORS['$'] }}
                        >
                          {exp.price_tier === 'free' ? 'Free' : exp.price_tier}
                        </span>
                        <span className={`experience-badge ${withinBudget ? 'within-budget' : 'over-budget'}`}>
                          {withinBudget ? 'Within budget' : 'Over budget'}
                        </span>
                      </div>
                      <h3 className="experience-name">{exp.name}</h3>
                      <p className="experience-desc">{exp.description}</p>
                      <div className="experience-meta">
                        <span className="experience-cost">
                          {exp.price_tier === 'free' ? 'Free' : `$${exp.estimated_cost?.toFixed(0) ?? 0}`}
                        </span>
                        <span className="experience-category">{exp.category}</span>
                      </div>
                      {exp.why_recommended && (
                        <p className="experience-why">{exp.why_recommended}</p>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div className="experiences-map-wrap">
              {data.experiences?.length > 0 && (
                <MapContainer
                  center={[data.experiences[0]?.lat ?? 40.7128, data.experiences[0]?.lng ?? -74.006]}
                  zoom={12}
                  className="experiences-map"
                  scrollWheelZoom={true}
                >
                  <TileLayer url={DARK_TILES} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>' />
                  <FitBounds experiences={data.experiences} selectedIndex={selectedIndex} />
                  <MapMarkers
                    experiences={data.experiences}
                    selectedIndex={selectedIndex}
                    onSelect={setSelectedIndex}
                  />
                </MapContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
