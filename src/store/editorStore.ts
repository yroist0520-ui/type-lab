import { useMemo } from 'react';
import { create } from 'zustand';
import { nanoid } from 'nanoid';
import {
  type AiGlyph,
  type AnyLayer,
  type CanvasConfig,
  type CharLayer,
  type CharOverride,
  type GlyphMode,
  type ImageLayer,
  type ImportedFont,
  type ProjectDoc,
  type ReferenceAsset,
  type StrokeStyle,
  type ShadowStyle,
  type StyleProfile,
  type TextLayer,
} from '../types/project';
import { getFont } from '../lib/fonts';
import { layoutText } from '../lib/textLayout';

const HISTORY_LIMIT = 80;
const MIN_SCALE = 0.05;
const MAX_SCALE = 8;

interface Snapshot {
  layers: AnyLayer[];
  canvas: CanvasConfig;
}

export interface Viewport {
  scale: number;
  x: number;
  y: number;
}

export interface EditorState {
  doc: ProjectDoc;
  selection: { layerIds: string[]; charIndices: number[] };
  viewport: Viewport;
  /** 画布容器尺寸，用于适应屏幕与居中 */
  stage: { width: number; height: number };
  /** 内部复制板，用于 Ctrl+C / Ctrl+V */
  clipboard: AnyLayer[];
  past: Snapshot[];
  future: Snapshot[];
  /** 边距参考线（第一阶段仅保留开关，供后续对齐使用） */
  activePanel: 'layers' | 'assets' | 'fonts' | 'ai';

  // 项目
  setProjectName: (name: string) => void;
  setCanvas: (patch: Partial<CanvasConfig>, recordHistory?: boolean) => void;
  setReference: (asset: ReferenceAsset | null) => void;
  loadDoc: (doc: ProjectDoc) => void;
  newDoc: () => void;

  // 字体与风格档案
  addFont: (font: ImportedFont) => void;
  removeFont: (id: string) => void;
  addStyle: (profile: StyleProfile) => void;
  renameStyle: (id: string, name: string) => void;
  removeStyle: (id: string) => void;
  /** 把风格档案绑定到文字层，供 AI 字形生成使用；传 null 解除绑定 */
  applyStyle: (layerId: string, styleId: string | null) => void;

  // AI 字形
  addGlyph: (glyph: AiGlyph) => void;
  updateGlyph: (id: string, patch: Partial<AiGlyph>) => void;
  removeGlyph: (id: string) => void;
  setGlyphMode: (layerId: string, mode: GlyphMode) => void;
  /** 把某个字符切换到指定 AI 字形，glyphId 为 null 时回退到字体渲染 */
  assignGlyph: (layerId: string, charIndex: number, glyphId: string | null) => void;
  assignGlyphs: (layerId: string, entries: Array<{ charIndex: number; glyphId: string | null }>) => void;

  // 选择
  selectLayer: (id: string | null, additive?: boolean) => void;
  selectLayers: (ids: string[]) => void;
  selectChars: (layerId: string, charIndices: number[]) => void;
  clearSelection: () => void;

  // 图层
  addTextLayer: (text?: string, preset?: Partial<TextLayer>) => string;
  addImageLayer: (src: string, size: { width: number; height: number }) => string;
  addLayers: (layers: AnyLayer[], select?: boolean) => void;
  moveLayers: (ids: string[], dx: number, dy: number, recordHistory?: boolean) => void;
  setActivePanel: (panel: 'layers' | 'assets' | 'fonts' | 'ai') => void;
  updateLayer: (id: string, patch: Partial<AnyLayer>, recordHistory?: boolean) => void;
  updateTextLayer: (id: string, patch: Partial<TextLayer>, recordHistory?: boolean) => void;
  updateImageLayer: (id: string, patch: Partial<ImageLayer>, recordHistory?: boolean) => void;
  removeLayers: (ids: string[]) => void;
  duplicateLayers: (ids: string[]) => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  toggleVisible: (id: string) => void;
  toggleLock: (id: string) => void;
  reorderLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  renameLayer: (id: string, name: string) => void;

