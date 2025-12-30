
export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  UPGRADING = 'UPGRADING',
  FINISHED = 'FINISHED'
}

export enum Difficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD'
}

export interface PlayerStats {
  damage: number;
  fireRate: number; // bullets per second
  projectileCount: number;
  level: number;
  score: number;
  xp: number;
  nextLevelXp: number;
  hp: number;
  maxHp: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'CHEST' | 'GATE_POS' | 'GATE_NEG' | 'WALL' | 'ENEMY' | 'LOOT' | 'BOSS';
  health?: number;
  maxHealth?: number;
  rewardXp?: number; // 击杀奖励经验
  value?: number;
  statType?: 'fireRate' | 'damage' | 'projectileCount';
  label?: string;
  speed?: number;
  pairId?: string; // 用于识别成对出现的门
  tier?: number; // 敌人阶级：1-5
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
  impact: (stats: PlayerStats) => PlayerStats;
  icon: string;
}
