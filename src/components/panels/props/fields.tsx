/** 属性面板共用的基础控件，统一间距与交互，避免各面板重复实现。 */

export const PALETTE = [
  '#111111',
  '#ffffff',
  '#ff3b00',
  '#c62828',
  '#1a73e8',
  '#0f9d58',
  '#f4b400',
  '#6a1b9a',
  '#8a8a8a',
  '#000000',
];

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onStart?: () => void;
  min?: number;
  max?: number;
  step?: number;
}

/** 数值输入：聚焦时记录一次历史，之后连续输入不再产生快照 */
export function NumberField({ label, value, onChange, onStart, min, max, step = 1 }: NumberFieldProps) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        className="input"
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onFocus={onStart}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </label>
  );
}

interface RangeFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onStart?: () => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

export function RangeField({ label, value, onChange, onStart, min, max, step = 1, unit = '' }: RangeFieldProps) {
  const display = step < 1 ? value.toFixed(2) : String(Math.round(value));
  return (
    <div className="field">
      <div className="row">
        <span className="field__label">{label}</span>
        <span className="grow" />
        <span className="mono">
          {display}
          {unit}
        </span>
      </div>
      <input
        className="range"
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onPointerDown={onStart}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

interface SwatchRowProps {
  value: string;
  onChange: (color: string) => void;
}

/** 常用色板 + 自定义取色器 */
export function SwatchRow({ value, onChange }: SwatchRowProps) {
  const current = value.toLowerCase();
  return (
    <div className="swatch-row">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          className={`swatch ${current === color ? 'is-active' : ''}`}
          style={{ background: color }}
          title={color}
          aria-label={color}
          onClick={() => onChange(color)}
        />
      ))}
      <input
        className="input--color"
        type="color"
        value={value}
        aria-label="自定义颜色"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

interface ToggleLineProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ToggleLine({ label, checked, onChange }: ToggleLineProps) {
  return (
    <label className="toggle-line">
      <input
        className="checkbox"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipGroupProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function ChipGroup<T extends string>({ options, value, onChange }: ChipGroupProps<T>) {
  return (
    <div className="chip-row">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`chip ${option.value === value ? 'is-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
