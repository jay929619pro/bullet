import { PlayerStats, UpgradeOption, Rarity } from "./types";

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

// Initial Stats
export const INITIAL_PLAYER_STATS: PlayerStats = {
  score: 0,
  distanceTraveled: 0,
  level: 1,
  xp: 0,
  nextLevelXp: 100,

  // Base Stats
  damage: 10,
  fireRate: 5,
  projectileCount: 1,
  hp: 3,
  maxHp: 3,

  // Multipliers
  damageMultiplier: 1.0,
  fireRateMultiplier: 1.0
};

// Rarity Definitions
const RARITY_WEIGHTS = {
  [Rarity.COMMON]: 60,
  [Rarity.RARE]: 30,
  [Rarity.EPIC]: 9,
  [Rarity.LEGENDARY]: 1
};

const RARITY_CONFIG = {
  [Rarity.COMMON]: { color: "#a0aec0", label: "普通", multiplier: 0.1 }, // +10%
  [Rarity.RARE]: { color: "#4299e1", label: "稀有", multiplier: 0.25 }, // +25%
  [Rarity.EPIC]: { color: "#9f7aea", label: "史诗", multiplier: 0.5 }, // +50%
  [Rarity.LEGENDARY]: { color: "#ed8936", label: "传说", multiplier: 1.0 } // +100%
};

// Upgrade Templates
// Instead of static options, we generate them based on rarity
export const getUpgradePool = (count: number = 3): UpgradeOption[] => {
  const options: UpgradeOption[] = [];

  for (let i = 0; i < count; i++) {
    // 1. Roll Rarity
    const roll = Math.random() * 100;
    let rarity = Rarity.COMMON;
    if (roll > 98) rarity = Rarity.LEGENDARY; // 2%
    else if (roll > 90) rarity = Rarity.EPIC; // 8%
    else if (roll > 60) rarity = Rarity.RARE; // 30%

    // Default config if not found (fallback)
    const config = RARITY_CONFIG[rarity] || RARITY_CONFIG[Rarity.COMMON];

    // 2. Roll Type (Damage, FireRate, Utility)
    const typeRoll = Math.random();
    let option: UpgradeOption;

    if (typeRoll < 0.4) {
      // 40% Damage (Attack Modchip)
      const bonusPct = Math.round(config.multiplier * 100);
      option = {
        id: "dmg_" + Math.random().toString(36).substr(2, 9),
        name: "攻击模组",
        icon: "⚔️",
        rarity,
        description: () => `威力 +${bonusPct}% (当前 x${config.multiplier})`,
        impact: s => ({
          ...s,
          damageMultiplier: (s.damageMultiplier || 1.0) + config.multiplier
        })
      };
    } else if (typeRoll < 0.8) {
      // 40% FireRate (Overclock Module)
      const bonusPct = Math.round(config.multiplier * 100);
      option = {
        id: "fr_" + Math.random().toString(36).substr(2, 9),
        name: "超频核心",
        icon: "⚡",
        rarity,
        description: () => `射速 +${bonusPct}% (当前 x${config.multiplier})`,
        impact: s => ({
          ...s,
          fireRateMultiplier: (s.fireRateMultiplier || 1.0) + config.multiplier
        })
      };
    } else {
      // 20% Special
      if (Math.random() < 0.5) {
        // Projectile
        let cnt = 0.5;
        if (rarity === Rarity.EPIC) cnt = 1;
        if (rarity === Rarity.LEGENDARY) cnt = 2;

        option = {
          id: "pc_" + Math.random().toString(36).substr(2, 9),
          name: "多重挂载",
          icon: "🔱",
          rarity,
          description: () => `弹道 +${cnt} (额外分裂)`,
          impact: s => ({ ...s, projectileCount: s.projectileCount + cnt })
        };
      } else {
        // Heal
        option = {
          id: "hp_" + Math.random().toString(36).substr(2, 9),
          name: "纳米修复",
          icon: "❤️",
          rarity,
          description: () => `生命值 +1 (上限提升)`,
          impact: s => ({ ...s, maxHp: s.maxHp + 1, hp: Math.min(s.maxHp + 1, s.hp + 1) })
        };
      }
    }
    options.push(option);
  }

  return options;
};

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
