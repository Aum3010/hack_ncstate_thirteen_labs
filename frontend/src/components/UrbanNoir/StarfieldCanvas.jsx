import React, { useRef, useEffect } from 'react'

/**
 * Twinkling starfield canvas for Portfolio (and optionally shared backdrop).
 * Optional scrollProgress (0–1) shifts stars for parallax.
 */
export default function StarfieldCanvas({ scrollProgress = 0, className = '', style = {} }) {
  const canvasRef = useRef(null)
  const starsRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId
    const numStars = 320

    const initStars = (w, h) => {
      const stars = []
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.4 + 0.2,
          phase: Math.random() * Math.PI * 2,
          speed: 0.015 + Math.random() * 0.04,
          baseAlpha: 0.4 + Math.random() * 0.5,
        })
      }
      return stars
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.scale(dpr, dpr)
      if (!starsRef.current) starsRef.current = initStars(w, h)
    }

    const draw = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const stars = starsRef.current
      if (!stars) return

      const t = Date.now() / 1000
      const parallaxY = scrollProgress * h * 0.15

      ctx.fillStyle = 'rgba(6, 6, 12, 0.2)'
      ctx.fillRect(0, 0, w, h)

      stars.forEach((s) => {
        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase))
        const alpha = twinkle * s.baseAlpha
        const y = s.y - parallaxY
        if (y < -5) return
        ctx.fillStyle = `rgba(240, 248, 255, ${alpha})`
        ctx.beginPath()
        ctx.arc(s.x, y, s.r, 0, Math.PI * 2)
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
  }, [scrollProgress])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        ...style,
      }}
      aria-hidden="true"
    />
  )
}
