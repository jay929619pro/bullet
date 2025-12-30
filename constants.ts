import { PlayerStats, UpgradeOption } from "./types";

export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 700;
export const PLAYER_SIZE = 40;
export const SCROLL_SPEED = 4.0;

// 霓虹调色盘
export const COLORS = {
  CYAN: "#00fff2",
  MAGENTA: "#ff00ff",
  YELLOW: "#ffff00",
  NEON_RED: "#ff0051",
  NEON_GREEN: "#00ff66",
  NEON_PURPLE: "#bc13fe",
  BG_DARK: "#020617",
  BG_LIGHT: "#1e1b4b"
};

export const INITIAL_STATS: PlayerStats = {
  damage: 20,
  fireRate: 5.0,
  projectileCount: 1,
  level: 1,
  score: 0,
  xp: 0,
  nextLevelXp: 100,
  hp: 3,
  maxHp: 3
};

const DMG_PCT = 0.5; // 50%
const FR_PCT = 0.45; // 45%

// Additive Upgrade Logic
// Base strength ≈ 3-4x Gate Strength
export const UPGRADE_OPTIONS: UpgradeOption[] = [
  {
    id: "fr_add",
    name: "射频过载",
    // 修复：描述与实际逻辑一致，且大幅下调数值
    // 3 mins (180s) -> 0.5 + 1.8 = +2.3 (原计划 +6.0，削弱 60%)
    description: s => `射速大幅提升`,
    icon: "⚡",
    impact: (s, ctx) => {
      const time = ctx?.gameTime || 0;
      // 为了让 description 能访问到 time，我们其实很难直接在 description 里拿到 context。
      // 这里是个 bug，description 只能拿到 stats。
      // 既然如此，我们写死一个更模糊但安全的描述，或者把 time 存入 stats (不推荐乱改结构)。
      // 暂时改为通用描述，避免误导。
      // Formula: Base 0.5 + Time * 0.01
      const bonus = 0.5 + time * 0.01;
      return { ...s, fireRate: s.fireRate + bonus };
    }
  },
  {
    id: "dmg_add",
    name: "贫铀弹头",
    // 3 mins (180s) -> 15 + 108 = +123 (原计划 +300，削弱 60%)
    description: s => `威力大幅提升`,
    icon: "☢️",
    impact: (s, ctx) => {
      const time = ctx?.gameTime || 0;
      const bonus = 15 + time * 0.6;
      return { ...s, damage: Math.ceil(s.damage + bonus) };
    }
  },
  {
    id: "pc",
    name: "同步链路",
    description: () => "弹道充能 +25%",
    icon: "🔱",
    impact: s => ({ ...s, projectileCount: s.projectileCount + 0.25 })
  },
  {
    id: "repair",
    name: "紧急维护",
    description: () => `生命上限 +1`,
    icon: "🛠️",
    impact: s => ({ ...s, maxHp: s.maxHp + 1, hp: s.hp + 1 })
  }
];

export const getWeaponName = (level: number) => {
  if (level < 5) return "Mk.I 原型机";
  if (level < 10) return "电弧拦截者";
  if (level < 15) return "等离子猎手";
  if (level < 20) return "重子歼击机";
  if (level < 25) return "幽灵黑客";
  if (level < 30) return "星际无畏级";
  if (level < 40) return "维度收割者";
  return "永恒终端";
};

export const getWeaponColor = (level: number) => {
  if (level < 5) return COLORS.CYAN;
  if (level < 10) return COLORS.NEON_GREEN;
  if (level < 15) return COLORS.YELLOW;
  if (level < 20) return COLORS.MAGENTA;
  if (level < 25) return COLORS.NEON_PURPLE;
  if (level < 35) return "#ffffff";
  return COLORS.NEON_RED;
};

export const formatNum = (num: number): string => {
  if (num < 1000) return Math.floor(num).toString();
  if (num < 10000) return (num / 1000).toFixed(1) + "K";
  if (num < 1000000) return Math.floor(num / 1000) + "K";
  return (num / 1000000).toFixed(1) + "M";
};
