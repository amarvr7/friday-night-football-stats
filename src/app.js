import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  writeBatch,
  getDocs,
  setDoc,
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import {
  Trophy,
  Plus,
  Users,
  Activity,
  Zap,
  TrendingUp,
  History,
  Save,
  FileUp,
  AlertCircle,
  CheckCircle2,
  Camera,
  X,
  Upload,
  RefreshCw,
  Lock,
  ArrowRight,
  Shield,
  Clock,
  UserCheck,
  CalendarDays,
  UserMinus,
  Shuffle,
  Shirt,
  BarChart2,
  Search,
  ArrowUp,
  ArrowDown,
  Filter,
  UserPlus,
  Sliders
} from 'lucide-react';

// --- 1. FIREBASE INITIALIZATION ---
// Hardcoded configuration to ensure immediate availability
const firebaseConfig = {
  apiKey: "AIzaSyCst0JAHFRVNmq_PTDVciV7pwF3MW-6TVY",
  authDomain: "fridaynightfootball-ba9c1.firebaseapp.com",
  projectId: "fridaynightfootball-ba9c1",
  storageBucket: "fridaynightfootball-ba9c1.firebasestorage.app",
  messagingSenderId: "149039714412",
  appId: "1:149039714412:web:a6422e99116ef923100849",
  measurementId: "G-YTVXVQ8328"
};

// Singleton initialization pattern to prevent multiple instances
let app;
let auth;
let db;
let initError = null;

try {
  // Check if an app is already initialized
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp(); // Use existing default app
  }

  // Initialize services
  auth = getAuth(app);
  db = getFirestore(app);
  console.log("Firebase Initialized Successfully");
} catch (err) {
  console.error("Firebase Init Error:", err);
  initError = err.message;
}

const PROJECT_ID = "fridaynightfootball-ba9c1";
const COLLECTIONS = {
  PLAYERS: 'players',
  MATCHES: 'matches',
  SETTINGS: 'settings',
  CHECKINS: 'checkins'
};

const ACCESS_CODE_PLAYER = "FRIDAY";
const ACCESS_CODE_ADMIN = "ADMIN123";

// --- 2. Utilities ---

const mapRating = (val) => {
  if (!val) return 60;
  const base = 35 + (val * 12);
  return Math.min(Math.round(base + (val > 4.5 ? 4 : 0)), 99);
};

// Calculate stats dynamically from a list of matches
const calculateStatsFromMatches = (player, matches) => {
  let stats = {
    goals: 0,
    wins: 0,
    gamesPlayed: 0,
    assists: 0,
    cleanSheets: 0,
    goalsFor: 0,
    goalsAgainst: 0
  };

  matches.forEach(m => {
    const pStats = m.stats && m.stats[player.id];
    if (pStats) {
      stats.gamesPlayed++;
      stats.goals += (pStats.goals || 0);
      stats.wins += (pStats.win || 0);
      stats.assists += (pStats.assists || 0);
      if (pStats.cleanSheet) stats.cleanSheets++;
      stats.goalsFor += (pStats.goalsFor || 0);
      stats.goalsAgainst += (pStats.goalsAgainst || 0);
    }
  });

  return stats;
};

const calculateOverall = (player, statsOverride = null) => {
  if (player.ratings) {
    const { fitness, control, shooting, defense } = player.ratings;
    const avg = (fitness * 1.0 + control * 1.2 + shooting * 1.0 + defense * 0.8) / 4;
    return mapRating(avg);
  }

  const goals = statsOverride ? statsOverride.goals : player.goals;
  const wins = statsOverride ? statsOverride.wins : player.wins;
  const gamesPlayed = statsOverride ? statsOverride.gamesPlayed : player.gamesPlayed;

  const assists = statsOverride ? (statsOverride.assists || 0) : 0;
  const cleanSheets = statsOverride ? (statsOverride.cleanSheets || 0) : 0;

  if (!gamesPlayed || gamesPlayed === 0) return 60;

  const goalsPerGame = goals / gamesPlayed;
  const assistsPerGame = assists / gamesPlayed;
  const csPerGame = cleanSheets / gamesPlayed;
  const winRate = wins / gamesPlayed;

  let rating = 60 + (goalsPerGame * 15) + (assistsPerGame * 10) + (csPerGame * 10) + (winRate * 20);
  return Math.min(Math.round(rating), 99);
};

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

