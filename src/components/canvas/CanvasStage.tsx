/** 中央自由画布：视口缩放平移、对象选中与变换、键盘快捷键。 */

import { useEffect, useMemo, useRef } from 'react';
import Konva from 'konva';
import { Layer, Rect, Stage, Transformer } from 'react-konva';
import { useEditorStore } from '../../store/editorStore';
import { registerStage } from '../../lib/exportImage';
import type { AnyLayer } from '../../types/project';
import CharNode from './CharNode';
import GlyphText from './GlyphText';
import ImageNode from './ImageNode';

/** 透明背景棋盘格 */
function createCheckerPattern(): HTMLCanvasElement {
  const cell = 12;
  const canvas = document.createElement('canvas');
  canvas.width = cell * 2;
  canvas.height = cell * 2;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cell * 2, cell * 2);
    ctx.fillStyle = '#e8e8e4';
    ctx.fillRect(0, 0, cell, cell);
    ctx.fillRect(cell, cell, cell, cell);
  }
  return canvas;
}

function LayerNode({ layer, charIndices }: { layer: AnyLayer; charIndices: number[] }) {
  if (layer.type === 'text') return <GlyphText layer={layer} selectedChars={charIndices} />;
  if (layer.type === 'image') return <ImageNode layer={layer} />;
  return <CharNode layer={layer} />;
}

