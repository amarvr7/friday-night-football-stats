import React, { useMemo, useState, useEffect } from 'react';
import { Award, Upload, Download, Flame, Clock, TrendingUp, Shield, Activity, Trophy, Zap, Target, Users } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, PROJECT_ID, COLLECTIONS } from '../services/firebase';
import { getPlayerStats } from '../utils/helpers';

const RecordsView = ({ players, matches, playerStreaks, userRole, onSelectPlayer }) => {
    const [customRecords, setCustomRecords] = useState([]);

    useEffect(() => {
        const unsub = onSnapshot(
            doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.SETTINGS, 'historicalRecords'),
            (snap) => {
                if (snap.exists() && Array.isArray(snap.data().records)) {
                    setCustomRecords(snap.data().records);
                }
            },
            (err) => console.error("Error loading historical records:", err)
        );
        return () => unsub();
    }, []);

    // Calculate all-time player stats for records
    const playersWithStats = useMemo(() => {
        return players.map(p => ({
            ...p,
            ...getPlayerStats(p, matches, 'all')
        }));
    }, [players, matches]);

    // Determine current active streaks across all players
    const activeWinStreaks = [...players].sort((a, b) => (playerStreaks[b.id]?.winStreak || 0) - (playerStreaks[a.id]?.winStreak || 0)).slice(0, 3);
    const activeGoalStreaks = [...players].sort((a, b) => (playerStreaks[b.id]?.goalStreak || 0) - (playerStreaks[a.id]?.goalStreak || 0)).slice(0, 3);
    const activeAssistStreaks = [...players].sort((a, b) => (playerStreaks[b.id]?.assistStreak || 0) - (playerStreaks[a.id]?.assistStreak || 0)).slice(0, 3);
    const activeCleanSheetStreaks = [...players].sort((a, b) => (playerStreaks[b.id]?.cleanSheetStreak || 0) - (playerStreaks[a.id]?.cleanSheetStreak || 0)).slice(0, 3);
    const activePlayedStreaks = [...players].sort((a, b) => (playerStreaks[b.id]?.playedStreak || 0) - (playerStreaks[a.id]?.playedStreak || 0)).slice(0, 3);
    const mostInactive = [...players].sort((a, b) => (playerStreaks[b.id]?.weeksSinceLastPlayed || 0) - (playerStreaks[a.id]?.weeksSinceLastPlayed || 0)).filter(p => (playerStreaks[p.id]?.weeksSinceLastPlayed || 0) > 0 && playerStreaks[p.id]?.weeksSinceLastPlayed < 99).slice(0, 3);

    // Calculate single-match records
    let maxGoalsInMatch = { count: 0, player: null, date: null };
    let maxAssistsInMatch = { count: 0, player: null, date: null };

    matches.forEach(m => {
        if (m.stats) {
            Object.keys(m.stats).forEach(pid => {
                const s = m.stats[pid];
                const p = players.find(p => p.id === pid);
                if (p) {
                    if ((s.goals || 0) > maxGoalsInMatch.count) maxGoalsInMatch = { count: s.goals, player: p, date: m.date };
                    if ((s.assists || 0) > maxAssistsInMatch.count) maxAssistsInMatch = { count: s.assists, player: p, date: m.date };
                }
            });
        }
    });

    const topGoalsPlayer = [...playersWithStats].sort((a, b) => (b.goals || 0) - (a.goals || 0))[0];
    const topWinsPlayer = [...playersWithStats].sort((a, b) => (b.wins || 0) - (a.wins || 0))[0];
    const topAppsPlayer = [...playersWithStats].sort((a, b) => (b.gamesPlayed || 0) - (a.gamesPlayed || 0))[0];
    const topMotmPlayer = [...playersWithStats].sort((a, b) => (b.motms || 0) - (a.motms || 0))[0];
    const topHatTricksPlayer = [...playersWithStats].sort((a, b) => (b.hatTricks || 0) - (a.hatTricks || 0))[0];
    const topCleanSheetsPlayer = [...playersWithStats].sort((a, b) => (b.cleanSheets || 0) - (a.cleanSheets || 0))[0];

    const allTimeRecords = [
        { title: "All-Time Top Scorer", player: topGoalsPlayer?.goals > 0 ? topGoalsPlayer.name : "N/A", value: topGoalsPlayer?.goals || 0, suffix: "Goals", icon: <Target className="text-pink-500" /> },
        { title: "Most Career Wins", player: topWinsPlayer?.wins > 0 ? topWinsPlayer.name : "N/A", value: topWinsPlayer?.wins || 0, suffix: "Wins", icon: <Trophy className="text-yellow-400" /> },
        { title: "Ironman (Appearances)", player: topAppsPlayer?.gamesPlayed > 0 ? topAppsPlayer.name : "N/A", value: topAppsPlayer?.gamesPlayed || 0, suffix: "Apps", icon: <Users className="text-blue-400" /> },
        { title: "Most Goals in a Match", player: maxGoalsInMatch.player?.name || "N/A", value: maxGoalsInMatch.count, suffix: "Goals", icon: <Flame className="text-orange-500" /> },
        { title: "Most Assists in a Match", player: maxAssistsInMatch.player?.name || "N/A", value: maxAssistsInMatch.count, suffix: "Assists", icon: <TrendingUp className="text-emerald-500" /> },
        { title: "Most MOTM Awards", player: topMotmPlayer?.motms > 0 ? topMotmPlayer.name : "N/A", value: topMotmPlayer?.motms || 0, suffix: "MOTMs", icon: <Award className="text-yellow-500" /> },
        ...(topHatTricksPlayer?.hatTricks > 0 ? [{ title: "Most Hat-Tricks", player: topHatTricksPlayer.name, value: topHatTricksPlayer.hatTricks, suffix: "Hat-Tricks", icon: <Zap className="text-purple-400" /> }] : []),
        ...(topCleanSheetsPlayer?.cleanSheets > 0 ? [{ title: "Most Clean Sheets", player: topCleanSheetsPlayer.name, value: topCleanSheetsPlayer.cleanSheets, suffix: "CS", icon: <Shield className="text-teal-400" /> }] : []),
        ...customRecords.map(r => ({
            title: r.title,
            player: r.player,
            value: r.value,
            suffix: r.notes || "",
            icon: <Award className="text-cyan-400" />
        }))
    ];

    const generateCSVTemplate = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + "Record Title,Player Name,Value,Date (YYYY-MM-DD),Notes\n"
            + "Highest All-Time Win Streak,Amar,15,2025-01-01,Winter League\n"
            + "Most Goals in a Match,JT,6,2024-05-15,\n";

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "friday_fut_records_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = (file) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const lines = (event.target.result || '').trim().split(/\r?\n/);
                if (lines.length < 2) throw new Error("CSV needs a header row and at least one record.");
                const parsed = [];
                for (let i = 1; i < lines.length; i++) {
                    const parts = lines[i].split(',');
                    if (parts.length < 3) continue;
                    const title = parts[0]?.trim();
                    const player = parts[1]?.trim();
                    const value = parts[2]?.trim();
                    const date = parts[3]?.trim() || '';
                    const notes = parts[4]?.trim() || '';
                    if (title && player && value) {
                        parsed.push({ title, player, value, date, notes });
                    }
                }
                if (parsed.length === 0) throw new Error("No valid records found in CSV.");
                await setDoc(doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.SETTINGS, 'historicalRecords'), {
                    records: parsed
                });
                alert(`Imported ${parsed.length} historical record(s)!`);
            } catch (err) {
                console.error("Error importing records CSV:", err);
                alert("Failed to import records: " + err.message);
            }
        };
        reader.readAsText(file);
    };

    const StreakCard = ({ title, players, streakKey, icon, suffix = "games", valueClass = "text-white" }) => {
        const visiblePlayers = players.filter(p => (playerStreaks[p.id]?.[streakKey] || 0) > 0);
        return (
            <div className="bg-slate-800/90 p-3.5 sm:p-4 rounded-2xl border border-slate-700/80 shadow-lg">
                <h3 className="text-xs font-black text-slate-300 mb-3 flex items-center gap-2 uppercase tracking-wider border-b border-slate-700/60 pb-2">
                    {icon} {title}
                </h3>
                <div className="space-y-2">
                    {visiblePlayers.map((p, i) => {
                        const val = playerStreaks[p.id]?.[streakKey] || 0;
                        return (
                            <div
                                key={p.id}
                                onClick={() => onSelectPlayer && onSelectPlayer(p, 'all')}
                                className="flex justify-between items-center bg-slate-900/70 hover:bg-slate-900 p-2.5 rounded-xl cursor-pointer transition-colors"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="font-mono text-slate-500 text-xs font-bold w-4 flex-shrink-0">{i + 1}.</span>
                                    <span className="font-bold text-white text-xs sm:text-sm truncate">{p.name}</span>
                                </div>
                                <div className={`font-mono font-black text-xs sm:text-sm flex-shrink-0 ml-2 ${valueClass}`}>
                                    {val} <span className="text-[10px] text-slate-500 font-sans font-bold uppercase ml-0.5">{suffix}</span>
                                </div>
                            </div>
                        );
                    })}
                    {visiblePlayers.length === 0 && (
                        <div className="text-slate-500 italic text-xs text-center py-4">No active streaks yet</div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2.5">
                <Award className="text-yellow-500" size={26} />
                <h2 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-wider">Streaks & Records</h2>
            </div>

            {/* Active Streaks Section */}
            <div>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity size={16} className="text-green-500" /> Active Streaks
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                    <StreakCard title="Win Streak" players={activeWinStreaks} streakKey="winStreak" icon={<TrendingUp size={15} className="text-green-400" />} valueClass="text-green-400" />
                    <StreakCard title="Scoring Streak" players={activeGoalStreaks} streakKey="goalStreak" icon={<Flame size={15} className="text-orange-400" />} valueClass="text-orange-400" />
                    <StreakCard title="Playmaker Streak" players={activeAssistStreaks} streakKey="assistStreak" icon={<Zap size={15} className="text-yellow-400" />} valueClass="text-yellow-400" />
                    <StreakCard title="Clean Sheet Streak" players={activeCleanSheetStreaks} streakKey="cleanSheetStreak" icon={<Shield size={15} className="text-emerald-400" />} valueClass="text-emerald-400" />
                    <StreakCard title="Attendance Streak" players={activePlayedStreaks} streakKey="playedStreak" icon={<Users size={15} className="text-blue-400" />} valueClass="text-blue-400" />
                    <StreakCard title="Missing in Action" players={mostInactive} streakKey="weeksSinceLastPlayed" icon={<Clock size={15} className="text-red-400" />} suffix="wks" valueClass="text-red-400" />
                </div>
            </div>

            {/* All-Time Records Section */}
            <div className="pt-2">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Trophy size={16} className="text-yellow-500" /> All-Time Hall of Fame
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    {allTimeRecords.map((rec, i) => (
                        <div key={i} className="bg-slate-800/90 p-3.5 sm:p-5 rounded-2xl border border-slate-700/80 flex flex-col items-center text-center relative overflow-hidden shadow-lg">
                            <div className="mb-2 p-2.5 bg-slate-900 rounded-full inline-block border border-slate-800">
                                {React.cloneElement(rec.icon, { size: 20 })}
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">{rec.title}</span>
                            <div className="text-base sm:text-2xl font-black text-white italic mb-0.5 truncate w-full">{rec.player}</div>
                            <div className="text-sm sm:text-lg font-mono text-yellow-400 font-bold">
                                {rec.value} {rec.suffix && <span className="text-[10px] text-slate-500 font-sans uppercase">{rec.suffix}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Admin Upload Section */}
            {userRole === 'admin' && (
                <div className="mt-6 bg-slate-800/50 p-4 sm:p-6 rounded-2xl border border-slate-700/50 border-dashed">
                    <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2">
                        <Upload size={16} className="text-purple-400" /> Import Historical Records
                    </h3>
                    <p className="text-slate-400 text-xs sm:text-sm mb-4">
                        Admins can upload a CSV to add custom historical records to the Hall of Fame.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={generateCSVTemplate}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors"
                        >
                            <Download size={15} /> Download CSV Template
                        </button>
                        <label className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-lg">
                            <Upload size={15} /> Upload Records CSV
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files[0]) {
                                        handleFileUpload(e.target.files[0]);
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
