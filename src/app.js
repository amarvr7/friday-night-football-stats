import React, { useState, useMemo } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import {
  X,
  Upload,
  Sliders,
  Trash2,
  AlertCircle
} from 'lucide-react';

import { db, PROJECT_ID, COLLECTIONS } from './services/firebase';
import { compressImage } from './utils/helpers';
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
import LegacyImporter from './components/LegacyImporter';
import TeamGenerator from './components/TeamGenerator';
import PlayerCard from './components/PlayerCard';

// --- Main Application ---
export default function FridayNightFUT() {
  const { user, authStatus, login, logout, loading: authLoading } = useAuth();
  const { players, matches, checkins, upcomingTeams, loading: dataLoading, sortedPlayers, playerStreaks } = useAppModel(user, authStatus.loggedIn);

  const [view, setView] = useState('dashboard');
  const [showImporter, setShowImporter] = useState(false);
  const [selectedPlayerForEdit, setSelectedPlayerForEdit] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [matchSetup, setMatchSetup] = useState(null); // Pre-filled match data from Team Generator

  // NEW: State for Editing Ratings
  const [showRatingsModal, setShowRatingsModal] = useState(false);
  const [ratingsForm, setRatingsForm] = useState({ fitness: 3, control: 3, shooting: 3, defense: 3 });

  // Players Available for Quick Add (SHOW ALL LEGENDS, even if in DB, to allow updates)
  const availableLegends = useMemo(() => {
    return SEED_DATA.map(s => s.name).sort();
  }, []);

  const handleSaveMatch = async (matchData, matchInfo = {}) => {
    await addDoc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.MATCHES), {
      date: serverTimestamp(),
      stats: matchData,
      createdBy: user.uid,
      motm: matchInfo.motm || null
    });

    const playerIds = Object.keys(matchData);
    for (const pid of playerIds) {
      const stats = matchData[pid];
      const player = players.find(p => p.id === pid);
      if (player) {
        const isMotm = matchInfo.motm === pid;
        const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, pid);
        await updateDoc(playerRef, {
          goals: (player.goals || 0) + stats.goals,
          assists: (player.assists || 0) + stats.assists,
          wins: (player.wins || 0) + (stats.win ? 1 : 0),
          gamesPlayed: (player.gamesPlayed || 0) + 1,
          motms: (player.motms || 0) + (isMotm ? 1 : 0)
        });
      }
    }
    setView('dashboard');
  };

  const handleSeedData = async () => {
    if (!window.confirm("This will add/update ALL historic player stats. Continue?")) return;
    const batch = writeBatch(db);
    let count = 0;

    SEED_DATA.forEach(p => {
      const existing = players.find(ep => ep.name.toLowerCase() === p.name.toLowerCase());
      if (existing) {
        const ref = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, existing.id);
        batch.update(ref, {
          goals: p.goals,
          wins: p.wins,
          gamesPlayed: p.gamesPlayed
        });
        count++;
      } else {
        const newRef = doc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS));
        batch.set(newRef, {
          ...p,
          assists: 0,
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

  const handleRemovePhoto = async () => {
    if (!selectedPlayerForEdit) return;
    try {
      const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, selectedPlayerForEdit.id);
      await updateDoc(playerRef, { photoUrl: null });
      setSelectedPlayerForEdit({ ...selectedPlayerForEdit, photoUrl: null });
    } catch (err) {
      console.error("Error removing photo", err);
      alert("Failed to remove photo.");
    }
  };

  const handleDeletePlayer = async () => {
    if (!selectedPlayerForEdit) return;
    try {
      const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, selectedPlayerForEdit.id);
      await deleteDoc(playerRef);
      const playerName = selectedPlayerForEdit.name;
      setSelectedPlayerForEdit(null);
      setShowDeleteConfirm(false);
      setTimeout(() => alert(`${playerName} has been removed from the squad.`), 100);
    } catch (err) {
      console.error("Delete failed", err);
      alert("Failed to delete player: " + err.message);
      setShowDeleteConfirm(false);
    }
  };

  if (!authStatus.loggedIn) return <LoginScreen onLogin={login} />;

  if (authLoading || dataLoading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div></div>;
  }

  return (
    <Layout view={view} setView={setView} authStatus={authStatus} handleLogout={logout}>
      {view === 'dashboard' && (
        <DashboardView
          players={players}
          upcomingTeams={upcomingTeams}
          sortedPlayers={sortedPlayers}
          playerStreaks={playerStreaks}
          checkins={checkins}
          matches={matches} // NEW: Pass matches for local 2026 filtering
          authStatus={authStatus}
          setSelectedPlayerForEdit={setSelectedPlayerForEdit}
        />
      )}

      {view === 'add-match' && authStatus.role === 'admin' && (
        <MatchLogger
          players={players}
          onSave={handleSaveMatch}
          onCancel={() => { setView('dashboard'); setMatchSetup(null); }}
          initialTeams={matchSetup}
        />
      )}

      {view === 'teams' && authStatus.role === 'admin' && (
        <TeamGenerator
          players={players}
          onLogMatch={(teams) => { setMatchSetup(teams); setView('add-match'); }}
        />
      )}

      {view === 'stats' && (
        <StatsView
          players={players}
          matches={matches}
          playerStreaks={playerStreaks}
          onSelectPlayer={(p) => setSelectedPlayerForEdit(p)}
          onAddMatch={() => setView('add-match')}
          currentUserRole={authStatus.role}
        />
      )}

      {view === 'players' && (
        <SquadView
          players={players}
          checkins={checkins}
          authStatus={authStatus}
          user={user}
          availableLegends={availableLegends}
          setShowImporter={setShowImporter}
          handleSeedData={handleSeedData}
          setSelectedPlayerForEdit={setSelectedPlayerForEdit}
          setView={setView}
        />
      )}

      {/* MODALS */}
      {selectedPlayerForEdit && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPlayerForEdit(null)}>
          <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedPlayerForEdit(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-2 flex items-center gap-1"
            >
              <span className="text-sm font-bold uppercase">Close</span> <X size={24} />
            </button>

            {!showRatingsModal ? (
              <>
                <div className="mb-6">
                  <PlayerCard
                    player={selectedPlayerForEdit}
                    rank={sortedPlayers.findIndex(p => p.id === selectedPlayerForEdit.id) + 1}
                    onUploadClick={() => authStatus.role === 'admin' && document.getElementById('photo-upload').click()}
                    canEdit={authStatus.role === 'admin'}
                    streaks={playerStreaks[selectedPlayerForEdit.id]}
                    onEditRatings={() => {
                      setRatingsForm(selectedPlayerForEdit.ratings || { fitness: 3, control: 3, shooting: 3, defense: 3 });
                      setShowRatingsModal(true);
                    }}
                  />
                </div>

                {/* Admin Upload Controls */}
                {authStatus.role === 'admin' && (
                  <div className="bg-slate-800 rounded-xl p-4 mb-4">
                    <p className="text-slate-400 text-sm mb-4">Tap card photo to upload image.</p>
                    <input type="file" id="photo-upload" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files[0]) handleImageUpload(e.target.files[0]); }} />
                    <button onClick={() => document.getElementById('photo-upload').click()} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mb-3">
                      <Upload size={18} /> Upload Photo
                    </button>
                    {selectedPlayerForEdit.photoUrl && (
                      <button onClick={handleRemovePhoto} className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-lg flex items-center justify-center gap-2 mb-3">
                        <X size={18} /> Remove Photo
                      </button>
                    )}
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-400 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Trash2 size={18} /> Delete Player
                    </button>
                  </div>
                )}

                {/* Explicit Back Button for mobile users */}
                <button
                  onClick={() => setSelectedPlayerForEdit(null)}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all"
                >
                  Close Card
                </button>
              </>
            ) : (
              <div className="bg-slate-800 rounded-xl p-6 shadow-2xl border border-slate-700">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
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
                  className="w-full mt-8 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg shadow-lg"
                >
                  Save Attributes
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showImporter && authStatus.role === 'admin' && <LegacyImporter onComplete={() => { setShowImporter(false); setView('dashboard'); }} onCancel={() => setShowImporter(false)} />}

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