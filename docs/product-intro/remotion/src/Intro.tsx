import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
} from "remotion";

const C = {
  bg: "#FFF8F0",
  card: "#FFFFFF",
  primary: "#FF7F50",
  primaryDeep: "#EC551C",
  primarySoft: "#FFF0E6",
  text: "#2D2D2D",
  textLight: "#666666",
  border: "#F0E6DC",
};
const FONT = `-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue","Segoe UI",Roboto,"Noto Sans SC",sans-serif`;

const fade = (f: number, d = 0, dur = 12) =>
  interpolate(f, [d, d + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
const rise = (f: number, d = 0, dur = 12) =>
  interpolate(f, [d, d + dur], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

// v5 回声气泡 Logo 图标部分（纯图形 SVG，不含文字，避免 headless 下 tspan 定位 bug）
const MARK_SVG = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 170" width="${size}" height="${size}">
    <defs>
      <linearGradient id="wt" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFB059"/><stop offset="55%" stop-color="#FF7A2F"/><stop offset="100%" stop-color="#EC551C"/>
      </linearGradient>
      <filter id="sf" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#EC551C" flood-opacity="0.35"/>
      </filter>
    </defs>
    <rect x="8" y="8" width="144" height="144" rx="38" fill="url(#wt)" filter="url(#sf)"/>
    <g transform="translate(11,3)">
      <g opacity="0.22" fill="#FFFFFF" transform="translate(8,8)">
        <rect x="32" y="40" width="66" height="50" rx="18"/><path d="M46 90 L46 106 L64 90 Z"/>
      </g>
      <g>
        <rect x="32" y="40" width="66" height="50" rx="18" fill="#FFFFFF"/>
        <path d="M46 90 L46 106 L64 90 Z" fill="#FFFFFF"/>
        <g fill="none" stroke="#FF7A2F" stroke-width="4.5" stroke-linecap="round">
          <path d="M52 58 A 12 12 0 0 1 52 72"/>
          <path d="M60 53 A 20 20 0 0 1 60 77"/>
          <path d="M68 48 A 28 28 0 0 1 68 82"/>
        </g>
      </g>
    </g>
    <g fill="#FFFFFF"><circle cx="128" cy="30" r="3" opacity="0.9"/><circle cx="139" cy="46" r="2" opacity="0.7"/></g>
  </svg>`;

// Logo = 图标(SVG) + 文字(React DOM)，彻底避开 SVG tspan 渲染 bug
const Logo: React.FC<{ iconSize?: number; fontSize?: number; dark?: boolean }> = ({
  iconSize = 160,
  fontSize = 54,
  dark = false,
}) => {
  const textColor = dark ? "#FFF8F0" : "#1A1A1A";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div dangerouslySetInnerHTML={{ __html: MARK_SVG(iconSize) }} />
      <div style={{ display: "flex", alignItems: "baseline", fontFamily: FONT }}>
        <span
          style={{
            fontSize,
            fontWeight: 800,
            letterSpacing: "-0.5",
            color: textColor,
          }}
        >
          Shadowing
        </span>
        <span
          style={{
            fontSize,
            fontWeight: 800,
            letterSpacing: "-0.5",
            background: "linear-gradient(135deg,#FFB059,#EC551C)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginLeft: 4,
          }}
        >
          Master
        </span>
      </div>
    </div>
  );
};

const Echo: React.FC<{ delay: number; top?: string }> = ({
  delay,
  top = "38%",
}) => {
  const f = useCurrentFrame();
  const t = ((((f - delay) % 100) + 100) % 100) / 100;
  const scale = interpolate(t, [0, 1], [0.5, 3.4]);
  const opacity = interpolate(t, [0, 1], [0.7, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top,
        width: 140,
        height: 140,
        margin: "-70px 0 0 -70px",
        borderRadius: "50%",
        border: "3px solid rgba(255,127,80,.55)",
        transform: `scale(${scale})`,
        opacity,
      }}
    />
  );
};

// ===== Scene 0: Hook =====
const Scene0: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(120% 90% at 50% 35%,#3a2418 0%,#271710 60%,#1a0f09 100%)",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: FONT,
        opacity: fade(f, 0, 10),
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 720,
          height: 720,
          borderRadius: "50%",
          background: "#FF7A2F",
          filter: "blur(80px)",
          opacity: 0.5,
          left: "50%",
          top: "30%",
          transform: "translate(-50%,-50%)",
        }}
      />
      <div
        style={{
          color: "#FFB98A",
          fontSize: 30,
          letterSpacing: 2,
          fontWeight: 600,
          opacity: fade(f, 5, 14),
        }}
      >
        ENGLISH SPEAKING
      </div>
      <div
        style={{
          color: "#FFF8F0",
          fontSize: 78,
          lineHeight: 1.32,
          fontWeight: 800,
          textAlign: "center",
          marginTop: 42,
          textShadow: "0 6px 30px rgba(0,0,0,.4)",
          opacity: fade(f, 12, 18),
          transform: `translateY(${rise(f, 12, 18)}px)`,
        }}
      >
        学了这么多年英语，
        <br />
        开口还是<span style={{ color: C.primary }}>没底气</span>？
      </div>
      <div
        style={{
          marginTop: 54,
          color: "#E7C9B5",
          fontSize: 38,
          lineHeight: 1.6,
          textAlign: "center",
          fontWeight: 500,
          opacity: fade(f, 30, 18),
        }}
      >
        不是你不努力，
        <br />
        是少了「跟读」这一环。
      </div>
    </AbsoluteFill>
  );
};

// ===== Scene 1: Brand reveal =====
const Scene1: React.FC = () => {
  const f = useCurrentFrame();
  const pop = spring({ frame: f, fps: 30, config: { damping: 12, stiffness: 120 } });
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(120% 90% at 50% 40%,#FFF3E8 0%,#FFF8F0 55%,#FFE9D8 100%)",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: FONT,
        position: "relative",
        opacity: fade(f, 0, 10),
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 680,
          height: 680,
          borderRadius: "50%",
          background: "#FFB059",
          filter: "blur(80px)",
          opacity: 0.4,
          left: "50%",
          top: "38%",
          transform: "translate(-50%,-50%)",
        }}
      />
      <Echo delay={0} />
      <Echo delay={33} />
      <Echo delay={66} />
      <div
        style={{
          transform: `scale(${pop})`,
          filter: "drop-shadow(0 14px 38px rgba(236,85,28,.35))",
        }}
      >
        <Logo iconSize={160} fontSize={54} dark={false} />
      </div>
      <div
        style={{
          marginTop: 60,
          fontSize: 46,
          fontWeight: 800,
          color: C.primaryDeep,
          letterSpacing: 1,
          opacity: fade(f, 18, 14),
        }}
      >
        回声跟读 · 练出地道口语
      </div>
      <div
        style={{
          marginTop: 26,
          fontSize: 34,
          color: C.textLight,
          fontWeight: 500,
          opacity: fade(f, 28, 14),
        }}
      >
        像影子一样紧跟原声，复述每一句
      </div>
      <div
        style={{
          marginTop: 48,
          fontSize: 27,
          color: "#A8745A",
          background: "#FFF0E6",
          padding: "18px 34px",
          borderRadius: 999,
          border: `1px solid ${C.border}`,
          opacity: fade(f, 40, 14),
        }}
      >
        Shadowing = 紧跟原声，成为自己的 Master
      </div>
    </AbsoluteFill>
  );
};

// ===== Scene 2: Method loop =====
const STEPS = [
  { n: "①", t: "看原声", d: "精选 YouTube 短视频，逐句切分，自动播放到当前句。" },
  { n: "②", t: "逐句跟读", d: "原句播完即刻录音，与原文逐词对比，差异立刻标出。" },
  { n: "③", t: "查词积累", d: "点开任意生词看释义与翻译，顺手收进生词本。" },
];
const Scene2: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg,#FFF8F0 0%,#FFEFE2 100%)",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: FONT,
        padding: "120px 96px",
        opacity: fade(f, 0, 10),
      }}
    >
      <div
        style={{
          fontSize: 52,
          fontWeight: 800,
          color: C.text,
          textAlign: "center",
          marginBottom: 14,
          opacity: fade(f, 4, 12),
        }}
      >
        三步，把原声<span style={{ color: C.primary }}>变成你的口语</span>
      </div>
      <div
        style={{
          fontSize: 30,
          color: C.textLight,
          marginBottom: 64,
          textAlign: "center",
          opacity: fade(f, 10, 12),
        }}
      >
        看 → 跟 → 记，闭环练熟
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 30, width: "100%" }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 34,
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 28,
                padding: "34px 38px",
                boxShadow: "0 10px 34px rgba(255,127,80,.10)",
                opacity: fade(f, 16 + i * 14, 14),
                transform: `translateY(${rise(f, 16 + i * 14, 14)}px)`,
              }}
            >
              <div
                style={{
                  flex: "0 0 auto",
                  width: 92,
                  height: 92,
                  borderRadius: 24,
                  background: "linear-gradient(135deg,#FFB059,#EC551C)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 48,
                  color: "#fff",
                  fontWeight: 800,
                  boxShadow: "0 8px 20px rgba(236,85,28,.35)",
                }}
              >
                {s.n}
              </div>
              <div>
                <div style={{ fontSize: 40, fontWeight: 800, color: C.text }}>{s.t}</div>
                <div style={{ fontSize: 28, color: C.textLight, marginTop: 8, lineHeight: 1.4 }}>
                  {s.d}
                </div>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div
                  style={{
                    width: 4,
                    height: 34,
                    background: "linear-gradient(#FF7F50,transparent)",
                    borderRadius: 4,
                    opacity: fade(f, 22 + i * 14, 10),
                  }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ===== Scene 3: Features =====
const FEATURES = [
  { ic: "🟠", t: "智能高亮", d: "考纲外难词自动标橙，注意力只留给该学的词。" },
  { ic: "🔍", t: "点词即查", d: "一键看释义与翻译，轻轻一点收进生词本。" },
  { ic: "📈", t: "进度可视", d: "每句练习都有记录，坚持看得见、有迹可循。" },
  { ic: "🎬", t: "海量素材", d: "YouTube 精选短视频，逐句精听、反复跟读。" },
];
const Scene3: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg,#FFF8F0 0%,#FFF1E6 100%)",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: FONT,
        padding: "80px 96px",
        opacity: fade(f, 0, 10),
      }}
    >
      <div
        style={{
          fontSize: 50,
          fontWeight: 800,
          color: C.text,
          textAlign: "center",
          opacity: fade(f, 4, 12),
        }}
      >
        为跟读而生的<span style={{ color: C.primary }}>每一处细节</span>
      </div>
      <div
        style={{
          fontSize: 28,
          color: C.textLight,
          textAlign: "center",
          marginTop: 12,
          marginBottom: 44,
          opacity: fade(f, 10, 12),
        }}
      >
        让你把时间花在真正该练的地方
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 26,
          width: "100%",
          maxWidth: 880,
        }}
      >
        {FEATURES.map((ft, i) => (
          <div
            key={i}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 26,
              padding: "34px 32px",
              boxShadow: "0 8px 26px rgba(255,127,80,.09)",
              minHeight: 268,
              opacity: fade(f, 16 + i * 12, 12),
              transform: `translateY(${rise(f, 16 + i * 12, 12)}px)`,
            }}
          >
            <div
              style={{
                width: 74,
                height: 74,
                borderRadius: 20,
                background: C.primarySoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                marginBottom: 22,
              }}
            >
              {ft.ic}
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, color: C.text }}>{ft.t}</div>
            <div style={{ fontSize: 25, color: C.textLight, marginTop: 12, lineHeight: 1.5 }}>
              {ft.d}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 40,
          width: "100%",
          maxWidth: 880,
          background: "#2D2D2D",
          borderRadius: 24,
          padding: "36px 38px",
          position: "relative",
          boxShadow: "0 14px 40px rgba(0,0,0,.25)",
          opacity: fade(f, 16 + FEATURES.length * 12, 12),
        }}
      >
        <div
          style={{
            fontSize: 22,
            color: "#FFB98A",
            letterSpacing: 3,
            marginBottom: 20,
            fontWeight: 600,
          }}
        >
          TAP ANY WORD
        </div>
        <div style={{ fontSize: 38, lineHeight: 1.6, color: "#FFF8F0" }}>
          She{" "}
          <span
            style={{
              background: C.primary,
              color: "#fff",
              padding: "2px 14px",
              borderRadius: 10,
              fontWeight: 700,
            }}
          >
            hesitated
          </span>{" "}
          before answering the tricky question.
        </div>
        <div
          style={{
            position: "absolute",
            right: 46,
            bottom: -44,
            background: "#fff",
            borderRadius: 18,
            padding: "22px 26px",
            boxShadow: "0 16px 40px rgba(0,0,0,.3)",
            minWidth: 300,
            transform: `translateY(${interpolate(
              ((f % 120) + 120) % 120 / 120,
              [0, 1],
              [0, -12]
            )}px)`,
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 800, color: C.primaryDeep }}>
            hesitated
          </div>
          <div style={{ fontSize: 24, color: C.textLight, marginTop: 6 }}>
            /ˈhezɪteɪtɪd/ v. 犹豫 · 迟疑
          </div>
          <div
            style={{
              marginTop: 14,
              display: "inline-block",
              background: "linear-gradient(135deg,#FFB059,#EC551C)",
              color: "#fff",
              fontSize: 22,
              fontWeight: 700,
              padding: "10px 22px",
              borderRadius: 999,
            }}
          >
            + 加入生词本
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===== Scene 4: CTA =====
const Scene4: React.FC = () => {
  const f = useCurrentFrame();
  const pop = spring({ frame: f, fps: 30, config: { damping: 12, stiffness: 120 } });
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(120% 90% at 50% 40%,#3a2418 0%,#271710 70%,#1a0f09 100%)",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: FONT,
        opacity: fade(f, 0, 10),
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 680,
          height: 680,
          borderRadius: "50%",
          background: "#FF7A2F",
          filter: "blur(80px)",
          opacity: 0.4,
          left: "50%",
          top: "34%",
          transform: "translate(-50%,-50%)",
        }}
      />
      <div
        style={{
          transform: `scale(${pop})`,
          filter: "drop-shadow(0 14px 38px rgba(236,85,28,.35))",
        }}
      >
        <Logo iconSize={120} fontSize={42} dark={true} />
      </div>
      <div
        style={{
          marginTop: 54,
          color: "#FFF8F0",
          fontSize: 62,
          lineHeight: 1.4,
          fontWeight: 800,
          textAlign: "center",
          opacity: fade(f, 14, 14),
        }}
      >
        现在，
        <br />
        开始你的第一次跟读。
      </div>
      <div
        style={{
          marginTop: 48,
          color: "#FFD9BE",
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: 1,
          border: "1px solid rgba(255,127,80,.5)",
          padding: "18px 40px",
          borderRadius: 999,
          background: "rgba(255,127,80,.08)",
          opacity: fade(f, 26, 14),
        }}
      >
        shadowingmaster.genisource.studio
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 90,
          color: "#B98C73",
          fontSize: 26,
          letterSpacing: 2,
          opacity: fade(f, 38, 14),
        }}
      >
        ShadowingMaster · 跟着原声，成为自己的 Master
      </div>
    </AbsoluteFill>
  );
};

export const ShadowingMasterIntro: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      <Sequence from={0} durationInFrames={240}>
        <Scene0 />
      </Sequence>
      <Sequence from={240} durationInFrames={240}>
        <Scene1 />
      </Sequence>
      <Sequence from={480} durationInFrames={240}>
        <Scene2 />
      </Sequence>
      <Sequence from={720} durationInFrames={300}>
        <Scene3 />
      </Sequence>
      <Sequence from={1020} durationInFrames={225}>
        <Scene4 />
      </Sequence>
    </AbsoluteFill>
  );
};
