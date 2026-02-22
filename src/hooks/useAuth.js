import { useState, useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function useAuth() {
    const [authStatus, setAuthStatus] = useState({ loggedIn: false, role: 'player' });
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check local storage for persisted role
        const savedAccess = localStorage.getItem('friday_fut_access');
        const savedRole = localStorage.getItem('friday_fut_role');

        if (savedAccess === 'granted') {
            setAuthStatus({ loggedIn: true, role: savedRole || 'player' });
        }

        // Anonymous Auth
        const doAuth = async () => {
            try {
                await signInAnonymously(auth);
            } catch (err) {
                console.error("Auth error:", err);
            }
        };
        doAuth();

        // Listen for auth changes
        return onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
    }, []);

    const login = (role) => {
        setAuthStatus({ loggedIn: true, role: role });
        localStorage.setItem('friday_fut_access', 'granted');
        localStorage.setItem('friday_fut_role', role);
    };

    const logout = () => {
        setAuthStatus({ loggedIn: false, role: 'player' });
        localStorage.removeItem('friday_fut_access');
        localStorage.removeItem('friday_fut_role');
    };

    return { user, authStatus, login, logout, loading };
}
