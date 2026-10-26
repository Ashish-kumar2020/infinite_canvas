import { useCallback, useRef, useState } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpLeft,
  Hand,
  MousePointer2,
  Plus,
  RectangleHorizontal,
  RotateCcw,
} from "lucide-react";

type Rect = { id: number; x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
type Mode = "select" | "pan" | "rect";
type DragState =
  | { kind: "pan"; pointer: Point; origin: Point }
  | { kind: "move"; pointer: Point; origin: Point; rectId: number }
  | { kind: "create"; pointer: Point; origin: Point; rectId: number };

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const initialRects: Rect[] = [
  { id: 1, x: 130, y: 115, width: 190, height: 120 },
  { id: 2, x: 420, y: 270, width: 155, height: 100 },
];

export default function App() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(3);
  const [rects, setRects] = useState<Rect[]>(initialRects);
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [mode, setMode] = useState<Mode>("select");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [drag, setDrag] = useState<DragState | null>(null);

  const screenToWorld = useCallback(
    (point: Point): Point => ({
      x: (point.x - pan.x) / zoom,
      y: (point.y - pan.y) / zoom,
    }),
    [pan, zoom],
  );

  const getLocalPoint = (event: ReactPointerEvent | ReactWheelEvent): Point => {
    const bounds = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const local = getLocalPoint(event);
    const target = (event.target as HTMLElement).closest(
      "[data-rect-id]",
    ) as HTMLElement | null;
    const targetId = target ? Number(target.dataset.rectId) : null;

    if (mode === "pan" || event.button === 1) {
      setDrag({ kind: "pan", pointer: local, origin: pan });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (mode === "rect") {
      const world = screenToWorld(local);
      const id = nextId.current++;
      setRects((current) => [
        ...current,
        { id, x: world.x, y: world.y, width: 1, height: 1 },
      ]);
      setSelectedId(id);
      setDrag({ kind: "create", pointer: world, origin: world, rectId: id });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (targetId !== null) {
      setSelectedId(targetId);
      const world = screenToWorld(local);
      const rect = rects.find((item) => item.id === targetId)!;
      setDrag({
        kind: "move",
        pointer: world,
        origin: { x: rect.x, y: rect.y },
        rectId: targetId,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
    } else {
      setSelectedId(null);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const local = getLocalPoint(event);
    if (drag.kind === "pan") {
      setPan({
        x: drag.origin.x + local.x - drag.pointer.x,
        y: drag.origin.y + local.y - drag.pointer.y,
      });
      return;
    }
    const world = screenToWorld(local);
    if (drag.kind === "move") {
      const dx = world.x - drag.pointer.x;
      const dy = world.y - drag.pointer.y;
      setRects((current) =>
        current.map((rect) =>
          rect.id === drag.rectId
            ? { ...rect, x: drag.origin.x + dx, y: drag.origin.y + dy }
            : rect,
        ),
      );
    } else {
      const left = Math.min(drag.origin.x, world.x);
      const top = Math.min(drag.origin.y, world.y);
      setRects((current) =>
        current.map((rect) =>
          rect.id === drag.rectId
            ? {
                ...rect,
                x: left,
                y: top,
                width: Math.max(1, Math.abs(world.x - drag.origin.x)),
                height: Math.max(1, Math.abs(world.y - drag.origin.y)),
              }
            : rect,
        ),
      );
    }
  };

  const stopDragging = () => setDrag(null);

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pointer = getLocalPoint(event);
    const worldBeforeZoom = screenToWorld(pointer);
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    setZoom(nextZoom);
    setPan({
      x: pointer.x - worldBeforeZoom.x * nextZoom,
      y: pointer.y - worldBeforeZoom.y * nextZoom,
    });
  };

  const zoomBy = (factor: number) => {
    const element = canvasRef.current;
    if (!element) return;
    const center = { x: element.clientWidth / 2, y: element.clientHeight / 2 };
    const world = screenToWorld(center);
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    setZoom(nextZoom);
    setPan({
      x: center.x - world.x * nextZoom,
      y: center.y - world.y * nextZoom,
    });
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const addRectangle = () => setMode("rect");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">∞</div>
        <div className="brand-copy">
          <strong>Infinite Canvas</strong>
          <span>Ideas without boundaries</span>
        </div>
        <div className="topbar-spacer" />
        <div className="status-pill">
          <span className="status-dot" /> Local workspace
        </div>
      </header>

      <div className="workspace">
        <aside className="toolbar">
          <div className="toolbar-label">TOOLS</div>
          <button
            className={`tool-button ${mode === "select" ? "active" : ""}`}
            onClick={() => setMode("select")}
            title="Select and move"
          >
            <MousePointer2 size={19} />
            <span>Select</span>
            <kbd>V</kbd>
          </button>
          <button
            className={`tool-button ${mode === "pan" ? "active" : ""}`}
            onClick={() => setMode("pan")}
            title="Pan canvas"
          >
            <Hand size={19} />
            <span>Pan canvas</span>
            <kbd>H</kbd>
          </button>
          <button
            className={`tool-button ${mode === "rect" ? "active" : ""}`}
            onClick={addRectangle}
            title="Create rectangle"
          >
            <RectangleHorizontal size={19} />
            <span>Rectangle</span>
            <kbd>R</kbd>
          </button>
          <div className="toolbar-divider" />
          <div className="toolbar-tip">
            <span className="tip-icon">✦</span>
            <p>
              <b>Quick tip</b>Drag empty space to pan, or use the mouse wheel to
              zoom.
            </p>
          </div>
        </aside>

        <section className="canvas-column">
          <div className="canvas-heading">
            <div>
              <h1>Untitled board</h1>
              <p>A spacious place to think visually</p>
            </div>
            <div className="board-badge">{rects.length} objects</div>
          </div>
          <div
            ref={canvasRef}
            className={`canvas-viewport ${mode === "pan" || drag?.kind === "pan" ? "panning" : ""} ${mode === "rect" ? "drawing" : ""}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onWheel={handleWheel}
          >
            <div
              className="canvas-world"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              <svg
                className="grid-layer"
                width="10000"
                height="10000"
                viewBox="0 0 10000 10000"
                aria-hidden="true"
              >
                <defs>
                  <pattern
                    id="small-grid"
                    width="24"
                    height="24"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 24 0 L 0 0 0 24"
                      fill="none"
                      stroke="#dce3f0"
                      strokeWidth="1"
                    />
                  </pattern>
                  <pattern
                    id="large-grid"
                    width="120"
                    height="120"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect width="120" height="120" fill="url(#small-grid)" />
                    <path
                      d="M 120 0 L 0 0 0 120"
                      fill="none"
                      stroke="#cbd5e5"
                      strokeWidth="1.2"
                    />
                  </pattern>
                </defs>
                <rect width="10000" height="10000" fill="url(#large-grid)" />
              </svg>
              {rects.map((rect) => (
                <div
                  key={rect.id}
                  data-rect-id={rect.id}
                  className={`canvas-rect ${selectedId === rect.id ? "selected" : ""}`}
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: rect.width,
                    height: rect.height,
                  }}
                >
                  <span className="rect-label">Rectangle {rect.id}</span>
                  {selectedId === rect.id && (
                    <>
                      <i className="selection-corner top-left" />
                      <i className="selection-corner top-right" />
                      <i className="selection-corner bottom-left" />
                      <i className="selection-corner bottom-right" />
                    </>
                  )}
                </div>
              ))}
            </div>
            {rects.length === 0 && (
              <div className="empty-hint">
                <div className="empty-icon">
                  <Plus size={22} />
                </div>
                <b>Your canvas is ready</b>
                <span>Choose Rectangle to add your first shape.</span>
              </div>
            )}
            <div className="canvas-coordinates">
              X {Math.round(-pan.x / zoom)} · Y {Math.round(-pan.y / zoom)}
            </div>
            <div className="zoom-controls">
              <button onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out">
                <ArrowDownLeft size={16} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => zoomBy(1.2)} aria-label="Zoom in">
                <ArrowUpLeft size={16} />
              </button>
              <i />
              <button onClick={resetView} aria-label="Reset view">
                <RotateCcw size={15} />
              </button>
            </div>
          </div>
          <div className="canvas-footer">
            <span>
              <span className="footer-dot" /> All changes stay in this browser
              session
            </span>
            <span>World space · {Math.round(zoom * 100)}% zoom</span>
          </div>
        </section>

        <aside className="layers-panel">
          <div className="panel-heading">
            <div>
              <h2>Layers</h2>
              <p>Objects on this board</p>
            </div>
            <span className="layer-count">{rects.length}</span>
          </div>
          <button className="add-object-button" onClick={addRectangle}>
            <Plus size={17} /> Add rectangle
          </button>
          <div className="layers-list">
            {[...rects].reverse().map((rect) => (
              <button
                key={rect.id}
                className={`layer-row ${selectedId === rect.id ? "selected" : ""}`}
                onClick={() => {
                  setSelectedId(rect.id);
                  setMode("select");
                }}
              >
                <span className="layer-shape-icon" />
                <span className="layer-name">Rectangle {rect.id}</span>
                <span className="layer-size">
                  {Math.round(rect.width)}×{Math.round(rect.height)}
                </span>
              </button>
            ))}
            {rects.length === 0 && (
              <p className="no-layers">
                No objects yet. Add a rectangle to get started.
              </p>
            )}
          </div>
          <div className="panel-note">
            <div className="note-mark">i</div>
            <p>
              <b>Simple by design</b>
              <br />
              Select a layer to focus its shape. Drag a shape to move it around
              the canvas.
            </p>
          </div>
        </aside>
      </div>
      <footer className="app-footer">
        <span>
          INFINITE CANVAS <span className="footer-separator">/</span> PROTOTYPE
        </span>
        <span>Built for focused thinking</span>
      </footer>
    </main>
  );
}