  // 字符
  updateChar: (layerId: string, charIndex: number, patch: Partial<CharOverride>, recordHistory?: boolean) => void;
  resetChar: (layerId: string, charIndex: number) => void;
  deleteChar: (layerId: string, charIndex: number) => void;
  duplicateChar: (layerId: string, charIndex: number) => void;
  /** 调整字符顺序，样式随字符一起移动 */
  moveChar: (layerId: string, charIndex: number, direction: 'prev' | 'next') => void;
  /** 在指定字符之后插入手动换行 */
  splitLineAt: (layerId: string, charIndex: number) => void;
  splitTextToCharLayers: (layerId: string) => void;

  // 视口
  setStageSize: (size: { width: number; height: number }) => void;
  setViewport: (patch: Partial<Viewport>) => void;
  resetViewport: () => void;
  zoomBy: (factor: number) => void;
  /** 以画布内某个点为锚点缩放（滚轮缩放） */
  zoomAt: (factor: number, point: { x: number; y: number }) => void;
  panBy: (dx: number, dy: number) => void;
  fitViewport: () => void;
  centerViewport: () => void;

  // 历史
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

const defaultStroke = (): StrokeStyle => ({ enabled: false, color: '#000000', width: 2 });
const defaultShadow = (): ShadowStyle => ({
  enabled: false,
  color: '#000000',
  blur: 12,
  offsetX: 0,
  offsetY: 8,
  opacity: 0.35,
});

export function createEmptyDoc(name = '未命名项目'): ProjectDoc {
  const now = Date.now();
  return {
    id: nanoid(10),
    name,
    createdAt: now,
    updatedAt: now,
    canvas: { width: 1200, height: 800, background: { type: 'color', color: '#ffffff' } },
    layers: [],
    reference: null,
    fonts: [],
    styles: [],
    glyphs: [],
  };
}

function normalize(layers: AnyLayer[]): AnyLayer[] {
  return layers.map((layer, index) => ({ ...layer, zIndex: index }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function makeTextLayer(text: string, preset?: Partial<TextLayer>): TextLayer {
  const font = getFont(preset?.fontId ?? 'pingfang');
  return {
    id: nanoid(10),
    type: 'text',
    name: text.slice(0, 12) || '文字',
    x: 120,
    y: 140,
    width: 400,
    height: 100,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    zIndex: 0,
    visible: true,
    locked: false,
    text,
    fontId: font.id,
    fontFamily: font.family,
    fontWeight: font.defaultWeight,
    italic: false,
    fontSize: 96,
    letterSpacing: 0,
    lineHeight: 1.25,
    color: '#111111',
    align: 'left',
    direction: 'horizontal',
    wrap: false,
    wrapWidth: 600,
    stroke: defaultStroke(),
    shadow: defaultShadow(),
    skewX: 0,
    chars: [],
    glyphMode: 'auto',
    ...preset,
  };
}

function findLayer(layers: AnyLayer[], id: string): AnyLayer | undefined {
  return layers.find((layer) => layer.id === id);
}

function makeCharOverrides(text: string): CharOverride[] {
  return Array.from(text).map((char, index) => ({
    id: nanoid(8),
    char,
    index,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fontSize: null,
    color: null,
    opacity: null,
    stroke: null,
    shadow: null,
    spacingBefore: 0,
    spacingAfter: 0,
    hidden: false,
    glyphId: null,
  }));
}

/** 文本变化时保留已有字符的样式，并为新增索引补齐覆盖项 */
function syncCharOverrides(prev: CharOverride[], text: string): CharOverride[] {
  const chars = Array.from(text);
  return chars.map((char, index) => {
    const existing = prev.find((item) => item.index === index);
    if (existing) return { ...existing, char };
    return {
      id: nanoid(8),
      char,
      index,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      fontSize: null,
      color: null,
      opacity: null,
      stroke: null,
      shadow: null,
      spacingBefore: 0,
      spacingAfter: 0,
      hidden: false,
      glyphId: null,
    };
  });
}

const initialDoc = createEmptyDoc();

export const useEditorStore = create<EditorState>()((set, get) => ({
  doc: initialDoc,
  selection: { layerIds: [], charIndices: [] },
  viewport: { scale: 1, x: 0, y: 0 },
  stage: { width: 0, height: 0 },
  past: [],
  future: [],
  activePanel: 'assets',
  clipboard: [],

  setProjectName: (name) =>
    set((state) => ({ doc: { ...state.doc, name, updatedAt: Date.now() } })),

  setCanvas: (patch, recordHistory = false) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      doc: { ...state.doc, canvas: { ...state.doc.canvas, ...patch }, updatedAt: Date.now() },
    }));
  },

  setReference: (asset) =>
    set((state) => ({ doc: { ...state.doc, reference: asset, updatedAt: Date.now() } })),

  loadDoc: (doc) =>
    set({
      doc: {
        ...doc,
        fonts: Array.isArray(doc.fonts) ? doc.fonts : [],
        styles: Array.isArray(doc.styles) ? doc.styles : [],
        glyphs: Array.isArray(doc.glyphs) ? doc.glyphs : [],
        layers: doc.layers.map((layer) =>
          layer.type === 'text'
            ? {
                ...layer,
                glyphMode: layer.glyphMode ?? 'auto',
                chars: (Array.isArray(layer.chars) ? layer.chars : []).map((item) => ({
                  ...item,
                  glyphId: item.glyphId ?? null,
                })),
              }
            : layer,
        ),
      },
      selection: { layerIds: [], charIndices: [] },
      past: [],
      future: [],
    }),

  newDoc: () =>
    set({ doc: createEmptyDoc(), selection: { layerIds: [], charIndices: [] }, past: [], future: [] }),

  addFont: (font) =>
    set((state) => ({
      doc: {
        ...state.doc,
        fonts: [...state.doc.fonts.filter((item) => item.id !== font.id), font],
        updatedAt: Date.now(),
      },
    })),

  removeFont: (id) =>
    set((state) => ({
      doc: {
        ...state.doc,
        fonts: state.doc.fonts.filter((item) => item.id !== id),
        updatedAt: Date.now(),
      },
    })),

  addStyle: (profile) =>
    set((state) => ({
      doc: { ...state.doc, styles: [profile, ...state.doc.styles], updatedAt: Date.now() },
    })),

  renameStyle: (id, name) =>
    set((state) => ({
      doc: {
        ...state.doc,
        styles: state.doc.styles.map((item) => (item.id === id ? { ...item, name } : item)),
        updatedAt: Date.now(),
      },
    })),

  removeStyle: (id) =>
    set((state) => ({
      doc: {
        ...state.doc,
        styles: state.doc.styles.filter((item) => item.id !== id),
        layers: state.doc.layers.map((layer) =>
          layer.type === 'text' && layer.styleId === id ? { ...layer, styleId: undefined } : layer,
        ),
        updatedAt: Date.now(),
      },
    })),

  applyStyle: (layerId, styleId) =>
    set((state) => ({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((layer) =>
          layer.id === layerId && layer.type === 'text'
            ? { ...layer, styleId: styleId ?? undefined }
            : layer,
        ),
        updatedAt: Date.now(),
      },
    })),

  addGlyph: (glyph) =>
    set((state) => ({
      doc: {
        ...state.doc,
        glyphs: [glyph, ...state.doc.glyphs.filter((item) => item.id !== glyph.id)],
        updatedAt: Date.now(),
      },
    })),

  updateGlyph: (id, patch) =>
    set((state) => ({
      doc: {
        ...state.doc,
        glyphs: state.doc.glyphs.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        updatedAt: Date.now(),
      },
    })),

  removeGlyph: (id) =>
    set((state) => ({
      doc: {
        ...state.doc,
        glyphs: state.doc.glyphs.filter((item) => item.id !== id),
        // 解除引用，避免画布上残留失效字形后无法渲染
        layers: state.doc.layers.map((layer) =>
          layer.type === 'text'
            ? {
                ...layer,
                chars: layer.chars.map((item) =>
                  item.glyphId === id ? { ...item, glyphId: null } : item,
                ),
              }
            : layer,
        ),
        updatedAt: Date.now(),
      },
    })),

  setGlyphMode: (layerId, mode) =>
    set((state) => ({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((layer) =>
          layer.id === layerId && layer.type === 'text' ? { ...layer, glyphMode: mode } : layer,
        ),
        updatedAt: Date.now(),
      },
    })),

