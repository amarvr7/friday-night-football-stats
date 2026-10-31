import React, { useState } from 'react';
import { Camera, Sliders, Flame, Target, Trophy, Award, Sparkles, Plus, Minus, Edit3 } from 'lucide-react';
import { calculateOverall, mapRating, getPlayerStats } from '../utils/helpers';

const ModernPlayerProfile = ({ 
    player, 
    rank, 
    matches = [],
    initialSeason = 'all',
    onUploadClick, 
    onEditRatings, 
    canEdit,
    onStatChange, 
    seasonStats, 
    streaks, 
    forceDynamic = false 
}) => {
    const [activeSeason, setActiveSeason] = useState(initialSeason);
    const [editingStats, setEditingStats] = useState(false);

    const statsToUse = matches.length > 0 || player.historical || player.season2026
        ? getPlayerStats(player, matches, activeSeason)
        : (seasonStats || player);

    const overall = calculateOverall(player, statsToUse, streaks, activeSeason === '2026' || forceDynamic);
    const { ratings } = player;

    // Calculate dynamic stat bumps based on streaks
    const fitnessBump = (streaks?.playedStreak >= 3) ? 5 : 0;
    const passingBump = (streaks?.assistStreak || 0) * 2;
    const shootingBump = (streaks?.goalStreak || 0) * 2;
    const defenseBump = (streaks?.cleanSheetStreak || 0) * 3;

    // 4 Core Stats
    const fitness = Math.min(99, (ratings ? mapRating(ratings.fitness) : (80 + Math.min(statsToUse.gamesPlayed || 0, 19))) + fitnessBump);
    const passing = Math.min(99, (ratings ? mapRating(ratings.control) : 65) + passingBump);
    const shooting = Math.min(99, (ratings ? mapRating(ratings.shooting) : (Math.min(99, 60 + (statsToUse.goals || 0) * 2))) + shootingBump);
    const defense = Math.min(99, (ratings ? mapRating(ratings.defense) : (Math.min(99, 50 + (statsToUse.gamesPlayed || 0)))) + defenseBump);

    const winRate = statsToUse.gamesPlayed > 0 
        ? ((statsToUse.wins / statsToUse.gamesPlayed) * 100).toFixed(0) 
        : '0';

    const goalsPerGame = statsToUse.gamesPlayed > 0 
        ? (statsToUse.goals / statsToUse.gamesPlayed).toFixed(2) 
        : '0.00';

    const winsFormatted = (statsToUse.wins || 0) % 1 === 0
        ? (statsToUse.wins || 0)
        : (statsToUse.wins || 0).toFixed(1);

    const StatBox = ({ label, value, valueClass = "text-white", statKey = null, step = 1 }) => (
        <div className="bg-slate-950/70 p-2 sm:p-2.5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[8px] sm:text-[9px] text-slate-500 font-black uppercase tracking-wider block">{label}</span>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
                {canEdit && editingStats && statKey && onStatChange && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onStatChange(statKey, -step, activeSeason); }}
                        className="w-6 h-6 rounded-md bg-slate-800 hover:bg-red-500/30 text-slate-300 hover:text-red-300 flex items-center justify-center border border-slate-700"
                    >
                        <Minus size={11} />
                    </button>
                )}
                <span className={`text-sm sm:text-base font-black font-mono ${valueClass}`}>{value}</span>
                {canEdit && editingStats && statKey && onStatChange && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onStatChange(statKey, step, activeSeason); }}
                        className="w-6 h-6 rounded-md bg-slate-800 hover:bg-green-500/30 text-slate-300 hover:text-green-300 flex items-center justify-center border border-slate-700"
                    >
                        <Plus size={11} />
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden w-full">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Profile Header — Side-by-side even on iPhone for compact vertical height */}
            <div className="flex items-center gap-3.5 sm:gap-5 pb-4 border-b border-slate-800/80 relative z-10">
                {/* Round Avatar Container */}
                <div className="relative group w-16 h-16 sm:w-22 sm:h-22 rounded-full overflow-hidden border-2 border-slate-700 bg-slate-800 shadow-lg flex items-center justify-center shrink-0">
                    <img 
                        src={player.photoUrl || '/logo.png'} 
                        alt={player.name} 
                        className="w-full h-full object-cover"
                    />
                    
                    {onUploadClick && canEdit && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onUploadClick(); }} 
                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Camera className="text-white drop-shadow-md" size={18} />
                        </button>
                    )}
                </div>

                {/* Name & Rank */}
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight mb-1 truncate">
                        {player.name}
                    </h2>
                    <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-blue-400">Squad</span>
                        {rank > 0 && (
                            <>
                                <span>•</span>
                                <span className="text-slate-400">Rank #{rank}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* OVR Badge & Edit Attributes */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 flex flex-col items-center justify-center bg-slate-950/90 border-2 border-cyan-500/40 rounded-2xl shadow-[0_0_15px_rgba(6,182,212,0.15)] select-none">
                        <span className="text-xl sm:text-2xl font-black text-cyan-400 tracking-tighter leading-none">{overall}</span>
                        <span className="text-[9px] font-black text-slate-400 tracking-wider uppercase leading-none mt-1">OVR</span>
                    </div>
                    
                    {canEdit && onEditRatings && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onEditRatings(); }} 
                            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white p-2.5 rounded-xl transition-all shadow-md"
                            title="Edit Attributes"
                        >
                            <Sliders size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Form & Streak Badges */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 relative z-10">
                <div className="flex flex-wrap items-center gap-1.5">
                    {streaks && streaks.last5 && streaks.last5.length > 0 && (
                        <div className="flex items-center gap-1 bg-slate-950/60 px-2 py-1 rounded-xl border border-slate-800/80">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider mr-1">Form</span>
                            {streaks.last5.map((r, i) => (
                                <div 
                                    key={i} 
                                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${
                                        r === 'W' ? 'bg-green-600 text-white' : 
                                        r === 'D' ? 'bg-slate-500 text-white' : 
                                        'bg-red-600 text-white'
                                    }`}
                                >
                                    {r}
                                </div>
                            ))}
                        </div>
                    )}

                    {streaks && streaks.winStreak >= 3 && (
                        <div className="bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[10px] font-black px-2 py-1 rounded-xl flex items-center gap-1">
                            <Flame size={10} fill="currentColor" /> {streaks.winStreak}W
                        </div>
                    )}

                    {streaks && streaks.goalStreak >= 3 && (
                        <div className="bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] font-black px-2 py-1 rounded-xl flex items-center gap-1">
                            <Target size={10} /> {streaks.goalStreak}G
                        </div>
                    )}

                    {streaks && streaks.cleanSheetStreak >= 3 && (
                        <div className="bg-teal-500/15 border border-teal-500/30 text-teal-400 text-[10px] font-black px-2 py-1 rounded-xl flex items-center gap-1">
                            <Sparkles size={10} /> {streaks.cleanSheetStreak}CS
                        </div>
                    )}
                    
                    {statsToUse.motms > 0 && (
                        <div className="bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[10px] font-black px-2 py-1 rounded-xl flex items-center gap-1">
                            <Trophy size={10} /> {statsToUse.motms} MOTM
                        </div>
                    )}
                </div>

                {/* Season Toggle inside Profile */}
                <div className="flex bg-slate-950 rounded-xl p-0.5 border border-slate-800 ml-auto">
                    <button
                        type="button"
                        onClick={() => setActiveSeason('all')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${activeSeason === 'all' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        All-Time
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSeason('2026')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${activeSeason === '2026' ? 'bg-green-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        2026
                    </button>
                </div>
            </div>

            {/* Profile Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4 relative z-10">
                {/* Left Panel: Attributes Slider Stats */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
                    <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 pb-1.5 border-b border-slate-800/60">
                        <Award size={13} className="text-cyan-500" /> Attributes
                    </h3>
                    <div className="space-y-2.5">
                        <div>
                            <div className="flex justify-between text-[10px] font-black mb-1">
                                <span className={`text-slate-400 truncate ${fitnessBump > 0 ? 'text-green-400' : ''}`}>FITNESS / SPEED</span>
                                <span className={`flex-shrink-0 ml-2 ${fitnessBump > 0 ? 'text-green-400' : 'text-slate-200'}`}>
                                    {fitness} {fitnessBump > 0 && <span className="text-[9px] font-extrabold">(+{fitnessBump})</span>}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${fitness}%` }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-[10px] font-black mb-1">
                                <span className={`text-slate-400 truncate ${passingBump > 0 ? 'text-green-400' : ''}`}>BALL CONTROL / PASS</span>
                                <span className={`flex-shrink-0 ml-2 ${passingBump > 0 ? 'text-green-400' : 'text-slate-200'}`}>
                                    {passing} {passingBump > 0 && <span className="text-[9px] font-extrabold">(+{passingBump})</span>}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${passing}%` }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-[10px] font-black mb-1">
                                <span className={`text-slate-400 truncate ${shootingBump > 0 ? 'text-green-400' : ''}`}>SHOOTING & FINISHING</span>
                                <span className={`flex-shrink-0 ml-2 ${shootingBump > 0 ? 'text-green-400' : 'text-slate-200'}`}>
                                    {shooting} {shootingBump > 0 && <span className="text-[9px] font-extrabold">(+{shootingBump})</span>}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${shooting}%` }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-[10px] font-black mb-1">
                                <span className={`text-slate-400 truncate ${defenseBump > 0 ? 'text-green-400' : ''}`}>DEFENSIVE AWARENESS</span>
                                <span className={`flex-shrink-0 ml-2 ${defenseBump > 0 ? 'text-green-400' : 'text-slate-200'}`}>
                                    {defense} {defenseBump > 0 && <span className="text-[9px] font-extrabold">(+{defenseBump})</span>}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${defense}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Season Stats Grid */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-slate-800/60">
                        <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Award size={13} className="text-purple-500" /> {activeSeason === '2026' ? '2026 Stats' : 'Career Stats'}
                        </h3>
                        {canEdit && onStatChange && (
                            <button
                                type="button"
                                onClick={() => setEditingStats(!editingStats)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${editingStats ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                            >
                                <Edit3 size={10} /> {editingStats ? 'Done' : 'Adjust'}
                            </button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <StatBox label="Played" value={statsToUse.gamesPlayed || 0} statKey="gamesPlayed" />
                        <StatBox label="Wins" value={winsFormatted} valueClass="text-green-400" statKey="wins" step={0.5} />
                        <StatBox label="Win Rate" value={`${winRate}%`} />
                        <StatBox label="Goals" value={statsToUse.goals || 0} statKey="goals" />
                        <StatBox label="Assists" value={statsToUse.assists || 0} statKey="assists" />
                        <StatBox label="G+A" value={(statsToUse.goals || 0) + (statsToUse.assists || 0)} valueClass="text-yellow-500" />
                        <StatBox label="Goals/Game" value={goalsPerGame} />
                        <StatBox label="Clean Sheets" value={statsToUse.cleanSheets || 0} valueClass="text-teal-400" statKey="cleanSheets" />
                    </div>
                </div>
            </div>

            {/* Extra Stats Row (GF / GA / MOTM / HT) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 relative z-10">
                <div className="bg-slate-950/40 border border-slate-800/60 px-2.5 py-2 rounded-xl flex justify-between items-center text-[11px]">
                    <span className="font-bold text-slate-500 uppercase">GF</span>
                    <span className="font-mono font-black text-green-400">{statsToUse.goalsFor || 0}</span>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/60 px-2.5 py-2 rounded-xl flex justify-between items-center text-[11px]">
                    <span className="font-bold text-slate-500 uppercase">GA</span>
                    <span className="font-mono font-black text-red-400">{statsToUse.goalsAgainst || 0}</span>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/60 px-2.5 py-2 rounded-xl flex justify-between items-center text-[11px]">
                    <span className="font-bold text-slate-500 uppercase">MOTM</span>
                    <span className="font-mono font-black text-yellow-400">{statsToUse.motms || 0}</span>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/60 px-2.5 py-2 rounded-xl flex justify-between items-center text-[11px]">
                    <span className="font-bold text-slate-500 uppercase">Hat-Tricks</span>
                    <span className="font-mono font-black text-pink-400">{statsToUse.hatTricks || 0}</span>
                </div>
            </div>
        </div>
    );
};

export default ModernPlayerProfile;
