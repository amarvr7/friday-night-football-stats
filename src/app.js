import React, { useState, useMemo, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  writeBatch,
  deleteDoc,
  increment
} from 'firebase/firestore';
import {
  X,
  Upload,
  Sliders,
  Trash2,
  AlertCircle
} from 'lucide-react';

import { db, PROJECT_ID, COLLECTIONS } from './services/firebase';
import { compressImage, getPlayerStats, getPlayerHistoricalBaseline, calculateStatsFromMatches } from './utils/helpers';
import SEED_DATA from './utils/seedData';

// Hooks
import useAuth from './hooks/useAuth';
import useAppModel from './hooks/useAppModel';

// Components
import LoginScreen from './components/LoginScreen';
import Layout from './components/Layout';
import DashboardView from './components/DashboardView';
import SquadView from './components/SquadView';
import StatsView from './components/StatsView';
import MatchLogger from './components/MatchLogger';
import StatsLogger from './components/StatsLogger';
import LiveMatchTracker from './components/LiveMatchTracker';
import LegacyImporter from './components/LegacyImporter';
import TeamGenerator from './components/TeamGenerator';
import ModernPlayerProfile from './components/ModernPlayerProfile';
import RecordsView from './components/RecordsView';

// --- Main Application ---
export default function FridayNightFUT() {
  const { user, authStatus, login, logout, loading: authLoading } = useAuth();
  const { players, matches, checkins, upcomingTeams, loading: dataLoading, sortedPlayers, playerStreaks } = useAppModel(user, authStatus.loggedIn);

  const [view, setView] = useState('dashboard');
  const [showImporter, setShowImporter] = useState(false);
  const [selectedPlayerForEdit, setSelectedPlayerForEdit] = useState(null);
  const [selectedPlayerSeason, setSelectedPlayerSeason] = useState('2026');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [matchSetup, setMatchSetup] = useState(null); // Pre-filled match data from Team Generator
  const [editingMatch, setEditingMatch] = useState(null); // State for editing an existing match
  const [showGamePicker, setShowGamePicker] = useState(false); // Big Night: choose Game 1 or Game 2
  const [statsNavRequest, setStatsNavRequest] = useState(null); // Deep-link into a Stats Hub tab

  // NEW: State for Editing Ratings
  const [showRatingsModal, setShowRatingsModal] = useState(false);
  const [ratingsForm, setRatingsForm] = useState({ fitness: 3, control: 3, shooting: 3, defense: 3 });

  const handleSelectPlayer = (player, season = 'all') => {
    setSelectedPlayerForEdit(player);
    setSelectedPlayerSeason(season);
    setShowRatingsModal(false);
  };

  // A fresh object each time so StatsView reacts even if the same tab is requested twice
  const openStatsTab = (mode, extra = {}) => {
    setStatsNavRequest({ mode, nonce: Date.now(), ...extra });
    setView('stats');
  };

  // Once the user leaves Stats, a plain nav tap back should land on the default tab again
  useEffect(() => {
    if (view !== 'stats') setStatsNavRequest(null);
  }, [view]);

  const handleViewAllMatches = () => openStatsTab('matches');

  const handleComparePlayer = (player, season = 'all') => {
    setSelectedPlayerForEdit(null);
    openStatsTab('compare', { compareA: player.id, season });
  };

  // Always use the freshest player object from Firestore listener when modal is open
  const activePlayerForModal = useMemo(() => {
    if (!selectedPlayerForEdit) return null;
    return players.find(p => p.id === selectedPlayerForEdit.id) || selectedPlayerForEdit;
  }, [players, selectedPlayerForEdit]);

  // Players Available for Quick Add (SHOW ALL LEGENDS, even if in DB, to allow updates)
  const availableLegends = useMemo(() => {
    return SEED_DATA.map(s => s.name).sort();
  }, []);

  const handleSaveMatch = async (matchData, matchInfo = {}) => {
    if (editingMatch) {
      const matchRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.MATCHES, editingMatch.id);
      await updateDoc(matchRef, {
        stats: matchData,
        motm: matchInfo.motm || null,
        pkWinner: matchInfo.pkWinner || null,
        ...(matchInfo.pkAttempts ? { pkAttempts: matchInfo.pkAttempts } : {}),
        ...(matchInfo.teamLabels ? { teamLabels: matchInfo.teamLabels } : {}),
        blueOwnGoals: matchInfo.blueOwnGoals || 0,
        whiteOwnGoals: matchInfo.whiteOwnGoals || 0
      });

      const batch = writeBatch(db);
      const oldStats = editingMatch.stats || {};
      const oldMotm = editingMatch.motm;
      const allPlayerIds = new Set([...Object.keys(oldStats), ...Object.keys(matchData)]);

      for (const pid of allPlayerIds) {
        const oldP = oldStats[pid] || { goals: 0, assists: 0, win: 0, cleanSheet: 0, goalsFor: 0, goalsAgainst: 0, ownGoals: 0 };
        const newP = matchData[pid] || { goals: 0, assists: 0, win: 0, cleanSheet: 0, goalsFor: 0, goalsAgainst: 0, ownGoals: 0 };
        const player = players.find(p => p.id === pid);
        if (player) {
          const isOldMotm = oldMotm === pid;
          const isNewMotm = matchInfo.motm === pid;

          const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, pid);
          batch.update(playerRef, {
            goals: Math.max(0, (player.goals || 0) - (oldP.goals || 0) + (newP.goals || 0)),
            assists: Math.max(0, (player.assists || 0) - (oldP.assists || 0) + (newP.assists || 0)),
            wins: Math.max(0, (player.wins || 0) - (oldP.win || 0) + (newP.win || 0)),
            gamesPlayed: Math.max(0, (player.gamesPlayed || 0) - (oldStats[pid] ? 1 : 0) + (matchData[pid] ? 1 : 0)),
            motms: Math.max(0, (player.motms || 0) - (isOldMotm ? 1 : 0) + (isNewMotm ? 1 : 0)),
            cleanSheets: Math.max(0, (player.cleanSheets || 0) - (oldP.cleanSheet ? 1 : 0) + (newP.cleanSheet ? 1 : 0)),
            goalsFor: Math.max(0, (player.goalsFor || 0) - (oldP.goalsFor || 0) + (newP.goalsFor || 0)),
            goalsAgainst: Math.max(0, (player.goalsAgainst || 0) - (oldP.goalsAgainst || 0) + (newP.goalsAgainst || 0)),
            ownGoals: Math.max(0, (player.ownGoals || 0) - (oldP.ownGoals || 0) + (newP.ownGoals || 0))
          });
        }
      }
      await batch.commit();
      setEditingMatch(null);
    } else {
      await addDoc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.MATCHES), {
        date: serverTimestamp(),
        stats: matchData,
        createdBy: user.uid,
        motm: matchInfo.motm || null,
        pkWinner: matchInfo.pkWinner || null,
        ...(matchInfo.pkAttempts ? { pkAttempts: matchInfo.pkAttempts } : {}),
        ...(matchInfo.teamLabels ? { teamLabels: matchInfo.teamLabels } : {}),
        blueOwnGoals: matchInfo.blueOwnGoals || 0,
        whiteOwnGoals: matchInfo.whiteOwnGoals || 0
      });

      const playerIds = Object.keys(matchData);
      for (const pid of playerIds) {
        const stats = matchData[pid];
        const player = players.find(p => p.id === pid);
        if (player) {
          const isMotm = matchInfo.motm === pid;
          const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, pid);
          await updateDoc(playerRef, {
            goals: (player.goals || 0) + (stats.goals || 0),
            assists: (player.assists || 0) + (stats.assists || 0),
            wins: (player.wins || 0) + (stats.win || 0),
            gamesPlayed: (player.gamesPlayed || 0) + 1,
            motms: (player.motms || 0) + (isMotm ? 1 : 0),
            cleanSheets: (player.cleanSheets || 0) + (stats.cleanSheet ? 1 : 0),
            goalsFor: (player.goalsFor || 0) + (stats.goalsFor || 0),
            goalsAgainst: (player.goalsAgainst || 0) + (stats.goalsAgainst || 0),
            ownGoals: (player.ownGoals || 0) + (stats.ownGoals || 0)
          });
        }
      }
    }
    setView('dashboard');
  };

  const handleDeleteMatch = async (match) => {
    if (!window.confirm("Are you sure you want to delete this match? This will remove all stats associated with it.")) return;
    try {
      const batch = writeBatch(db);
      const matchStats = match.stats || {};
      const playerIds = Object.keys(matchStats);
      for (const pid of playerIds) {
        const stats = matchStats[pid];
        const player = players.find(p => p.id === pid);
        if (player) {
          const isMotm = match.motm === pid;
          const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, pid);
          batch.update(playerRef, {
            goals: Math.max(0, (player.goals || 0) - (stats.goals || 0)),
            assists: Math.max(0, (player.assists || 0) - (stats.assists || 0)),
            wins: Math.max(0, (player.wins || 0) - (stats.win || 0)),
            gamesPlayed: Math.max(0, (player.gamesPlayed || 0) - 1),
            motms: Math.max(0, (player.motms || 0) - (isMotm ? 1 : 0)),
            cleanSheets: Math.max(0, (player.cleanSheets || 0) - (stats.cleanSheet ? 1 : 0)),
            goalsFor: Math.max(0, (player.goalsFor || 0) - (stats.goalsFor || 0)),
            goalsAgainst: Math.max(0, (player.goalsAgainst || 0) - (stats.goalsAgainst || 0)),
            ownGoals: Math.max(0, (player.ownGoals || 0) - (stats.ownGoals || 0))
          });
        }
      }
      await batch.commit();
      await deleteDoc(doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.MATCHES, match.id));
      alert("Match deleted successfully.");
    } catch (err) {
      console.error("Failed to delete match:", err);
      alert("Failed to delete match.");
    }
  };

  const handleSeedData = async () => {
    if (!window.confirm("This will update historic player baseline stats. Continue?")) return;
    const batch = writeBatch(db);
    let count = 0;

    SEED_DATA.forEach(p => {
      const existing = players.find(ep => ep.name.toLowerCase() === p.name.toLowerCase());
      const updatedHistorical = {
        gamesPlayed: p.gamesPlayed,
        goals: p.goals,
        wins: p.wins
      };

      if (existing) {
        const ref = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, existing.id);
        const allStats = getPlayerStats({ ...existing, historical: updatedHistorical }, matches, 'all');
        batch.update(ref, {
          historical: updatedHistorical,
          goals: allStats.goals,
          wins: allStats.wins,
          gamesPlayed: allStats.gamesPlayed,
          assists: allStats.assists,
          cleanSheets: allStats.cleanSheets,
          motms: allStats.motms,
          goalsFor: allStats.goalsFor,
          goalsAgainst: allStats.goalsAgainst
        });
        count++;
      } else {
        const newRef = doc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS));
        batch.set(newRef, {
          ...p,
          historical: updatedHistorical,
          assists: 0,
          cleanSheets: 0,
          motms: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          createdAt: serverTimestamp()
        });
        count++;
      }
    });

    await batch.commit();
    alert(`Successfully processed ${count} player records!`);
  };

  const handleImageUpload = async (file) => {
    if (!selectedPlayerForEdit) return;
    const base64 = await compressImage(file);
    const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, selectedPlayerForEdit.id);
    await updateDoc(playerRef, { photoUrl: base64 });
    setSelectedPlayerForEdit({ ...selectedPlayerForEdit, photoUrl: base64 });
  };

  const handleSaveRatings = async () => {
    if (!selectedPlayerForEdit) return;
    const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, selectedPlayerForEdit.id);
    await updateDoc(playerRef, { ratings: ratingsForm });
    setSelectedPlayerForEdit({ ...selectedPlayerForEdit, ratings: ratingsForm });
    setShowRatingsModal(false);
  };

  const handleStatChange = async (statName, change, targetSeason = 'all') => {
    if (!activePlayerForModal) return;
    const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, activePlayerForModal.id);

    try {
      const updates = {};
      if (targetSeason === '2026') {
        const s2026Field = statName === 'gamesPlayed' ? 'games' : statName;
        updates[`season2026.${s2026Field}`] = increment(change);
        updates[statName] = increment(change);
      } else {
        const allMatchStats = calculateStatsFromMatches(activePlayerForModal, matches);
        const currentHistorical = getPlayerHistoricalBaseline(activePlayerForModal, allMatchStats);
        if (!activePlayerForModal.historical) {
          Object.keys(currentHistorical).forEach(k => {
            updates[`historical.${k}`] = currentHistorical[k] || 0;
          });
        }
        updates[`historical.${statName}`] = Math.max(0, (currentHistorical[statName] || 0) + change);
        updates[statName] = Math.max(0, (activePlayerForModal[statName] || 0) + change);
      }
      await updateDoc(playerRef, updates);
    } catch (err) {
      console.error("Stat update failed", err);
      alert("Failed to update stat: " + err.message);
    }
  };

  const handleRemovePhoto = async () => {
    if (!activePlayerForModal) return;
    try {
      const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, activePlayerForModal.id);
      await updateDoc(playerRef, { photoUrl: null });
      setSelectedPlayerForEdit({ ...activePlayerForModal, photoUrl: null });
    } catch (err) {
      console.error("Error removing photo", err);
      alert("Failed to remove photo.");
    }
  };

  const handleDeletePlayer = async () => {
    if (!activePlayerForModal) return;
    try {
      const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, activePlayerForModal.id);
      await deleteDoc(playerRef);
      const playerName = activePlayerForModal.name;
      setSelectedPlayerForEdit(null);
      setShowDeleteConfirm(false);
      setTimeout(() => alert(`${playerName} has been removed from the squad.`), 100);
    } catch (err) {
      console.error("Delete failed", err);
      alert("Failed to delete player: " + err.message);
      setShowDeleteConfirm(false);
    }
  };

  const startLiveGame = (gameNumber) => {
    const toPlayers = (ids) => (ids || []).map(id => players.find(p => p.id === id)).filter(Boolean);

    if (gameNumber === 2) {
      // Game 2 rides the blue/white slots with Red/Green display labels
      setMatchSetup({
        blue: toPlayers(upcomingTeams.red),
        white: toPlayers(upcomingTeams.green),
        labels: { blue: 'Red', white: 'Green' }
      });
    } else {
      setMatchSetup({ blue: toPlayers(upcomingTeams.blue), white: toPlayers(upcomingTeams.white) });
    }
    setShowGamePicker(false);
    setView('live-match');
  };

  const handleStartLiveMatch = () => {
    if (upcomingTeams && upcomingTeams.blue && upcomingTeams.white) {
      if (upcomingTeams.mode === 'quad') {
        // Big Night: two games published — let the admin pick which one goes live
        setShowGamePicker(true);
        return;
      }
      startLiveGame(1);
    } else {
      setView('add-match');
    }
  };

  if (!authStatus.loggedIn) return <LoginScreen onLogin={login} />;

  if (authLoading || dataLoading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div></div>;
  }

  return (
    <Layout view={view} setView={setView} authStatus={authStatus} handleLogout={logout} hasUpcomingTeams={!!upcomingTeams} handleStartLiveMatch={handleStartLiveMatch}>
      {view === 'dashboard' && (
        <DashboardView
          players={players}
          upcomingTeams={upcomingTeams}
          sortedPlayers={sortedPlayers}
          playerStreaks={playerStreaks}
          checkins={checkins}
          matches={matches}
          authStatus={authStatus}
          setSelectedPlayerForEdit={handleSelectPlayer}
          onViewAllMatches={handleViewAllMatches}
        />
      )}

      {view === 'live-match' && authStatus.role === 'admin' && (
        <LiveMatchTracker
          players={players}
          onSave={handleSaveMatch}
          onCancel={() => { setView('dashboard'); setMatchSetup(null); }}
          initialTeams={matchSetup}
        />
      )}

      {view === 'add-match' && authStatus.role === 'admin' && (
        <StatsLogger
          players={players}
          matches={matches}
          onBack={() => setView('dashboard')}
        />
      )}

      {view === 'log-match' && authStatus.role === 'admin' && (
        <MatchLogger
          players={players}
          onSave={handleSaveMatch}
          onCancel={() => { setView('dashboard'); setMatchSetup(null); setEditingMatch(null); }}
          initialTeams={matchSetup}
          editingMatch={editingMatch}
        />
      )}

      {view === 'teams' && authStatus.role === 'admin' && (
        <TeamGenerator
          players={players}
          upcomingTeams={upcomingTeams}
          matches={matches}
          playerStreaks={playerStreaks}
          onLogMatch={(teams, matchType = 'add-match') => { setMatchSetup(teams); setView(matchType); }}
        />
      )}

      {view === 'stats' && (
        <StatsView
          players={players}
          matches={matches}
          playerStreaks={playerStreaks}
          onSelectPlayer={handleSelectPlayer}
          onAddMatch={() => { setMatchSetup(null); setEditingMatch(null); setView('log-match'); }}
          onEditMatch={(m) => { setEditingMatch(m); setView('log-match'); }}
          onDeleteMatch={handleDeleteMatch}
          currentUserRole={authStatus.role}
          navRequest={statsNavRequest}
        />
      )}

      {view === 'players' && (
        <SquadView
          players={players}
          matches={matches}
          checkins={checkins}
          authStatus={authStatus}
          user={user}
          availableLegends={availableLegends}
          setShowImporter={setShowImporter}
          handleSeedData={handleSeedData}
          setSelectedPlayerForEdit={handleSelectPlayer}
          setView={setView}
        />
      )}

      {view === 'records' && (
        <RecordsView
          players={players}
          matches={matches}
          playerStreaks={playerStreaks}
          userRole={authStatus.role}
          onSelectPlayer={handleSelectPlayer}
        />
      )}

      {/* MODALS */}
      {activePlayerForModal && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-start justify-center z-50 p-3 sm:p-4 pt-safe pb-safe overflow-y-auto"
          onClick={() => setSelectedPlayerForEdit(null)}
        >
          <div className="relative max-w-md w-full my-3 sm:my-8" onClick={(e) => e.stopPropagation()}>
            {/* Reachable Top Bar inside Viewport */}
            <div className="flex justify-between items-center mb-2.5 px-1">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Player Card</span>
              <button
                onClick={() => setSelectedPlayerForEdit(null)}
                className="bg-slate-800/90 hover:bg-slate-700 text-white px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-1.5 text-xs font-bold shadow-lg"
              >
                <span>Close</span> <X size={16} />
              </button>
            </div>

            {!showRatingsModal ? (
              <>
                <div className="mb-4">
                  <ModernPlayerProfile
                    player={activePlayerForModal}
                    matches={matches}
                    players={players}
                    initialSeason={selectedPlayerSeason}
                    onCompare={handleComparePlayer}
                    rank={sortedPlayers.findIndex(p => p.id === activePlayerForModal.id) + 1}
                    onUploadClick={() => authStatus.role === 'admin' && document.getElementById('photo-upload').click()}
                    canEdit={authStatus.role === 'admin'}
                    onStatChange={authStatus.role === 'admin' ? handleStatChange : null}
                    streaks={playerStreaks[activePlayerForModal.id]}
                    seasonStats={getPlayerStats(activePlayerForModal, matches, selectedPlayerSeason)}
                    onEditRatings={() => {
                      setRatingsForm(activePlayerForModal.ratings || { fitness: 3, control: 3, shooting: 3, defense: 3 });
                      setShowRatingsModal(true);
                    }}
                  />
                </div>

                {/* Admin Upload Controls */}
                {authStatus.role === 'admin' && (
                  <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3.5 mb-3">
                    <input type="file" id="photo-upload" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files[0]) handleImageUpload(e.target.files[0]); }} />
                    <div className="flex gap-2">
                      <button onClick={() => document.getElementById('photo-upload').click()} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm">
                        <Upload size={15} /> {activePlayerForModal.photoUrl ? 'Change Photo' : 'Upload Photo'}
                      </button>
                      {activePlayerForModal.photoUrl && (
                        <button onClick={handleRemovePhoto} className="bg-slate-700/60 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm">
                          <X size={15} /> Remove
                        </button>
                      )}
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-colors"
                        title="Delete Player"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setSelectedPlayerForEdit(null)}
                  className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all text-sm"
                >
                  Close Card
                </button>
              </>
            ) : (
              <div className="bg-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-700">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <Sliders size={20} className="text-yellow-500" /> Edit Attributes
                  </h3>
                  <button onClick={() => setShowRatingsModal(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="space-y-6">
                  {['fitness', 'control', 'shooting', 'defense'].map(attr => (
                    <div key={attr}>
                      <div className="flex justify-between text-sm mb-2">
                        <label className="font-bold text-slate-300 capitalize">{attr === 'defense' ? 'Defensive Awareness' : attr === 'fitness' ? 'Fitness / Speed' : attr === 'control' ? 'Ball Control / Passing' : 'Shooting & Finishing'}</label>
                        <span className="font-mono text-yellow-500">{ratingsForm[attr]}</span>
                      </div>
                      <input
                        type="range" min="1" max="5" step="0.1"
                        value={ratingsForm[attr]}
                        onChange={(e) => setRatingsForm({ ...ratingsForm, [attr]: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSaveRatings}
                  className="w-full mt-8 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg"
                >
                  Save Attributes
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showImporter && authStatus.role === 'admin' && <LegacyImporter onComplete={() => { setShowImporter(false); setView('dashboard'); }} onCancel={() => setShowImporter(false)} />}

      {/* Big Night Game Picker */}
      {showGamePicker && authStatus.role === 'admin' && upcomingTeams && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setShowGamePicker(false)}>
          <div className="bg-slate-800 rounded-2xl max-w-md w-full p-6 border border-slate-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Which game is going live?</h3>
              <button onClick={() => setShowGamePicker(false)} className="text-slate-500 hover:text-white p-1" aria-label="Close game picker">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => startLiveGame(1)}
                className="w-full bg-slate-900 hover:bg-slate-700 border border-blue-500/40 rounded-xl p-4 text-left transition-colors"
              >
                <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Game 1 — Kickoff First</span>
                <span className="font-black text-lg"><span className="text-blue-400">Blue</span> <span className="text-slate-500">vs</span> <span className="text-white">White</span></span>
              </button>
              <button
                onClick={() => startLiveGame(2)}
                className="w-full bg-slate-900 hover:bg-slate-700 border border-red-500/40 rounded-xl p-4 text-left transition-colors"
              >
                <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Game 2 — Straight After</span>
                <span className="font-black text-lg"><span className="text-red-400">Red</span> <span className="text-slate-500">vs</span> <span className="text-green-400">Green</span></span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedPlayerForEdit && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-slate-800 rounded-2xl max-w-md w-full p-6 border-2 border-red-500/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-500/20 p-3 rounded-full">
                <Trash2 className="text-red-400" size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">Delete Player?</h3>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
              <p className="text-slate-300 mb-3">Are you sure you want to permanently delete:</p>
              <div className="bg-slate-800 rounded p-3 mb-3">
                <p className="text-white font-bold text-lg">{selectedPlayerForEdit.name}</p>
              </div>
              <div className="text-sm text-slate-400 space-y-1">
                <p>\u2022 {selectedPlayerForEdit.gamesPlayed || 0} games played</p>
                <p>\u2022 {selectedPlayerForEdit.goals || 0} goals scored</p>
                <p>\u2022 {selectedPlayerForEdit.wins || 0} wins</p>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6">
              <p className="text-yellow-400 text-sm font-bold flex items-center gap-2">
                <AlertCircle size={16} />
                This action cannot be undone
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePlayer}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}