const SEED_DATA = [
  { name: "Amar", gamesPlayed: 102, goals: 53, wins: 57, ratings: { fitness: 3.6, control: 3.6, shooting: 3.6, defense: 3.6 } },
  { name: "JT", gamesPlayed: 68, goals: 46, wins: 32, ratings: { fitness: 3.6, control: 3.6, shooting: 3.6, defense: 3.6 } },
  { name: "Johann", gamesPlayed: 67, goals: 43, wins: 30.5 },
  { name: "Nico", gamesPlayed: 65, goals: 37, wins: 35 },
  { name: "Jarrad", gamesPlayed: 50, goals: 35, wins: 20, ratings: { fitness: 3.1, control: 3.1, shooting: 3.1, defense: 3.1 } },
  { name: "Duncan", gamesPlayed: 58, goals: 29, wins: 35 },
  { name: "Tim", gamesPlayed: 51, goals: 36, wins: 36, ratings: { fitness: 4.0, control: 4.0, shooting: 4.0, defense: 4.0 } },
  { name: "Weylu", gamesPlayed: 49, goals: 23, wins: 23 },
  { name: "Wafik", gamesPlayed: 35, goals: 11, wins: 17 },
  { name: "Derek", gamesPlayed: 31, goals: 1, wins: 15 },
  { name: "G", gamesPlayed: 26, goals: 28, wins: 13 },
  { name: "Zoran", gamesPlayed: 22, goals: 3, wins: 11 },
  { name: "Travers", gamesPlayed: 20, goals: 1, wins: 10 },
  { name: "Kristof", gamesPlayed: 16, goals: 15, wins: 8 },
  { name: "Josh", gamesPlayed: 14, goals: 14, wins: 7 },
  { name: "Greg", gamesPlayed: 14, goals: 4, wins: 4.5 },
  { name: "Figo", gamesPlayed: 13, goals: 25, wins: 9, ratings: { fitness: 4.5, control: 4.5, shooting: 4.5, defense: 4.5 } },
  { name: "Gino", gamesPlayed: 13, goals: 1, wins: 6.5 },
  { name: "Oz", gamesPlayed: 11, goals: 3, wins: 3.5 },
  { name: "Max", gamesPlayed: 10, goals: 3, wins: 5 },
  { name: "Dorian", gamesPlayed: 8, goals: 1, wins: 4 },
  { name: "Olly", gamesPlayed: 7, goals: 2, wins: 3.5 },
  { name: "Austin", gamesPlayed: 7, goals: 2, wins: 3.5 },
  { name: "Vin", gamesPlayed: 7, goals: 2, wins: 3.5 },
  { name: "Johnny", gamesPlayed: 5, goals: 5, wins: 4 },
  { name: "Drew", gamesPlayed: 4, goals: 6, wins: 3 },
  { name: "Sal", gamesPlayed: 4, goals: 5, wins: 2 },
  { name: "Jeff", gamesPlayed: 3, goals: 1, wins: 2 },
  { name: "Gabe D", gamesPlayed: 3, goals: 2, wins: 2 },
  { name: "Bruce", gamesPlayed: 3, goals: 1, wins: 1 },
  { name: "Gary", gamesPlayed: 3, goals: 1, wins: 1 },
  { name: "Hadi", gamesPlayed: 3, goals: 1, wins: 0 },
  { name: "Carter", gamesPlayed: 3, goals: 1, wins: 0 },
  { name: "Mike", gamesPlayed: 3, goals: 1, wins: 0 },
  { name: "Dante", gamesPlayed: 3, goals: 1, wins: 0 },
  { name: "Jonathan", gamesPlayed: 2, goals: 3, wins: 1 },
  { name: "Rachael", gamesPlayed: 2, goals: 0, wins: 1 },
  { name: "Anh", gamesPlayed: 2, goals: 0, wins: 1 },
  { name: "Santi", gamesPlayed: 1, goals: 2, wins: 0 },
  { name: "Italian", gamesPlayed: 1, goals: 2, wins: 0 },
  { name: "Carlos", gamesPlayed: 0, goals: 0, wins: 0, ratings: { fitness: 4.8, control: 4.8, shooting: 4.8, defense: 4.8 } },
  { name: "Jared", gamesPlayed: 4, goals: 0, wins: 2, ratings: { fitness: 3.6, control: 3.6, shooting: 3.6, defense: 3.6 } },
];

// --- 3. Components ---

const LoginScreen = ({ onLogin }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanCode = code.toUpperCase().trim();
    if (cleanCode === ACCESS_CODE_PLAYER) {
      onLogin('player');
    } else if (cleanCode === ACCESS_CODE_ADMIN) {
      onLogin('admin');
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-950 to-slate-950 -z-10"></div>
      <div className="text-center mb-10">
        <Trophy size={48} className="text-yellow-500 drop-shadow-lg mx-auto mb-4" />
        <h1 className="text-4xl font-black uppercase italic tracking-widest text-white mb-2">Friday<span className="text-green-500">FUT</span></h1>
      </div>
      <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ENTER CODE" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 text-center text-xl font-bold tracking-widest text-white uppercase" />
          <button type="submit" className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg">Unlock</button>
          {error && <p className="text-red-500 text-xs text-center font-bold">Invalid Code</p>}
        </form>
      </div>
    </div>
  );
};

