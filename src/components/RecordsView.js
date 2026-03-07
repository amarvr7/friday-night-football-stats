import React, { useState } from 'react';
import { Award, Upload, Download, Flame, Clock, TrendingUp, Shield, Activity, Trophy } from 'lucide-react';

const RecordsView = ({ players, matches, playerStreaks, userRole, handleUploadRecords }) => {
    // Determine current active streaks across all players
    const activeWinStreaks = [...players].sort((a, b) => (playerStreaks[b.id]?.winStreak || 0) - (playerStreaks[a.id]?.winStreak || 0)).slice(0, 3);
    const activeGoalStreaks = [...players].sort((a, b) => (playerStreaks[b.id]?.goalStreak || 0) - (playerStreaks[a.id]?.goalStreak || 0)).slice(0, 3);
    const activeCleanSheetStreaks = [...players].sort((a, b) => (playerStreaks[b.id]?.cleanSheetStreak || 0) - (playerStreaks[a.id]?.cleanSheetStreak || 0)).slice(0, 3);
    const mostInactive = [...players].sort((a, b) => (playerStreaks[b.id]?.weeksSinceLastPlayed || 0) - (playerStreaks[a.id]?.weeksSinceLastPlayed || 0)).filter(p => playerStreaks[p.id]?.weeksSinceLastPlayed < 99).slice(0, 3);

    // Calculate all-time records
    let maxGoalsInMatch = { count: 0, player: null, date: null };
    let maxAssistsInMatch = { count: 0, player: null, date: null };

    matches.forEach(m => {
        if (m.stats) {
            Object.keys(m.stats).forEach(pid => {
                const s = m.stats[pid];
                const p = players.find(p => p.id === pid);
                if (p) {
                    if (s.goals > maxGoalsInMatch.count) maxGoalsInMatch = { count: s.goals, player: p, date: m.date };
                    if (s.assists > maxAssistsInMatch.count) maxAssistsInMatch = { count: s.assists, player: p, date: m.date };
                }
            });
        }
    });

    // We can also have manual "Historical Records" stored in Firebase, but for now we'll calculate what we can and provide a placeholder structure.
    const allTimeRecords = [
        { title: "Most Goals in a Match", player: maxGoalsInMatch.player?.name || "N/A", value: maxGoalsInMatch.count, icon: <Flame className="text-orange-500" /> },
        { title: "Most Assists in a Match", player: maxAssistsInMatch.player?.name || "N/A", value: maxAssistsInMatch.count, icon: <TrendingUp className="text-emerald-500" /> },
        { title: "Most MOTMs (All Time)", player: [...players].sort((a, b) => (b.motms || 0) - (a.motms || 0))[0]?.name || "N/A", value: [...players].sort((a, b) => (b.motms || 0) - (a.motms || 0))[0]?.motms || 0, icon: <Award className="text-yellow-500" /> },
    ];

    const generateCSVTemplate = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + "Record Title,Player Name,Value,Date (YYYY-MM-DD),Notes\n"
            + "Highest All-Time Win Streak,Amar,15,2025-01-01,Set during the winter league\n"
            + "Most Goals in a Match,JT,6,2024-05-15,\n";

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "friday_fut_records_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const StreakCard = ({ title, players, streakKey, icon, suffix = "games", valueClass = "text-white" }) => (
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h3 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2 uppercase tracking-wide">
                {icon} {title}
            </h3>
            <div className="space-y-3">
                {players.map((p, i) => {
                    const val = playerStreaks[p.id]?.[streakKey] || 0;
                    if (val === 0 && streakKey !== 'weeksSinceLastPlayed') return null; // Don't show zero streaks
                    return (
                        <div key={p.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/50 p-2 rounded gap-2 sm:gap-0">
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-slate-500 text-xs w-4">{i + 1}.</span>
                                <span className="font-bold text-white truncate max-w-[150px]">{p.name}</span>
                            </div>
                            <div className={`font-mono font-bold ${valueClass}`}>
                                {val} <span className="text-xs text-slate-500 font-sans font-normal ml-1">{suffix}</span>
                            </div>
                        </div>
                    )
                })}
                {players.filter(p => playerStreaks[p.id]?.[streakKey] > 0 || streakKey === 'weeksSinceLastPlayed').length === 0 && (
                    <div className="text-slate-500 italic text-sm text-center py-2">No active streaks</div>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <Award className="text-yellow-500" size={32} />
                <h2 className="text-2xl font-black text-white uppercase italic tracking-wider">Streaks & Records</h2>
            </div>

            {/* Active Streaks Section */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Activity size={20} className="text-green-500" /> Current Form
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StreakCard title="Win Streak" players={activeWinStreaks} streakKey="winStreak" icon={<TrendingUp size={16} />} valueClass="text-green-400" />
                    <StreakCard title="Goal Streak" players={activeGoalStreaks} streakKey="goalStreak" icon={<Flame size={16} />} valueClass="text-orange-400" />
                    <StreakCard title="Clean Sheet Streak" players={activeCleanSheetStreaks} streakKey="cleanSheetStreak" icon={<Shield size={16} />} valueClass="text-emerald-400" />
                    <StreakCard title="Most Inactive" players={mostInactive} streakKey="weeksSinceLastPlayed" icon={<Clock size={16} />} suffix="weeks" valueClass="text-red-400" />
                </div>
            </div>

            {/* All-Time Records Section */}
            <div className="mt-8">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Trophy size={20} className="text-yellow-500" /> All-Time Hall of Fame
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {allTimeRecords.map((rec, i) => (
                        <div key={i} className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex flex-col items-center text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-20">
                                {rec.icon}
                            </div>
                            <div className="mb-2 p-3 bg-slate-900 rounded-full inline-block">
                                {React.cloneElement(rec.icon, { size: 24 })}
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-4">{rec.title}</span>
                            <div className="text-3xl font-black text-white italic mb-1">{rec.player}</div>
                            <div className="text-xl font-mono text-yellow-500 font-bold">{rec.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Admin Upload Section */}
            {userRole === 'admin' && (
                <div className="mt-8 bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 border-dashed">
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                        <Upload size={18} className="text-purple-400" /> Import Historical Records
                    </h3>
                    <p className="text-slate-400 text-sm mb-4">
                        Admins can upload a CSV to populate historical, unrecorded hall of fame records.
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={generateCSVTemplate}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
                        >
                            <Download size={16} /> Download CSV Template
                        </button>
                        <label className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-purple-900/20">
                            <Upload size={16} /> Upload Records CSV
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files[0]) {
                                        // TODO: Implement parsing in app.js or here
                                        alert("CSV parsing for records to be implemented! File selected: " + e.target.files[0].name);
                                    }
                                }}
                            />
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecordsView;
