import React, { useRef, useEffect } from 'react'
import './UrbanNoir.css'

/**
 * Shared Urban Noir backdrop for all authenticated pages (except Portfolio).
 * Renders a subtle starfield + dimmed city/sky gradient. No scroll parallax.
 */
export default function UrbanNoirSharedBackdrop() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId
    const stars = []
    const numStars = 120

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.scale(dpr, dpr)
      if (stars.length === 0) {
        for (let i = 0; i < numStars; i++) {
          stars.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            r: Math.random() * 1.2 + 0.3,
            phase: Math.random() * Math.PI * 2,
            speed: 0.02 + Math.random() * 0.03,
          })
        }
      }
    }

    const draw = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.fillStyle = 'rgba(6, 6, 10, 0.15)'
      ctx.fillRect(0, 0, w, h)
      const t = Date.now() / 1000
      stars.forEach((s) => {
        const twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase))
        ctx.fillStyle = `rgba(220, 230, 255, ${twinkle * 0.6})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      })
      animationId = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  const cityImageUrl = '/media/city-noir.svg'

  return (
    <div className="urban-noir-shared-backdrop" aria-hidden="true">
      <div className="urban-noir-gradient" />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.9,
        }}
      />
      <div
        className="urban-noir-city-layer"
        style={{ backgroundImage: `url(${cityImageUrl})` }}
      />
      <div className="urban-noir-overlay" />
    </div>
  )
}
