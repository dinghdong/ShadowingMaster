/**
 * ShadowingMaster · Landing Page（应用主页 /）
 * 设计事实源：docs/LANDING-PAGE-SPEC.md；视觉全部取 tokens.css 的 var(--xxx)。
 * 纯展示页：导航走 useApp().setPage，与现有 History 路由一致，无新依赖。
 * 视觉增强（更酷炫）：极光背景 / 渐变标题 / 声波可视化 / 浮动徽章 / 滚动揭示 / 话题跑马灯 / 流光 CTA。
 */
import React, { useEffect, useRef } from "react";
import { AppState } from "../useApp";
import { Icon, IconName } from "../components/Icon";
import { ThemeMode } from "../theme-mode";

type Props = AppState & { theme: ThemeMode; onToggleTheme: () => void };

/* —— 数据：核心功能卡（与已实现功能一一对应，见规范 §4）—— */
const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  { icon: "lines", title: "中英双语气泡字幕", desc: "英文 + 中文对照，一键切换 英文 / 中文 / 双语，看一句跟一句。" },
  { icon: "target", title: "生词自动高亮", desc: "超出 5000 常用词表的词自动标红，点一下看释义、加入生词本。" },
  { icon: "mic", title: "语音跟读 · 逐词对比", desc: "浏览器原生识别录音，和原句逐词对照，读错的词立刻标红。" },
  { icon: "chart", title: "四种练习模式", desc: "精听、跟读、听写、挖空，覆盖听、说、写，循序渐进。" },
  { icon: "book", title: "生词本 · 跳回原句", desc: "收录的生词带释义，一键回到出现它的视频原句位置。" },
  { icon: "clock", title: "学习进度记忆", desc: "自动记住上次学到哪一句，下次打开接着练，不丢进度。" },
];

const MODES: { icon: IconName; name: string; desc: string }[] = [
  { icon: "target", name: "精听", desc: "盲听练耳朵，可隐藏字幕挑战" },
  { icon: "mic", name: "跟读", desc: "录音对比，纠正发音" },
  { icon: "lines", name: "听写", desc: "写下你听到的英文" },
  { icon: "book", name: "挖空", desc: "填出生词，巩固记忆" },
];

const STATS: { num: string; label: string }[] = [
  { num: "5000+", label: "高频词表智能高亮" },
  { num: "4", label: "种练习模式" },
  { num: "逐词", label: "发音对比纠错" },
  { num: "0", label: "下载 · 浏览器直接练" },
];

const TOPICS = ["日常对话", "TED 演讲", "美剧片段", "商务英语", "旅行口语", "面试英语", "新闻听力", "电影台词"];

/* —— 跟读示例 mock：模拟一句气泡（英文 + 中文 + 生词标红 + 你的跟读逐词对比）—— */
const EN_TOKENS: { t: string; hard?: boolean }[] = [
  { t: "I " }, { t: "genuinely", hard: true }, { t: " " },
  { t: "appreciate", hard: true }, { t: " " }, { t: "your " },
  { t: "generous", hard: true }, { t: " " }, { t: "hospitality", hard: true }, { t: "." },
];
const CN = "我由衷地感激你慷慨的款待。";
const YOUR_TOKENS: { t: string; bad?: boolean }[] = [
  { t: "I " }, { t: "genuine", bad: true }, { t: " " },
  { t: "appreciate" }, { t: " " }, { t: "your " },
  { t: "generous" }, { t: " " }, { t: "hospital", bad: true }, { t: "." },
];

/* —— 滚动揭示：进入视口时加 is-in，触发 CSS 过渡 —— */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return ref;
}

/* —— 声波可视化：n 条跳动的柱 —— */
function Waveform({ bars = 5, className }: { bars?: number; className?: string }) {
  return (
    <span className={`wave ${className ?? ""}`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className="wave__bar" style={{ ["--i" as string]: String(i) } as React.CSSProperties} />
      ))}
    </span>
  );
}

function LandingNav(p: Props) {
  return (
    <header className="landing__nav">
      <button className="landing__brand" onClick={() => p.setPage("landing")} aria-label="返回首页">
        <img className="landing__brand-logo" src="/favicon.svg" alt="ShadowingMaster" width={28} height={28} />
        <span>Shadowing<span style={{ color: "var(--primary)" }}>Master</span></span>
      </button>
      <div className="landing__nav-actions">
        <button className="icon-btn icon-btn--plain" onClick={p.onToggleTheme} aria-label="切换主题" title="切换深色模式">
          <Icon name={p.theme === "dark" ? "sun" : "moon"} size={22} />
        </button>
        {p.user ? (
          <button className="btn btn--sm landing__nav-enter" onClick={() => p.setPage("list")}>进入应用</button>
        ) : (
          <button className="btn btn--sm landing__nav-login" onClick={() => p.setPage("login")}>登录</button>
        )}
      </div>
    </header>
  );
}

