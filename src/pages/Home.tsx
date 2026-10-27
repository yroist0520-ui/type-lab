interface HomeProps {
  onEnter: () => void;
}

const CAPABILITIES = [
  {
    no: '01',
    title: '参考图风格分析',
    desc: '上传字体参考图，提取字重、笔画结构、比例与端点特征，生成可复用的风格档案。',
  },
  {
    no: '02',
    title: '双引擎字形生成',
    desc: '真实字体渲染与 AI 字形生成共用一套字符对象，缺失字形才交给 AI。',
  },
  {
    no: '03',
    title: '逐字自由排版',
    desc: '每个字符都是独立对象，可单独调字号、颜色、位置、角度与前后间距。',
  },
  {
    no: '04',
    title: '本地项目管理',
    desc: '浏览器内保存项目，支持 .typelab 导出备份与高清 PNG 输出，无需注册。',
  },
];

export default function Home({ onEnter }: HomeProps) {
  return (
    <div className="home">
      <header className="home__bar">
        <span className="home__mark mono">TYPE LAB</span>
        <span className="mono home__version">v0.1 / studio</span>
      </header>

      <main className="home__main">
        <div className="home__hero">
          <p className="mono home__eyebrow">AI TYPOGRAPHY CREATION STUDIO</p>
          <h1 className="home__title">
            TYPE
            <br />
            LAB
          </h1>
          <p className="home__lead">
            从一张参考图出发，分析字体风格，生成新的字形，并在画布上逐字排版。
            <br />
            字体不是被识别出来的，而是被你重新做出来的。
          </p>
          <div className="home__actions">
            <button className="btn btn--primary home__enter" onClick={onEnter}>
              进入工作台 →
            </button>
            <span className="hint">无需注册 · 数据保存在本地浏览器</span>
          </div>
        </div>

        <div className="home__specimen" aria-hidden="true">
          <div className="home__specimen-line home__specimen-line--a">Aa</div>
          <div className="home__specimen-line home__specimen-line--b">字</div>
          <div className="home__specimen-grid" />
        </div>
      </main>

      <section className="home__caps">
        {CAPABILITIES.map((item) => (
          <article key={item.no} className="home__cap">
            <span className="mono home__cap-no">{item.no}</span>
            <h2 className="home__cap-title">{item.title}</h2>
            <p className="home__cap-desc">{item.desc}</p>
          </article>
        ))}
      </section>

      <footer className="home__foot mono">
        <span>REFERENCE → ANALYSIS → GLYPH → LAYOUT</span>
        <span>本地项目可能因清理缓存丢失，重要作品请导出 .typelab 备份</span>
      </footer>
    </div>
  );
}
