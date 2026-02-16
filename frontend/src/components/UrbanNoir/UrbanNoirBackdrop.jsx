import React from 'react'
import './UrbanNoir.css'

/**
 * Dimmed city backdrop layer for Portfolio full scene.
 * Used as the bottom layer of the scroll-to-ascend background stack.
 */
export default function UrbanNoirBackdrop({ scrollProgress = 0, className = '' }) {
  const opacity = Math.max(0.2, 0.45 - scrollProgress * 0.25)
  return (
    <div
      className={'urban-noir-backdrop ' + (className || '').trim()}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url(/media/city-noir.svg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
        opacity,
        transition: 'opacity 0.1s ease-out',
      }}
    />
  )
}