export default function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const contentLayerRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const panRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const fittedRef = useRef(false);

  const layers = useEditorStore((state) => state.doc.layers);
  const canvas = useEditorStore((state) => state.doc.canvas);
  const viewport = useEditorStore((state) => state.viewport);
  const stageSize = useEditorStore((state) => state.stage);
  const selection = useEditorStore((state) => state.selection);

  const setStageSize = useEditorStore((state) => state.setStageSize);
  const fitViewport = useEditorStore((state) => state.fitViewport);
  const centerViewport = useEditorStore((state) => state.centerViewport);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const zoomAt = useEditorStore((state) => state.zoomAt);
  const zoomBy = useEditorStore((state) => state.zoomBy);
  const panBy = useEditorStore((state) => state.panBy);

  const checker = useMemo(createCheckerPattern, []);

  // 把舞台注册给导出模块
  useEffect(() => {
    registerStage(stageRef.current);
    return () => registerStage(null);
  }, []);

  // 容器尺寸同步
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const sync = () => setStageSize({ width: element.clientWidth, height: element.clientHeight });
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => observer.disconnect();
  }, [setStageSize]);

  // 首次拿到尺寸后把画布适应到屏幕
  useEffect(() => {
    if (fittedRef.current) return;
    if (stageSize.width <= 0 || stageSize.height <= 0) return;
    fittedRef.current = true;
    fitViewport();
  }, [stageSize.width, stageSize.height, fitViewport]);

  // 选择变化时重新绑定 Transformer
  useEffect(() => {
    const transformer = transformerRef.current;
    const contentLayer = contentLayerRef.current;
    if (!transformer || !contentLayer) return;
    const nodes = selection.layerIds
      .map((id) => contentLayer.findOne<Konva.Node>('#' + id))
      .filter((node): node is Konva.Node => Boolean(node));
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selection.layerIds, layers]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }

      const state = useEditorStore.getState();
      const ids = state.selection.layerIds;
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modifier && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (modifier && key === 'y') {
        event.preventDefault();
        state.redo();
        return;
      }
      if (modifier && key === 'c') {
        state.copySelection();
        return;
      }
      if (modifier && key === 'v') {
        event.preventDefault();
        state.pasteClipboard();
        return;
      }
      if (modifier && key === 'd') {
        event.preventDefault();
        state.duplicateLayers(ids);
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (ids.length === 0) return;
        event.preventDefault();
        state.removeLayers(ids);
        return;
      }
      if (event.key === 'Escape') {
        state.clearSelection();
        return;
      }
      if (ids.length === 0) return;

      const step = event.shiftKey ? 10 : 1;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        state.moveLayers(ids, -step, 0, true);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        state.moveLayers(ids, step, 0, true);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        state.moveLayers(ids, 0, -step, true);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        state.moveLayers(ids, 0, step, true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = { x: event.evt.clientX - rect.left, y: event.evt.clientY - rect.top };
    const factor = event.evt.deltaY > 0 ? 1 / 1.08 : 1.08;
    zoomAt(factor, point);
  };

  const handleMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const onBackground = event.target === stage;
    const middleButton = event.evt.button === 1;
    if (middleButton) event.evt.preventDefault();
    if (!onBackground && !middleButton) return;
    panRef.current = { active: true, lastX: event.evt.clientX, lastY: event.evt.clientY };
    if (onBackground) clearSelection();
  };

  const handleMouseMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (!panRef.current.active) return;
    const dx = event.evt.clientX - panRef.current.lastX;
    const dy = event.evt.clientY - panRef.current.lastY;
    panRef.current.lastX = event.evt.clientX;
    panRef.current.lastY = event.evt.clientY;
    panBy(dx, dy);
  };

  const handleMouseUp = () => {
    panRef.current.active = false;
  };

  const handleTransformStart = () => {
    useEditorStore.getState().pushHistory();
  };

  const handleTransformEnd = () => {
    const contentLayer = contentLayerRef.current;
    if (!contentLayer) return;
    const state = useEditorStore.getState();
    state.selection.layerIds.forEach((id) => {
      const node = contentLayer.findOne<Konva.Node>('#' + id);
      if (!node) return;
      state.updateLayer(
        id,
        {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
        },
        false,
      );
    });
  };

  const transparent = canvas.background.type === 'transparent';
  const activeScale = viewport.scale > 0 ? viewport.scale : 1;

  return (
    <div className="canvas-area">
      <div className="canvas-area__stage" ref={containerRef}>
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <Layer ref={contentLayerRef}>
            <Rect
              name="export-bg"
              x={0}
              y={0}
              width={canvas.width}
              height={canvas.height}
              fill={transparent ? undefined : canvas.background.color}
              fillPatternImage={transparent ? (checker as unknown as HTMLImageElement) : undefined}
              fillPatternRepeat="repeat"
              listening={false}
            />
            <Rect
              name="export-hide"
              x={0}
              y={0}
              width={canvas.width}
              height={canvas.height}
              stroke="#cfcfc9"
              strokeWidth={1}
              strokeScaleEnabled={false}
              listening={false}
            />
            {layers.map((layer) => (
              <LayerNode key={layer.id} layer={layer} charIndices={selection.charIndices} />
            ))}
            <Transformer
              ref={transformerRef}
              name="export-hide"
              rotateEnabled
              ignoreStroke
              borderStroke="#ff3b00"
              borderStrokeWidth={1.5 / activeScale}
              anchorFill="#ffffff"
              anchorStroke="#ff3b00"
              anchorStrokeWidth={1.5 / activeScale}
              anchorSize={8 / activeScale}
              anchorCornerRadius={1}
              rotateAnchorOffset={26 / activeScale}
              onTransformStart={handleTransformStart}
              onTransformEnd={handleTransformEnd}
            />
          </Layer>
        </Stage>
      </div>

      <div className="canvas-tag">
        {canvas.width} × {canvas.height}
      </div>

      {layers.length === 0 && (
        <div className="canvas-empty">
          <div className="canvas-empty__box">
            <div className="mono">CANVAS</div>
            <p>在左侧输入文字并添加到画布开始设计</p>
          </div>
        </div>
      )}

      <div className="canvas-hud">
        <button type="button" className="btn btn--icon" title="缩小" onClick={() => zoomBy(1 / 1.2)}>
          −
        </button>
        <span className="canvas-hud__zoom">{Math.round(viewport.scale * 100)}%</span>
        <button type="button" className="btn btn--icon" title="放大" onClick={() => zoomBy(1.2)}>
          +
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={fitViewport}>
          适应
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={centerViewport}>
          居中
        </button>
      </div>
    </div>
  );
}
