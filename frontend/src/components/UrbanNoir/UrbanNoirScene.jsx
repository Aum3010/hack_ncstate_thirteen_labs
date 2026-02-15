import React from 'react'
import UrbanNoirBackdrop from './UrbanNoirBackdrop'
import StarfieldCanvas from './StarfieldCanvas'
import ParallaxSkyline from './ParallaxSkyline'
import './UrbanNoir.css'

/**
 * Full Urban Noir scene for Portfolio: backdrop, starfield, skyline, moon.
 * scrollProgress (0–1) drives parallax and ascend effect.
 */
export default function UrbanNoirScene({ scrollProgress = 0 }) {
  return (
    <div
      className="urban-noir-scene"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <UrbanNoirBackdrop scrollProgress={scrollProgress} />
      <StarfieldCanvas scrollProgress={scrollProgress} />
      <ParallaxSkyline scrollProgress={scrollProgress} />
      <div className="urban-noir-moon" />
    </div>
  )
}
