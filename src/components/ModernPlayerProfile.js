import React from 'react';
import { Camera, Sliders, Flame, Target, Trophy, Award, Sparkles } from 'lucide-react';
import { calculateOverall, mapRating } from '../utils/helpers';

const ModernPlayerProfile = ({ 
    player, 
    rank, 
    onUploadClick, 
    onEditRatings, 
    canEdit, 
    seasonStats, 
    streaks, 
    forceDynamic = false 
}) => {
    const statsToUse = seasonStats || player;

    // Use pre-computed overall if available, otherwise recalculate
    const overall = seasonStats?.overall || calculateOverall(player, seasonStats, streaks, forceDynamic);
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

    // Get initials for circular avatar placeholder
    const getInitials = (name) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    // Calculate Win rate
    const winRate = statsToUse.gamesPlayed > 0 
        ? ((statsToUse.wins / statsToUse.gamesPlayed) * 100).toFixed(0) 
        : '0';

    // Calculate Goals Per Game
    const goalsPerGame = statsToUse.gamesPlayed > 0 
        ? (statsToUse.goals / statsToUse.gamesPlayed).toFixed(2) 
        : '0.00';

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden max-w-lg w-full">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-slate-800/80 relative z-10">
                {/* Round Avatar Container */}
                <div className="relative group w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-3 border-slate-700 bg-slate-800 shadow-lg flex items-center justify-center shrink-0">
                    {player.photoUrl ? (
                        <img 
                            src={player.photoUrl} 
                            alt={player.name} 
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center text-white text-3xl font-black font-mono tracking-wider">
                            {getInitials(player.name)}
                        </div>
                    )}
                    
                    {onUploadClick && canEdit && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onUploadClick(); }} 
                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Camera className="text-white drop-shadow-md" size={24} />
                        </button>
                    )}
                </div>

                {/* Name, Position & Overall Rating */}
                <div className="flex-1 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight mb-1">
                                {player.name}
                            </h2>
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider flex justify-center sm:justify-start items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-blue-400">Player</span>
                                <span>•</span>
                                <span className="text-slate-500">Rank #{rank}</span>
                            </div>
                        </div>

                        {/* OVR Badge */}
                        <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center bg-slate-950/80 border-2 border-cyan-500/40 rounded-2xl shadow-[0_0_15px_rgba(6,182,212,0.15)] select-none shrink-0">
                                <span className="text-2xl sm:text-3xl font-black text-cyan-400 tracking-tighter leading-none">{overall}</span>
                                <span className="text-[10px] sm:text-xs font-black text-slate-400 tracking-wider uppercase leading-none mt-1">OVR</span>
                            </div>
                            
                            {canEdit && onEditRatings && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onEditRatings(); }} 
                                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white p-2 rounded-xl transition-all shadow-md"
                                    title="Edit Attributes"
                                >
                                    <Sliders size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Form & Streak Badges */}
                    <div className="mt-4 flex flex-wrap justify-center sm:justify-start items-center gap-3">
                        {streaks && streaks.last5 && streaks.last5.length > 0 && (
                            <div className="flex items-center gap-1 bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-slate-800/80">
                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider mr-1.5">Form</span>
                                {streaks.last5.map((r, i) => (
                                    <div 
                                        key={i} 
                                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border border-slate-950 shadow-sm ${
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
                            <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 text-orange-400 text-xs font-black px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-md">
                                <Flame size={12} fill="currentColor" /> {streaks.winStreak} Win Streak
                            </div>
                        )}

                        {streaks && streaks.goalStreak >= 3 && (
                            <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-black px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-md">
                                <Target size={12} /> {streaks.goalStreak} Goal Streak
                            </div>
                        )}

                        {streaks && streaks.cleanSheetStreak >= 3 && (
                            <div className="bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-black px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-md">
                                <Sparkles size={12} /> {streaks.cleanSheetStreak} CS Streak
                            </div>
                        )}
                        
                        {statsToUse.motms > 0 && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-xs font-black px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-md">
                                <Trophy size={12} /> {statsToUse.motms} MOTM
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Profile Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6 relative z-10">
                
                {/* Left Panel: Attributes Slider Stats */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                    <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2 pb-2 border-b border-slate-800/60">
                        <Award size={16} className="text-cyan-500" /> Attributes
                    </h3>
                    <div className="space-y-3.5">
                        {/* Fitness */}
                        <div>
                            <div className="flex justify-between text-xs font-black mb-1">
                                <span className={`text-slate-400 ${fitnessBump > 0 ? 'text-green-400' : ''}`}>FITNESS / SPEED</span>
                                <span className={fitnessBump > 0 ? 'text-green-400' : 'text-slate-200'}>
                                    {fitness} {fitnessBump > 0 && <span className="text-[10px] font-extrabold">(+{fitnessBump})</span>}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${fitness}%` }}></div>
                            </div>
                        </div>

                        {/* Control / Passing */}
                        <div>
                            <div className="flex justify-between text-xs font-black mb-1">
                                <span className={`text-slate-400 ${passingBump > 0 ? 'text-green-400' : ''}`}>BALL CONTROL / PASS</span>
                                <span className={passingBump > 0 ? 'text-green-400' : 'text-slate-200'}>
                                    {passing} {passingBump > 0 && <span className="text-[10px] font-extrabold">(+{passingBump})</span>}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${passing}%` }}></div>
                            </div>
                        </div>

                        {/* Shooting */}
                        <div>
                            <div className="flex justify-between text-xs font-black mb-1">
                                <span className={`text-slate-400 ${shootingBump > 0 ? 'text-green-400' : ''}`}>SHOOTING & FINISHING</span>
                                <span className={shootingBump > 0 ? 'text-green-400' : 'text-slate-200'}>
                                    {shooting} {shootingBump > 0 && <span className="text-[10px] font-extrabold">(+{shootingBump})</span>}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${shooting}%` }}></div>
                            </div>
                        </div>

                        {/* Defense */}
                        <div>
                            <div className="flex justify-between text-xs font-black mb-1">
                                <span className={`text-slate-400 ${defenseBump > 0 ? 'text-green-400' : ''}`}>DEFENSIVE AWARENESS</span>
                                <span className={defenseBump > 0 ? 'text-green-400' : 'text-slate-200'}>
                                    {defense} {defenseBump > 0 && <span className="text-[10px] font-extrabold">(+{defenseBump})</span>}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${defense}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Season Stats Grid */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4">
                    <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2 pb-2 border-b border-slate-800/60">
                        <Award size={16} className="text-purple-500" /> Season Stats
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3.5 text-center">
                        {/* GP */}
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Played</span>
                            <span className="text-lg font-black text-white">{statsToUse.gamesPlayed}</span>
                        </div>

                        {/* Wins */}
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Wins</span>
                            <span className="text-lg font-black text-green-400">{statsToUse.wins}</span>
                        </div>

                        {/* Win % */}
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Win Rate</span>
                            <span className="text-lg font-black text-white">{winRate}%</span>
                        </div>

                        {/* Goals */}
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Goals</span>
                            <span className="text-lg font-black text-white">{statsToUse.goals}</span>
                        </div>

                        {/* Assists */}
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Assists</span>
                            <span className="text-lg font-black text-white">{statsToUse.assists || 0}</span>
                        </div>

                        {/* G+A */}
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">G+A</span>
                            <span className="text-lg font-black text-yellow-500">{(statsToUse.goals || 0) + (statsToUse.assists || 0)}</span>
                        </div>

                        {/* GPG */}
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Goals/Game</span>
                            <span className="text-sm font-black text-white pt-0.5 block">{goalsPerGame}</span>
                        </div>

                        {/* Clean Sheets */}
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Clean Sheets</span>
                            <span className="text-lg font-black text-teal-400">{statsToUse.cleanSheets || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Extra Stats Row (GF / GA) */}
            <div className="grid grid-cols-2 gap-4 mt-4 relative z-10">
                <div className="bg-slate-950/20 border border-slate-800/60 px-4 py-2.5 rounded-xl flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-500 uppercase tracking-wider">Goals For (Team Scored)</span>
                    <span className="font-mono font-black text-green-400">{statsToUse.goalsFor || 0}</span>
                </div>
                <div className="bg-slate-950/20 border border-slate-800/60 px-4 py-2.5 rounded-xl flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-500 uppercase tracking-wider">Goals Against (Team Conceded)</span>
                    <span className="font-mono font-black text-red-400">{statsToUse.goalsAgainst || 0}</span>
                </div>
            </div>
        </div>
    );
};

export default ModernPlayerProfile;
