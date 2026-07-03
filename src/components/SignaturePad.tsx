import * as React from 'react';
import { Button } from './ui';
import { Eraser, Check, Loader2 } from 'lucide-react';

/**
 * Draw-with-mouse/touch signature pad. On save it exports the drawing as a
 * transparent PNG File and hands it to the parent (which uploads it exactly like
 * a picked file). Uses pointer events so it works for mouse and touch.
 */
export function SignaturePad({
  onSave,
  saving,
}: {
  onSave: (file: File) => void;
  saving?: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const ctxRef = React.useRef<CanvasRenderingContext2D | null>(null);
  const drawing = React.useRef(false);
  const last = React.useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctxRef.current = ctx;
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !ctxRef.current || !last.current) return;
    const p = pos(e);
    const ctx = ctxRef.current;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasDrawn) setHasDrawn(true);
  };

  const end = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const save = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onSave(new File([blob], 'signature.png', { type: 'image/png' }));
    }, 'image/png');
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="w-full h-40 bg-white border border-ink-200 rounded-md touch-none cursor-crosshair"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex items-center gap-2 mt-2">
        <Button type="button" variant="ghost" onClick={clear} disabled={!hasDrawn || saving}>
          <Eraser className="h-4 w-4 mr-1" /> Clear
        </Button>
        <Button type="button" onClick={save} disabled={!hasDrawn || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
          Save signature
        </Button>
      </div>
    </div>
  );
}

export default SignaturePad;
