import "./index.css";
import { useCallback, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import {
  Hand,
  Layers,
  Minus,
  MousePointer2,
  Plus,
  Square,
} from "lucide-react";

type Shape = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

type Point = {
  x: number;
  y: number;
};

type Tool = "select" | "pan" | "rectangle";

type DragState = {
  id: string;
  startX: number;
  startY: number;
  originalX: number;
  originalY: number;
};

type ResizeState = DragState & {
  handle: string;
  originalWidth: number;
  originalHeight: number;
};

const COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B"];

const initialShapes: Shape[] = [
  {
    id: "shape-1",
    name: "Rectangle 1",
    x: 120,
    y: 100,
    width: 180,
    height: 120,
    color: COLORS[0],
  },
  {
    id: "shape-2",
    name: "Rectangle 2",
    x: 400,
    y: 180,
    width: 200,
    height: 140,
    color: COLORS[1],
  },
];

function createId() {
  return `shape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const shapesRef = useRef<Shape[]>(initialShapes);

  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);

  const panRef = useRef<{
    startX: number;
    startY: number;
    originalX: number;
    originalY: number;
  } | null>(null);

  const createRef = useRef<{
    start: Point;
    current: Point;
  } | null>(null);

  const [shapes, setShapes] = useState<Shape[]>(initialShapes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const [preview, setPreview] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const selectedShape =
    shapes.find((shape) => shape.id === selectedId) ?? null;

  const selectedShapeIndex = shapes.findIndex(
    (shape) => shape.id === selectedId
  );

  const syncShapes = useCallback((nextShapes: Shape[]) => {
    shapesRef.current = nextShapes;
    setShapes(nextShapes);
  }, []);

  const screenToWorld = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    if(!canvas) return {x: 0, y: 0};
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    }
  },[pan, zoom]);
  
  const addRectangle = useCallback(() => {
    const newShape : Shape = {
      id: createId(),
      name: `Reactangle ${shapesRef.current.length + 1}`,
      x: (100 - pan.x) / zoom,
      y: (100 - pan.y) / zoom,
      width: 100,
      height: 120,
      color: COLORS[shapesRef.current.length % COLORS.length],
    };

    syncShapes([...shapesRef.current, newShape]);
    setSelectedId(newShape.id);
    setTool("select");
  },[pan, zoom, syncShapes]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if(!event.ctrlKey && !event.metaKey){
      setPan((current) => ({
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      }));
      return;
    }

    event.preventDefault();
    zoomAt(zoom * (event.deltaY < 0 ? 1.1 : 0.9), event.clientX , event.clientY)
  }


  const zoomAt = useCallback(
    (nextZoom: number, clientX?: number, clientY?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();

      const localX =
        (clientX ?? rect.left + rect.width / 2) - rect.left;
      const localY =
        (clientY ?? rect.top + rect.height / 2) - rect.top;

      const clampedZoom = Math.min(5.5, Math.max(0.25, nextZoom));

      const worldX = (localX - pan.x) / zoom;
      const worldY = (localY - pan.y) / zoom;

      setZoom(clampedZoom);
      setPan({
        x: localX - worldX * clampedZoom,
        y: localY - worldY * clampedZoom,
      });
    },
    [pan, zoom]
  );



  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button === 2) {
      event.preventDefault();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const world = screenToWorld(event.clientX, event.clientY);

    if (event.button === 1 || tool === "pan") {
      panRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originalX: pan.x,
        originalY: pan.y,
      };

      setIsDragging(true);
      canvas.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === "rectangle") {
      createRef.current = { start: world, current: world };

      setPreview({
        x: world.x,
        y: world.y,
        width: 0,
        height: 0,
      });

      canvas.setPointerCapture(event.pointerId);
      return;
    }

    const target = event.target as HTMLElement;
    const shapeElement = target.closest<HTMLElement>("[data-shape-id]");

    if (!shapeElement) {
      setSelectedId(null);
      return;
    }

    const id = shapeElement.dataset.shapeId;
    if (!id) return;

    const shape = shapesRef.current.find((item) => item.id === id);
    if (!shape) return;

    setSelectedId(id);

    const handleElement = target.closest<HTMLElement>("[data-resize-handle]");
    const handle = handleElement?.dataset.resizeHandle;

    if (handle) {
      resizeRef.current = {
        id,
        handle,
        startX: world.x,
        startY: world.y,
        originalX: shape.x,
        originalY: shape.y,
        originalWidth: shape.width,
        originalHeight: shape.height,
      };

      setIsDragging(true);
      canvas.setPointerCapture(event.pointerId);
      return;
    }

    dragRef.current = {
      id,
      startX: world.x,
      startY: world.y,
      originalX: shape.x,
      originalY: shape.y,
    };

    setIsDragging(true);
    canvas.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (panRef.current) {
      const drag = panRef.current;

      setPan({
        x: drag.originalX + event.clientX - drag.startX,
        y: drag.originalY + event.clientY - drag.startY,
      });
      return;
    }

    if (createRef.current) {
      const world = screenToWorld(event.clientX, event.clientY);
      createRef.current.current = world;

      const { start } = createRef.current;

      setPreview({
        x: Math.min(start.x, world.x),
        y: Math.min(start.y, world.y),
        width: Math.abs(world.x - start.x),
        height: Math.abs(world.y - start.y),
      });
      return;
    }

    if (resizeRef.current) {
      const world = screenToWorld(event.clientX, event.clientY);
      const drag = resizeRef.current;
      const dx = world.x - drag.startX;
      const dy = world.y - drag.startY;

      syncShapes(
        shapesRef.current.map((shape) => {
          if (shape.id !== drag.id) return shape;

          let x = drag.originalX;
          let y = drag.originalY;
          let width = drag.originalWidth;
          let height = drag.originalHeight;

          if (drag.handle.includes("right")) width += dx;
          if (drag.handle.includes("left")) {
            x += dx;
            width -= dx;
          }
          if (drag.handle.includes("bottom")) height += dy;
          if (drag.handle.includes("top")) {
            y += dy;
            height -= dy;
          }

          return {
            ...shape,
            x,
            y,
            width: Math.max(20, width),
            height: Math.max(20, height),
          };
        })
      );
      return;
    }

    if (dragRef.current) {
      const world = screenToWorld(event.clientX, event.clientY);
      const drag = dragRef.current;

      syncShapes(
        shapesRef.current.map((shape) =>
          shape.id === drag.id
            ? {
                ...shape,
                x: drag.originalX + world.x - drag.startX,
                y: drag.originalY + world.y - drag.startY,
              }
            : shape
        )
      );
    }
  };


  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if(createRef.current){
      const {start, current} = createRef.current;
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);

      if(width > 5 && height > 5){
        const shape : Shape = {
          id: createId(),
          name : `Reactangle ${shapesRef.current.length + 1}`,
          x : Math.min(start.x, current.x),
          y: Math.min(start.y, current.y),
          width,
          height,
          color : COLORS[shapesRef.current.length % COLORS.length]
        };
        syncShapes([...shapesRef.current, shape]);
        setSelectedId(shape.id);
      }
      createRef.current = null;
      setPreview(null);
    }
    panRef.current = null;
    dragRef.current = null;
    resizeRef.current = null;
    setIsDragging(false);
    const canvas = canvasRef.current;
    if(canvas?.hasPointerCapture(event.pointerId)){
      canvas.releasePointerCapture(event.pointerId);
    }
  }



  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Layers size={20} />
          </div>
          <div>
            <h1>Infinite Canvas</h1>
            <span>Design workspace</span>
          </div>
        </div>
      </header>

      <div className="workspace">
        <aside className="left-sidebar">
          <div className="sidebar-heading">TOOLS</div>

          <button
            className={`tool-button ${tool === "select" ? "active" : ""}`}
            onClick={() => setTool("select")}
            title="Select (V)"
          >
            <MousePointer2 size={19} />
            <span>Select</span>
            <kbd>V</kbd>
          </button>

          <button
            className={`tool-button ${tool === "pan" ? "active" : ""}`}
            onClick={() => setTool("pan")}
            title="Pan (H)"
          >
            <Hand size={19} />
            <span>Pan</span>
            <kbd>H</kbd>
          </button>

          <button
            className={`tool-button ${tool === "rectangle" ? "active" : ""}`}
            onClick={() => setTool("rectangle")}
            title="Rectangle (R)"
          >
            <Square size={19} />
            <span>Rectangle</span>
            <kbd>R</kbd>
          </button>

          <div className="sidebar-divider" />
        </aside>

        <main className="canvas-area">
          <div className="canvas-toolbar">
            <div className="canvas-breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-separator">/</span>
              <strong>Untitled canvas</strong>
            </div>

            <div className="canvas-controls">
              <span className="zoom-label">{Math.round(zoom * 100)}%</span>

              <button
                className="small-icon-button"
                title="Zoom out"
                onClick={() => zoomAt(zoom - 0.1)}
              >
                <Minus size={15} />
              </button>

              <button
                className="small-icon-button"
                title="Zoom in"
                onClick={() => zoomAt(zoom + 0.1)}
              >
                <Plus size={15} />
              </button>

              <button
                className="fit-button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
              >
                Reset view
              </button>
            </div>
          </div>

          <div
            ref={canvasRef}
            className={`canvas ${tool === "pan" || isDragging ? "grabbing" : ""}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onContextMenu={(event) => event.preventDefault()}
            style={{
              backgroundPosition: `${pan.x}px ${pan.y}px`,
              backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
              cursor:
                tool === "pan"
                  ? isDragging
                    ? "grabbing"
                    : "grab"
                  : tool === "rectangle"
                    ? "crosshair"
                    : "default",
            }}
          >
            <div
              className="canvas-content"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {shapes.map((shape) => (
                <div
                  key={shape.id}
                  data-shape-id={shape.id}
                  className={`canvas-shape ${selectedId === shape.id ? "selected" : ""}`}
                  style={{
                    left: shape.x,
                    top: shape.y,
                    width: shape.width,
                    height: shape.height,
                    backgroundColor: shape.color,
                  }}
                >
                  {selectedId === shape.id && (
                    <>
                      <div className="selection-label">{shape.name}</div>
                      <div className="resize-handle top-left" data-resize-handle="top-left" />
                      <div className="resize-handle top-right" data-resize-handle="top-right" />
                      <div className="resize-handle bottom-left" data-resize-handle="bottom-left" />
                      <div className="resize-handle bottom-right" data-resize-handle="bottom-right" />
                    </>
                  )}
                </div>
              ))}

              {preview && (
                <div
                  className="creation-preview"
                  style={{
                    left: preview.x,
                    top: preview.y,
                    width: preview.width,
                    height: preview.height,
                  }}
                />
              )}
            </div>

            {shapes.length === 0 && !preview && (
              <div className="empty-canvas">
                <div className="empty-icon">
                  <Square size={28} />
                </div>
                <h2>Your canvas is empty</h2>
                <p>Add a rectangle to get started.</p>
                <button className="primary-button" onClick={addRectangle}>
                  <Plus size={16} />
                  Add rectangle
                </button>
              </div>
            )}
          </div>

          <footer className="statusbar">
            <div className="status-right">
              <span>{shapes.length} objects</span>
              <span className="status-divider">|</span>
              <span>{selectedShape?.name ?? "Nothing selected"}</span>
            </div>
          </footer>
        </main>

        <aside className="right-sidebar">
          <div className="layers-section">
            <div className="layers-heading">
              <div>
                <Layers size={16} />
                <h3>Layers</h3>
              </div>
              <span>{shapes.length}</span>
            </div>

            <div className="layers-list">
              {shapes.length === 0 ? (
                <p className="empty-layers">No objects yet</p>
              ) : (
                [...shapes].reverse().map((shape) => (
                  <button
                    key={shape.id}
                    className={`layer-item ${selectedId === shape.id ? "layer-active" : ""}`}
                    onClick={() => setSelectedId(shape.id)}
                  >
                    <span
                      className="layer-color"
                      style={{ backgroundColor: shape.color }}
                    />
                    <span className="layer-name">{shape.name}</span>
                    {selectedId === shape.id && <MousePointer2 size={14} />}
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedShape && (
            <div className="selection-footer">
              <span>Selected layer</span>
              <span>
                {selectedShapeIndex + 1} of {shapes.length}
              </span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