  assignGlyph: (layerId, charIndex, glyphId) => get().assignGlyphs(layerId, [{ charIndex, glyphId }]),

  assignGlyphs: (layerId, entries) => {
    if (entries.length === 0) return;
    get().pushHistory();
    set((state) => ({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((layer) => {
          if (layer.id !== layerId || layer.type !== 'text') return layer;
          const chars = Array.from(layer.text);
          const base =
            layer.chars.length === chars.length
              ? layer.chars
              : syncCharOverrides(layer.chars, layer.text);
          return {
            ...layer,
            chars: base.map((item) => {
              const hit = entries.find((entry) => entry.charIndex === item.index);
              return hit ? { ...item, glyphId: hit.glyphId } : item;
            }),
          };
        }),
        updatedAt: Date.now(),
      },
    }));
  },

  selectLayer: (id, additive = false) =>
    set((state) => {
      if (!id) return { selection: { layerIds: [], charIndices: [] } };
      if (additive) {
        const exists = state.selection.layerIds.includes(id);
        const layerIds = exists
          ? state.selection.layerIds.filter((item) => item !== id)
          : [...state.selection.layerIds, id];
        return { selection: { layerIds, charIndices: [] } };
      }
      return { selection: { layerIds: [id], charIndices: [] } };
    }),

  selectLayers: (ids) => set({ selection: { layerIds: ids, charIndices: [] } }),

  selectChars: (layerId, charIndices) => set({ selection: { layerIds: [layerId], charIndices } }),

  clearSelection: () => set({ selection: { layerIds: [], charIndices: [] } }),

  addTextLayer: (text = 'TYPE LAB', preset) => {
    get().pushHistory();
    const layer = makeTextLayer(text, preset);
    set((state) => ({
      doc: {
        ...state.doc,
        layers: normalize([...state.doc.layers, { ...layer, zIndex: state.doc.layers.length }]),
        updatedAt: Date.now(),
      },
      selection: { layerIds: [layer.id], charIndices: [] },
    }));
    return layer.id;
  },

  addImageLayer: (src, size) => {
    get().pushHistory();
    const layer: ImageLayer = {
      id: nanoid(10),
      type: 'image',
      name: '图片',
      x: 120,
      y: 120,
      width: size.width,
      height: size.height,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      zIndex: 0,
      visible: true,
      locked: false,
      src,
    };
    set((state) => ({
      doc: {
        ...state.doc,
        layers: normalize([...state.doc.layers, layer]),
        updatedAt: Date.now(),
      },
      selection: { layerIds: [layer.id], charIndices: [] },
    }));
    return layer.id;
  },

  addLayers: (layers, select = true) => {
    if (layers.length === 0) return;
    get().pushHistory();
    set((state) => ({
      doc: {
        ...state.doc,
        layers: normalize([...state.doc.layers, ...layers]),
        updatedAt: Date.now(),
      },
      selection: select
        ? { layerIds: layers.map((layer) => layer.id), charIndices: [] }
        : state.selection,
    }));
  },

  moveLayers: (ids, dx, dy, recordHistory = false) => {
    if (ids.length === 0) return;
    if (recordHistory) get().pushHistory();
    set((state) => ({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((layer) =>
          ids.includes(layer.id) && !layer.locked
            ? { ...layer, x: layer.x + dx, y: layer.y + dy }
            : layer,
        ),
        updatedAt: Date.now(),
      },
    }));
  },

  setActivePanel: (panel) => set({ activePanel: panel }),

  updateLayer: (id, patch, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((layer) => (layer.id === id ? ({ ...layer, ...patch } as AnyLayer) : layer)),
        updatedAt: Date.now(),
      },
    }));
  },

  updateTextLayer: (id, patch, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((layer) => {
          if (layer.id !== id || layer.type !== 'text') return layer;
          const next = { ...layer, ...patch } as TextLayer;
          if (patch.text !== undefined && patch.text !== layer.text) {
            next.chars = syncCharOverrides(layer.chars, patch.text);
          }
          return next;
        }),
        updatedAt: Date.now(),
      },
    }));
  },

  updateImageLayer: (id, patch, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((layer) =>
          layer.id === id && layer.type === 'image' ? ({ ...layer, ...patch } as ImageLayer) : layer,
        ),
        updatedAt: Date.now(),
      },
    }));
  },

  removeLayers: (ids) => {
    if (ids.length === 0) return;
    get().pushHistory();
    set((state) => ({
      doc: {
        ...state.doc,
        layers: normalize(state.doc.layers.filter((layer) => !ids.includes(layer.id))),
        updatedAt: Date.now(),
      },
      selection: {
        layerIds: state.selection.layerIds.filter((id) => !ids.includes(id)),
        charIndices: [],
      },
    }));
  },

  duplicateLayers: (ids) => {
    if (ids.length === 0) return;
    get().pushHistory();
    set((state) => {
      const copies: AnyLayer[] = [];
      for (const layer of state.doc.layers) {
        if (!ids.includes(layer.id)) continue;
        const copy = {
          ...layer,
          id: nanoid(10),
          name: `${layer.name} 副本`,
          x: layer.x + 24,
          y: layer.y + 24,
        } as AnyLayer;
        if (copy.type === 'text') {
          copy.chars = layer.type === 'text' ? layer.chars.map((item) => ({ ...item, id: nanoid(8) })) : [];
        }
        copies.push(copy);
      }
      return {
        doc: {
          ...state.doc,
          layers: normalize([...state.doc.layers, ...copies]),
          updatedAt: Date.now(),
        },
        selection: { layerIds: copies.map((item) => item.id), charIndices: [] },
      };
    });
  },

  toggleVisible: (id) => {
    set((state) => ({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((layer) =>
          layer.id === id ? { ...layer, visible: !layer.visible } : layer,
        ),
        updatedAt: Date.now(),
      },
    }));
  },

  toggleLock: (id) => {
    set((state) => ({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((layer) =>
          layer.id === id ? { ...layer, locked: !layer.locked } : layer,
        ),
        updatedAt: Date.now(),
      },
    }));
  },

  reorderLayer: (id, direction) =>
    set((state) => {
      const layers = [...state.doc.layers];
      const index = layers.findIndex((layer) => layer.id === id);
      if (index < 0) return {};
      const [target] = layers.splice(index, 1);
      let nextIndex = index;
      if (direction === 'up') nextIndex = Math.min(index + 1, layers.length);
      if (direction === 'down') nextIndex = Math.max(index - 1, 0);
      if (direction === 'top') nextIndex = layers.length;
      if (direction === 'bottom') nextIndex = 0;
      layers.splice(nextIndex, 0, target);
      return {
        doc: { ...state.doc, layers: normalize(layers), updatedAt: Date.now() },
      };
    }),

  renameLayer: (id, name) =>
    set((state) => ({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((layer) => (layer.id === id ? { ...layer, name } : layer)),
        updatedAt: Date.now(),
      },
    })),

  updateChar: (layerId, charIndex, patch, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((layer) => {
          if (layer.id !== layerId || layer.type !== 'text') return layer;
          const chars = Array.from(layer.text);
          let overrides = layer.chars;
          if (overrides.length !== chars.length) {
            overrides = syncCharOverrides(overrides, layer.text);
          }
          const nextChars = overrides.map((item) =>
            item.index === charIndex ? { ...item, ...patch } : item,
          );
          return { ...layer, chars: nextChars };
        }),
        updatedAt: Date.now(),
      },
    }));
  },

  resetChar: (layerId, charIndex) => {
    get().pushHistory();
    set((state) => ({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((layer) => {
          if (layer.id !== layerId || layer.type !== 'text') return layer;
          return {
            ...layer,
            chars: layer.chars.map((item) =>
              item.index === charIndex
                ? {
                    ...item,
                    offsetX: 0,
                    offsetY: 0,
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                    fontSize: null,
                    color: null,
                    opacity: null,
                    stroke: null,
                    shadow: null,
                    spacingBefore: 0,
                    spacingAfter: 0,
                    hidden: false,
                  }
                : item,
            ),
          };
        }),
      },
    }));
  },

  deleteChar: (layerId, charIndex) => {
    get().pushHistory();
    set((state) => ({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((layer) => {
          if (layer.id !== layerId || layer.type !== 'text') return layer;
          const chars = Array.from(layer.text);
          if (charIndex < 0 || charIndex >= chars.length) return layer;
          const nextText = chars.filter((_, index) => index !== charIndex).join('');
          // 直接剔除对应覆盖项再重新编号，避免后续字符样式左移串位
          const base = layer.chars.length === chars.length ? layer.chars : syncCharOverrides(layer.chars, layer.text);
          const chars2 = base
            .filter((item) => item.index !== charIndex)
            .map((item, index) => ({ ...item, index }));
          return { ...layer, text: nextText, chars: chars2 };
        }),
      },
      selection: { layerIds: [layerId], charIndices: [] },
    }));
  },

  duplicateChar: (layerId, charIndex) => {
    get().pushHistory();
    set((state) => ({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((layer) => {
          if (layer.id !== layerId || layer.type !== 'text') return layer;
          const chars = Array.from(layer.text);
          const char = chars[charIndex];
          if (char === undefined) return layer;
          const nextText = chars.slice(0, charIndex + 1).join('') + char + chars.slice(charIndex + 1).join('');
          const base = layer.chars.length === chars.length ? layer.chars : syncCharOverrides(layer.chars, layer.text);
          const source = base.find((item) => item.index === charIndex);
          const inserted: CharOverride = source
            ? { ...source, id: nanoid(8) }
            : makeCharOverrides(char)[0];
          const chars2 = [
            ...base.filter((item) => item.index <= charIndex),
            inserted,
            ...base.filter((item) => item.index > charIndex),
          ].map((item, index) => ({ ...item, index }));
          return { ...layer, text: nextText, chars: chars2 };
        }),
      },
    }));
  },

  moveChar: (layerId, charIndex, direction) => {
    const state = get();
    const layer = findLayer(state.doc.layers, layerId);
    if (!layer || layer.type !== 'text') return;
    const chars = Array.from(layer.text);
    const target = direction === 'prev' ? charIndex - 1 : charIndex + 1;
    if (target < 0 || target >= chars.length) return;
    state.pushHistory();
    set((current) => ({
      doc: {
        ...current.doc,
        layers: current.doc.layers.map((item) => {
          if (item.id !== layerId || item.type !== 'text') return item;
          const list = Array.from(item.text);
          const base =
            item.chars.length === list.length ? item.chars : syncCharOverrides(item.chars, item.text);
          const pairs = list.map((char, index) => ({
            char,
            override: base.find((entry) => entry.index === index),
          }));
          const moving = pairs[charIndex];
          pairs[charIndex] = pairs[target];
          pairs[target] = moving;
          const nextChars = pairs.map((pair, index) => ({
            ...(pair.override ?? makeCharOverrides(pair.char)[0]),
            char: pair.char,
            index,
          }));
          return {
            ...item,
            text: pairs.map((pair) => pair.char).join(''),
            chars: nextChars,
          };
        }),
        updatedAt: Date.now(),
      },
      selection: { layerIds: [layerId], charIndices: [target] },
    }));
  },

  splitLineAt: (layerId, charIndex) => {
    const state = get();
    const layer = findLayer(state.doc.layers, layerId);
    if (!layer || layer.type !== 'text') return;
    const chars = Array.from(layer.text);
    if (charIndex < 0 || charIndex >= chars.length) return;
    if (chars[charIndex] === '\n') return;
    state.pushHistory();
    set((current) => ({
      doc: {
        ...current.doc,
        layers: current.doc.layers.map((item) => {
          if (item.id !== layerId || item.type !== 'text') return item;
          const list = Array.from(item.text);
          const base =
            item.chars.length === list.length ? item.chars : syncCharOverrides(item.chars, item.text);
          const inserted: CharOverride = { ...makeCharOverrides('\n')[0], index: charIndex + 1 };
          const nextChars = [
            ...base.filter((entry) => entry.index <= charIndex),
            inserted,
            ...base.filter((entry) => entry.index > charIndex),
          ].map((entry, index) => ({ ...entry, index }));
          const nextText =
            list.slice(0, charIndex + 1).join('') + '\n' + list.slice(charIndex + 1).join('');
          return { ...item, text: nextText, chars: nextChars };
        }),
        updatedAt: Date.now(),
      },
      selection: { layerIds: [layerId], charIndices: [charIndex + 1] },
    }));
  },

  splitTextToCharLayers: (layerId) => {
    const state = get();
    const layer = findLayer(state.doc.layers, layerId);
    if (!layer || layer.type !== 'text') return;
    if (Array.from(layer.text).filter((char) => char !== '\n').length === 0) return;
    state.pushHistory();
    // 依据真实排版结果拆分，保证字符位置与画布所见一致
    const { glyphs } = layoutText(layer);
    const aiGlyphs = state.doc.glyphs;
    const created: CharLayer[] = glyphs
      .filter((glyph) => glyph.char !== '\n' && !glyph.hidden)
      .map((glyph) => {
        const override = layer.chars.find((item) => item.index === glyph.index);
        const aiGlyph = override?.glyphId
          ? aiGlyphs.find((item) => item.id === override.glyphId)
          : undefined;
        return {
          id: nanoid(10),
          type: 'char',
          name: glyph.char,
          x: layer.x + glyph.x,
          y: layer.y + glyph.y,
          width: glyph.width,
          height: glyph.fontSize,
          rotation: layer.rotation + glyph.rotation,
          scaleX: layer.scaleX * glyph.scaleX,
          scaleY: layer.scaleY * glyph.scaleY,
          opacity: layer.opacity * glyph.opacity,
          zIndex: 0,
          visible: layer.visible,
          locked: false,
          char: glyph.char,
          fontId: layer.fontId,
          fontFamily: layer.fontFamily,
          fontWeight: layer.fontWeight,
          italic: layer.italic,
          fontSize: glyph.fontSize,
          color: glyph.color,
          stroke: { ...layer.stroke },
          shadow: { ...layer.shadow },
          skewX: layer.skewX,
          sourceLayerId: layer.id,
          sourceIndex: glyph.index,
          glyphSrc: aiGlyph?.src,
        };
      });
    set((current) => ({
      doc: {
        ...current.doc,
        layers: normalize([...current.doc.layers.filter((item) => item.id !== layerId), ...created]),
        updatedAt: Date.now(),
      },
      selection: { layerIds: created.map((item) => item.id), charIndices: [] },
    }));
  },

  // 视口
  setStageSize: (size) => set({ stage: size }),
  setViewport: (patch) => set((state) => ({ viewport: { ...state.viewport, ...patch } })),
  resetViewport: () => set({ viewport: { scale: 1, x: 0, y: 0 } }),

  zoomBy: (factor) =>
    set((state) => {
      const { stage, viewport } = state;
      const nextScale = clamp(viewport.scale * factor, MIN_SCALE, MAX_SCALE);
      if (nextScale === viewport.scale) return {};
      // 以画布视口中心为锚点缩放
      const cx = stage.width / 2;
      const cy = stage.height / 2;
      return {
        viewport: {
          scale: nextScale,
          x: cx - ((cx - viewport.x) * nextScale) / viewport.scale,
          y: cy - ((cy - viewport.y) * nextScale) / viewport.scale,
        },
      };
    }),

  zoomAt: (factor, point) =>
    set((state) => {
      const { viewport } = state;
      const nextScale = clamp(viewport.scale * factor, MIN_SCALE, MAX_SCALE);
      if (nextScale === viewport.scale) return {};
      const worldX = (point.x - viewport.x) / viewport.scale;
      const worldY = (point.y - viewport.y) / viewport.scale;
      return {
        viewport: {
          scale: nextScale,
          x: point.x - worldX * nextScale,
          y: point.y - worldY * nextScale,
        },
      };
    }),

  panBy: (dx, dy) =>
    set((state) => ({
      viewport: { ...state.viewport, x: state.viewport.x + dx, y: state.viewport.y + dy },
    })),

  fitViewport: () =>
    set((state) => {
      const { stage, doc } = state;
      if (!stage.width || !stage.height) return {};
      const padding = 64;
      const scale = clamp(
        Math.min(
          (stage.width - padding) / doc.canvas.width,
          (stage.height - padding) / doc.canvas.height,
        ),
        MIN_SCALE,
        MAX_SCALE,
      );
      return {
        viewport: {
          scale,
          x: (stage.width - doc.canvas.width * scale) / 2,
          y: (stage.height - doc.canvas.height * scale) / 2,
        },
      };
    }),

  centerViewport: () =>
    set((state) => {
      const { stage, viewport, doc } = state;
      if (!stage.width || !stage.height) return {};
      return {
        viewport: {
          scale: viewport.scale,
          x: (stage.width - doc.canvas.width * viewport.scale) / 2,
          y: (stage.height - doc.canvas.height * viewport.scale) / 2,
        },
      };
    }),

  copySelection: () => {
    const state = get();
    const picked = state.doc.layers.filter((layer) => state.selection.layerIds.includes(layer.id));
    if (picked.length === 0) return;
    set({
      clipboard: picked.map((layer) => ({
        ...layer,
        stroke: 'stroke' in layer ? { ...layer.stroke } : undefined,
        shadow: 'shadow' in layer ? { ...layer.shadow } : undefined,
        chars: layer.type === 'text' ? layer.chars.map((item) => ({ ...item })) : undefined,
      }) as AnyLayer),
    });
  },

  pasteClipboard: () => {
    const state = get();
    if (state.clipboard.length === 0) return;
    state.pushHistory();
    const copies: AnyLayer[] = state.clipboard.map((layer) => ({
      ...layer,
      id: nanoid(10),
      x: layer.x + 24,
      y: layer.y + 24,
      chars:
        layer.type === 'text' ? layer.chars.map((item) => ({ ...item, id: nanoid(8) })) : undefined,
    }) as AnyLayer);
    set((current) => ({
      doc: {
        ...current.doc,
        layers: normalize([...current.doc.layers, ...copies]),
        updatedAt: Date.now(),
      },
      selection: { layerIds: copies.map((item) => item.id), charIndices: [] },
    }));
  },

  pushHistory: () =>
    set((state) => {
      const snapshot: Snapshot = { layers: state.doc.layers, canvas: state.doc.canvas };
      const past = [...state.past, snapshot];
      if (past.length > HISTORY_LIMIT) past.shift();
      return { past, future: [] };
    }),

  undo: () =>
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (!previous) return {};
      const currentSnapshot: Snapshot = { layers: state.doc.layers, canvas: state.doc.canvas };
      return {
        doc: { ...state.doc, layers: previous.layers, canvas: previous.canvas, updatedAt: Date.now() },
        past: state.past.slice(0, -1),
        future: [currentSnapshot, ...state.future].slice(0, HISTORY_LIMIT),
        selection: { layerIds: [], charIndices: [] },
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return {};
      const currentSnapshot: Snapshot = { layers: state.doc.layers, canvas: state.doc.canvas };
      return {
        doc: { ...state.doc, layers: next.layers, canvas: next.canvas, updatedAt: Date.now() },
        past: [...state.past, currentSnapshot].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        selection: { layerIds: [], charIndices: [] },
      };
    }),
}));

export function useSelectedLayers(): AnyLayer[] {
  const layers = useEditorStore((state) => state.doc.layers);
  const ids = useEditorStore((state) => state.selection.layerIds);
  return useMemo(() => layers.filter((layer) => ids.includes(layer.id)), [layers, ids]);
}

export function useActiveLayer(): AnyLayer | null {
  return useEditorStore((state) => {
    const id = state.selection.layerIds[state.selection.layerIds.length - 1];
    if (!id) return null;
    return state.doc.layers.find((layer) => layer.id === id) ?? null;
  });
}

export { makeTextLayer, makeCharOverrides, syncCharOverrides };
