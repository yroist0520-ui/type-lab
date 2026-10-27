/** 字体清单：第一阶段使用系统字体，第三阶段接入导入字体与风格档案。 */

export interface FontOption {
  id: string;
  label: string;
  family: string;
  category: '无衬线' | '衬线' | '等宽' | '展示';
  defaultWeight: number;
  lang: '中英' | '西文' | '通用';
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'pingfang',
    label: '苹方 PingFang',
    family: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    category: '无衬线',
    defaultWeight: 500,
    lang: '中英',
  },
  {
    id: 'helvetica',
    label: 'Helvetica Neue',
    family: '"Helvetica Neue", Helvetica, Arial, "PingFang SC", sans-serif',
    category: '无衬线',
    defaultWeight: 500,
    lang: '通用',
  },
  {
    id: 'arial',
    label: 'Arial',
    family: 'Arial, "Helvetica Neue", "PingFang SC", sans-serif',
    category: '无衬线',
    defaultWeight: 400,
    lang: '通用',
  },
  {
    id: 'avenir',
    label: 'Avenir Next',
    family: '"Avenir Next", Avenir, "PingFang SC", sans-serif',
    category: '无衬线',
    defaultWeight: 500,
    lang: '通用',
  },
  {
    id: 'songti',
    label: '宋体 Songti',
    family: '"Songti SC", "SimSun", "Source Han Serif SC", serif',
    category: '衬线',
    defaultWeight: 400,
    lang: '中英',
  },
  {
    id: 'kaiti',
    label: '楷体 Kaiti',
    family: '"Kaiti SC", "KaiTi", "STKaiti", serif',
    category: '衬线',
    defaultWeight: 400,
    lang: '中英',
  },
  {
    id: 'georgia',
    label: 'Georgia',
    family: 'Georgia, "Times New Roman", "Songti SC", serif',
    category: '衬线',
    defaultWeight: 400,
    lang: '通用',
  },
  {
    id: 'times',
    label: 'Times New Roman',
    family: '"Times New Roman", Times, "Songti SC", serif',
    category: '衬线',
    defaultWeight: 400,
    lang: '通用',
  },
  {
    id: 'didot',
    label: 'Didot',
    family: 'Didot, "Bodoni 72", "Times New Roman", serif',
    category: '衬线',
    defaultWeight: 400,
    lang: '西文',
  },
  {
    id: 'menlo',
    label: 'Menlo Mono',
    family: 'Menlo, Monaco, "Courier New", monospace',
    category: '等宽',
    defaultWeight: 400,
    lang: '通用',
  },
  {
    id: 'impact',
    label: 'Impact',
    family: 'Impact, "Haettenschweiler", "Arial Black", sans-serif',
    category: '展示',
    defaultWeight: 400,
    lang: '西文',
  },
  {
    id: 'arialblack',
    label: 'Arial Black',
    family: '"Arial Black", "Helvetica Neue", "PingFang SC", sans-serif',
    category: '展示',
    defaultWeight: 900,
    lang: '通用',
  },
];

export function getFont(id: string): FontOption {
  return FONT_OPTIONS.find((font) => font.id === id) ?? FONT_OPTIONS[0];
}
