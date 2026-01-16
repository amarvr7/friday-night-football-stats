import { useState, useEffect, useMemo } from 'react';
import {
    collection,
    doc,
    onSnapshot,
    query,
    orderBy
} from 'firebase/firestore';
import { db, PROJECT_ID, COLLECTIONS } from '../services/firebase';
import { calculateOverall, calculateStreaks } from '../utils/helpers';

export default function useAppModel(user, loggedIn) {
    const [players, setPlayers] = useState([]);
    const [matches, setMatches] = useState([]);
    const [checkins, setCheckins] = useState([]);
    const [upcomingTeams, setUpcomingTeams] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !loggedIn) return;

        // 1. Players Listener
        const qPlayers = query(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS));
        const unsubPlayers = onSnapshot(qPlayers, (snapshot) => {
            setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            // Consider granular loading states if needed, for now we just unset loading at the end of the chain or keep it simple
            setLoading(false);
        });

        // 2. Matches Listener
        const qMatches = query(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.MATCHES));
        const unsubMatches = onSnapshot(qMatches, (snapshot) => {
            const mList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            mList.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
            setMatches(mList);
        });

        // 3. Checkins Listener
        const qCheckins = query(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.CHECKINS), orderBy("timestamp", "asc"));
        const unsubCheckins = onSnapshot(qCheckins, (snapshot) => {
            setCheckins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // 4. Upcoming Teams Listener
        const unsubUpcoming = onSnapshot(doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.SETTINGS, 'currentTeams'), (doc) => {
            if (doc.exists()) setUpcomingTeams(doc.data());
            else setUpcomingTeams(null);
        });

        return () => {
            unsubPlayers();
            unsubMatches();
            unsubCheckins();
            unsubUpcoming();
        };
    }, [user, loggedIn]);

    // Derived Data
    const sortedPlayers = useMemo(() => {
        return [...players].sort((a, b) => calculateOverall(b) - calculateOverall(a));
    }, [players]);

    const playerStreaks = useMemo(() => {
        const streaks = {};
        players.forEach(p => {
            streaks[p.id] = calculateStreaks(p, matches);
        });
        return streaks;
    }, [players, matches]);

    return {
        players,
        matches,
        checkins,
        upcomingTeams,
        loading,
        sortedPlayers,
        playerStreaks
    };
}
