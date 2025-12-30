
import React, { useState, useCallback, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, PlayerStats, UpgradeOption, Difficulty } from './types';
import { INITIAL_STATS, UPGRADE_OPTIONS, getWeaponName, formatNum, COLORS } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.NORMAL);
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [gameTime, setGameTime] = useState(0);
  const [currentUpgradeChoices, setCurrentUpgradeChoices] = useState<UpgradeOption[]>([]);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('bullet_evolve_hs')) || 0);

  useEffect(() => {
    let interval: number;
    if (gameState === GameState.PLAYING && !showUpgrades) {
      interval = window.setInterval(() => {
        setGameTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState, showUpgrades]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = (selectedDiff: Difficulty) => {
    setDifficulty(selectedDiff);
    let startStats = { ...INITIAL_STATS };
    if (selectedDiff === Difficulty.EASY) {
      startStats.damage = 40;
      startStats.fireRate = 7.0;
      startStats.hp = 5;
      startStats.maxHp = 5;
      startStats.nextLevelXp = 80;
    } else if (selectedDiff === Difficulty.NORMAL) {
      startStats.hp = 3;
      startStats.maxHp = 3;
    } else if (selectedDiff === Difficulty.HARD) {
      startStats.hp = 2;
      startStats.maxHp = 2;
      startStats.nextLevelXp = 150;
    }
    setStats(startStats);
    setGameTime(0);
    setGameState(GameState.PLAYING);
    setShowUpgrades(false);
  };

  const triggerUpgradeChoice = useCallback(() => {
    const choices = [...UPGRADE_OPTIONS]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    setCurrentUpgradeChoices(choices);
    setShowUpgrades(true);
  }, []);

  const selectUpgrade = (upgrade: UpgradeOption) => {
    setStats(prev => ({
      ...upgrade.impact(prev, { gameTime }),
      level: prev.level + 1,
      xp: 0,
      nextLevelXp: Math.floor(prev.nextLevelXp * 1.35)
    }));
    setShowUpgrades(false);
  };

  const handleStatChange = useCallback((stat: keyof PlayerStats, amount: number) => {
    setStats(prev => {
      let newValue = prev[stat] as number;
      // 核心修改：改为加法逻辑，避免指数级膨胀
      // 此时 amount 已经是处理过的具体数值（例如 +10, +0.5），直接累加即可
      newValue += amount;

      // 最小值限制与数值修正
      if (stat === 'fireRate') newValue = Math.max(1, newValue);
      if (stat === 'damage') newValue = Math.max(1, newValue);
      if (stat === 'hp') newValue = Math.min(prev.maxHp, Math.max(0, newValue));
      
      return { ...prev, [stat]: newValue };
    });
  }, []);

  const handleScoreUpdate = useCallback((s: number) => {
    setStats(prev => ({ ...prev, score: s }));
  }, []);

  const handleGameOver = useCallback((finalScore: number) => {
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('bullet_evolve_hs', finalScore.toString());
    }
    setGameState(GameState.FINISHED);
  }, [highScore]);

  const handleXpGain = useCallback((amount: number) => {
    setStats(prev => {
      const newXp = prev.xp + amount;
      if (newXp >= prev.nextLevelXp) {
        setTimeout(() => triggerUpgradeChoice(), 10);
        return { ...prev, xp: prev.nextLevelXp };
      }
      return { ...prev, xp: newXp };
    });
  }, [triggerUpgradeChoice]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 font-['Rajdhani'] text-white overflow-hidden select-none">
      <div className="relative w-full max-w-[400px] h-full bg-[#020617] shadow-[0_0_50px_rgba(0,0,0,0.8)] border-x border-slate-800/50">
        
        <div className="absolute inset-0 pointer-events-none z-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

        <GameCanvas 
          gameState={gameState}
          difficulty={difficulty}
          stats={stats}
          isPaused={showUpgrades}
          onXpGain={handleXpGain}
          onStatChange={handleStatChange}
          onGameOver={handleGameOver}
          onUpgradeTrigger={triggerUpgradeChoice}
          onScoreUpdate={handleScoreUpdate}
        />

        {gameState === GameState.PLAYING && (
          <div className="absolute top-0 left-0 w-full p-4 flex flex-col pointer-events-none z-20">
            <div className="bg-black/40 backdrop-blur-lg rounded-lg border border-cyan-500/30 shadow-[0_0_20px_rgba(0,255,242,0.1)] overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-cyan-500/10 border-b border-cyan-500/20">
                <div className="flex flex-col">
                  <span className="text-[10px] text-cyan-400 font-bold tracking-[2px] uppercase font-['Orbitron']">武器系统</span>
                  <span className="text-sm font-black text-white italic tracking-tighter">LV.{stats.level} {getWeaponName(stats.level)}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-['Orbitron']">作战时长</span>
                  <span className="text-xs font-mono font-bold text-cyan-300">{formatTime(gameTime)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-red-500/20 border border-red-500/40">❤️</div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-red-400 font-bold uppercase">机体稳定性</span>
                    <span className={`text-lg font-black tabular-nums leading-none ${stats.hp <= 1 ? 'text-red-500 animate-pulse' : 'text-red-400'}`}>
                      {stats.hp} <span className="text-slate-600 text-xs">/ {stats.maxHp}</span>
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  {[
                    { label: '威力', val: formatNum(stats.damage), color: 'text-cyan-400' },
                    { label: '射速', val: stats.fireRate.toFixed(1), color: 'text-green-400' },
                    { label: '弹道', val: stats.projectileCount.toFixed(1), color: 'text-purple-400' }
                  ].map(s => (
                    <div key={s.label} className="flex flex-col items-end">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">{s.label}</span>
                      <span className={`text-sm font-black ${s.color}`}>{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative h-1 w-full bg-slate-900">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-300 shadow-[0_0_15px_rgba(0,255,242,0.8)]"
                  style={{ width: `${(stats.xp / stats.nextLevelXp) * 100}%` }}
                />
              </div>
            </div>
            
            <div className="mt-2 text-center">
              <span className="text-4xl font-black text-white tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                {stats.score.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {showUpgrades && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xl flex flex-col items-center justify-center p-6 z-[100] animate-in fade-in duration-500">
            <div className="text-cyan-400 font-['Orbitron'] font-black text-xs tracking-[0.5em] uppercase mb-1 animate-pulse">进化协议加载中</div>
            <h2 className="text-4xl font-['Orbitron'] font-black text-white mb-6 tracking-tighter text-center uppercase italic glitch-text">系统突破</h2>
            
            <div className="w-full bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 mb-6 grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="text-xl">🔥</div>
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">实时威力</div>
                  <div className="text-lg font-black text-cyan-400 font-mono">{formatNum(stats.damage)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xl">🌪️</div>
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">实时射速</div>
                  <div className="text-lg font-black text-green-400 font-mono">{stats.fireRate.toFixed(1)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xl">❤️</div>
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">当前耐久</div>
                  <div className="text-lg font-black text-red-500 font-mono">{stats.hp}/{stats.maxHp}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xl">✨</div>
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">弹道链路</div>
                  <div className="text-lg font-black text-purple-400 font-mono">{stats.projectileCount.toFixed(1)}</div>
                </div>
              </div>
            </div>

            <div className="w-full space-y-3 px-2">
              {currentUpgradeChoices.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUpgrade(u)}
                  className="w-full bg-slate-900/40 hover:bg-cyan-500/20 group border border-slate-700/50 hover:border-cyan-400 p-4 rounded-xl flex items-center gap-5 transition-all active:scale-95 relative overflow-hidden shadow-2xl"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 group-hover:bg-cyan-400 transition-colors"></div>
                  <div className="text-3xl group-hover:scale-125 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{u.icon}</div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-sm md:text-base font-bold text-slate-300 group-hover:text-white transition-colors tracking-tight leading-tight">
                      {u.description(stats)}
                    </div>
                  </div>
                  <div className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-['Orbitron']">部署</span>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="mt-8 text-[10px] text-slate-500 font-bold uppercase tracking-widest animate-pulse">
              等待指令确认...
            </div>
          </div>
        )}

        {gameState === GameState.START && (
          <div className="absolute inset-0 bg-[#020617] flex flex-col items-center justify-center p-8 text-center z-[150]">
            <div className="relative mb-12">
               <div className="text-cyan-500 font-['Orbitron'] font-black text-5xl italic glitch-text tracking-tighter">BULLET</div>
               <div className="text-white font-['Orbitron'] font-black text-7xl uppercase tracking-tighter leading-[0.8]">EVOLVE</div>
               <div className="absolute -bottom-6 right-0 text-cyan-400 text-[10px] font-bold tracking-[0.5em] uppercase">子弹进化：赛博协议</div>
            </div>
            
            <div className="w-full space-y-6 mb-12">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">选择作战烈度</div>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { id: Difficulty.EASY, name: '低压测试', desc: '快速部署 / 实验性火力', color: 'border-green-500/50 text-green-400 hover:bg-green-500/10' },
                  { id: Difficulty.NORMAL, name: '标准协议', desc: '标准环境 / 平衡难度', color: 'border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10' },
                  { id: Difficulty.HARD, name: '极限超载', desc: '高危作战 / 性能压榨', color: 'border-red-500/50 text-red-400 hover:bg-red-500/10' }
                ].map(d => (
                  <button 
                    key={d.id}
                    onClick={() => handleStart(d.id)}
                    className={`p-4 border bg-slate-900/50 rounded-xl transition-all active:scale-95 text-left flex justify-between items-center group ${d.color}`}
                  >
                    <div>
                      <div className="font-bold text-lg uppercase tracking-wider">{d.name}</div>
                      <div className="text-[10px] opacity-60 uppercase">{d.desc}</div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">▶</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="text-slate-500 text-xs font-bold tracking-[0.2em] uppercase font-['Orbitron']">
              历史最高记录: <span className="text-cyan-400 font-mono">{highScore.toLocaleString()}</span>
            </div>
          </div>
        )}

        {gameState === GameState.FINISHED && (
          <div className="absolute inset-0 bg-[#020617]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center z-[200]">
            <div className="text-red-500 font-['Orbitron'] font-black text-6xl italic glitch-text mb-4 uppercase">连接中断</div>
            <div className="w-full bg-slate-900/50 border border-red-500/20 p-8 rounded-3xl mb-12 shadow-[0_0_30px_rgba(255,0,81,0.1)]">
              <div className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] mb-4">战斗分析数据</div>
              <div className="text-5xl font-black text-white mb-2 tabular-nums tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                {stats.score.toLocaleString()}
              </div>
              <div className="text-xs font-bold text-slate-400 mb-8 uppercase tracking-widest">持续时长: {formatTime(gameTime)}</div>
              
              <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-8">
                <div className="text-center">
                  <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">最终评级</div>
                  <div className="text-cyan-400 font-black text-2xl uppercase italic">{getWeaponName(stats.level)}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">最高记录</div>
                  <div className="text-yellow-500 font-black text-2xl tabular-nums">{highScore.toLocaleString()}</div>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setGameState(GameState.START)}
              className="w-full py-5 bg-cyan-500 text-black font-black text-xl tracking-[0.4em] uppercase rounded-xl hover:bg-cyan-400 transition-all active:scale-95 shadow-[0_0_30px_rgba(0,255,242,0.4)]"
            >
              重启系统
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
