import React, { useState, useEffect } from 'react';
import { Shirt, Shuffle, RefreshCw, Send, Activity } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, PROJECT_ID, COLLECTIONS } from '../services/firebase';
import { calculateOverall } from '../utils/helpers';

const TeamGenerator = ({ players, onLogMatch }) => {
    const [confirmedPlayers, setConfirmedPlayers] = useState([]);
    const [teamBlue, setTeamBlue] = useState([]);
    const [teamWhite, setTeamWhite] = useState([]);

    useEffect(() => {
        // Only get the top 12 from checkins
        const q = query(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.CHECKINS), orderBy("timestamp", "asc"));
        const unsub = onSnapshot(q, (snapshot) => {
            const top12Checkins = snapshot.docs.slice(0, 12).map(d => d.data());
            // Map checkin data back to full player objects for stats
            const loaded = top12Checkins.map(c => {
                const fullPlayer = players.find(p => p.id === c.playerId);
                return fullPlayer ? { ...fullPlayer, _checkinName: c.name } : null;
            }).filter(Boolean);
            setConfirmedPlayers(loaded);
        });
        return () => unsub();
    }, [players]);

    const generateTeams = () => {
        if (confirmedPlayers.length < 2) {
            alert("Not enough players to generate teams!");
            return;
        }

        // 1. Sort by Rating (Best to Worst)
        const sorted = [...confirmedPlayers].sort((a, b) => calculateOverall(b) - calculateOverall(a));

        const blue = [];
        const white = [];

        // 2. Snake Draft Algorithm
        // Round 1: Blue gets 1st, White gets 2nd & 3rd, Blue gets 4th...
        // Pattern: A, B, B, A, A, B, B, A...
        sorted.forEach((p, index) => {
            const snakeOrder = index % 4; // 0, 1, 2, 3
            if (snakeOrder === 0 || snakeOrder === 3) {
                blue.push(p);
            } else {
                white.push(p);
            }
        });

        setTeamBlue(blue);
        setTeamWhite(white);
    };

    const movePlayer = (player, fromTeam, toTeam, setFrom, setTo) => {
        setFrom(prev => prev.filter(p => p.id !== player.id));
        setTo(prev => [...prev, player]);
    };

    const handlePublish = async () => {
        if (teamBlue.length === 0 || teamWhite.length === 0) return;

        try {
            // Save just the IDs
            await setDoc(doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.SETTINGS, 'currentTeams'), {
                blue: teamBlue.map(p => p.id),
                white: teamWhite.map(p => p.id),
                timestamp: serverTimestamp()
            });
            alert("Teams Published to Dashboard!");
        } catch (err) {
            console.error(err);
            alert("Failed to publish teams.");
        }
    };

    const TeamColumn = ({ title, colorClass, teamList, setSelf, setOther }) => (
        <div className={`flex-1 rounded-xl border ${colorClass} bg-slate-900/50 p-4`}>
            <h3 className={`text-lg font-bold mb-4 uppercase text-center border-b pb-2 ${colorClass.replace('border', 'text')}`}>{title}</h3>
            <div className="space-y-2 min-h-[200px]">
                {teamList.map(p => (
                    <div key={p.id} className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-yellow-500 w-6 text-center">{calculateOverall(p)}</span>
                            <span className="text-white text-sm truncate max-w-[100px]">{p.name}</span>
                        </div>
                        <button
                            onClick={() => movePlayer(p, teamList, setOther === setTeamBlue ? teamBlue : teamWhite, setSelf, setOther)}
                            className="text-slate-400 hover:text-white p-1"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                ))}
            </div>
            <div className="mt-4 pt-2 border-t border-slate-700 text-center">
                <span className="text-slate-500 text-xs uppercase">Avg Rating</span>
                <div className="text-xl font-mono font-bold text-white">
                    {teamList.length > 0
                        ? Math.round(teamList.reduce((acc, p) => acc + calculateOverall(p), 0) / teamList.length)
                        : 0}
                </div>
            </div>
        </div>
    );

    return (
        <div className="bg-slate-800 rounded-xl p-6 shadow-2xl border border-slate-700 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Shirt className="text-purple-400" /> Team Sheet
                </h2>
                <div className="flex gap-2">
                    <button onClick={generateTeams} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg">
                        <Shuffle size={16} /> AI Generate
                    </button>
                    {teamBlue.length > 0 && (
                        <>
                            <button onClick={handlePublish} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg">
                                <Send size={16} /> Publish
                            </button>
                            <button onClick={() => onLogMatch({ blue: teamBlue, white: teamWhite })} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg">
                                <Activity size={16} /> Log Match
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4">
                <TeamColumn title="Blue Team" colorClass="border-blue-500" teamList={teamBlue} setSelf={setTeamBlue} setOther={setTeamWhite} />
                <TeamColumn title="White Team" colorClass="border-slate-200" teamList={teamWhite} setSelf={setTeamWhite} setOther={setTeamBlue} />
            </div>

            {teamBlue.length === 0 && (
                <div className="text-center text-slate-500 italic mt-8">
                    Click "AI Generate" to split the {confirmedPlayers.length} confirmed players.
                </div>
            )}
        </div>
    );
};

export default TeamGenerator;
