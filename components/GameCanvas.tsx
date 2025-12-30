
import React, { useRef, useEffect } from 'react';
import { GameState, PlayerStats, Entity, Bullet, BulletParticle, Difficulty } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_SIZE, SCROLL_SPEED, getWeaponColor, formatNum, COLORS } from '../constants';

interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  scale: number;
}

interface GameCanvasProps {
  gameState: GameState;
  difficulty: Difficulty;
  stats: PlayerStats;
  isPaused: boolean;
  onXpGain: (amount: number) => void;
  onStatChange: (stat: keyof PlayerStats, amount: number) => void;
  onGameOver: (score: number) => void;
  onUpgradeTrigger: () => void;
  onScoreUpdate: (score: number) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, 
  difficulty,
  stats, 
  isPaused, 
  onXpGain, 
  onStatChange,
  onGameOver,
  onUpgradeTrigger,
  onScoreUpdate
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statsRef = useRef(stats);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);
  
  const stateRef = useRef({
    playerX: CANVAS_WIDTH / 2,
    playerY: CANVAS_HEIGHT - 120,
    bullets: [] as Bullet[],
    entities: [] as Entity[],
    particles: [] as BulletParticle[],
    floatingTexts: [] as FloatingText[],
    lastShotTime: 0,
    distanceTraveled: 0,
    score: 0,
    nextEntitySpawn: 0,
    shake: 0,
    isHordeMode: false,
    triggeredPairIds: new Set<string>(),
    bossFightActive: false,
    lastBossShot: 0,
    hitGateIdsThisFrame: new Set<string>(),
    invincibilityFrames: 0,
    damageFlash: 0,
    lastChestSpawnTime: 0,
    gateLastHitTime: new Map<string, number>() 
  });

  const mousePosRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 120 });

  const getDifficultyFactor = () => {
    switch (difficulty) {
      case Difficulty.EASY: return 0.6;
      case Difficulty.NORMAL: return 1.0;
      case Difficulty.HARD: return 1.5;
      default: return 1.0;
    }
  };

  /**
   * 核心修改：重新规划门的增长速度比例
   * 使用平滑曲线防止高难度下进化停滞
   */


  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      stateRef.current = {
        playerX: CANVAS_WIDTH / 2,
        playerY: CANVAS_HEIGHT - 120,
        bullets: [],
        entities: [],
        particles: [],
        floatingTexts: [],
        lastShotTime: 0,
        distanceTraveled: 0,
        score: 0,
        nextEntitySpawn: 0,
        shake: 0,
        isHordeMode: false,
        triggeredPairIds: new Set<string>(),
        bossFightActive: false,
        lastBossShot: 0,
        hitGateIdsThisFrame: new Set(),
        invincibilityFrames: 0,
        damageFlash: 0,
        lastChestSpawnTime: performance.now(),
        gateLastHitTime: new Map(),
      };
      mousePosRef.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 120 };
      spawnEntities(400, true);
    }
  }, [gameState]);

  useEffect(() => {
    if (stats.level > 1 && (stats.level - 1) % 5 === 0 && !stateRef.current.bossFightActive) {
      startBossFight();
    }
  }, [stats.level]);

  const startBossFight = () => {
    const state = stateRef.current;
    state.bossFightActive = true;
    state.isHordeMode = false;
    state.entities = state.entities.filter(e => e.type === 'LOOT');
    
    // 核心重构：Boss血量基于距离的平方增长 (Quadratic Scaling)
    // 依据：玩家DPS通常呈指数或高阶多项式增长 (FireRate线性 * Damage线性 = DPS二次方)
    // Goal: 3分钟(45k距离)约40k血量; 10分钟(150k距离)约450k血量
    const distFactor = Math.max(0, state.distanceTraveled);
    const difficultyMult = difficulty === Difficulty.HARD ? 1.5 : (difficulty === Difficulty.EASY ? 0.6 : 1.0);
    
    const baseBossHp = 3000 * difficultyMult;
    // 系数 ~20 用于匹配 (Distance/1000)^2
    const scalingHp = 20 * Math.pow(distFactor / 1000, 2) * difficultyMult;
    
    const hp = Math.floor(baseBossHp + scalingHp);
    
    const boss: Entity = {
      id: `boss-${Date.now()}`,
      x: CANVAS_WIDTH / 2 - 80,
      y: -300,
      width: 160,
      height: 120,
      type: 'BOSS',
      health: hp,
      maxHealth: hp,
      rewardXp: 2000 + statsRef.current.level * 200,
      speed: difficulty === Difficulty.HARD ? 1.5 : 0.8,
    };
    state.entities.push(boss);
    spawnFloatingText(CANVAS_WIDTH / 2, 200, "警告：高能单位接入", COLORS.NEON_RED);
  };

  const generateRandomGate = (side: 'left' | 'right', y: number, pairId?: string): Entity => {
    const statTypes: ('fireRate' | 'damage')[] = ['fireRate', 'damage'];
    const stat = statTypes[Math.floor(Math.random() * statTypes.length)];
    // 核心重构：Gate数值由距离线性决定 (Additive Growth)
    // 不再根据玩家当前属性计算，切断滚雪球链路
    const dist = Math.max(0, stateRef.current.distanceTraveled);
    const diffFactor = difficulty === Difficulty.HARD ? 1.5 : (difficulty === Difficulty.EASY ? 0.6 : 1.0);
    
    let baseVal = 0;
    let growthVal = 0;

    if (stat === 'damage') {
       // 攻击力：基础 10 + 每1万米 12点
       baseVal = 10 * diffFactor;
       growthVal = dist * 0.0012 * diffFactor; 
    } else {
       // 射速：基础 0.5 + 每1万米 0.8点 (原计划1.0，微调防止过快)
       baseVal = 0.5 * diffFactor;
       growthVal = dist * 0.00008 * diffFactor;
    }

    // 最终正值，带有 -20% ~ +20% 的随机浮动
    const targetPositiveValue = (baseVal + growthVal) * (0.8 + Math.random() * 0.4);
    
    // 初始负值：设为目标正值的 -40% ~ -80%，保证需要一定时间打正
    const initialValue = -(targetPositiveValue * (0.4 + Math.random() * 0.4));
    
    // 进化速度计算
    // 目标：1.5 秒内打正 (屏幕停留时间约 2.8s，需留出余量)
    // 进化增量 = |initialValue| / (PPS * 1.5)
    // 关键修正：游戏引擎每帧最多射击一次(60FPS)，因此实际射速无法超过60
    // 计算需求量时必须封顶，否则当面板射速>60时，门会变得由硬导致无法在离屏前打正
    const currentStats = statsRef.current;
    const effectiveFireRate = Math.min(60, currentStats.fireRate);
    const totalPPS = effectiveFireRate * currentStats.projectileCount;
    const safePPS = Math.max(1, totalPPS);
    
    // Gate 进化逻辑为每一发子弹增加 value
    // 这里计算每发子弹应该增加多少 value
    const evolutionSpeed = Math.abs(initialValue) / (safePPS * 1.5);

    return {
      id: `gate-${side}-${Math.random()}`,
      x: side === 'left' ? 0 : CANVAS_WIDTH / 2,
      y,
      width: CANVAS_WIDTH / 2,
      height: 110,
      type: 'GATE_NEG',
      statType: stat,
      value: parseFloat(initialValue.toFixed(2)),
      evolutionSpeed: parseFloat(evolutionSpeed.toFixed(4)),
      pairId
    };
  };

  const spawnEntities = (startY: number, isStarterZone = false) => {
    const state = stateRef.current;
    if (state.bossFightActive) return;

    const newEntities: Entity[] = [];
    const hordeCycle = state.distanceTraveled % 15000;
    const isHorde = hordeCycle > 12000 && !isStarterZone;
    state.isHordeMode = isHorde;

    const rows = isHorde ? 8 : 5;
    const rowSpacing = isHorde ? 400 : 750;

    for (let i = 0; i < rows; i++) {
      const rowY = startY - i * rowSpacing;
      if (state.entities.some(e => Math.abs(e.y - rowY) < 200)) continue;

      const roll = Math.random();
      if (roll < (isHorde ? 0.05 : 0.4)) {
        const pairId = `row-${Math.random()}`;
        newEntities.push(generateRandomGate('left', rowY, pairId));
        newEntities.push(generateRandomGate('right', rowY, pairId));
      } else {
        const count = isHorde ? 6 : (isStarterZone ? 2 : 3 + Math.floor(Math.random() * 2));
        const spacing = CANVAS_WIDTH / (count + 1);
        for (let j = 0; j < count; j++) {
          const rarityRoll = Math.random();
          let baseHp = 30;
          let tier = 1;
          let speedMult = 1.0;

          if (rarityRoll > 0.96) { tier = 4; baseHp = 500; speedMult = 0.5; }
          else if (rarityRoll > 0.85) { tier = 2; baseHp = 120; speedMult = 1.3; }

          // 核心重构：怪物血量成长公式
          // 采用轻微指数增长以对抗玩家的加法成长
          // Base * (1 + (Distance/8000)^1.1)
          const distFactor = Math.max(0, state.distanceTraveled);
          const diffMult = getDifficultyFactor(); // 0.4, 1.0, 2.8 (原函数) -> 注意这里用了原函数的系数，可能过大，需检查
          // 原 getDifficultyFactor 是 Easy 0.4, Normal 1.0, Hard 2.8
          // 我们新计划里是 Easy 0.6, Hard 1.5。为了统一，这里手动计算
          const standardDiffMult = difficulty === Difficulty.HARD ? 1.5 : (difficulty === Difficulty.EASY ? 0.6 : 1.0);
          
          let hpMultiplier = 1 + Math.pow(distFactor / 8000, 1.1);
          
          const hp = Math.max(1, Math.floor(baseHp * hpMultiplier * standardDiffMult));
          const size = Math.min(120, 50 + (Math.log10(hp + 1) * 12)); 
          
          newEntities.push({
            id: `enemy-${Math.random()}`,
            x: (j + 1) * spacing - size / 2,
            y: rowY - Math.random() * (isHorde ? 80 : 250),
            width: size, height: size,
            type: 'ENEMY',
            health: hp, maxHealth: hp,
            rewardXp: Math.floor(baseHp * 0.5),
            tier,
            speed: speedMult * (0.4 + Math.random() * 0.2) * (difficulty === Difficulty.HARD ? 1.3 : 1.0)
          });
        }
      }
    }
    state.entities = [...state.entities, ...newEntities];
  };

  const spawnChest = () => {
    const state = stateRef.current;
    if (state.bossFightActive) return;
    const hp = Math.max(60, Math.floor(100 * (1 + state.distanceTraveled / 30000) * getDifficultyFactor()));
    state.entities.push({
      id: `chest-${Date.now()}`,
      x: 50 + Math.random() * (CANVAS_WIDTH - 150),
      y: -200, width: 100, height: 80, type: 'CHEST',
      health: hp, maxHealth: hp, rewardXp: 100
    });
    spawnFloatingText(CANVAS_WIDTH / 2, 100, "检测到进化模块", COLORS.YELLOW);
  };

  const handleInput = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== GameState.PLAYING || isPaused) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let x = 0, y = 0;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    mousePosRef.current = {
      x: Math.max(PLAYER_SIZE/2, Math.min(CANVAS_WIDTH - PLAYER_SIZE/2, x * scaleX)),
      y: Math.max(PLAYER_SIZE/2, Math.min(CANVAS_HEIGHT - PLAYER_SIZE/2, y * scaleY))
    };
  };

  const spawnFloatingText = (x: number, y: number, text: string, color: string) => {
    stateRef.current.floatingTexts.push({
      id: Math.random().toString(),
      x, y, text, color, life: 70, scale: 1.2
    });
  };

  const createParticles = (x: number, y: number, color: string, count = 15, speed = 15) => {
    for (let i = 0; i < count; i++) {
      stateRef.current.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        life: 0,
        maxLife: 30 + Math.random() * 40,
        color
      });
    }
  };

  const spawnLoot = (x: number, y: number) => {
    stateRef.current.entities.push({
      id: `loot-${Math.random()}`,
      x, y, width: 40, height: 40, type: 'LOOT'
    });
  };

  const takeDamage = (amount: number) => {
    const state = stateRef.current;
    if (state.invincibilityFrames > 0) return;
    onStatChange('hp', -1);
    state.invincibilityFrames = 60; 
    state.damageFlash = 20;
    state.shake = 15;
    if (statsRef.current.hp - 1 <= 0) {
      onGameOver(state.score);
    } else {
      spawnFloatingText(state.playerX, state.playerY - 30, "护盾受损", COLORS.NEON_RED);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const update = () => {
      const state = stateRef.current;
      if (gameState !== GameState.PLAYING || isPaused) {
        state.lastChestSpawnTime += 16.6; 
        return;
      }
      
      const now = performance.now();
      if (now - state.lastChestSpawnTime > 20000) {
        state.lastChestSpawnTime = now;
        spawnChest();
      }

      if (state.invincibilityFrames > 0) state.invincibilityFrames--;
      if (state.damageFlash > 0) state.damageFlash--;

      state.hitGateIdsThisFrame.clear();

      const effectiveScroll = state.bossFightActive ? 0 : SCROLL_SPEED;
      state.distanceTraveled += effectiveScroll;
      
      state.playerX += (mousePosRef.current.x - state.playerX) * 0.15;
      state.playerY += (mousePosRef.current.y - state.playerY) * 0.15;

      if (state.shake > 0) state.shake -= 0.8;

      const fireInterval = 1000 / statsRef.current.fireRate;
      if (now - state.lastShotTime > fireInterval) {
        state.lastShotTime = now;
        const count = statsRef.current.projectileCount;
        const spread = Math.min(240, (count - 1) * 30);
        for (let i = 0; i < count; i++) {
          const offsetX = count > 1 ? (i / (count - 1) - 0.5) * spread : 0;
          state.bullets.push({
            id: `b-${Math.random()}`,
            x: state.playerX + offsetX,
            y: state.playerY - 30,
            vx: offsetX * 0.05,
            vy: -18,
            active: true,
            damage: statsRef.current.damage,
            distTraveled: 0,
            hitEntityIds: new Set(),
            isEnemyBullet: false
          });
        }
      }

      state.floatingTexts.forEach(t => { t.y -= 1; t.life--; t.scale *= 0.99; });
      state.floatingTexts = state.floatingTexts.filter(t => t.life > 0);

      state.bullets.forEach(b => {
        b.x += b.vx; b.y += b.vy; b.distTraveled += Math.abs(b.vy);
        if (b.y < -100 || b.y > CANVAS_HEIGHT + 100 || b.x < -100 || b.x > CANVAS_WIDTH + 100) b.active = false;

        if (b.isEnemyBullet) {
          if (Math.abs(b.x - state.playerX) < 25 && Math.abs(b.y - state.playerY) < 25) {
            takeDamage(1); b.active = false;
          }
          return;
        }

        state.entities.forEach(e => {
          if (!b.active || b.hitEntityIds.has(e.id)) return;
          if (b.x > e.x && b.x < e.x + e.width && b.y > e.y && b.y < e.y + e.height) {
            if (e.type === 'CHEST' || e.type === 'ENEMY' || e.type === 'BOSS') {
              b.active = false;
              if (e.health !== undefined) {
                e.health -= b.damage;
                createParticles(b.x, b.y, e.type === 'BOSS' ? COLORS.NEON_RED : COLORS.CYAN, 4, 8);
                if (e.health <= 0) {
                  if (e.type === 'BOSS') {
                    state.bossFightActive = false;
                    state.score += 50000;
                    for(let k=0; k<3; k++) spawnLoot(e.x + e.width/2 + (k-1)*60, e.y + e.height/2);
                    createParticles(e.x + e.width/2, e.y + e.height/2, COLORS.NEON_RED, 150, 25);
                    state.shake = 30;
                    onXpGain(e.rewardXp || 2000);
                  } else if (e.type === 'CHEST') {
                    state.score += 10000;
                    state.shake = 20;
                    createParticles(e.x + e.width/2, e.y + e.height/2, COLORS.YELLOW, 60, 20);
                    onUpgradeTrigger();
                  } else {
                    state.score += Math.floor(e.maxHealth! * 10);
                    onXpGain(e.rewardXp || 20);
                    createParticles(e.x + e.width/2, e.y + e.height/2, COLORS.NEON_PURPLE, 15, 12);
                  }
                  onScoreUpdate(state.score);
                  e.y = 10000; 
                }
              }
            } else if (e.type.startsWith('GATE')) {
              b.hitEntityIds.add(e.id);
              state.hitGateIdsThisFrame.add(e.id);
              // 直接在此处应用增量，响应每一发子弹
              if (e.evolutionSpeed) {
                 e.value = (e.value || 0) + e.evolutionSpeed;
              }
            }
          }
        });
      });
      state.bullets = state.bullets.filter(b => b.active);

      for (const e of state.entities) {
        // Gate Evolution Logic
        // 移除冷却限制，改用预计算的 normalized 增量
        if (e.type.startsWith('GATE') && state.hitGateIdsThisFrame.has(e.id) && e.value !== undefined && e.evolutionSpeed !== undefined) {
             // 本帧命中次数。因为 hitGateIdsThisFrame 是Set，只知道"这帧被打了"，具体次数需要计数吗？
             // 为了性能，之前移除了 gateHitCounts。
             // 但这里如果不计数，高射速(一帧多次命中)和低射速(一帧一次)的差距会被抹平。
             // 之前的逻辑是"hitGateIdsThisFrame.has" -> 该帧至少命中一次。
             // 如果我们希望"射速"完全生效，应该恢复计数逻辑，或者近似处理：
             // 实际上，bullet遍历时记录了 `hitGateIdsThisFrame`。
             // 如果要精确对应每发子弹，我们需要回退到在 bullet loop 里直接应用效果，或者维护计数 Map。
             // 考虑到"频率锁定"是被废弃的方案，我们现在需要"每发子弹都算"。
             // 但为了避免遍历 entity loop 时不知道命中了几次，最好在 bullet loop 里直接增加 value。
             // 不过，为了保持代码结构，我们可以在 bullet loop 里只标记，这里再增加。
             // 既然 bullet loop 里已经 filter 了，我们在那里其实更好操作。
             // 暂时折衷：在 bullet loop 里，每次 hit，直接 update entity value。
             // 那么这里的逻辑应该删掉，或者改为处理类型的翻转。
        }
        // 由于上述原因，Gate更新逻辑将移回 bullet loop (下方409行附近处理)，
        // 这里仅负责状态翻转 check
        if (e.type.startsWith('GATE') && e.value !== undefined) {
          if (e.value >= 0) e.type = 'GATE_POS'; else e.type = 'GATE_NEG';
        }

        // Entity Movement & Updates
        if (e.type === 'BOSS') {
          if (e.y < 120) e.y += 2;
          e.x += Math.sin(Date.now() / 800) * 4;
          if (now - state.lastBossShot > (difficulty === Difficulty.HARD ? 800 : 1500)) {
            state.lastBossShot = now;
            const bCount = 8;
            for(let i=0; i<bCount; i++) {
              state.bullets.push({
                id: `eb-${Math.random()}`,
                x: e.x + e.width/2, y: e.y + e.height,
                vx: (i/(bCount-1)-0.5)*10, vy: 6,
                active: true, damage: 1, distTraveled: 0, hitEntityIds: new Set(), isEnemyBullet: true
              });
            }
          }
        } else {
          e.y += effectiveScroll + (e.type === 'ENEMY' ? (e.speed || 0) : 0);
        }

        // Loot Attraction
        if (e.type === 'LOOT' && Math.sqrt((state.playerX - (e.x+20))**2 + (state.playerY - (e.y+20))**2) < 250) {
           e.x += (state.playerX - (e.x+20)) * 0.2; e.y += (state.playerY - (e.y+20)) * 0.2;
        }

        // Player Collision
        if (state.playerX + 20 > e.x && state.playerX - 20 < e.x + e.width && state.playerY + 20 > e.y && state.playerY - 20 < e.y + e.height) {
          if (e.type === 'ENEMY' || e.type === 'CHEST' || e.type === 'BOSS') {
            takeDamage(1); if (e.type === 'ENEMY') e.y = 10000;
          } else if (e.type === 'LOOT') {
            onStatChange('hp', 1); createParticles(state.playerX, state.playerY, COLORS.NEON_GREEN, 30, 15); e.y = 10000;
          } else if (e.type.startsWith('GATE')) {
            if (e.pairId && !state.triggeredPairIds.has(e.pairId)) {
              state.triggeredPairIds.add(e.pairId);
              onStatChange(e.statType!, e.value!);
              createParticles(state.playerX, e.y+50, e.value! >= 0 ? COLORS.CYAN : COLORS.NEON_RED, 40, 18);
              state.entities = state.entities.filter(ent => ent.pairId !== e.pairId);
            }
          }
        }
      }
      state.entities = state.entities.filter(e => e.y < CANVAS_HEIGHT + 200);

      if (state.distanceTraveled > state.nextEntitySpawn && !state.bossFightActive) {
        spawnEntities(-400, state.distanceTraveled < 3000);
        state.nextEntitySpawn += state.isHordeMode ? 800 : 1800;
      }

      state.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life++; });
      state.particles = state.particles.filter(p => p.life < p.maxLife);
    };

    const draw = () => {
      const state = stateRef.current;
      ctx.save();
      if (!isPaused && state.shake > 0) ctx.translate((Math.random()-0.5)*state.shake, (Math.random()-0.5)*state.shake);
      ctx.fillStyle = COLORS.BG_DARK;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.strokeStyle = state.isHordeMode || state.bossFightActive ? 'rgba(255, 0, 81, 0.2)' : 'rgba(0, 255, 242, 0.1)';
      ctx.lineWidth = 1;
      const offY = (state.distanceTraveled * 0.5) % 80;
      for(let x=0; x<=CANVAS_WIDTH; x+=40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke(); }
      for(let y=-80; y<=CANVAS_HEIGHT; y+=80) { ctx.beginPath(); ctx.moveTo(0, y+offY); ctx.lineTo(CANVAS_WIDTH, y+offY); ctx.stroke(); }

      let bossEntity: Entity | null = null;

      for (const e of state.entities) {
        if (e.type === 'BOSS') {
           bossEntity = e;
           ctx.shadowBlur = 30; ctx.shadowColor = COLORS.NEON_RED;
           ctx.fillStyle = '#111'; ctx.fillRect(e.x, e.y, e.width, e.height);
           ctx.strokeStyle = COLORS.NEON_RED; ctx.lineWidth = 4; ctx.strokeRect(e.x, e.y, e.width, e.height);
           ctx.fillStyle = COLORS.NEON_RED; ctx.font = '50px serif'; ctx.textAlign = 'center'; ctx.fillText('💀', e.x + e.width/2, e.y + e.height/2 + 20);
        } else if (e.type === 'CHEST') {
           ctx.shadowBlur = 40; ctx.shadowColor = COLORS.YELLOW;
           ctx.fillStyle = '#2d2d2d'; ctx.fillRect(e.x, e.y, e.width, e.height);
           ctx.strokeStyle = COLORS.YELLOW; ctx.lineWidth = 3; ctx.strokeRect(e.x, e.y, e.width, e.height);
           ctx.fillStyle = COLORS.YELLOW; ctx.font = '40px serif'; ctx.textAlign = 'center'; ctx.fillText('📦', e.x + e.width/2, e.y + e.height/2 + 15);
        } else if (e.type === 'ENEMY') {
           const tier = e.tier || 1;
           ctx.shadowBlur = 10 + tier * 5; ctx.shadowColor = COLORS.NEON_PURPLE;
           ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = tier > 1 ? COLORS.MAGENTA : COLORS.NEON_PURPLE;
           ctx.lineWidth = 2;
           ctx.save();
           ctx.translate(e.x + e.width/2, e.y + e.height/2);
           ctx.rotate(Date.now() / 1000 * tier);
           ctx.beginPath();
           if(tier === 4) { ctx.rect(-e.width/2, -e.height/2, e.width, e.height); }
           else { ctx.moveTo(0, -e.height/2); ctx.lineTo(e.width/2, e.height/2); ctx.lineTo(-e.width/2, e.height/2); ctx.closePath(); }
           ctx.fill(); ctx.stroke(); ctx.restore();
        } else if (e.type.startsWith('GATE')) {
           const isPos = e.type === 'GATE_POS';
           ctx.shadowBlur = 20; ctx.shadowColor = isPos ? COLORS.CYAN : COLORS.NEON_RED;
           const grd = ctx.createLinearGradient(e.x, e.y, e.x, e.y+e.height);
           grd.addColorStop(0, isPos ? 'rgba(0, 255, 242, 0.4)' : 'rgba(255, 0, 81, 0.4)');
           grd.addColorStop(1, 'transparent');
           ctx.fillStyle = grd; ctx.fillRect(e.x, e.y, e.width, e.height);
           ctx.strokeStyle = isPos ? COLORS.CYAN : COLORS.NEON_RED; ctx.lineWidth = 2; ctx.strokeRect(e.x, e.y, e.width, e.height);
           ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = '900 14px Rajdhani';
           ctx.fillText(e.statType === 'fireRate' ? '射速' : '威力', e.x + e.width/2, e.y + 30);
           ctx.font = '900 32px Rajdhani';
           const val = e.value!;
           // 显示具体数值而非百分比
           const displayVal = Math.abs(val).toFixed(2);
           const sign = val >= 0 ? '+' : '-';
           ctx.fillText(`${sign}${displayVal}`, e.x + e.width/2, e.y + 75);
        } else if (e.type === 'LOOT') {
           ctx.shadowBlur = 20; ctx.shadowColor = COLORS.NEON_GREEN;
           ctx.fillStyle = COLORS.NEON_GREEN; ctx.beginPath(); ctx.arc(e.x+20, e.y+20, 10 + Math.sin(Date.now()/100)*3, 0, Math.PI*2); ctx.fill();
        }

        if (e.health !== undefined && e.health > 0 && (e.type === 'ENEMY' || e.type === 'CHEST')) {
           ctx.shadowBlur = 0;
           ctx.fillStyle = 'rgba(0,0,0,0.5)';
           const fontSize = Math.max(10, e.width * 0.22);
           ctx.font = `900 ${fontSize}px Rajdhani`;
           const text = formatNum(e.health);
           const textWidth = ctx.measureText(text).width;
           ctx.fillRect(e.x + e.width/2 - textWidth/2 - 2, e.y + e.height/2 - fontSize/2 - 2, textWidth + 4, fontSize + 4);
           ctx.fillStyle = 'white';
           ctx.textAlign = 'center';
           ctx.fillText(text, e.x + e.width/2, e.y + e.height/2 + (fontSize / 3));
        }
      }

      if (bossEntity && bossEntity.health !== undefined && bossEntity.maxHealth !== undefined) {
         const barWidth = CANVAS_WIDTH * 0.8;
         const barHeight = 12;
         const barX = (CANVAS_WIDTH - barWidth) / 2;
         const barY = 160; 
         ctx.save();
         ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
         ctx.fillRect(barX, barY, barWidth, barHeight);
         const progress = bossEntity.health / bossEntity.maxHealth;
         const fillWidth = barWidth * progress;
         const grd = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
         grd.addColorStop(0, COLORS.NEON_RED);
         grd.addColorStop(1, COLORS.MAGENTA);
         ctx.fillStyle = grd;
         ctx.shadowBlur = 10;
         ctx.shadowColor = COLORS.NEON_RED;
         ctx.fillRect(barX, barY, fillWidth, barHeight);
         ctx.strokeStyle = 'white';
         ctx.lineWidth = 1;
         ctx.strokeRect(barX, barY, barWidth, barHeight);
         ctx.shadowBlur = 5;
         ctx.fillStyle = 'white';
         ctx.font = '900 12px Orbitron';
         ctx.textAlign = 'left';
         ctx.fillText("BOSS UNIT", barX, barY - 8);
         ctx.textAlign = 'right';
         ctx.fillText(`${formatNum(bossEntity.health)} / ${formatNum(bossEntity.maxHealth)}`, barX + barWidth, barY - 8);
         ctx.restore();
      }

      state.floatingTexts.forEach(t => {
        ctx.save(); ctx.globalAlpha = t.life / 70; ctx.fillStyle = t.color;
        ctx.font = `900 ${24 * t.scale}px Rajdhani`; ctx.textAlign = 'center';
        ctx.shadowBlur = 15; ctx.shadowColor = t.color;
        ctx.fillText(t.text, t.x, t.y); ctx.restore();
      });

      const wCol = getWeaponColor(statsRef.current.level);
      state.bullets.forEach(b => {
        ctx.shadowBlur = 15; ctx.shadowColor = b.isEnemyBullet ? COLORS.NEON_RED : wCol;
        ctx.fillStyle = b.isEnemyBullet ? COLORS.NEON_RED : wCol;
        if(b.isEnemyBullet) { ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, Math.PI*2); ctx.fill(); }
        else { ctx.fillRect(b.x-4, b.y-15, 8, 30); }
      });

      state.particles.forEach(p => {
        ctx.globalAlpha = 1 - p.life/p.maxLife; ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
      });

      ctx.save(); ctx.translate(state.playerX, state.playerY);
      if (state.invincibilityFrames > 0 && Math.floor(Date.now()/50)%2===0) ctx.globalAlpha = 0.4;
      ctx.shadowBlur = 25; ctx.shadowColor = wCol;
      ctx.strokeStyle = wCol; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -35); ctx.lineTo(30, 15); ctx.lineTo(0, 5); ctx.lineTo(-30, 15); ctx.closePath();
      ctx.fill(); ctx.stroke();
      for(let i=0; i<3; i++) {
        ctx.fillStyle = wCol; ctx.globalAlpha = 0.4;
        ctx.fillRect(-10 + i*8, 15 + Math.random()*15, 4, 4);
      }
      ctx.restore();

      if (state.damageFlash > 0) {
        ctx.fillStyle = `rgba(255, 0, 81, ${state.damageFlash / 40})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      ctx.restore();
    };

    const FIXED_TIME_STEP = 1000 / 60;
    let accumulatedTime = 0;
    let lastTime = performance.now();

    const loop = (timestamp: number) => {
      const deltaTime = timestamp - lastTime;
      lastTime = timestamp;
      
      // 避免后台挂起后回来由于 deltaTime 过大导致死循环
      // 限制最大追赶时间为 0.2 秒 (约 12 帧)
      accumulatedTime += Math.min(deltaTime, 200);

      while (accumulatedTime >= FIXED_TIME_STEP) {
        update();
        accumulatedTime -= FIXED_TIME_STEP;
      }

      draw();
      animationFrameId = requestAnimationFrame(loop);
    };
    
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, difficulty, isPaused, onXpGain, onGameOver, onScoreUpdate, onStatChange, onUpgradeTrigger, takeDamage, getDifficultyFactor]);

  return <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onMouseMove={handleInput} onTouchMove={handleInput} className="cursor-none block w-full h-full touch-none relative z-10" />;
};

export default GameCanvas;
