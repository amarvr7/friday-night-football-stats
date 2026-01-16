import React from 'react';
import { Users, Camera, Sliders, Flame, Target, Trophy, Shirt } from 'lucide-react';
import { calculateOverall, mapRating } from '../utils/helpers';

const PlayerCard = ({ player, rank, onUploadClick, onEditRatings, canEdit, seasonStats, streaks }) => {
    const statsToUse = seasonStats || player;
    const overall = calculateOverall(player, seasonStats, streaks?.formScore);
    const { ratings } = player;

    const pace = ratings ? mapRating(ratings.fitness) : (80 + Math.min(statsToUse.gamesPlayed || 0, 19));
    const dri = ratings ? mapRating(ratings.control) : (Math.min(99, 70 + (statsToUse.wins || 0)));
    const sho = ratings ? mapRating(ratings.shooting) : (Math.min(99, 60 + (statsToUse.goals || 0) * 2));
    const def = ratings ? mapRating(ratings.defense) : (Math.min(99, 50 + (statsToUse.gamesPlayed || 0)));
    const pas = ratings ? mapRating(ratings.control) : 65;
    const phy = ratings ? mapRating(ratings.defense) : (Math.min(99, 75 + (statsToUse.wins || 0)));

    const getCardStyle = () => {
        // FPL-inspired Metallic Gradients
        if (rank === 1) return "bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 border-yellow-400 shadow-yellow-500/50";
        if (rank === 2) return "bg-gradient-to-br from-slate-200 via-slate-400 to-slate-600 border-slate-300 shadow-slate-500/50";
        if (rank === 3) return "bg-gradient-to-br from-orange-300 via-orange-500 to-orange-700 border-orange-400 shadow-orange-500/50";
        return "bg-gradient-to-br from-slate-800 via-slate-900 to-black border-slate-700 shadow-black";
    };

    const isTop3 = rank <= 3;
    const textColor = isTop3 ? "text-slate-900" : "text-white";
    const accentColor = isTop3 ? "border-slate-900/20" : "border-slate-500/30";

    return (
        <div className={`relative group w-full aspect-[2/3] transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl rounded-t-2xl rounded-b-xl border-[3px] overflow-hidden ${getCardStyle()}`}>

            {/* Kit Texture Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>

            {/* Content Container */}
            <div className="relative h-full flex flex-col pt-4 px-3 pb-2">

                {/* Top Section: Info & Rank */}
                <div className="flex justify-between items-start z-20">
                    <div className="flex flex-col items-center">
                        <span className={`text-4xl font-black leading-none tracking-tighter ${textColor} drop-shadow-sm`}>{overall}</span>
                        <span className={`text-xs font-bold uppercase tracking-widest ${textColor} opacity-80`}>CAM</span>
                    </div>
                    {canEdit && (
                        <button onClick={(e) => { e.stopPropagation(); onEditRatings(); }} className="bg-white/20 hover:bg-white/40 text-current p-1.5 rounded-full backdrop-blur-md transition-colors"><Sliders size={14} className={textColor} /></button>
                    )}
                </div>

                {/* Player Image & Dynamic Visuals */}
                <div className="absolute inset-x-0 top-12 bottom-24 z-10 flex items-end justify-center">
                    {/* Streak Badges */}
                    <div className="absolute top-0 right-2 flex flex-col gap-1 items-end z-30">
                        {/* MOTM Badge */}
                        {(statsToUse.motms > 0) && (
                            <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-slate-900 text-xs font-black px-3 py-1 rounded-l-full flex items-center gap-1.5 shadow-md border border-yellow-300">
                                <Trophy size={12} fill="currentColor" /> {statsToUse.motms}
                            </div>
                        )}
                        {streaks && streaks.winStreak >= 3 && (
                            <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-bold px-3 py-1 rounded-l-full flex items-center gap-1.5 shadow-md animate-pulse">
                                <Flame size={14} fill="currentColor" /> {streaks.winStreak}
                            </div>
                        )}
                        {streaks && streaks.goalStreak >= 3 && (
                            <div className="bg-gradient-to-r from-blue-400 to-cyan-500 text-white text-xs font-bold px-3 py-1 rounded-l-full flex items-center gap-1.5 shadow-md">
                                <Target size={14} /> {streaks.goalStreak}
                            </div>
                        )}
                    </div>

                    {player.photoUrl && !isTop3 ? (
                        <img src={player.photoUrl} alt={player.name} className="h-full w-auto object-cover mask-image-blob drop-shadow-2xl" />
                    ) : (
                        isTop3 ? (
                            <div className={`drop-shadow-2xl transform hover:scale-110 transition-transform duration-300 ${rank === 1 ? 'text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]' :
                                rank === 2 ? 'text-slate-300 drop-shadow-[0_0_15px_rgba(203,213,225,0.5)]' :
                                    'text-orange-400 drop-shadow-[0_0_15px_rgba(251,146,60,0.5)]'
                                }`}>
                                <Shirt size={120} strokeWidth={1} fill="currentColor" fillOpacity={0.2} />
                            </div>
                        ) : (
                            <Users size={100} className="text-slate-600 opacity-50" />
                        )
                    )}

                    {onUploadClick && (
                        <button onClick={(e) => { e.stopPropagation(); onUploadClick(); }} className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-40">
                            <Camera className="text-white drop-shadow-lg" size={32} />
                        </button>
                    )}
                </div>

                {/* Name Bar */}
                <div className="mt-auto relative z-20 mb-2">
                    {streaks && streaks.last5 && streaks.last5.length > 0 && (
                        <div className="flex justify-center items-center gap-1.5 mb-2 opacity-100">
                            {streaks.last5.map((r, i) => (
                                <div key={i} className={`w-4 h-4 rounded-full border-[1.5px] ${isTop3 ? 'border-slate-900/50' : 'border-white/50'} ${r === 'W' ? 'bg-green-500' : r === 'D' ? 'bg-slate-400' : 'bg-red-500'}`} title={r === 'W' ? 'Win' : r === 'D' ? 'Draw' : 'Loss'} />
                            ))}
                            {streaks.formScore !== undefined && (
                                <div className={`ml-1 text-xs font-black px-2 py-0.5 rounded ${isTop3 ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
                                    {streaks.formScore.toFixed(0)}
                                </div>
                            )}
                        </div>
                    )}

                    <div className={`bg-slate-900/10 backdrop-blur-sm rounded-lg py-1 px-2 border-t ${accentColor}`}>
                        <h3 className={`font-black uppercase text-center text-lg tracking-tight truncate leading-tight ${textColor}`}>{player.name}</h3>
                    </div>
                </div>

                {/* Stat Grid */}
                <div className="relative z-20">
                    <div className={`grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs font-bold leading-tight ${textColor} opacity-90`}>
                        <div className="flex justify-between border-b border-dashed border-current/20 pb-0.5"><span className="opacity-70">PAC</span><span>{pace}</span></div>
                        <div className="flex justify-between border-b border-dashed border-current/20 pb-0.5"><span className="opacity-70">DRI</span><span>{dri}</span></div>
                        <div className="flex justify-between border-b border-dashed border-current/20 pb-0.5"><span className="opacity-70">SHO</span><span>{sho}</span></div>
                        <div className="flex justify-between border-b border-dashed border-current/20 pb-0.5"><span className="opacity-70">DEF</span><span>{def}</span></div>
                        <div className="flex justify-between"><span className="opacity-70">PAS</span><span>{pas}</span></div>
                        <div className="flex justify-between"><span className="opacity-70">PHY</span><span>{phy}</span></div>
                    </div>
                </div>

                {/* Bottom Shine */}
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-10"></div>
            </div>
        </div>
    );
};

export default PlayerCard;
