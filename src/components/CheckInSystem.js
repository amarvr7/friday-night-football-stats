import React, { useState, useEffect } from 'react';
import { CalendarDays, Shield, Clock, UserCheck, UserMinus } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, addDoc, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, PROJECT_ID, COLLECTIONS } from '../services/firebase';

const CheckInSystem = ({ players, currentUserRole }) => {
    const [checkins, setCheckins] = useState([]);
    const [settings, setSettings] = useState({ unlockTime: null });
    const [selectedPlayer, setSelectedPlayer] = useState('');
    const [unlockTimeInput, setUnlockTimeInput] = useState('');
    const [newPlayerName, setNewPlayerName] = useState('');

    useEffect(() => {
        // Order by timestamp ensures Waitlist logic works automatically (First come first serve)
        const qCheckins = query(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.CHECKINS), orderBy("timestamp", "asc"));
        const unsub = onSnapshot(qCheckins, (snapshot) => {
            setCheckins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const qSettings = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.SETTINGS, 'config');
        const unsubSettings = onSnapshot(qSettings, (snap) => {
            if (snap.exists()) setSettings(snap.data());
        });
        return () => { unsub(); unsubSettings(); };
    }, []);

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

    const updateUnlockTime = async () => {
        if (currentUserRole !== 'admin') return;

        if (!unlockTimeInput) {
            alert("Please select a date and time.");
            return;
        }

        try {
            const date = new Date(unlockTimeInput);

            if (isNaN(date.getTime())) {
                throw new Error("Invalid date selected");
            }

            await setDoc(doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.SETTINGS, 'config'), {
                unlockTime: date.toISOString()
            });
            alert("Unlock time updated!");
        } catch (err) {
            console.error("Settings update failed", err);
            alert("Failed to update time: " + err.message);
        }
    };

    const isUnlocked = settings.unlockTime ? new Date() >= new Date(settings.unlockTime) : true;
    const canCheckIn = isUnlocked || currentUserRole === 'admin';

    // Separate Lists
    const starting12 = checkins.slice(0, 12);
    const waitingList = checkins.slice(12);

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

            {currentUserRole === 'admin' && (
                <div className="bg-slate-900/50 p-4 rounded-lg mb-6 border border-slate-700">
                    <h3 className="text-sm font-bold text-yellow-500 uppercase mb-2 flex items-center gap-2"><Shield size={14} /> Admin Controls</h3>
                    <div className="flex gap-2">
                        <input type="datetime-local" className="bg-slate-800 text-white text-sm p-2 rounded border border-slate-600 flex-1" onChange={(e) => setUnlockTimeInput(e.target.value)} />
                        <button onClick={updateUnlockTime} className="bg-slate-700 text-white px-4 py-2 rounded text-sm font-bold hover:bg-slate-600">Set Unlock Time</button>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">Current Unlock: {settings.unlockTime ? new Date(settings.unlockTime).toLocaleString() : 'Always Open'}</div>
                </div>
            )}

            {canCheckIn ? (
                <div className="flex flex-col sm:flex-row gap-2 mb-6 items-start">
                    <div className="flex-1 w-full space-y-2">
                        <select
                            className="w-full bg-slate-900 text-white p-3 rounded-lg border border-slate-700"
                            value={selectedPlayer}
                            onChange={(e) => setSelectedPlayer(e.target.value)}
                        >
                            <option value="">Select Your Name...</option>
                            {players
                                .filter(p => !checkins.some(c => c.playerId === p.id))
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                            }
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
                    <button onClick={handleCheckIn} disabled={!selectedPlayer || (selectedPlayer === 'NEW' && !newPlayerName.trim())} className="w-full sm:w-auto bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-500 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 h-[50px]">
                        <UserCheck size={18} /> I'm In
                    </button>
                </div>
            ) : (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-center mb-6">
                    <Clock className="text-red-400 mx-auto mb-2" />
                    <p className="text-red-400 font-bold">Check-in is currently locked.</p>
                    <p className="text-xs text-slate-400 mt-1">Opens: {settings.unlockTime ? new Date(settings.unlockTime).toLocaleString() : 'Soon'}</p>
                </div>
            )}

            {/* Starting 12 */}
            <div className="mb-4">
                <h3 className="text-green-400 font-bold uppercase text-xs mb-2 tracking-wider">Starting 12 ({starting12.length}/12)</h3>
                <div className="space-y-2">
                    {starting12.length === 0 && <p className="text-slate-500 text-sm italic">Empty pitch.</p>}
                    {starting12.map((c, idx) => (
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
                                    <span className="bg-slate-800 text-slate-400 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">{12 + idx + 1}</span>
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
