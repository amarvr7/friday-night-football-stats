import React, { useState } from 'react';
import { FileUp, BarChart2, X } from 'lucide-react';
import { writeBatch, collection, getDocs, doc, serverTimestamp } from 'firebase/firestore';
import { db, PROJECT_ID, COLLECTIONS } from '../services/firebase';

const LegacyImporter = ({ onComplete, onCancel }) => {
    const [step, setStep] = useState('select');
    const [importType, setImportType] = useState('alltime'); // 'alltime' or '2026'
    const [parsedData, setParsedData] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');

    // Download CSV template
    const downloadTemplate = (type) => {
        let csvContent = '';
        let filename = '';

        if (type === 'alltime') {
            csvContent = 'Name,GamesPlayed,Goals,Wins\n';
            csvContent += 'Amar,102,53,57\n';
            csvContent += 'JT,68,46,32\n';
            csvContent += 'Johann,67,43,30.5\n';
            filename = 'alltime_stats_template.csv';
        } else {
            csvContent = 'Name,Games,Wins,Goals,Assists,GoalsFor,GoalsAgainst,MOTM\n';
            csvContent += 'Amar,1,1,2,1,5,2,1\n';
            csvContent += 'JT,1,0,1,0,2,5,0\n';
            csvContent += 'Johann,1,1,1,2,5,2,0\n';
            filename = '2026_stats_template.csv';
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target.result;
                const results = importType === 'alltime' ? parseAllTimeCSV(text) : parse2026CSV(text);
                if (results.length === 0) {
                    throw new Error("No valid data found in CSV");
                }
                setParsedData(results);
                setStep('preview');
            } catch (err) {
                console.error(err);
                setErrorMsg(err.message || "Could not parse file. Please check the format and try again.");
                setStep('error');
            }
        };
        reader.readAsText(file);
    };

    const parseAllTimeCSV = (csvText) => {
        const lines = csvText.trim().split(/\r?\n/);
        if (lines.length < 2) throw new Error("File is too short. Need at least a header row and one data row.");

        const header = lines[0].toLowerCase();
        if (!header.includes('name') || !header.includes('games') || !header.includes('goals') || !header.includes('wins')) {
            throw new Error("Invalid format. Expected columns: Name, GamesPlayed, Goals, Wins");
        }

        const results = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',');
            if (parts.length < 4) continue;

            const name = parts[0]?.trim();
            const games = parseInt(parts[1]);
            const goals = parseFloat(parts[2]);
            const wins = parseFloat(parts[3]);

            if (name && !isNaN(games) && !isNaN(goals) && !isNaN(wins)) {
                results.push({ name, games, goals, wins });
            }
        }

        return results.sort((a, b) => b.games - a.games);
    };

    const parse2026CSV = (csvText) => {
        const lines = csvText.trim().split(/\r?\n/);
        if (lines.length < 2) throw new Error("File is too short. Need at least a header row and one data row.");

        const header = lines[0].toLowerCase();
        if (!header.includes('name')) {
            throw new Error("Invalid format. Expected columns: Name, Games, Wins, Goals, Assists, GoalsFor, GoalsAgainst, MOTM");
        }

        const matches = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',');
            if (parts.length < 7) continue;

            const name = parts[0]?.trim();
            const games = parseInt(parts[1]) || 0;
            const wins = parseFloat(parts[2]) || 0;
            const goals = parseInt(parts[3]) || 0;
            const assists = parseInt(parts[4]) || 0;
            const goalsFor = parseInt(parts[5]) || 0;
            const goalsAgainst = parseInt(parts[6]) || 0;
            const motm = parts.length > 7 ? parseInt(parts[7]) || 0 : 0;

            if (name) {
                matches.push({
                    name,
                    games,
                    wins,
                    goals,
                    assists,
                    goalsFor,
                    goalsAgainst,
                    motm
                });
            }
        }

        // Aggregate by player
        const playerStats = {};
        matches.forEach(m => {
            if (!playerStats[m.name]) {
                playerStats[m.name] = {
                    name: m.name,
                    games: 0,
                    goals: 0,
                    wins: 0,
                    assists: 0,
                    cleanSheets: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    motms: 0
                };
            }
            const p = playerStats[m.name];
            p.games += (m.games || 0);
            p.wins += (m.wins || 0);
            p.goals += (m.goals || 0);
            p.assists += (m.assists || 0);
            p.goalsFor += (m.goalsFor || 0);
            p.goalsAgainst += (m.goalsAgainst || 0);
            p.motms += (m.motm || 0);
            p.cleanSheets += (m.games > 0 && m.goalsAgainst === 0) ? m.games : 0;
        });

        return Object.values(playerStats).sort((a, b) => b.games - a.games);
    };

    const confirmImport = async () => {
        setStep('processing');
        try {
            const batch = writeBatch(db);
            const playersRef = collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS);
            const snapshot = await getDocs(playersRef);
            const existingPlayers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            parsedData.forEach(p => {
                const existing = existingPlayers.find(ep => ep.name.toLowerCase() === p.name.toLowerCase());

                const safeGames = p.games || 0;
                const safeGoals = p.goals || 0;
                const safeWins = p.wins || 0;
                const safeAssists = p.assists || 0;
                const safeCleanSheets = p.cleanSheets || 0;
                const safeGoalsFor = p.goalsFor || 0;
                const safeGoalsAgainst = p.goalsAgainst || 0;
                const safeMotms = p.motms || 0;

                const docRef = existing
                    ? doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, existing.id)
                    : doc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS));

                const mergedPayload = {
                    name: existing ? existing.name : p.name
                };

                if (!existing) {
                    mergedPayload.createdAt = serverTimestamp();
                }

                if (importType === 'alltime') {
                    mergedPayload.goals = (existing?.goals || 0) + safeGoals;
                    mergedPayload.wins = (existing?.wins || 0) + safeWins;
                    mergedPayload.gamesPlayed = (existing?.gamesPlayed || 0) + safeGames;
                } else if (importType === '2026') {
                    mergedPayload.season2026 = {
                        goals: (existing?.season2026?.goals || 0) + safeGoals,
                        wins: (existing?.season2026?.wins || 0) + safeWins,
                        games: (existing?.season2026?.games || 0) + safeGames,
                        assists: (existing?.season2026?.assists || 0) + safeAssists,
                        cleanSheets: (existing?.season2026?.cleanSheets || 0) + safeCleanSheets,
                        goalsFor: (existing?.season2026?.goalsFor || 0) + safeGoalsFor,
                        goalsAgainst: (existing?.season2026?.goalsAgainst || 0) + safeGoalsAgainst,
                        motms: (existing?.season2026?.motms || 0) + safeMotms
                    };
                }

                batch.set(docRef, mergedPayload, { merge: true });
            });
            await batch.commit();
            setStep('complete');
        } catch (err) {
            console.error(err);
            setErrorMsg("Database save failed: " + err.message);
            setStep('error');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl max-w-3xl w-full p-6 border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <FileUp className="text-blue-400" /> CSV Import Tool
                    </h3>
                    <button
                        onClick={onCancel}
                        className="text-slate-400 hover:text-white transition-colors p-1"
                    >
                        <X size={24} />
                    </button>
                </div>

                {step === 'select' && (
                    <div className="flex-1 flex flex-col">
                        <p className="text-slate-400 text-sm mb-6">Choose which type of data you want to import:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <button
                                onClick={() => { setImportType('alltime'); setStep('upload'); }}
                                className="bg-slate-700 hover:bg-slate-600 border-2 border-slate-600 hover:border-blue-500 rounded-xl p-6 text-left transition-all group"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <BarChart2 className="text-yellow-400" size={32} />
                                    <h4 className="text-lg font-bold text-white">All-Time Stats</h4>
                                </div>
                                <p className="text-slate-400 text-sm mb-4">Import cumulative career statistics for players</p>
                                <div className="flex items-center text-blue-400 text-sm font-bold group-hover:underline">
                                    Use All-Time Template →
                                </div>
                            </button>

                            <button
                                onClick={() => { setImportType('2026'); setStep('upload'); }}
                                className="bg-slate-700 hover:bg-slate-600 border-2 border-slate-600 hover:border-blue-500 rounded-xl p-6 text-left transition-all group"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <FileUp className="text-green-400" size={32} />
                                    <h4 className="text-lg font-bold text-white">2026 Match Stats</h4>
                                </div>
                                <p className="text-slate-400 text-sm mb-4">Import match-by-match stats for the 2026 season</p>
                                <div className="flex items-center text-blue-400 text-sm font-bold group-hover:underline">
                                    Use 2026 Template →
                                </div>
                            </button>
                        </div>

                        <div className="mt-auto">
                            <button
                                onClick={onCancel}
                                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {step === 'upload' && (
                    <div className="flex-1 flex flex-col">
                        <p className="text-slate-400 mb-6">
                            Upload a .csv file with the stats.
                            <button onClick={() => downloadTemplate(importType)} className="ml-2 text-blue-400 hover:text-blue-300 underline">Download Template</button>
                        </p>
                        <div className="flex-1 border-2 border-dashed border-slate-600 rounded-xl flex items-center justify-center p-12 bg-slate-900/50 hover:bg-slate-900 transition-colors relative mb-6">
                            <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <div className="text-center">
                                <FileUp size={48} className="mx-auto text-slate-500 mb-4" />
                                <p className="font-bold text-white">Click or Drag to Upload CSV</p>
                            </div>
                        </div>
                        <button onClick={() => setStep('select')} className="text-slate-500 hover:text-white transition-colors">Back</button>
                    </div>
                )}

                {step === 'error' && (
                    <div className="text-center py-12">
                        <p className="text-red-500 font-bold mb-6">{errorMsg}</p>
                        <button onClick={() => setStep('upload')} className="bg-slate-700 text-white px-6 py-2 rounded-lg font-bold">Try Again</button>
                    </div>
                )}

                {step === 'preview' && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <h4 className="text-green-400 font-bold mb-4">Found {parsedData.length} records</h4>
                        <div className="flex-1 overflow-auto bg-slate-900 rounded-xl p-4 mb-6 border border-slate-700">
                            <table className="w-full text-sm text-left text-slate-300">
                                <thead className="text-xs uppercase bg-slate-800 text-slate-500 sticky top-0">
                                    <tr>
                                        <th className="p-2">Name</th>
                                        <th className="p-2">Games</th>
                                        <th className="p-2">Goals</th>
                                        <th className="p-2">Wins</th>
                                        {parsedData[0].cleanSheets !== undefined && <th className="p-2">CS</th>}
                                        {parsedData[0].motms !== undefined && <th className="p-2">MOTM</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedData.map((row, i) => (
                                        <tr key={i} className="border-b border-slate-800 last:border-0">
                                            <td className="p-2 font-bold text-white">{row.name}</td>
                                            <td className="p-2">{row.games}</td>
                                            <td className="p-2">{row.goals}</td>
                                            <td className="p-2">{row.wins}</td>
                                            {row.cleanSheets !== undefined && <td className="p-2">{row.cleanSheets}</td>}
                                            {row.motms !== undefined && <td className="p-2">{row.motms}</td>}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={confirmImport} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors">Confirm & Import</button>
                            <button onClick={() => setStep('select')} className="px-6 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors">Cancel</button>
                        </div>
                    </div>
                )}

                {step === 'processing' && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                        <p className="text-white font-bold animate-pulse">Importing data...</p>
                    </div>
                )}

                {step === 'complete' && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4 text-slate-900">
                            <BarChart2 size={32} />
                        </div>
                        <h4 className="text-2xl font-bold text-white mb-2">Import Successful!</h4>
                        <p className="text-slate-400 mb-8">The stats have been updated in the database.</p>
                        <button onClick={onComplete} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25">Done</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LegacyImporter;
