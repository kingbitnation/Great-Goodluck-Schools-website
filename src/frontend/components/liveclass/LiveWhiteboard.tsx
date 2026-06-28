import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPut } from '../../lib/api'

type Stroke = { points: { x: number; y: number }[]; color: string; width: number }

type Props = {
  liveClassId: string
  canDraw: boolean
}

export default function LiveWhiteboard({ liveClassId, canDraw }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const strokesRef = useRef<Stroke[]>([])
  const [color, setColor] = useState('#0b1f4a')
  const lastSync = useRef<string | null>(null)

  const redraw = useCallback((strokes: Stroke[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      ctx.stroke()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = canvas.offsetWidth
    canvas.height = 320
    redraw(strokesRef.current)
  }, [redraw])

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await apiGet<{ strokes: Stroke[]; updatedAt: string }>(
          `/api/live-classes/${liveClassId}/whiteboard`
        )
        if (lastSync.current !== data.updatedAt) {
          lastSync.current = data.updatedAt
          strokesRef.current = data.strokes || []
          redraw(strokesRef.current)
        }
      } catch {
        // ignore poll errors
      }
    }
    poll()
    const id = setInterval(poll, 2500)
    return () => clearInterval(id)
  }, [liveClassId, redraw])

  async function saveStrokes(strokes: Stroke[]) {
    strokesRef.current = strokes
    redraw(strokes)
    if (canDraw) {
      await apiPut(`/api/live-classes/${liveClassId}/whiteboard`, { strokes })
    }
  }

  function pointerPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!canDraw) return
    e.preventDefault()
    drawing.current = true
    const pt = pointerPos(e)
    strokesRef.current = [...strokesRef.current, { points: [pt], color, width: 3 }]
  }

  function moveDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!drawing.current || !canDraw) return
    e.preventDefault()
    const pt = pointerPos(e)
    const strokes = [...strokesRef.current]
    const last = strokes[strokes.length - 1]
    if (!last) return
    last.points.push(pt)
    strokesRef.current = strokes
    redraw(strokes)
  }

  function endDraw() {
    if (!drawing.current) return
    drawing.current = false
    saveStrokes(strokesRef.current)
  }

  function clearBoard() {
    if (!canDraw) return
    saveStrokes([])
  }

  return (
    <div>
      {canDraw && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {['#0b1f4a', '#f59e0b', '#dc2626', '#16a34a', '#111827'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-school-gold' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
          <button type="button" onClick={clearBoard} className="ml-auto text-xs text-red-600 hover:underline">
            Clear board
          </button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`w-full rounded-lg border border-slate-200 bg-white ${canDraw ? 'cursor-crosshair' : 'cursor-default'}`}
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={moveDraw}
        onTouchEnd={endDraw}
      />
      {!canDraw && <p className="mt-1 text-xs text-slate-400">Whiteboard is controlled by the teacher.</p>}
    </div>
  )
}
