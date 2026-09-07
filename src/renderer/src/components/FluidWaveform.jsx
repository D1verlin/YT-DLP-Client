import { useEffect, useRef } from 'react'

export default function FluidWaveform({ analyzing = false }) {
  const canvasRef = useRef(null)
  const animFrameRef = useRef(null)
  const stateRef = useRef({
    phase: 0,
    currentAmp: 14,
    currentSpeed: 0.008,
    currentGlow: 8,
    targetAmp: 14,
    targetSpeed: 0.008,
    targetGlow: 8
  })

  // Update target dynamics when analyzing state changes
  useEffect(() => {
    if (analyzing) {
      stateRef.current.targetAmp = 28
      stateRef.current.targetSpeed = 0.024
      stateRef.current.targetGlow = 22
    } else {
      stateRef.current.targetAmp = 14
      stateRef.current.targetSpeed = 0.008
      stateRef.current.targetGlow = 8
    }
  }, [analyzing])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const dpr = window.devicePixelRatio || 1
    const width = 340
    const height = 110

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    const waves = [
      { freq: 0.016, ampMult: 1.0, phaseOffset: 0, alpha: 0.9, width: 2.2 },
      { freq: 0.014, ampMult: -0.85, phaseOffset: 1.8, alpha: 0.65, width: 1.8 },
      { freq: 0.022, ampMult: 0.6, phaseOffset: 3.4, alpha: 0.45, width: 1.5 },
      { freq: 0.012, ampMult: -0.5, phaseOffset: 5.0, alpha: 0.35, width: 1.2 }
    ]

    const render = () => {
      const state = stateRef.current

      // Silky smooth interpolation (lerp)
      state.currentAmp += (state.targetAmp - state.currentAmp) * 0.06
      state.currentSpeed += (state.targetSpeed - state.currentSpeed) * 0.06
      state.currentGlow += (state.targetGlow - state.currentGlow) * 0.06
      state.phase += state.currentSpeed

      ctx.clearRect(0, 0, width, height)

      const centerY = height / 2

      // Create horizontal gradient that seamlessly fades to 0% at left/right edges
      const grad = ctx.createLinearGradient(0, 0, width, 0)
      grad.addColorStop(0, 'rgba(255, 255, 255, 0)')
      grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.25)')
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)')
      grad.addColorStop(0.82, 'rgba(255, 255, 255, 0.25)')
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)')

      ctx.save()
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
      ctx.shadowBlur = state.currentGlow

      waves.forEach((w) => {
        ctx.beginPath()
        ctx.strokeStyle = grad
        ctx.lineWidth = w.width
        ctx.globalAlpha = w.alpha

        for (let x = 0; x <= width; x += 2) {
          // Smooth sine envelope tapering amplitude to zero at borders
          const normalizedX = x / width
          const envelope = Math.sin(normalizedX * Math.PI)

          // Primary harmonic curve
          const y1 = Math.sin(x * w.freq + state.phase + w.phaseOffset)
          // Secondary subtle resonance
          const y2 = Math.cos(x * (w.freq * 1.5) - state.phase * 0.7) * 0.35

          const totalY = centerY + (y1 + y2) * state.currentAmp * w.ampMult * envelope

          if (x === 0) {
            ctx.moveTo(x, totalY)
          } else {
            ctx.lineTo(x, totalY)
          }
        }
        ctx.stroke()
      })

      ctx.restore()

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [])

  return (
    <div className={`canvas-wave-wrapper ${analyzing ? 'is-analyzing' : ''}`}>
      <div className="canvas-wave-aura" />
      <canvas ref={canvasRef} className="canvas-wave-element" />
    </div>
  )
}
