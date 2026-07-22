import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Shield, Clock, UserCheck, UserMinus, Users } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, addDoc, deleteDoc, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore';
import { db, PROJECT_ID, COLLECTIONS } from '../services/firebase';

const BIG_NIGHT_THRESHOLD = 24;

const CheckInSystem = ({ players, currentUserRole }) => {
    const [checkins, setCheckins] = useState([]);
    const [selectedPlayer, setSelectedPlayer] = useState('');
    const [newPlayerName, setNewPlayerName] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkLoading, setBulkLoading] = useState(false);

    useEffect(() => {
        // Order by timestamp ensures Waitlist logic works automatically (First come first serve)
        const qCheckins = query(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.CHECKINS), orderBy("timestamp", "asc"));
        const unsub = onSnapshot(qCheckins, (snapshot) => {
            setCheckins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsub();
    }, []);

    // Players not yet checked in (shared by the dropdown and the admin checklist)
    const availablePlayers = useMemo(() => {
        return players
            .filter(p => !checkins.some(c => c.playerId === p.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [players, checkins]);

    const handleCheckIn = async () => {
        if (!selectedPlayer) return;
        try {
            if (selectedPlayer === 'NEW') {
                if (!newPlayerName.trim()) return;

                // Add to PLAYERS collection first
                const playerRef = await addDoc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS), {
                    name: newPlayerName.trim(),
                    goals: 0,
                    assists: 0,
                    wins: 0,
                    gamesPlayed: 0,
                    createdAt: serverTimestamp()
                });

                // Add to CHECKINS
                await addDoc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.CHECKINS), {
                    playerId: playerRef.id,
                    name: newPlayerName.trim(),
                    timestamp: serverTimestamp()
                });
                setNewPlayerName('');
            } else {
                await addDoc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.CHECKINS), {
                    playerId: selectedPlayer,
                    name: players.find(p => p.id === selectedPlayer)?.name || 'Unknown',
                    timestamp: serverTimestamp()
                });
            }
            setSelectedPlayer('');
        } catch (err) { console.error("Checkin failed", err); }
    };

    const handleRemoveCheckIn = async (checkinId) => {
        try {
            await deleteDoc(doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.CHECKINS, checkinId));
        } catch (err) { console.error("Remove failed", err); }
    };

    const handleToggleSelect = (playerId) => {
        setSelectedIds(prev => prev.includes(playerId)
            ? prev.filter(id => id !== playerId)
            : [...prev, playerId]
        );
    };

    // ADMIN: Check in all ticked names at once
    const handleBulkCheckIn = async () => {
        if (currentUserRole !== 'admin' || selectedIds.length === 0) return;

        setBulkLoading(true);
        try {
            const batch = writeBatch(db);
            const baseTime = Date.now();

            selectedIds.forEach((playerId, i) => {
                const player = players.find(p => p.id === playerId);
                if (!player) return;
                if (checkins.some(c => c.playerId === playerId)) return;

                // Staggered timestamps keep the check-in order matching the selection order
                const checkinRef = doc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.CHECKINS));
                batch.set(checkinRef, {
                    playerId,
                    name: player.name,
                    timestamp: Timestamp.fromMillis(baseTime + i)
                });
            });

            await batch.commit();
            setSelectedIds([]);
        } catch (err) {
            console.error("Bulk check-in failed", err);
            alert("Bulk check-in failed: " + err.message);
        } finally {
            setBulkLoading(false);
        }
    };

    // Separate Lists — Big Night (24+) expands the roster to 24 players / 4 teams
    const isBigNight = checkins.length >= BIG_NIGHT_THRESHOLD;
    const rosterSize = isBigNight ? BIG_NIGHT_THRESHOLD : 12;
    const startingList = checkins.slice(0, rosterSize);
    const waitingList = checkins.slice(rosterSize);

    return (
        <div className="bg-slate-800 rounded-xl p-6 shadow-2xl border border-slate-700">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <CalendarDays className="text-blue-400" /> Friday Availability
                </h2>
                <div className="text-right">
                    <div className="text-3xl font-mono font-bold text-green-400">{checkins.length}</div>
                    <div className="text-xs text-slate-500 uppercase">Players Total</div>
                </div>
            </div>

            {currentUserRole === 'admin' && availablePlayers.length > 0 && (
                <div className="bg-slate-900/50 p-4 rounded-lg mb-6 border border-slate-700">
                    <h3 className="text-sm font-bold text-yellow-500 uppercase mb-3 flex items-center gap-2">
                        <Shield size={14} /> Admin: Tap Names to Check In
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {availablePlayers.map(p => {
                            const isSelected = selectedIds.includes(p.id);
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => handleToggleSelect(p.id)}
                                    aria-pressed={isSelected}
                                    aria-label={`Select ${p.name} for check-in`}
                                    className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors min-h-[40px] ${isSelected
                                        ? 'bg-green-600 text-white border-green-400'
                                        : 'bg-slate-800 text-slate-300 border-slate-600 hover:border-slate-400'}`}
                                >
                                    {isSelected ? '✓ ' : ''}{p.name}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-slate-500">
                            {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Tap names, then check them all in at once.'}
                        </span>
                        <div className="flex gap-2">
                            {selectedIds.length > 0 && (
                                <button
                                    onClick={() => setSelectedIds([])}
                                    className="text-slate-400 hover:text-white px-3 py-2 rounded text-sm font-bold"
                                >
                                    Clear
                                </button>
                            )}
                            <button
                                onClick={handleBulkCheckIn}
                                disabled={selectedIds.length === 0 || bulkLoading}
                                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2"
                            >
                                <Users size={14} /> {bulkLoading ? 'Adding...' : `Check In${selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Big Night Banner */}
            {isBigNight && (
                <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-lg mb-6 text-center">
                    <p className="text-purple-300 font-bold text-sm flex items-center justify-center gap-2">
                        <Users size={16} /> BIG NIGHT: {checkins.length} players — 4-team mode unlocked (2 games)!
                    </p>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 mb-6 items-start">
                <div className="flex-1 w-full space-y-2">
                    <select
                        className="w-full bg-slate-900 text-white p-3 rounded-lg border border-slate-700"
                        value={selectedPlayer}
                        onChange={(e) => setSelectedPlayer(e.target.value)}
                    >
                        <option value="">Select Your Name...</option>
                        {availablePlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        <option value="NEW" className="text-green-400 font-bold">+ I'm not listed (Add Name)</option>
                    </select>
                    {selectedPlayer === 'NEW' && (
                        <input
                            type="text"
                            placeholder="Enter your full name..."
                            className="w-full bg-slate-800 text-white p-3 rounded-lg border border-green-500/50 focus:border-green-500 outline-none"
                            value={newPlayerName}
                            onChange={(e) => setNewPlayerName(e.target.value)}
                            autoFocus
                        />
                    )}
                </div>
                <button
                    onClick={handleCheckIn}
                    disabled={!selectedPlayer || (selectedPlayer === 'NEW' && !newPlayerName.trim())}
                    className={`w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 h-[50px] transition-colors ${checkins.length >= rosterSize ? 'bg-orange-500 hover:bg-orange-400' : 'bg-green-600 hover:bg-green-500'}`}
                >
                    {checkins.length >= rosterSize ? (
                        <><Clock size={18} /> Join Waitlist</>
                    ) : (
                        <><UserCheck size={18} /> I'm In</>
                    )}
                </button>
            </div>

            {/* Starting Roster */}
            <div className="mb-4">
                <h3 className="text-green-400 font-bold uppercase text-xs mb-2 tracking-wider">
                    {isBigNight ? `Big Night Roster (${startingList.length}/${rosterSize})` : `Starting 12 (${startingList.length}/12)`}
                </h3>
                <div className="space-y-2">
                    {startingList.length === 0 && <p className="text-slate-500 text-sm italic">Empty pitch.</p>}
                    {startingList.map((c, idx) => (
                        <div key={c.id} className="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-green-500/30">
                            <div className="flex items-center gap-3">
                                <span className="bg-green-900 text-green-400 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">{idx + 1}</span>
                                <span className="font-bold text-white">{c.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">{c.timestamp ? new Date(c.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                {/* ALLOW ADMIN OR USER TO REMOVE */}
                                <button onClick={() => handleRemoveCheckIn(c.id)} className="text-red-500 hover:text-red-400 p-1 bg-red-500/10 rounded ml-2" title="I'm Out">
                                    <UserMinus size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Waiting List */}
            {waitingList.length > 0 && (
                <div className="mt-6 border-t border-slate-700 pt-4">
                    <h3 className="text-orange-400 font-bold uppercase text-xs mb-2 tracking-wider flex items-center gap-2"><Clock size={12} /> Waiting List</h3>
                    <div className="space-y-2">
                        {waitingList.map((c, idx) => (
                            <div key={c.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-dashed border-slate-700 opacity-70">
                                <div className="flex items-center gap-3">
                                    <span className="bg-slate-800 text-slate-400 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">{rosterSize + idx + 1}</span>
                                    <span className="font-medium text-slate-300">{c.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleRemoveCheckIn(c.id)} className="text-red-500 hover:text-red-400 p-1">
                                        <UserMinus size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckInSystem;
