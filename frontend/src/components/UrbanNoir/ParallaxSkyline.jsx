import React, { useMemo } from 'react'
import './UrbanNoir.css'

const BUILDING_CONFIG = [
  { w: 42, h: 140, windows: [1,1,1,1,0,1,1,0,1,1,1,0], neon: null },
  { w: 38, h: 100, windows: [1,0,1,0,1,1], neon: 'NOIR' },
  { w: 50, h: 180, windows: [1,1,0,1,1,1,0,1,0,1,1,1,1], neon: null },
  { w: 35, h: 85, windows: [0,1,0,1], neon: 'DIR' },
  { w: 45, h: 120, windows: [1,1,1,0,1,0,1,1], neon: null },
  { w: 40, h: 160, windows: [1,0,1,1,0,1,1,1,0,1], neon: 'R' },
  { w: 48, h: 95, windows: [1,1,0,1,1], neon: null },
  { w: 36, h: 130, windows: [0,1,1,0,1,1,0], neon: null },
  { w: 44, h: 110, windows: [1,0,1,1,1,0,1], neon: null },
  { w: 52, h: 170, windows: [1,1,1,0,1,1,0,1,1,1,0], neon: null },
]

function Building({ config, layerIndex }) {
  const { w, h, windows, neon } = config
  const cols = 3
  const rows = Math.ceil(windows.length / cols) || 2
  const windowEls = useMemo(() => {
    const out = []
    for (let i = 0; i < rows * cols; i++) {
      const on = windows[i % windows.length]
      out.push(
        <div
          key={i}
          className={'urban-noir-window' + (on ? '' : ' off')}
          style={{ animationDelay: `${(i * 0.7 + layerIndex * 2) % 5}s` }}
        />
      )
    }
    return out
  }, [windows, rows, cols, layerIndex])

  return (
    <div className="urban-noir-building" style={{ height: h + 4 }}>
      <div
        className="urban-noir-building-face"
        style={{
          width: w,
          height: h,
          minHeight: 60,
        }}
      >
        {windowEls}
        {neon && (
          <span className={'urban-noir-neon-sign' + (neon === 'NOIR' ? ' pink' : '')}>
            {neon}
          </span>
        )}
      </div>
      <div
        className="urban-noir-building-face side"
        style={{
          width: w * 0.35,
          height: h,
          minHeight: 60,
        }}
      >
        {windowEls.slice(0, Math.min(4, windowEls.length))}
      </div>
    </div>
  )
}

export default function ParallaxSkyline({ scrollProgress = 0 }) {
  const layerSpeeds = [0.15, 0.35, 0.55]
  const layers = useMemo(() => [
    BUILDING_CONFIG.slice(0, 4),
    BUILDING_CONFIG.slice(2, 7),
    BUILDING_CONFIG.slice(1, 6),
  ], [])

  return (
    <div className="urban-noir-skyline">
      {layers.map((buildings, layerIndex) => {
        const speed = layerSpeeds[layerIndex]
        const translateY = scrollProgress * 120 * speed
        return (
          <div
            key={layerIndex}
            className="urban-noir-skyline-layer"
            style={{
              transform: `translateY(${translateY}px)`,
              opacity: 1 - layerIndex * 0.12,
              zIndex: 3 - layerIndex,
            }}
          >
            {buildings.map((cfg, i) => (
              <Building key={i} config={cfg} layerIndex={layerIndex} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