function Hero(p: Props) {
  return (
    <section className="hero">
      {/* 极光光晕背景（纯装饰） */}
      <div className="hero__aurora" aria-hidden="true">
        <span className="hero__blob hero__blob--1" />
        <span className="hero__blob hero__blob--2" />
        <span className="hero__blob hero__blob--3" />
      </div>

      <div className="hero__inner">
        <div className="hero__copy">
          <div className="hero__eyebrow reveal">
            <span className="hero__eyebrow-dot" />
            用 YouTube 真实短视频练口语
          </div>
          <h1 className="hero__title reveal">
            像母语者一样，
            <br />
            <span className="hero__title-grad">逐句跟读练出好口语</span>
          </h1>
          <p className="hero__sub reveal">
            选一段你喜欢的英文短视频，跟着逐句气泡字幕朗读、录音对比、自动标记生词。
            把碎片时间变成高效的口语训练。
          </p>
          <div className="hero__cta reveal">
            <button className="btn btn--primary btn--lg btn--glow" onClick={() => p.setPage("list")}>
              开始跟读 <Icon name="arrowRight" size={16} />
            </button>
            <button className="link-btn hero__secondary" onClick={() => p.setPage("login")}>
              登录 / 注册
            </button>
          </div>
          <div className="hero__proof reveal">
            <Waveform bars={5} className="wave--inline" />
            <span className="meta">无需下载 · 手机浏览器直接练 · 游客可先逛逛</span>
          </div>

          <div className="hero__stats reveal">
            {STATS.slice(0, 3).map((s) => (
              <div key={s.label} className="hero__stat">
                <span className="hero__stat-num">{s.num}</span>
                <span className="hero__stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：真实跟读界面的手机预览（token 驱动，非截图） */}
        <div className="hero__visual reveal">
          <div className="phone-stage">
            <div className="phone-halo" aria-hidden="true" />
            <div className="phone">
              <div className="phone__notch" />
              <div className="phone__bar">
                <span className="phone__title">Daily English #23</span>
                <Icon name="book" size={16} />
              </div>
              <div className="phone__player">
                <Waveform bars={9} className="wave--player" />
                <span className="phone__rec"><span className="phone__rec-dot" />REC</span>
                <div className="phone__play"><Icon name="play" size={16} /></div>
              </div>
              <div className="phone__sentence phone__sentence--current">
                <div className="phone__en">
                  The <span className="phone__hard">quick</span> brown fox jumps over the <span className="phone__hard">lazy</span> dog.
                </div>
                <div className="phone__cn">一只敏捷的棕色狐狸跳过了那只懒狗。</div>
              </div>
              <div className="phone__sentence">
                <div className="phone__en">And runs into the <span className="phone__hard">forest</span>.</div>
                <div className="phone__cn">然后跑进了森林。</div>
              </div>
              <div className="phone__modes">
                {["精听", "跟读", "听写", "挖空"].map((m, i) => (
                  <span key={m} className={`phone__mode ${i === 1 ? "phone__mode--active" : ""}`}>{m}</span>
                ))}
              </div>
            </div>

            {/* 浮动玻璃徽章 */}
            <div className="phone-badge phone-badge--score">
              <span className="phone-badge__ic"><Icon name="check" size={14} /></span>
              <span><b>发音 92</b><br />逐词对比通过</span>
            </div>
            <div className="phone-badge phone-badge--word">
              <span className="phone-badge__ic phone-badge__ic--warn"><Icon name="book" size={14} /></span>
              <span><b>+1 生词</b><br />已存入生词本</span>
            </div>
          </div>
        </div>
      </div>

      {/* 话题跑马灯 */}
      <div className="marquee reveal" aria-hidden="true">
        <div className="marquee__track">
          {[...TOPICS, ...TOPICS].map((t, i) => (
            <span key={i} className="marquee__chip"><Icon name="film" size={13} />{t}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="section__head reveal">
      <h2 className="section__title">{title}</h2>
      {lead && <p className="section__lead">{lead}</p>}
    </div>
  );
}

function Steps() {
  const steps = [
    { n: "1", icon: "film" as IconName, title: "选一段视频", desc: "浏览视频库，挑你感兴趣的真实英文短视频。" },
    { n: "2", icon: "mic" as IconName, title: "逐句跟读录音", desc: "句子自动播放，点「跟读」录音，和原句逐词对比。" },
    { n: "3", icon: "book" as IconName, title: "收藏生词复习", desc: "生词一键存入生词本，随时跳回原句巩固。" },
  ];
  return (
    <section className="section">
      <SectionHead title="三步，开始你的第一段跟读" />
      <div className="steps">
        {steps.map((s, i) => (
          <div key={s.n} className="step reveal" style={{ ["--d" as string]: `${i * 90}ms` } as React.CSSProperties}>
            <div className="step__num">{s.n}</div>
            <div className="step__icon"><Icon name={s.icon} size={22} /></div>
            <div className="step__title">{s.title}</div>
            <div className="step__desc">{s.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="section">
      <SectionHead title="口语三大痛点，逐个击破" lead="每一项功能都已实现，打开即用。" />
      <div className="feature-grid">
        {FEATURES.map((f, i) => (
          <div key={f.title} className="feature reveal" style={{ ["--d" as string]: `${(i % 3) * 90}ms` } as React.CSSProperties}>
            <div className="feature__icon"><Icon name={f.icon} size={22} /></div>
            <div className="feature__title">{f.title}</div>
            <div className="feature__desc">{f.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ModesShowcase() {
  return (
    <section className="section">
      <SectionHead title="一种素材，四种练法" lead="同一段视频，按你的目标切换练习模式。" />
      <div className="modes">
        {MODES.map((m, i) => (
          <div key={m.name} className="mode reveal" style={{ ["--d" as string]: `${i * 80}ms` } as React.CSSProperties}>
            <span className="mode__icon"><Icon name={m.icon} size={20} /></span>
            <span className="mode__name">{m.name}</span>
            <span className="mode__desc">{m.desc}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DemoSection() {
  return (
    <section className="section">
      <SectionHead title="眼见为实：一句跟读长这样" lead="真实界面里的逐句气泡与跟读对比。" />
      <div className="demo">
        <div className="demo__card reveal">
          <div className="demo__label">原句</div>
          <div className="demo__en">
            {EN_TOKENS.map((tk, i) => (
              <span key={i} className={tk.hard ? "demo__hard" : undefined}>{tk.t}</span>
            ))}
          </div>
          <div className="demo__cn">{CN}</div>
        </div>
        <div className="demo__card demo__card--yours reveal" style={{ ["--d" as string]: "120ms" } as React.CSSProperties}>
          <div className="demo__yours-head">
            <div className="demo__label">你的跟读</div>
            <div className="score-ring" style={{ ["--val" as string]: "82" } as React.CSSProperties}>
              <span className="score-ring__num">82</span>
            </div>
          </div>
          <div className="demo__en">
            {YOUR_TOKENS.map((tk, i) => (
              <span key={i} className={tk.bad ? "demo__diff" : undefined}>{tk.t}</span>
            ))}
          </div>
          <div className="demo__hint">标红的词和原句不一致，多听多模仿就好。</div>
        </div>
      </div>
    </section>
  );
}

function YouTubeSection(p: Props) {
  return (
    <section className="section">
      <div className="yt-band reveal">
        <div className="yt-band__icon"><Icon name="plus" size={22} /></div>
        <div className="yt-band__body">
          <div className="yt-band__title">粘贴 YouTube 链接，即学即练</div>
          <div className="yt-band__desc">
            登录后把任意 YouTube 视频链接贴进来，系统自动下载、解析中英字幕并生成跟读视频——
            你喜欢的素材，马上就能拿来练。
          </div>
        </div>
        <button className="btn btn--sm btn--primary" onClick={() => (p.user ? p.setPage("add") : p.setPage("login"))}>
          {p.user ? "去添加" : "登录可用"}
        </button>
      </div>
    </section>
  );
}

function FinalCTA(p: Props) {
  return (
    <section className="section">
      <div className="cta-band reveal">
        <span className="cta-band__sheen" aria-hidden="true" />
        <h2 className="cta-band__title">现在就开始你的第一段跟读</h2>
        <p className="cta-band__desc">几分钟就能感受到「跟读」带来的变化。</p>
        <div className="cta-band__btns">
          <button className="btn btn--lg" onClick={() => p.setPage("list")}>开始跟读</button>
          <button className="btn btn--outline btn--lg" onClick={() => p.setPage("login")}>登录 / 注册</button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__brand">ShadowingMaster</div>
      <div className="footer__tagline meta">英语口语跟读训练 · 用真实视频练出好口语</div>
      <div className="footer__links">
        <span className="link-btn">隐私</span>
        <span className="link-btn">帮助</span>
        <span className="link-btn">联系我们</span>
      </div>
      <div className="footer__copy meta">© 2026 ShadowingMaster</div>
    </footer>
  );
}

export default function LandingPage(p: Props) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div className="app app--flush landing" ref={ref}>
      <LandingNav {...p} />
      <Hero {...p} />
      <Steps />
      <Features />
      <ModesShowcase />
      <DemoSection />
      <YouTubeSection {...p} />
      <FinalCTA {...p} />
      <Footer />
    </div>
  );
}