const PlayerCard = ({ player, rank, onUploadClick, onEditRatings, canEdit, seasonStats }) => {
  const statsToUse = seasonStats || player;
  const overall = calculateOverall(player, seasonStats);
  const { ratings } = player;

  const pace = ratings ? mapRating(ratings.fitness) : (80 + Math.min(statsToUse.gamesPlayed || 0, 19));
  const dri = ratings ? mapRating(ratings.control) : (Math.min(99, 70 + (statsToUse.wins || 0)));
  const sho = ratings ? mapRating(ratings.shooting) : (Math.min(99, 60 + (statsToUse.goals || 0) * 2));
  const def = ratings ? mapRating(ratings.defense) : (Math.min(99, 50 + (statsToUse.gamesPlayed || 0)));
  const pas = ratings ? mapRating(ratings.control) : 65;
  const phy = ratings ? mapRating(ratings.defense) : (Math.min(99, 75 + (statsToUse.wins || 0)));

  const getCardStyle = () => {
    if (rank === 1) return "bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-600 border-yellow-300 text-slate-900";
    if (rank === 2) return "bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 border-slate-300 text-slate-900";
    if (rank === 3) return "bg-gradient-to-b from-orange-200 via-orange-300 to-orange-400 border-orange-300 text-slate-900";
    return "bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-slate-600 text-white";
  };
  const textColor = rank <= 3 ? "text-slate-900" : "text-white";
  const labelColor = rank <= 3 ? "text-slate-800" : "text-slate-400";

  return (
    <div className={`relative w-full aspect-[2/3] rounded-t-xl rounded-b-lg p-1 shadow-xl transition-all hover:scale-105 ${getCardStyle()}`}>
      <div className={`h-full w-full border-2 ${rank <= 3 ? "border-white/40" : "border-yellow-500/30"} rounded-lg relative flex flex-col p-3 overflow-hidden`}>
        <div className="flex justify-between items-start mb-2 relative z-20">
          <div className="flex flex-col items-center"><span className={`text-3xl font-bold leading-none ${textColor}`}>{overall}</span><span className={`text-xs font-bold uppercase ${labelColor}`}>CAM</span></div>
          <div className="opacity-90">
            {canEdit && <button onClick={(e) => { e.stopPropagation(); onEditRatings(); }} className="bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition-colors"><Sliders size={16} /></button>}
          </div>
        </div>
        <div className="flex-grow flex items-end justify-center -mb-4 relative z-10 group">
          {player.photoUrl ? <img src={player.photoUrl} alt={player.name} className="h-32 w-32 object-cover object-top mask-image-gradient" style={{ maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)' }} /> : <Users size={80} className={`${rank <= 3 ? "text-slate-900" : "text-slate-400"} opacity-90`} />}
          {onUploadClick && <button onClick={(e) => { e.stopPropagation(); onUploadClick(); }} className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"><Camera className="text-white drop-shadow-lg" size={32} /></button>}
        </div>
        <div className="relative z-20 text-center mb-3"><h3 className={`font-black uppercase tracking-wider text-lg truncate ${textColor} border-b-2 ${rank <= 3 ? "border-slate-900/10" : "border-yellow-500/20"} pb-1`}>{player.name}</h3></div>
        <div className={`grid grid-cols-2 gap-x-2 gap-y-1 text-sm font-bold ${textColor}`}>
          <div className="flex items-center justify-between"><span className={labelColor}>PAC</span><span>{pace}</span></div>
          <div className="flex items-center justify-between"><span className={labelColor}>DRI</span><span>{dri}</span></div>
          <div className="flex items-center justify-between"><span className={labelColor}>SHO</span><span>{sho}</span></div>
          <div className="flex items-center justify-between"><span className={labelColor}>DEF</span><span>{def}</span></div>
          <div className="flex items-center justify-between"><span className={labelColor}>PAS</span><span>{pas}</span></div>
          <div className="flex items-center justify-between"><span className={labelColor}>PHY</span><span>{phy}</span></div>
        </div>
      </div>
    </div>
  );
};

const LeaderboardRow = ({ player, rank, overall, stats }) => (
  <div className="group flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700 last:border-0 hover:bg-slate-750 transition-colors">
    <div className="flex items-center gap-4">
      <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${rank === 1 ? 'bg-yellow-500 text-slate-900' : rank === 2 ? 'bg-slate-300 text-slate-900' : rank === 3 ? 'bg-orange-400 text-slate-900' : 'bg-slate-700 text-slate-400'}`}>{rank}</div>
      <div><div className="font-bold text-white text-lg">{player.name}</div><div className="text-xs text-slate-400 flex gap-2"><span>{stats ? stats.gamesPlayed : (player.gamesPlayed || 0)} Matches</span><span className="text-slate-600">•</span><span className="text-green-400">{stats ? stats.wins : (player.wins || 0)} Wins</span></div></div>
    </div>
    <div className="flex items-center gap-6">
      <div className="text-center hidden sm:block"><div className="text-xs text-slate-500 uppercase font-bold">Goals</div><div className="text-white font-mono text-lg">{stats ? stats.goals : (player.goals || 0)}</div></div>
      <div className="text-center bg-slate-900 p-2 rounded-lg border border-slate-700 min-w-[60px]"><div className="text-[10px] text-slate-500 uppercase font-bold">OVR</div><div className={`font-black text-xl ${overall >= 80 ? 'text-yellow-400' : overall >= 70 ? 'text-green-400' : 'text-slate-200'}`}>{overall}</div></div>
    </div>
  </div>
);

const StatsView = ({ players, matches, onSelectPlayer }) => {
  const [sortField, setSortField] = useState('overall');
  const [sortDesc, setSortDesc] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('all');

  const filteredMatches = useMemo(() => {
    if (filterYear === 'all') return matches;
    return matches.filter(m => {
      if (!m.date) return false;
      const date = new Date(m.date.seconds * 1000);
      return date.getFullYear() === 2026;
    });
  }, [matches, filterYear]);

  const processedPlayers = useMemo(() => {
    return players.map(p => {
      let dynamicStats = { goals: 0, wins: 0, gamesPlayed: 0, assists: 0, cleanSheets: 0, goalContrib: 0, goalsFor: 0, goalsAgainst: 0 };

      if (filterYear === '2026') {
        dynamicStats = calculateStatsFromMatches(p, filteredMatches);
        dynamicStats.goalContrib = dynamicStats.goals + dynamicStats.assists;
      } else {
        dynamicStats = {
          goals: p.goals || 0,
          wins: p.wins || 0,
          gamesPlayed: p.gamesPlayed || 0,
          assists: 0,
          cleanSheets: 0,
          goalContrib: (p.goals || 0),
          goalsFor: 0,
          goalsAgainst: 0
        };
      }

      return {
        ...p,
        ...dynamicStats,
        winRate: dynamicStats.gamesPlayed > 0 ? (dynamicStats.wins / dynamicStats.gamesPlayed) * 100 : 0,
        goalsPerGame: dynamicStats.gamesPlayed > 0 ? dynamicStats.goals / dynamicStats.gamesPlayed : 0,
        overall: calculateOverall(p, dynamicStats)
      };
    }).filter(p => filterYear === 'all' || p.gamesPlayed > 0);
  }, [players, filteredMatches, filterYear]);

  const sortedData = useMemo(() => {
    let data = [...processedPlayers];
    if (searchTerm) {
      data = data.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    data.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      if (sortDesc) return valA < valB ? 1 : -1;
      return valA > valB ? 1 : -1;
    });
    return data;
  }, [processedPlayers, sortField, sortDesc, searchTerm]);

  const handleSort = (field) => {
    if (sortField === field) setSortDesc(!sortDesc);
    else { setSortField(field); setSortDesc(true); }
  };

  const SortHeader = ({ field, label }) => (
    <th className="p-3 text-left cursor-pointer hover:text-white transition-colors" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </div>
    </th>
  );

  return (
    <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 flex flex-col h-full max-h-[80vh]">
      <div className="p-4 border-b border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="text-blue-400" /> Stats
          </h2>
          <div className="flex bg-slate-900 rounded-lg p-1">
            <button onClick={() => setFilterYear('all')} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${filterYear === 'all' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>All Time</button>
            <button onClick={() => setFilterYear('2026')} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${filterYear === '2026' ? 'bg-green-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>2026</button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-500" size={18} />
          <input type="text" placeholder="Find a player..." className="w-full bg-slate-900 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-700 focus:border-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="overflow-auto flex-1">
        <table className="w-full text-sm text-slate-300">
          <thead className="bg-slate-900 text-slate-500 uppercase font-bold text-xs sticky top-0 z-10">
            <tr>
              <SortHeader field="name" label="Player" />
              <SortHeader field="gamesPlayed" label="GP" />
              <SortHeader field="wins" label="Wins" />
              <SortHeader field="winRate" label="Win %" />
              <SortHeader field="goals" label="G" />
              {filterYear === '2026' && <SortHeader field="assists" label="A" />}
              {filterYear === '2026' && <SortHeader field="goalContrib" label="G+A" />}
              {filterYear === '2026' && <SortHeader field="cleanSheets" label="CS" />}
              {filterYear === '2026' && <SortHeader field="goalsFor" label="GF" />}
              {filterYear === '2026' && <SortHeader field="goalsAgainst" label="GA" />}
              <SortHeader field="overall" label="OVR" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {sortedData.map(p => (
              <tr key={p.id} onClick={() => onSelectPlayer(p)} className="hover:bg-slate-700/50 cursor-pointer transition-colors">
                <td className="p-3 font-bold text-white">{p.name}</td>
                <td className="p-3">{p.gamesPlayed}</td>
                <td className="p-3 text-green-400">{p.wins % 1 === 0 ? p.wins : p.wins.toFixed(1)}</td>
                <td className="p-3">{p.winRate.toFixed(1)}%</td>
                <td className="p-3 text-white">{p.goals}</td>
                {filterYear === '2026' && <td className="p-3">{p.assists}</td>}
                {filterYear === '2026' && <td className="p-3 text-blue-400 font-bold">{p.goalContrib}</td>}
                {filterYear === '2026' && <td className="p-3 text-yellow-400">{p.cleanSheets}</td>}
                {filterYear === '2026' && <td className="p-3">{p.goalsFor}</td>}
                {filterYear === '2026' && <td className="p-3">{p.goalsAgainst}</td>}
                <td className="p-3 font-bold text-yellow-500">{p.overall}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortedData.length === 0 && <div className="p-8 text-center text-slate-500">No players found.</div>}
      </div>
    </div>
  );
};

const MatchLogger = ({ players, onSave, onCancel }) => {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [matchData, setMatchData] = useState({});
  const [teamBluePlayers, setTeamBluePlayers] = useState([]);
  const [teamWhitePlayers, setTeamWhitePlayers] = useState([]);
  const [blueScore, setBlueScore] = useState(0);
  const [whiteScore, setWhiteScore] = useState(0);

  const togglePlayer = (playerId) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(prev => prev.filter(id => id !== playerId));
      const newData = { ...matchData }; delete newData[playerId]; setMatchData(newData);
    } else {
      setSelectedPlayers(prev => [...prev, playerId]);
      // Default to blue team
      setMatchData(prev => ({ ...prev, [playerId]: { goals: 0, assists: 0, team: 'blue' } }));
    }
  };

  const switchTeam = (playerId, newTeam) => {
    setMatchData(prev => ({ ...prev, [playerId]: { ...prev[playerId], team: newTeam } }));
  };

  const updateStat = (playerId, field, value) => {
    setMatchData(prev => ({ ...prev, [playerId]: { ...prev[playerId], [field]: value } }));
  };

  const handleFinalize = (e) => {
    e.preventDefault();
    const blueWin = blueScore > whiteScore ? 1 : (blueScore === whiteScore ? 0.5 : 0);
    const whiteWin = whiteScore > blueScore ? 1 : (whiteScore === blueScore ? 0.5 : 0);
    const blueClean = whiteScore === 0;
    const whiteClean = blueScore === 0;

    const finalData = {};
    selectedPlayers.forEach(pid => {
      const pData = matchData[pid];
      const isBlue = pData.team === 'blue';
      finalData[pid] = {
        ...pData,
        win: isBlue ? blueWin : whiteWin,
        goalsFor: isBlue ? blueScore : whiteScore,
        goalsAgainst: isBlue ? whiteScore : blueScore,
        cleanSheet: isBlue ? blueClean : whiteClean
      };
    });
    onSave(finalData);
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 shadow-2xl border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Activity className="text-green-400" /> Log 2026 Match</h2>

      <div className="mb-6"><label className="block text-slate-400 text-sm font-bold mb-2 uppercase">Who Played?</label><div className="flex flex-wrap gap-2">{players.map(p => (<button key={p.id} type="button" onClick={() => togglePlayer(p.id)} className={`px-4 py-2 rounded-full font-bold text-sm transition-all ${selectedPlayers.includes(p.id) ? 'bg-green-500 text-white shadow-lg' : 'bg-slate-700 text-slate-400'}`}>{p.name}</button>))}</div></div>

      {selectedPlayers.length > 0 && (
        <>
          <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-700 mb-6">
            <div className="text-center">
              <h3 className="text-blue-400 font-bold uppercase mb-2">Blue Team</h3>
              <input type="number" value={blueScore} onChange={(e) => setBlueScore(parseInt(e.target.value) || 0)} className="w-16 h-16 text-center text-3xl font-black bg-slate-800 text-white rounded-lg border border-blue-500" />
            </div>
            <div className="text-slate-500 font-black text-xl">VS</div>
            <div className="text-center">
              <h3 className="text-white font-bold uppercase mb-2">White Team</h3>
              <input type="number" value={whiteScore} onChange={(e) => setWhiteScore(parseInt(e.target.value) || 0)} className="w-16 h-16 text-center text-3xl font-black bg-slate-800 text-white rounded-lg border border-white" />
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {selectedPlayers.map(pid => {
              const player = players.find(p => p.id === pid);
              const stats = matchData[pid];
              const isBlue = stats.team === 'blue';

              return (
                <div key={pid} className={`grid grid-cols-4 gap-2 items-center p-3 rounded-lg border ${isBlue ? 'bg-blue-900/20 border-blue-500/30' : 'bg-slate-700/50 border-white/30'}`}>
                  <div className="col-span-1">
                    <span className="font-bold text-white block truncate">{player.name}</span>
                    <button onClick={() => switchTeam(pid, isBlue ? 'white' : 'blue')} className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded mt-1 ${isBlue ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-900'}`}>{isBlue ? 'Blue' : 'White'}</button>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 uppercase">Goals</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateStat(pid, 'goals', Math.max(0, stats.goals - 1))} className="w-6 h-6 rounded bg-slate-600 text-white">-</button>
                      <span className="w-4 text-center text-white font-mono">{stats.goals}</span>
                      <button type="button" onClick={() => updateStat(pid, 'goals', stats.goals + 1)} className="w-6 h-6 rounded bg-green-600 text-white">+</button>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 uppercase">Assists</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateStat(pid, 'assists', Math.max(0, stats.assists - 1))} className="w-6 h-6 rounded bg-slate-600 text-white">-</button>
                      <span className="w-4 text-center text-white font-mono">{stats.assists}</span>
                      <button type="button" onClick={() => updateStat(pid, 'assists', stats.assists + 1)} className="w-6 h-6 rounded bg-blue-600 text-white">+</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="flex gap-4"><button type="submit" onClick={handleFinalize} disabled={selectedPlayers.length === 0} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50">Save Match Result</button><button type="button" onClick={onCancel} className="px-6 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600">Cancel</button></div>
    </div>
  );
};

const LegacyImporter = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState('upload');
  const [parsedData, setParsedData] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const results = analyzeCSV(text);
        results.sort((a, b) => b.games - a.games);
        setParsedData(results);
        setStep('preview');
      } catch (err) {
        console.error(err);
        setErrorMsg("Could not parse file. Ensure it is the 'Player Stats.csv' export.");
        setStep('error');
      }
    };
    reader.readAsText(file);
  };

  const analyzeCSV = (csvText) => {
    const lines = csvText.split(/\r?\n/).map(line => line.split(','));
    let nameRowIndex = 2;
    let dataStartIndex = 3;
    if (lines.length < 5) throw new Error("File too short");
    const nameRow = lines[nameRowIndex];
    const playersMap = {};

    for (let i = 0; i < nameRow.length; i += 3) {
      const name = nameRow[i]?.trim();
      if (name && name.length > 1 && name.toLowerCase() !== 'date') {
        playersMap[i] = { name: name, goals: 0, wins: 0, games: 0 };
      }
    }

    for (let r = dataStartIndex; r < lines.length; r++) {
      const row = lines[r];
      Object.keys(playersMap).forEach(idxStr => {
        const idx = parseInt(idxStr);
        const dateVal = row[idx];
        const goalsVal = row[idx + 1];
        const winsVal = row[idx + 2];
        const isValidDate = dateVal && (dateVal.includes('-') || dateVal.includes('/')) && !isNaN(parseInt(dateVal[0]));
        if (isValidDate) {
          const p = playersMap[idx];
          p.games++;
          const g = parseFloat(goalsVal); if (!isNaN(g)) p.goals += g;
          const w = parseFloat(winsVal); if (!isNaN(w)) p.wins += w;
        }
      });
    }
    return Object.values(playersMap);
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
        if (existing) {
          const ref = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, existing.id);
          batch.update(ref, { goals: p.goals, wins: p.wins, gamesPlayed: p.games, assists: existing.assists || 0 });
        } else {
          const newRef = doc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS));
          batch.set(newRef, { name: p.name, goals: p.goals, wins: p.wins, gamesPlayed: p.games, assists: 0, createdAt: serverTimestamp() });
        }
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
      <div className="bg-slate-800 rounded-2xl max-w-2xl w-full p-6 border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><FileUp className="text-blue-400" /> Import Tool</h3>
        {step === 'upload' && (
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-slate-400 text-sm mb-6">Upload the <strong>'Player Stats.csv'</strong> file.</p>
            <div className="border-2 border-dashed border-slate-600 rounded-xl p-12 text-center hover:border-blue-500 transition-colors bg-slate-900/50">
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="csvInput" />
              <label htmlFor="csvInput" className="cursor-pointer flex flex-col items-center">
                <FileUp className="text-slate-500 mb-4" size={48} /><span className="text-blue-400 font-bold text-lg hover:underline">Click to upload CSV</span>
              </label>
            </div>
            <button onClick={onCancel} className="mt-8 text-slate-500 font-bold hover:text-white">Cancel</button>
          </div>
        )}
        {step === 'preview' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <p className="text-green-400 font-bold mb-4">Found {parsedData.length} Players. Please check the data:</p>
            <div className="flex-1 overflow-y-auto border border-slate-700 rounded-lg bg-slate-900/50 mb-6">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800 text-slate-400 uppercase font-bold sticky top-0"><tr><th className="p-3">Player</th><th className="p-3 text-center">Games</th><th className="p-3 text-center">Goals</th><th className="p-3 text-center">Wins</th></tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {parsedData.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50">
                      <td className="p-3 font-bold text-white">{p.name}</td><td className="p-3 text-center font-mono">{p.games}</td><td className="p-3 text-center font-mono text-green-400">{p.goals}</td><td className="p-3 text-center font-mono text-yellow-500">{p.wins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-4"><button onClick={confirmImport} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold">Import Everything</button><button onClick={() => setStep('upload')} className="px-6 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600">Back</button></div>
          </div>
        )}
        {step === 'processing' && (
          <div className="flex-1 flex flex-col items-center justify-center p-12"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-6"></div><h4 className="text-xl font-bold text-white">Saving to Database...</h4></div>
        )}
        {step === 'complete' && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center"><CheckCircle2 className="text-green-500 mb-4" size={64} /><h4 className="text-2xl font-bold text-white mb-2">Import Successful!</h4><button onClick={onComplete} className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold">Return to Dashboard</button></div>
        )}
        {step === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center"><AlertCircle className="text-red-500 mb-4" size={64} /><h4 className="text-xl font-bold text-white mb-2">Something went wrong</h4><p className="text-red-400 mb-8">{errorMsg}</p><button onClick={() => setStep('upload')} className="bg-slate-700 text-white px-8 py-3 rounded-xl font-bold">Try Again</button></div>
        )}
      </div>
    </div>
  );
};

