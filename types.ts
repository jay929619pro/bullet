export enum GameState {
  START = "START",
  PLAYING = "PLAYING",
  UPGRADING = "UPGRADING",
  FINISHED = "FINISHED"
}

export enum Difficulty {
  EASY = "EASY",
  NORMAL = "NORMAL",
  HARD = "HARD"
}

export enum Rarity {
  COMMON = "common",
  RARE = "rare",
  EPIC = "epic",
  LEGENDARY = "legendary"
}

export interface PlayerStats {
  score: number;
  distanceTraveled: number;
  level: number;
  xp: number;
  nextLevelXp: number;

  // Base Stats (from Initial + Gates)
  damage: number;
  fireRate: number;
  projectileCount: number;
  hp: number;
  maxHp: number; // 3 hearts

  // Multipliers (from Upgrades)
  damageMultiplier: number; // Default 1.0, +0.1 means +10%
  fireRateMultiplier: number; // Default 1.0
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "CHEST" | "GATE_POS" | "GATE_NEG" | "WALL" | "ENEMY" | "LOOT" | "BOSS";
  health?: number;
  maxHealth?: number;
  rewardXp?: number; // 击杀奖励经验
  value?: number;
  statType?: "fireRate" | "damage" | "projectileCount";
  label?: string;
  speed?: number;
  pairId?: string; // 用于识别成对出现的门
  tier?: number; // 敌人阶级：1-5
  evolutionSpeed?: number; // 门数值进化每枪增量
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  damage: number;
  distTraveled: number;
  hitEntityIds: Set<string>; // 防止穿透时重复触发同一实体的碰撞
  isEnemyBullet?: boolean;
}

export interface BulletParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface UpgradeOption {
  id: string;
  name: string;
  description: (stats: PlayerStats) => string;
  impact: (stats: PlayerStats, context?: { gameTime: number }) => PlayerStats;
  icon: string;
  rarity: Rarity; // Quality level
}