const CheckInSystem = ({ players, currentUserRole }) => {
  const [checkins, setCheckins] = useState([]);
  const [settings, setSettings] = useState({ unlockTime: null });
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [unlockTimeInput, setUnlockTimeInput] = useState('');

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
      await addDoc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.CHECKINS), {
        playerId: selectedPlayer,
        name: players.find(p => p.id === selectedPlayer)?.name || 'Unknown',
        timestamp: serverTimestamp()
      });
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

    // FIX: ADDED VALIDATION HERE
    if (!unlockTimeInput) {
      alert("Please select a date and time.");
      return;
    }

    try {
      const date = new Date(unlockTimeInput);

      // FIX: CHECK IF DATE IS VALID
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
        <div className="flex gap-2 mb-6">
          <select
            className="flex-1 bg-slate-900 text-white p-3 rounded-lg border border-slate-700"
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
          >
            <option value="">Select Your Name...</option>
            {players
              .filter(p => !checkins.some(c => c.playerId === p.id))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(p => <option key={p.id} value={p.id}>{p.name}</option>)
            }
          </select>
          <button onClick={handleCheckIn} disabled={!selectedPlayer} className="bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2">
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

const TeamGenerator = ({ players }) => {
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
        <button onClick={generateTeams} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg">
          <Shuffle size={16} /> AI Generate
        </button>
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

// --- 4. Main Application ---
export default function FridayNightFUT() {
  const [authStatus, setAuthStatus] = useState({ loggedIn: false, role: 'player' });
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [checkins, setCheckins] = useState([]); // New State for Checkins
  const [loading, setLoading] = useState(true);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [showImporter, setShowImporter] = useState(false);
  const [selectedPlayerForEdit, setSelectedPlayerForEdit] = useState(null);
  const [filterCheckedIn, setFilterCheckedIn] = useState(false); // New Filter State
  const [quickAddPlayer, setQuickAddPlayer] = useState(''); // New Quick Add State

  // NEW: State for Editing Ratings
  const [showRatingsModal, setShowRatingsModal] = useState(false);
  const [ratingsForm, setRatingsForm] = useState({ fitness: 3, control: 3, shooting: 3, defense: 3 });

  useEffect(() => {
    const savedAccess = localStorage.getItem('friday_fut_access');
    const savedRole = localStorage.getItem('friday_fut_role');
    if (savedAccess === 'granted') {
      setAuthStatus({ loggedIn: true, role: savedRole || 'player' });
    }
    const doAuth = async () => { try { await signInAnonymously(auth); } catch (err) { } };
    doAuth();
    return onAuthStateChanged(auth, (u) => { setUser(u); if (u) setLoading(false); });
  }, []);

  useEffect(() => {
    if (!user || !authStatus.loggedIn) return;
    const qPlayers = query(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS));
    const unsubPlayers = onSnapshot(qPlayers, (snapshot) => {
      setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    const qMatches = query(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.MATCHES));
    const unsubMatches = onSnapshot(qMatches, (snapshot) => {
      const mList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      mList.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
      setMatches(mList);
    });

    // Also listen to checkins globally so we can show badges
    const qCheckins = query(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.CHECKINS), orderBy("timestamp", "asc"));
    const unsubCheckins = onSnapshot(qCheckins, (snapshot) => {
      setCheckins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubPlayers(); unsubMatches(); unsubCheckins(); };
  }, [user, authStatus.loggedIn]);

  const handleLogin = (role) => {
    setAuthStatus({ loggedIn: true, role: role });
    localStorage.setItem('friday_fut_access', 'granted');
    localStorage.setItem('friday_fut_role', role);
  };

  const handleLogout = () => {
    setAuthStatus({ loggedIn: false, role: 'player' });
    localStorage.removeItem('friday_fut_access');
    localStorage.removeItem('friday_fut_role');
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !user) return;
    await addDoc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS), { name: newPlayerName.trim(), goals: 0, assists: 0, wins: 0, gamesPlayed: 0, createdAt: serverTimestamp() });
    setNewPlayerName('');
  };

  // NEW: Quick Add from SEED_DATA with UPDATE logic
  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!quickAddPlayer || !user) return;

    const seedPlayer = SEED_DATA.find(p => p.name === quickAddPlayer);
    if (!seedPlayer) return;

    // Check if player already exists in the database
    const existingPlayer = players.find(p => p.name.toLowerCase() === seedPlayer.name.toLowerCase());

    try {
      if (existingPlayer) {
        // Update existing player with historical stats (merge)
        const ref = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, existingPlayer.id);
        await updateDoc(ref, {
          goals: seedPlayer.goals,
          wins: seedPlayer.wins,
          gamesPlayed: seedPlayer.gamesPlayed
        });
        alert(`Updated ${seedPlayer.name}'s stats!`);
      } else {
        // Create new player
        await addDoc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS), {
          ...seedPlayer,
          assists: 0,
          createdAt: serverTimestamp()
        });
        alert(`Added ${seedPlayer.name} to the squad!`);
      }
      setQuickAddPlayer('');
    } catch (err) {
      console.error("Quick add failed", err);
    }
  };

  const handleSaveMatch = async (matchData) => {
    await addDoc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.MATCHES), { date: serverTimestamp(), stats: matchData, createdBy: user.uid });
    const playerIds = Object.keys(matchData);
    for (const pid of playerIds) {
      const stats = matchData[pid];
      const player = players.find(p => p.id === pid);
      if (player) {
        const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, pid);
        await updateDoc(playerRef, { goals: (player.goals || 0) + stats.goals, assists: (player.assists || 0) + stats.assists, wins: (player.wins || 0) + (stats.win ? 1 : 0), gamesPlayed: (player.gamesPlayed || 0) + 1 });
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
        // UPDATE existing (merge stats)
        const ref = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, existing.id);
        batch.update(ref, {
          goals: p.goals,
          wins: p.wins,
          gamesPlayed: p.gamesPlayed
        });
        count++;
      } else {
        // CREATE new
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

  // Save edited ratings
  const handleSaveRatings = async () => {
    if (!selectedPlayerForEdit) return;
    const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, selectedPlayerForEdit.id);
    await updateDoc(playerRef, { ratings: ratingsForm });

    // Update local state for immediate feedback
    setSelectedPlayerForEdit({ ...selectedPlayerForEdit, ratings: ratingsForm });
    setShowRatingsModal(false);
  };

  const sortedPlayers = useMemo(() => [...players].sort((a, b) => calculateOverall(b) - calculateOverall(a)), [players]);

  // Derived Filtered List for Squad View
  const squadDisplayPlayers = useMemo(() => {
    if (!filterCheckedIn) return players;
    return players.filter(p => checkins.some(c => c.playerId === p.id));
  }, [players, checkins, filterCheckedIn]);

  // Helper to check status
  const getPlayerStatus = (playerId) => {
    const index = checkins.findIndex(c => c.playerId === playerId);
    if (index === -1) return null;
    if (index < 12) return 'in'; // Starting 12
    return 'waitlist'; // > 12
  };

  // Players Available for Quick Add (SHOW ALL LEGENDS, even if in DB, to allow updates)
  const availableLegends = useMemo(() => {
    // Sort names alphabetically
    return SEED_DATA.map(s => s.name).sort();
  }, []);

  if (!authStatus.loggedIn) return <LoginScreen onLogin={handleLogin} />;
  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-2xl">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2"><Trophy className="text-yellow-500" /><h1 className="text-xl font-black uppercase tracking-widest text-white italic">Friday<span className="text-green-500">FUT</span></h1></div>
          <div className="flex items-center gap-2">
            {authStatus.role === 'admin' && <div className="bg-yellow-500 text-slate-900 text-xs font-bold px-2 py-1 rounded">ADMIN</div>}
            {authStatus.role === 'admin' && <button onClick={() => setView('add-match')} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"><Plus size={16} /> Match</button>}
            <button onClick={handleLogout} className="text-slate-500 hover:text-white"><Lock size={16} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {view === 'dashboard' && (
          <div className="space-y-12">
            <CheckInSystem players={players} currentUserRole={authStatus.role} />
            <section>
              <h2 className="text-slate-400 font-bold uppercase tracking-wider text-sm mb-4 flex items-center gap-2"><Zap size={16} /> Current Form Leaders</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
                <div className="md:order-2 transform md:-translate-y-4 z-10">{sortedPlayers[0] && <PlayerCard player={sortedPlayers[0]} rank={1} />}</div>
                <div className="md:order-1 transform md:translate-y-4">{sortedPlayers[1] && <PlayerCard player={sortedPlayers[1]} rank={2} />}</div>
                <div className="hidden md:block md:order-3 transform md:translate-y-8">{sortedPlayers[2] && <PlayerCard player={sortedPlayers[2]} rank={3} />}</div>
                <div className="block md:hidden col-span-2 sm:col-span-1 mx-auto w-1/2 sm:w-full">{sortedPlayers[2] && <PlayerCard player={sortedPlayers[2]} rank={3} />}</div>
              </div>
            </section>
            <section>
              <div className="flex justify-between items-end mb-4"><h2 className="text-slate-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2"><TrendingUp size={16} /> Season Standings</h2></div>
              <div className="bg-slate-800 rounded-xl overflow-hidden shadow-xl border border-slate-700">
                {sortedPlayers.map((player, idx) => (
                  <div key={player.id} onClick={() => { if (authStatus.role === 'admin') setSelectedPlayerForEdit(player); }} className={`${authStatus.role === 'admin' ? 'cursor-pointer' : ''}`}>
                    <LeaderboardRow player={player} rank={idx + 1} overall={calculateOverall(player)} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === 'add-match' && authStatus.role === 'admin' && <MatchLogger players={players} onSave={handleSaveMatch} onCancel={() => setView('dashboard')} />}

        {view === 'teams' && authStatus.role === 'admin' && <TeamGenerator players={players} />}

        {view === 'stats' && <StatsView players={players} matches={matches} onSelectPlayer={(p) => setSelectedPlayerForEdit(p)} />}

        {view === 'players' && (
          <div className="bg-slate-800 rounded-xl p-6 shadow-2xl border border-slate-700">
            <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
              <h2 className="text-2xl font-bold text-white">Squad</h2>
              <div className="flex gap-2">
                <button onClick={() => setFilterCheckedIn(!filterCheckedIn)} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex gap-2 border ${filterCheckedIn ? 'bg-green-500/20 text-green-400 border-green-500' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                  <Filter size={16} /> {filterCheckedIn ? 'Show All' : 'Show Checked In'}
                </button>
                {authStatus.role === 'admin' && (
                  <>
                    <button onClick={handleSeedData} className="bg-yellow-600/20 text-yellow-400 px-3 py-1.5 rounded-lg text-sm font-bold flex gap-2"><Zap size={16} /> Load All History</button>
                    <button onClick={() => setShowImporter(true)} className="bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-lg text-sm font-bold flex gap-2"><FileUp size={16} /> Import CSV</button>
                  </>
                )}
              </div>
            </div>

            {/* UPDATED: Add Player Form with Quick Select */}
            {authStatus.role === 'admin' && (
              <div className="mb-8 p-4 bg-slate-900 rounded-lg border border-slate-700">
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Add New Player</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Quick Add Legend */}
                  <form onSubmit={handleQuickAdd} className="flex gap-2">
                    <select
                      className="flex-1 bg-slate-800 text-white p-2 rounded border border-slate-600 text-sm"
                      value={quickAddPlayer}
                      onChange={(e) => setQuickAddPlayer(e.target.value)}
                    >
                      <option value="">Select a Legend...</option>
                      {availableLegends.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <button type="submit" disabled={!quickAddPlayer} className="bg-blue-600 disabled:opacity-50 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-1">
                      <UserPlus size={16} /> Add/Update
                    </button>
                  </form>

                  {/* Manual Add */}
                  <form onSubmit={handleAddPlayer} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Or type new name..."
                      className="flex-1 bg-slate-800 border border-slate-600 text-white px-4 py-2 rounded text-sm"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                    />
                    <button type="submit" disabled={!newPlayerName} className="bg-green-600 disabled:opacity-50 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold">
                      Create
                    </button>
                  </form>
                </div>
                <p className="text-xs text-slate-500 mt-2 italic">Tip: Typing a Legend's name in the "Type new name" box will also automatically pull their stats!</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {squadDisplayPlayers.map(p => {
                const status = getPlayerStatus(p.id);
                return (
                  <div key={p.id} onClick={() => { if (authStatus.role === 'admin') setSelectedPlayerForEdit(p); }} className={`flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800 group ${authStatus.role === 'admin' ? 'cursor-pointer hover:border-slate-600' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
                          {p.photoUrl ? <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" /> : <Users size={16} className="text-slate-500" />}
                        </div>
                        {/* STATUS INDICATOR DOT */}
                        {status === 'in' && <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900"></div>}
                        {status === 'waitlist' && <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-slate-900"></div>}
                      </div>
                      <span className="font-bold text-slate-200">{p.name}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      {status === 'in' && <span className="text-green-400 font-bold uppercase text-[10px]">Playing</span>}
                      {status === 'waitlist' && <span className="text-orange-400 font-bold uppercase text-[10px]">Waitlist</span>}
                      <span className="ml-2">{p.gamesPlayed} Apps</span>
                      {authStatus.role === 'admin' && <div className="opacity-0 group-hover:opacity-100 bg-slate-700 p-1 rounded-full text-white"><Camera size={12} /></div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setView('dashboard')} className="mt-8 text-slate-400 hover:text-white text-sm font-bold flex items-center gap-1">← Back to Dashboard</button>
          </div>
        )}

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
                      onEditRatings={() => {
                        setRatingsForm(selectedPlayerForEdit.ratings || { fitness: 3, control: 3, shooting: 3, defense: 3 });
                        setShowRatingsModal(true);
                      }}
                    />
                  </div>

                  {/* Admin Upload Controls */}
                  {authStatus.role === 'admin' && (
                    <div className="bg-slate-800 rounded-xl p-4 text-center mb-4">
                      <p className="text-slate-400 text-sm mb-4">Tap card photo to upload image.</p>
                      <input type="file" id="photo-upload" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files[0]) handleImageUpload(e.target.files[0]); }} />
                      <button onClick={() => document.getElementById('photo-upload').click()} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                        <Upload size={18} /> Upload Photo
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
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <label className="font-bold text-slate-300">Fitness / Speed</label>
                        <span className="font-mono text-yellow-500">{ratingsForm.fitness}</span>
                      </div>
                      <input
                        type="range" min="1" max="5" step="0.1"
                        value={ratingsForm.fitness}
                        onChange={(e) => setRatingsForm({ ...ratingsForm, fitness: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <label className="font-bold text-slate-300">Ball Control / Passing</label>
                        <span className="font-mono text-yellow-500">{ratingsForm.control}</span>
                      </div>
                      <input
                        type="range" min="1" max="5" step="0.1"
                        value={ratingsForm.control}
                        onChange={(e) => setRatingsForm({ ...ratingsForm, control: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <label className="font-bold text-slate-300">Shooting & Finishing</label>
                        <span className="font-mono text-yellow-500">{ratingsForm.shooting}</span>
                      </div>
                      <input
                        type="range" min="1" max="5" step="0.1"
                        value={ratingsForm.shooting}
                        onChange={(e) => setRatingsForm({ ...ratingsForm, shooting: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <label className="font-bold text-slate-300">Defensive Awareness</label>
                        <span className="font-mono text-yellow-500">{ratingsForm.defense}</span>
                      </div>
                      <input
                        type="range" min="1" max="5" step="0.1"
                        value={ratingsForm.defense}
                        onChange={(e) => setRatingsForm({ ...ratingsForm, defense: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
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
      </main>

      <nav className="fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 pb-safe z-40">
        <div className="flex justify-around items-center max-w-4xl mx-auto">
          <button onClick={() => setView('dashboard')} className={`flex flex-col items-center py-3 px-6 ${view === 'dashboard' ? 'text-green-400' : 'text-slate-500'}`}><Trophy size={20} /><span className="text-[10px] font-bold mt-1 uppercase">Home</span></button>
          <button onClick={() => setView('stats')} className={`flex flex-col items-center py-3 px-6 ${view === 'stats' ? 'text-green-400' : 'text-slate-500'}`}><BarChart2 size={20} /><span className="text-[10px] font-bold mt-1 uppercase">Stats</span></button>
          <button onClick={() => setView('players')} className={`flex flex-col items-center py-3 px-6 ${view === 'players' ? 'text-green-400' : 'text-slate-500'}`}><Users size={20} /><span className="text-[10px] font-bold mt-1 uppercase">Squad</span></button>
          {authStatus.role === 'admin' && (
            <>
              <button onClick={() => setView('teams')} className={`flex flex-col items-center py-3 px-6 ${view === 'teams' ? 'text-green-400' : 'text-slate-500'}`}><Shirt size={20} /><span className="text-[10px] font-bold mt-1 uppercase">Sheet</span></button>
              <button onClick={() => setView('add-match')} className={`flex flex-col items-center py-3 px-6 ${view === 'add-match' ? 'text-green-400' : 'text-slate-500'}`}><Activity size={20} /><span className="text-[10px] font-bold mt-1 uppercase">Log</span></button>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}