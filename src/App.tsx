import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { 
  Trophy, 
  Users, 
  User, 
  Timer, 
  TrendingUp, 
  Shield, 
  ChevronRight, 
  X,
  AlertCircle,
  Coins,
  Calculator,
  LayoutDashboard,
  Play,
  RotateCcw,
  Settings,
  Plus,
  Minus,
  Trash2,
  Search,
  ArrowRight,
  LogOut,
  Lock,
  Phone,
  Mail,
  Eye,
  EyeOff,
  Upload,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Filter,
  ArrowUpDown,
  MessageCircle,
  BarChart2,
  Clock,
  Eye as EyeIcon,
  Volume2,
  VolumeX,
  GitCompare,
  Calendar
} from 'lucide-react';
import { Player, Team, AuctionState, Category, AuctionSettings } from './types';
import { auth, db, storage } from './firebase';
import { cn } from './lib/utils';
import { PlayerStatsChart, PlayerAvatar } from './components/shared/PlayerComponents';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { initializeApp, deleteApp } from 'firebase/app';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  getAuth,
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  createUserWithEmailAndPassword,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc,
  deleteDoc,
  onSnapshot, 
  setDoc, 
  updateDoc, 
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  increment,
  arrayUnion,
  arrayRemove,
  runTransaction,
  writeBatch,
  deleteField,
  collectionGroup
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId || undefined,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}



// Countdown display for scheduled auction start
const ScheduleCountdown = React.memo(({ targetMs }: { targetMs: number }) => {
  const [remaining, setRemaining] = useState(Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setRemaining(Math.max(0, targetMs - Date.now())), 1000);
    return () => clearInterval(t);
  }, [targetMs]);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  if (remaining <= 0) return <span className="font-mono font-bold">now!</span>;
  return <span className="font-mono font-bold">{h > 0 ? `${h}h ` : ''}{m}m {s}s</span>;
});

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<{ role: 'admin' | 'team'; teamId?: string } | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [view, setView] = useState<'portal' | 'public' | 'admin' | 'team' | 'login'>('portal');
  const [loginMode, setLoginMode] = useState<'admin' | 'team'>('admin');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [settings, setSettings] = useState<AuctionSettings>({
    maxPlayersPerTeam: 15,
    minBidIncrement: 10,
    timerDuration: 30
  });
  const [auction, setAuction] = useState<AuctionState>({
    currentPlayerId: null,
    highestBid: 0,
    highestBidderId: null,
    timeLeft: 0,
    status: 'Idle',
    bidHistory: []
  });

  const descendingBidHistory = useMemo(
    () => auction.bidHistory ? [...auction.bidHistory].sort((a, b) => b.timestamp - a.timestamp) : [],
    [auction.bidHistory]
  );

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sound effects
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playSound = useCallback((type: 'bid' | 'urgent' | 'sold' | 'unsold') => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      if (type === 'bid') {
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
      } else if (type === 'urgent') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(550, now + 0.1);
        osc.frequency.setValueAtTime(440, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
      } else if (type === 'sold') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.1);
        osc.frequency.setValueAtTime(784, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
      } else {
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
      }
    } catch (_) {}
  }, [soundEnabled]);

  // Spectator count
  const [spectatorCount, setSpectatorCount] = useState(0);
  const spectatorDocRef = useRef<string | null>(null);

  // Player comparison
  const [comparePlayerIds, setComparePlayerIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // New State for CRUD
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [generatedTeamCreds, setGeneratedTeamCreds] = useState<{ mobile: string; email: string; pass: string } | null>(null);
  const [importedTeamCreds, setImportedTeamCreds] = useState<{ name: string; email: string; password: string }[]>([]);
  const [teamCredsModal, setTeamCredsModal] = useState<{ name: string; email: string; password: string } | null>(null);
  
  // New State for Bidding
  const [customBidAmount, setCustomBidAmount] = useState<string>('');
  const [showConfirmBid, setShowConfirmBid] = useState(false);
  const [pendingBidAmount, setPendingBidAmount] = useState<number | null>(null);

  // New State for Search and Confirmation
  const [playerSearch, setPlayerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Available' | 'Sold' | 'Unsold'>('All');
  const [minRuns, setMinRuns] = useState<number | ''>('');
  const [maxWickets, setMaxWickets] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<'name' | 'basePrice' | 'runs' | 'wickets'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [importStatus, setImportStatus] = useState<{
    type: 'players' | 'teams';
    status: 'idle' | 'processing' | 'completed' | 'error';
    progress: number;
    total: number;
    error?: string;
  } | null>(null);

  // Modal and detail states
  const [selectedPlayerForDetails, setSelectedPlayerForDetails] = useState<Player | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      try {
        setUser(u);
        if (u) {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          let profile: { role: 'admin' | 'team'; teamId?: string } | null = null;
          if (userDoc.exists()) {
            profile = userDoc.data() as { role: 'admin' | 'team'; teamId?: string };
            setUserProfile(profile);
            if (profile.role === 'team' && profile.teamId) {
              setSelectedTeamId(profile.teamId);
            }
          } else if (u.email === import.meta.env.VITE_ADMIN_EMAIL) {
            // Auto-bootstrap default admin (configured via VITE_ADMIN_EMAIL env var)
            profile = { role: 'admin' as const };
            await setDoc(doc(db, 'users', u.uid), profile);
            setUserProfile(profile);
          } else if (u.email) {
            // Auto-bootstrap team user — look up by email or mobile number in teams collection
            const emailToMatch = u.email;
            const mobileToMatch = u.email.endsWith('@auction.com') ? u.email.split('@')[0] : null;

            let teamId: string | null = null;

            // Try matching by email field on team doc (publicly readable)
            const emailQuery = query(collection(db, 'teams'), where('email', '==', emailToMatch));
            const emailSnap = await getDocs(emailQuery);
            if (!emailSnap.empty) teamId = emailSnap.docs[0].id;

            // Fallback: match by mobileNumber for @auction.com emails
            if (!teamId && mobileToMatch) {
              const mobileQuery = query(collection(db, 'teams'), where('mobileNumber', '==', mobileToMatch));
              const mobileSnap = await getDocs(mobileQuery);
              if (!mobileSnap.empty) teamId = mobileSnap.docs[0].id;
            }

            if (teamId) {
              profile = { role: 'team' as const, teamId };
              await setDoc(doc(db, 'users', u.uid), profile);
              setUserProfile(profile);
              setSelectedTeamId(teamId);
            }
          }
          // Auto-navigate to the correct view once profile is resolved
          if (profile?.role === 'admin') {
            setView('admin');
          } else if (profile?.role === 'team') {
            setView('team');
          }
        } else {
          setUserProfile(null);
          setSelectedTeamId(null);
          setView('portal');
        }
      } catch (err) {
        console.error('Auth state change error:', err);
      } finally {
        setIsAuthLoading(false);
      }
    });

    const unsubscribePlayers = onSnapshot(collection(db, 'players'), (snapshot) => {
      setPlayers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'players');
    });

    const unsubscribeTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      setTeams(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teams');
    });

    const unsubscribeAuction = onSnapshot(doc(db, 'auction', 'state'), (snapshot) => {
      if (snapshot.exists()) {
        setAuction(snapshot.data() as AuctionState);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'auction/state');
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'auction', 'settings'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as AuctionSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'auction/settings');
    });

    // Initialize auction docs if they don't exist (only if admin)
    const initAuction = async () => {
      try {
        const stateDoc = await getDoc(doc(db, 'auction', 'state'));
        if (!stateDoc.exists()) {
          await setDoc(doc(db, 'auction', 'state'), {
            currentPlayerId: null,
            highestBid: 0,
            highestBidderId: null,
            timeLeft: 0,
            status: 'Idle',
            bidHistory: []
          });
        }
        const settingsDoc = await getDoc(doc(db, 'auction', 'settings'));
        if (!settingsDoc.exists()) {
          await setDoc(doc(db, 'auction', 'settings'), {
            maxPlayersPerTeam: 15,
            minBidIncrement: 10,
            timerDuration: 30
          });
        }
      } catch (e) {
        // Silently fail if not admin or other issue, listeners will handle errors if they persist
      }
    };
    initAuction();

    return () => {
      unsubscribeAuth();
      unsubscribePlayers();
      unsubscribeTeams();
      unsubscribeAuction();
      unsubscribeSettings();
    };
  }, []);

  // Admin-only: listen to teams/*/private/contact for email + password data
  useEffect(() => {
    if (userProfile?.role !== 'admin') return;
    const unsubscribe = onSnapshot(
      collectionGroup(db, 'private'),
      (snapshot) => {
        const privateMap: Record<string, { email?: string; password?: string }> = {};
        snapshot.docs.forEach(d => {
          // path: teams/{teamId}/private/contact
          const teamId = d.ref.parent.parent?.id;
          if (teamId) privateMap[teamId] = { email: d.data().email, password: d.data().password };
        });
        setTeams(prev => prev.map(t => ({
          ...t,
          email: privateMap[t.id]?.email ?? t.email,
          password: privateMap[t.id]?.password ?? t.password,
        })));
      },
      () => {} // silently ignore permission errors for non-admins
    );
    return () => unsubscribe();
  }, [userProfile?.role]);

  // Spectator presence — write a doc on mount, delete on unmount
  useEffect(() => {
    const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    spectatorDocRef.current = sessionId;
    const presenceRef = doc(db, 'presence', sessionId);
    
    // Create presence document
    setDoc(presenceRef, { 
      ts: Date.now(), 
      view: 'active',
      userAgent: navigator.userAgent.slice(0, 100) // Help distinguish different browsers/tabs
    }).catch((err) => {
      console.error('Failed to create presence document:', err);
    });
    
    // Heartbeat to keep presence alive
    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setDoc(presenceRef, { 
          ts: Date.now(), 
          view: 'active',
          userAgent: navigator.userAgent.slice(0, 100)
        }, { merge: true }).catch(() => {});
      }
    }, 30000); // Update every 30 seconds
    
    // Listen to all presence documents
    const unsub = onSnapshot(
      collection(db, 'presence'), 
      (snap) => {
        setSpectatorCount(snap.size);
      }, 
      (err) => {
        console.error('Presence snapshot error:', err);
      }
    );
    
    // Cleanup on unmount or tab close
    const cleanup = () => {
      deleteDoc(presenceRef).catch((err) => {
        console.error('Failed to delete presence document:', err);
      });
    };
    
    window.addEventListener('beforeunload', cleanup);
    
    return () => {
      clearInterval(heartbeat);
      unsub();
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, []);

  // Timer display logic — client-side countdown, admin triggers auto-end when it hits 0
  const [displayTime, setDisplayTime] = useState(0);
  const autoEndFiredRef = useRef<string | null>(null); // tracks playerId to prevent double-fire

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (auction.status === 'Active' && auction.startTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - auction.startTime!) / 1000);
        const remaining = Math.max(0, auction.timeLeft - elapsed);
        setDisplayTime(remaining);

        // Only admin client triggers the auto-end to avoid race conditions
        if (remaining === 0 && userProfile?.role === 'admin' && auction.currentPlayerId) {
          if (autoEndFiredRef.current !== auction.currentPlayerId) {
            autoEndFiredRef.current = auction.currentPlayerId;
            endAuctionRef.current();
          }
        }
      }, 1000);
    } else {
      setDisplayTime(auction.timeLeft);
      // Reset the guard when auction is no longer active
      if (auction.status !== 'Active') {
        autoEndFiredRef.current = null;
      }
    }
    return () => clearInterval(interval);
  }, [auction.status, auction.startTime, auction.timeLeft, auction.currentPlayerId, userProfile?.role]);

  // Keep endAuctionRef in sync (for manual end calls)
  useEffect(() => {
    endAuctionRef.current = endAuction;
  });

  // Sound effects — after displayTime is declared
  const prevBidCountRef = useRef(0);
  const prevDisplayTimeRef = useRef(0);
  useEffect(() => {
    const bidCount = auction.bidHistory?.length || 0;
    if (bidCount > prevBidCountRef.current) playSound('bid');
    prevBidCountRef.current = bidCount;
  }, [auction.bidHistory?.length, playSound]);
  useEffect(() => {
    if (auction.status === 'Active' && displayTime <= 5 && displayTime > 0 && prevDisplayTimeRef.current > displayTime) {
      playSound('urgent');
    }
    prevDisplayTimeRef.current = displayTime;
  }, [displayTime, auction.status, playSound]);
  useEffect(() => {
    if (auction.status === 'Ended') playSound(auction.highestBidderId ? 'sold' : 'unsold');
  }, [auction.status, auction.highestBidderId, playSound]);

  const currentPlayer = useMemo(() => 
    players.find(p => p.id === auction.currentPlayerId), 
    [players, auction.currentPlayerId]
  );

  const highestBidder = useMemo(() => 
    teams.find(t => t.id === auction.highestBidderId),
    [teams, auction.highestBidderId]
  );

  const budgetProjection = useMemo(() => {
    if (view !== 'team' || !userProfile?.teamId) return null;
    
    const availablePlayers = players.filter(p => p.status === 'Available');
    const avgBasePrice = availablePlayers.length > 0 
      ? availablePlayers.reduce((sum, p) => sum + p.basePrice, 0) / availablePlayers.length 
      : 0;
    
    const currentTeam = teams.find(t => t.id === userProfile.teamId);
    const remainingBudget = currentTeam?.remainingBudget || 0;
    const canAffordCount = avgBasePrice > 0 ? Math.floor(remainingBudget / avgBasePrice) : 0;
    
    const squadSize = currentTeam?.players.length || 0;
    const slotsLeft = Math.max(0, settings.maxPlayersPerTeam - squadSize);
    
    return {
      avgBasePrice,
      canAffordCount,
      slotsLeft,
      recommendedCount: Math.min(canAffordCount, slotsLeft)
    };
  }, [view, userProfile?.teamId, players, teams, settings.maxPlayersPerTeam]);

  const uploadImage = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    const formData = new FormData(e.currentTarget);
    const identifier = formData.get('identifier') as string;
    const password = formData.get('password') as string;

    try {
      await signInWithEmailAndPassword(auth, identifier, password);
      setView('portal');
    } catch (err: any) {
      // Provide more user-friendly error messages
      let message = err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = loginMode === 'admin' 
          ? 'Invalid email or password. Please check your credentials.' 
          : 'Invalid mobile number or password. Please check your credentials.';
      } else if (err.code === 'auth/invalid-email') {
        message = loginMode === 'admin' 
          ? 'Please enter a valid email address.' 
          : 'Please enter a valid mobile number.';
      }
      setLoginError(message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setView('portal');
  };

  const handleBid = async (amount: number) => {
    if (!selectedTeamId || !auction.currentPlayerId) return;
    setPendingBidAmount(amount);
    setShowConfirmBid(true);
  };

  const confirmBid = async () => {
    if (!selectedTeamId || !auction.currentPlayerId || pendingBidAmount === null) return;

    try {
      // Validate client-side using already-subscribed realtime data
      const currentTeam = teams.find(t => t.id === selectedTeamId);
      if (!currentTeam) throw new Error('Team not found');

      if (pendingBidAmount < auction.highestBid) {
        throw new Error('Bid must be at least the current highest bid');
      }
      if (pendingBidAmount === auction.highestBid && auction.highestBidderId !== null) {
        throw new Error('Bid must be higher than current highest bid');
      }
      if (pendingBidAmount > currentTeam.remainingBudget) {
        throw new Error('Insufficient budget');
      }
      if (auction.status !== 'Active') {
        throw new Error('Auction is not active');
      }

      await updateDoc(doc(db, 'auction', 'state'), {
        highestBid: pendingBidAmount,
        highestBidderId: selectedTeamId,
        startTime: Date.now(),
        timeLeft: settings.timerDuration,
        bidHistory: arrayUnion({
          amount: pendingBidAmount,
          bidderId: selectedTeamId,
          bidderName: currentTeam.name,
          timestamp: Date.now()
        })
      });
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    } finally {
      setShowConfirmBid(false);
      setPendingBidAmount(null);
      setCustomBidAmount('');
    }
  };

  const endAuction = async () => {
    if (!auction.currentPlayerId) return;
    const player = players.find(p => p.id === auction.currentPlayerId);
    if (!player) return;

    try {
      await runTransaction(db, async (transaction) => {
        const auctionDoc = await transaction.get(doc(db, 'auction', 'state'));
        if (!auctionDoc.exists()) return;
        const currentAuction = auctionDoc.data() as AuctionState;

        if (currentAuction.status !== 'Active') return;

        let winningTeam: Team | null = null;
        if (currentAuction.highestBidderId) {
          const teamDoc = await transaction.get(doc(db, 'teams', currentAuction.highestBidderId));
          if (teamDoc.exists()) {
            winningTeam = teamDoc.data() as Team;
          }
        }

        // All reads are done. Now perform writes.
        transaction.update(doc(db, 'auction', 'state'), {
          status: 'Ended',
          timeLeft: 0
        });

        if (currentAuction.highestBidderId && winningTeam) {
          transaction.update(doc(db, 'teams', currentAuction.highestBidderId), {
            remainingBudget: winningTeam.remainingBudget - currentAuction.highestBid,
            players: arrayUnion(currentAuction.currentPlayerId)
          });
          transaction.update(doc(db, 'players', currentAuction.currentPlayerId!), {
            status: 'Sold',
            soldTo: currentAuction.highestBidderId,
            soldPrice: currentAuction.highestBid
          });
        } else {
          transaction.update(doc(db, 'players', currentAuction.currentPlayerId!), {
            status: 'Unsold'
          });
        }
      });
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const startAuction = async (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    // Check if player is a captain or vice-captain
    const isProtected = teams.some(t => t.captainId === playerId || t.viceCaptainId === playerId);
    if (isProtected) {
      setError('Cannot auction a player who is a Team Captain or Vice Captain!');
      setTimeout(() => setError(null), 3000);
      return;
    }

    await setDoc(doc(db, 'auction', 'state'), {
      currentPlayerId: playerId,
      highestBid: player.basePrice,
      highestBidderId: null,
      timeLeft: settings.timerDuration,
      startTime: Date.now(),
      status: 'Active',
      bidHistory: []
    });
  };

  const pauseAuction = async () => {
    if (auction.status !== 'Active') return;
    // Snapshot remaining time before pausing
    const elapsed = auction.startTime ? Math.floor((Date.now() - auction.startTime) / 1000) : 0;
    const remaining = Math.max(0, auction.timeLeft - elapsed);
    await updateDoc(doc(db, 'auction', 'state'), { status: 'Paused', timeLeft: remaining });
  };

  const resumeAuction = async () => {
    if (auction.status !== 'Paused') return;
    await updateDoc(doc(db, 'auction', 'state'), { status: 'Active', startTime: Date.now() });
  };

  const reAuctionUnsold = async () => {
    const unsoldPlayers = players.filter(p => p.status === 'Unsold');
    if (unsoldPlayers.length === 0) return;
    try {
      const chunks: typeof unsoldPlayers[] = [];
      for (let i = 0; i < unsoldPlayers.length; i += 500) chunks.push(unsoldPlayers.slice(i, i + 500));
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(p => batch.update(doc(db, 'players', p.id), { status: 'Available' }));
        await batch.commit();
      }
    } catch (err: any) {
      setError('Failed to re-queue unsold players: ' + err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const resetTeamPassword = async (team: Team) => {
    const email = team.email;
    if (!email) {
      setError('No email on record for this team.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
    try {
      // Sign in as the team user via a secondary app, then update their password
      const secondaryApp = initializeApp(firebaseConfig, `reset-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      // We need the current password to re-authenticate — we have it in the private doc
      const currentPassword = team.password;
      if (!currentPassword) {
        // No stored password — use REST API to create/overwrite the account
        const apiKey = firebaseConfig.apiKey;
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: newPassword, returnSecureToken: false }),
          }
        );
        if (!res.ok) {
          const errData = await res.json();
          if (errData.error?.message === 'EMAIL_EXISTS') {
            // Can't reset without current password — send reset email
            await deleteApp(secondaryApp);
            const { sendPasswordResetEmail } = await import('firebase/auth');
            const tempAuth = getAuth(secondaryApp);
            await sendPasswordResetEmail(tempAuth, email);
            setTeamCredsModal({ name: team.name, email, password: '(reset email sent to team)' });
            return;
          }
          throw new Error(errData.error?.message || 'Failed to reset auth account');
        }
        await deleteApp(secondaryApp);
      } else {
        const { signInWithEmailAndPassword: signIn, updatePassword } = await import('firebase/auth');
        const cred = await signIn(secondaryAuth, email, currentPassword);
        await updatePassword(cred.user, newPassword);
        await deleteApp(secondaryApp);
      }

      // Persist new password to private subcollection
      await setDoc(doc(db, 'teams', team.id, 'private', 'contact'), { email, password: newPassword }, { merge: true });

      setTeamCredsModal({ name: team.name, email, password: newPassword });
    } catch (err: any) {
      setError('Password reset failed: ' + err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [showNextPlayerPrompt, setShowNextPlayerPrompt] = useState(false);
  const [nextPlayerId, setNextPlayerId] = useState<string | null>(null);
  const [showEndAuctionConfirm, setShowEndAuctionConfirm] = useState(false);
  const [showResetTimerConfirm, setShowResetTimerConfirm] = useState(false);
  const [showBidAdjust, setShowBidAdjust] = useState(false);
  const [bidAdjustTeamId, setBidAdjustTeamId] = useState<string | null>(null);
  const [bidAdjustAmount, setBidAdjustAmount] = useState<string>('');
  const [teamBidStep, setTeamBidStep] = useState<number>(10);
  const [showBudgetAdjust, setShowBudgetAdjust] = useState(false);
  const [budgetAdjustTeamId, setBudgetAdjustTeamId] = useState<string | null>(null);
  const [budgetAdjustAmount, setBudgetAdjustAmount] = useState<string>('');
  const [budgetAdjustMode, setBudgetAdjustMode] = useState<'add' | 'subtract' | 'set'>('add');
  const [budgetAdjustTarget, setBudgetAdjustTarget] = useState<'both' | 'remaining'>('remaining');
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState<Player | null>(null);
  const playerCsvInputRef = useRef<HTMLInputElement>(null);
  const teamCsvInputRef = useRef<HTMLInputElement>(null);
  
  // Keep a ref to endAuction for manual calls
  const endAuctionRef = useRef<() => Promise<void>>(async () => {});
  
  // Pagination state
  const [playersPage, setPlayersPage] = useState(1);
  const playersPerPage = 20;

  const filteredPlayers = useMemo(() => {
    const filtered = players.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(playerSearch.toLowerCase()) || 
                          p.category.toLowerCase().includes(playerSearch.toLowerCase());
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      const matchesRuns = minRuns === '' || (p.stats.runs || 0) >= minRuns;
      const matchesWickets = maxWickets === '' || (p.stats.wickets || 0) <= maxWickets;
      return matchesSearch && matchesStatus && matchesRuns && matchesWickets;
    });

    return filtered.sort((a, b) => {
      let valA: any, valB: any;
      if (sortBy === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortBy === 'basePrice') {
        valA = a.basePrice;
        valB = b.basePrice;
      } else if (sortBy === 'runs') {
        valA = a.stats.runs || 0;
        valB = b.stats.runs || 0;
      } else if (sortBy === 'wickets') {
        valA = a.stats.wickets || 0;
        valB = b.stats.wickets || 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [players, playerSearch, statusFilter, minRuns, maxWickets, sortBy, sortOrder]);

  // Paginated players for display
  const paginatedPlayers = useMemo(() => {
    const startIndex = (playersPage - 1) * playersPerPage;
    return filteredPlayers.slice(startIndex, startIndex + playersPerPage);
  }, [filteredPlayers, playersPage, playersPerPage]);

  const totalPages = Math.ceil(filteredPlayers.length / playersPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPlayersPage(1);
  }, [playerSearch, statusFilter, minRuns, maxWickets, sortBy, sortOrder]);

  useEffect(() => {
    if (userProfile?.role === 'admin' && auction.status === 'Ended' && auction.currentPlayerId) {
      const availablePlayers = players.filter(
        p => p.status === 'Available' && p.id !== auction.currentPlayerId
      );

      if (availablePlayers.length === 0) return;

      const nextPlayer = availablePlayers[0];
      setNextPlayerId(nextPlayer.id);
      setShowNextPlayerPrompt(true);

      // Auto-start next player after 4 seconds
      const timer = setTimeout(() => {
        setShowNextPlayerPrompt(false);
        setNextPlayerId(null);
        startAuction(nextPlayer.id);
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [auction.status, auction.currentPlayerId, userProfile?.role]);

  const backfillTeamEmails = async () => {
    if (userProfile?.role !== 'admin') return;
    let fixed = 0;
    try {
      const batch = writeBatch(db);
      for (const team of teams) {
        if (team.email) continue;
        // Fetch private/contact doc for this team (admin-only read)
        const contactDoc = await getDoc(doc(db, 'teams', team.id, 'private', 'contact'));
        if (!contactDoc.exists()) continue;
        const email = contactDoc.data().email;
        if (!email) continue;
        batch.update(doc(db, 'teams', team.id), { email });
        fixed++;
      }
      if (fixed > 0) await batch.commit();
      alert(`Done — backfilled email for ${fixed} team(s).`);
    } catch (err: any) {
      setError('Backfill failed: ' + err.message);
      setTimeout(() => setError(null), 4000);
    }
  };

  const generateSampleData = async () => {
    if (userProfile?.role !== 'admin') return;
    if (!confirm('This will add 8 teams and 70 players. Continue?')) return;

    setIsGenerating(true);
    try {
      const batch = writeBatch(db);

      const teamNames = [
        { name: 'Mumbai Indians', color: '#004BA0', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cd/Mumbai_Indians_Logo.svg/1200px-Mumbai_Indians_Logo.svg.png' },
        { name: 'Chennai Super Kings', color: '#FFFF00', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2b/Chennai_Super_Kings_Logo.svg/1200px-Chennai_Super_Kings_Logo.svg.png' },
        { name: 'Royal Challengers Bangalore', color: '#EC1C24', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/69/Royal_Challengers_Bangalore_Logo.svg/1200px-Royal_Challengers_Bangalore_Logo.svg.png' },
        { name: 'Kolkata Knight Riders', color: '#3A225D', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4c/Kolkata_Knight_Riders_Logo.svg/1200px-Kolkata_Knight_Riders_Logo.svg.png' },
        { name: 'Delhi Capitals', color: '#00008B', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Delhi_Capitals_Logo.svg/1200px-Delhi_Capitals_Logo.svg.png' },
        { name: 'Rajasthan Royals', color: '#EA1B85', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/60/Rajasthan_Royals_Logo.svg/1200px-Rajasthan_Royals_Logo.svg.png' },
        { name: 'Sunrisers Hyderabad', color: '#FF822A', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/81/Sunrisers_Hyderabad.svg/1200px-Sunrisers_Hyderabad.svg.png' },
        { name: 'Gujarat Titans', color: '#1B2133', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/09/Gujarat_Titans_Logo.svg/1200px-Gujarat_Titans_Logo.svg.png' }
      ];

      teamNames.forEach(t => {
        const teamRef = doc(collection(db, 'teams'));
        batch.set(teamRef, {
          name: t.name,
          totalBudget: 1000,
          remainingBudget: 1000,
          players: [],
          color: t.color,
          logoUrl: t.logo,
          mobileNumber: '',
          ownerUid: ''
        });
      });

      const firstNames = ['Virat', 'Rohit', 'MS', 'Hardik', 'Jasprit', 'KL', 'Shubman', 'Rishabh', 'Shreyas', 'Suryakumar', 'Ravindra', 'Mohammed', 'Yuzvendra', 'Kuldeep', 'Axar', 'Ishant', 'Umesh', 'Bhuvneshwar', 'Sanju', 'Ishan', 'Prithvi', 'Devdutt', 'Ruturaj', 'Venkatesh', 'Deepak', 'Shardul', 'Harshal', 'Avesh', 'Arshdeep', 'Umran', 'Ravi', 'Washington', 'Krunal', 'Nitish', 'Rahul', 'Mayank', 'Ajinkya', 'Cheteshwar', 'Hanuma', 'Karun'];
      const lastNames = ['Kohli', 'Sharma', 'Dhoni', 'Pandya', 'Bumrah', 'Rahul', 'Gill', 'Pant', 'Iyer', 'Yadav', 'Jadeja', 'Shami', 'Chahal', 'Siraj', 'Patel', 'Ashwin', 'Chakravarthy', 'Bishnoi', 'Sundar', 'Samson', 'Kishan', 'Shaw', 'Padikkal', 'Gaikwad', 'Chahar', 'Thakur', 'Tripathi', 'Rana', 'Tewatia', 'Hooda', 'Krishna', 'Malik', 'Khan', 'Saini', 'Natarajan', 'Unadkat', 'Mavi', 'Nagarkoti', 'Tyagi', 'Sakariya'];
      const categories: Category[] = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'];

      for (let i = 0; i < 70; i++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        
        const playerRef = doc(collection(db, 'players'));
        batch.set(playerRef, {
          name: `${firstName} ${lastName}`,
          category,
          basePrice: [20, 50, 100, 150, 200][Math.floor(Math.random() * 5)],
          imageUrl: `https://picsum.photos/seed/player${i}/200/200`,
          stats: {
            matches: Math.floor(Math.random() * 200) + 10,
            runs: category !== 'Bowler' ? Math.floor(Math.random() * 5000) + 500 : Math.floor(Math.random() * 500),
            wickets: category !== 'Batsman' ? Math.floor(Math.random() * 200) + 20 : Math.floor(Math.random() * 10),
            strikeRate: Math.floor(Math.random() * 50) + 120,
            economy: Math.floor(Math.random() * 4) + 6
          },
          status: 'Available'
        });
      }

      await batch.commit();
      alert('Sample data generated successfully!');
    } catch (err) {
      console.error('Error generating sample data:', err);
      alert('Failed to generate sample data.');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetAuction = async () => {
    setShowResetConfirm(true);
  };

  const confirmReset = async () => {
    setIsResetting(true);
    setError(null);
    try {
      // Delete players in batches
      for (let i = 0; i < players.length; i += 400) {
        const batch = writeBatch(db);
        players.slice(i, i + 400).forEach(p => batch.delete(doc(db, 'players', p.id)));
        await batch.commit();
      }

      // Delete private/contact subcollection docs FIRST (before parent team docs)
      // Wrapped separately — these may not exist for all teams
      try {
        for (let i = 0; i < teams.length; i += 400) {
          const batch = writeBatch(db);
          teams.slice(i, i + 400).forEach(t =>
            batch.delete(doc(db, 'teams', t.id, 'private', 'contact'))
          );
          await batch.commit();
        }
      } catch (_) {
        // Non-fatal: private docs may not exist for all teams
      }

      // Delete teams
      for (let i = 0; i < teams.length; i += 400) {
        const batch = writeBatch(db);
        teams.slice(i, i + 400).forEach(t => batch.delete(doc(db, 'teams', t.id)));
        await batch.commit();
      }

      // Reset auction state — full overwrite to clear all stale fields
      await setDoc(doc(db, 'auction', 'state'), {
        currentPlayerId: null,
        highestBid: 0,
        highestBidderId: null,
        timeLeft: 0,
        status: 'Idle' as const,
        bidHistory: []
      });

      setShowResetConfirm(false);
      setError("Auction reset successfully! All teams and players deleted.");
      setTimeout(() => setError(null), 3000);
    } catch (err: any) {
      console.error("Reset error:", err);
      setError("Failed to reset auction: " + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const downloadSampleCSV = (type: 'players' | 'teams') => {
    const data = type === 'players' 
      ? [
          ['name', 'category', 'basePrice', 'imageUrl', 'matches', 'runs', 'wickets', 'strikeRate', 'economy'],
          ['Virat Kohli', 'Batsman', '200', 'https://picsum.photos/seed/virat/200/200', '250', '12000', '4', '130.5', '0'],
          ['Jasprit Bumrah', 'Bowler', '150', 'https://picsum.photos/seed/bumrah/200/200', '120', '50', '150', '80.0', '6.5'],
          ['Hardik Pandya', 'All-Rounder', '150', 'https://picsum.photos/seed/hardik/200/200', '100', '2000', '60', '145.0', '8.5'],
          ['MS Dhoni', 'Wicket-Keeper', '200', 'https://picsum.photos/seed/dhoni/200/200', '350', '10000', '0', '135.0', '0']
        ]
      : [
          ['name', 'totalBudget', 'color', 'logoUrl', 'mobileNumber', 'email'],
          ['Mumbai Indians', '1000', '#004BA0', 'https://picsum.photos/seed/mi/200/200', '9876543210', 'mi@example.com'],
          ['Chennai Super Kings', '1000', '#FFFF00', 'https://picsum.photos/seed/csk/200/200', '9876543211', 'csk@example.com']
        ];
    
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${type}_sample.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Normalize a raw CSV category string to a valid Category value
  const normalizeCategory = (raw: string): Category => {
    const s = (raw || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
    if (s.includes('wicket') || s.includes('keeper') || s === 'wk') return 'Wicket-Keeper';
    if (s.includes('all') || s.includes('rounder')) return 'All-Rounder';
    if (s.includes('bowl')) return 'Bowler';
    return 'Batsman';
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'players' | 'teams') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus({
      type,
      status: 'processing',
      progress: 0,
      total: 0
    });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];
        setImportStatus(prev => prev ? { ...prev, total: data.length } : null);
        
        try {
          if (type === 'players') {
            let count = 0;
            for (const row of data) {
              const player: Omit<Player, 'id'> = {
                name: row.name || 'Unknown Player',
                category: normalizeCategory(row.category),
                basePrice: Number(row.basePrice) || 0,
                imageUrl: row.imageUrl || '',
                stats: {
                  matches: Number(row.matches) || 0,
                  runs: row.runs ? Number(row.runs) : undefined,
                  wickets: row.wickets ? Number(row.wickets) : undefined,
                  strikeRate: row.strikeRate ? Number(row.strikeRate) : undefined,
                  economy: row.economy ? Number(row.economy) : undefined,
                },
                status: 'Available'
              };
              await addDoc(collection(db, 'players'), player);
              count++;
              setImportStatus(prev => prev ? { ...prev, progress: count } : null);
            }
          } else {
            let count = 0;
            const credsCollected: { name: string; email: string; password: string }[] = [];
            for (const row of data) {
              const mobileNumber = row.mobileNumber || '';
              const email = row.email || (mobileNumber ? `${mobileNumber}@auction.com` : '');
              let password = Math.random().toString(36).slice(-8);

              if (email) {
                // Use Firebase Auth REST API to create/manage users without a secondary app instance
                // This avoids any risk of the secondary app interfering with the admin's auth state
                const apiKey = firebaseConfig.apiKey;
                try {
                  const res = await fetch(
                    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email, password, returnSecureToken: false }),
                    }
                  );
                  if (!res.ok) {
                    const err = await res.json();
                    if (err.error?.message === 'EMAIL_EXISTS') {
                      // Account exists — reuse existing password if we have it
                      const existingTeam = teams.find(t => t.email === email);
                      if (existingTeam?.password) {
                        password = existingTeam.password;
                      } else {
                        password = '(existing — use Reset Password in admin)';
                      }
                    }
                    // Other errors: log but continue — Firestore write still proceeds
                  }
                } catch (fetchErr) {
                  console.error(`Auth REST error for ${email}:`, fetchErr);
                }
              }

              const team: Omit<Team, 'id'> = {
                name: row.name || 'Unknown Team',
                totalBudget: Number(row.totalBudget) || 1000,
                remainingBudget: Number(row.totalBudget) || 1000,
                players: [],
                color: row.color || '#ffffff',
                logoUrl: row.logoUrl || '',
                mobileNumber: mobileNumber,
                ...(email ? { email } : {}),
              };
              const newTeamRef = await addDoc(collection(db, 'teams'), team);
              if (email) {
                await setDoc(doc(db, 'teams', newTeamRef.id, 'private', 'contact'), { email, password });
              }
              credsCollected.push({ name: team.name, email, password });
              count++;
              setImportStatus(prev => prev ? { ...prev, progress: count } : null);
            }
            setImportedTeamCreds(credsCollected);
          }
          setImportStatus(prev => prev ? { ...prev, status: 'completed' } : null);
        } catch (err: any) {
          setImportStatus(prev => prev ? { ...prev, status: 'error', error: err.message } : null);
        }
      },
      error: (err) => {
        setImportStatus(prev => prev ? { ...prev, status: 'error', error: err.message } : null);
      }
    });
    // Reset input
    event.target.value = '';
  };

  const applyBudgetAdjust = async () => {
    if (!budgetAdjustTeamId) return;
    const team = teams.find(t => t.id === budgetAdjustTeamId);
    if (!team) return;
    const val = parseInt(budgetAdjustAmount);
    if (isNaN(val) || val < 0) {
      setError('Please enter a valid positive amount');
      setTimeout(() => setError(null), 3000);
      return;
    }

    let updates: Record<string, any> = {};

    if (budgetAdjustMode === 'set') {
      updates.remainingBudget = val;
      if (budgetAdjustTarget === 'both') updates.totalBudget = val;
    } else {
      const delta = budgetAdjustMode === 'add' ? val : -val;
      updates.remainingBudget = increment(delta);
      if (budgetAdjustTarget === 'both') updates.totalBudget = increment(delta);
    }

    // Guard: remaining can't go below 0
    const newRemaining = budgetAdjustMode === 'set' ? val
      : budgetAdjustMode === 'add' ? team.remainingBudget + val
      : team.remainingBudget - val;

    if (newRemaining < 0) {
      setError('Remaining budget cannot go below ₹0L');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      await updateDoc(doc(db, 'teams', budgetAdjustTeamId), updates);
      setShowBudgetAdjust(false);
      setBudgetAdjustTeamId(null);
      setBudgetAdjustAmount('');
      setBudgetAdjustMode('add');
      setBudgetAdjustTarget('remaining');
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const adminAdjustBid = async (teamId: string, amount: number) => {
    if (!auction.currentPlayerId || auction.status !== 'Active') return;
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    if (amount > team.remainingBudget) {
      setError('Bid amount exceeds team remaining budget');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const currentPlayer = players.find(p => p.id === auction.currentPlayerId);
    if (!currentPlayer || amount < currentPlayer.basePrice) {
      setError('Bid amount cannot be less than base price');
      setTimeout(() => setError(null), 3000);
      return;
    }
    try {
      await updateDoc(doc(db, 'auction', 'state'), {
        highestBid: amount,
        highestBidderId: teamId,
        startTime: Date.now(),
        timeLeft: settings.timerDuration,
        bidHistory: arrayUnion({
          amount,
          bidderId: teamId,
          bidderName: team.name + ' (Admin)',
          timestamp: Date.now()
        })
      });
      setShowBidAdjust(false);
      setBidAdjustTeamId(null);
      setBidAdjustAmount('');
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const updateSettingsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateSettings = (newSettings: AuctionSettings) => {
    // Optimistically update local state immediately for responsive UI
    setSettings(newSettings);
    if (updateSettingsDebounceRef.current) clearTimeout(updateSettingsDebounceRef.current);
    updateSettingsDebounceRef.current = setTimeout(() => {
      setDoc(doc(db, 'auction', 'settings'), newSettings).catch(err => {
        setError('Failed to save settings: ' + err.message);
        setTimeout(() => setError(null), 3000);
      });
    }, 500);
  };


  const addPlayer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const imageFile = formData.get('imageFile') as File;
    let imageUrl = formData.get('imageUrl') as string;

    if (imageFile && imageFile.size > 0) {
      imageUrl = await uploadImage(imageFile, 'players');
    }

    const player = {
      name: formData.get('name') as string,
      category: formData.get('category') as Category,
      basePrice: parseInt(formData.get('basePrice') as string),
      imageUrl: imageUrl,
      status: 'Available',
      stats: {
        matches: parseInt(formData.get('matches') as string),
        runs: formData.get('runs') ? parseInt(formData.get('runs') as string) : null,
        wickets: formData.get('wickets') ? parseInt(formData.get('wickets') as string) : null,
        strikeRate: formData.get('strikeRate') ? parseFloat(formData.get('strikeRate') as string) : null,
        economy: formData.get('economy') ? parseFloat(formData.get('economy') as string) : null,
      }
    };
    const newPlayerRef = doc(collection(db, 'players'));
    await setDoc(newPlayerRef, player);
    setIsAddingPlayer(false);
  };

  const editPlayer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPlayer) return;
    const formData = new FormData(e.currentTarget);
    const imageFile = formData.get('imageFile') as File;
    let imageUrl = formData.get('imageUrl') as string;

    if (imageFile && imageFile.size > 0) {
      imageUrl = await uploadImage(imageFile, 'players');
    }

    const player = {
      name: formData.get('name') as string,
      category: formData.get('category') as Category,
      basePrice: parseInt(formData.get('basePrice') as string),
      imageUrl: imageUrl,
      stats: {
        matches: parseInt(formData.get('matches') as string),
        runs: formData.get('runs') ? parseInt(formData.get('runs') as string) : null,
        wickets: formData.get('wickets') ? parseInt(formData.get('wickets') as string) : null,
        strikeRate: formData.get('strikeRate') ? parseFloat(formData.get('strikeRate') as string) : null,
        economy: formData.get('economy') ? parseFloat(formData.get('economy') as string) : null,
      }
    };
    await updateDoc(doc(db, 'players', editingPlayer.id), player);
    setEditingPlayer(null);
  };

  const addTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const mobileNumber = formData.get('mobileNumber') as string;
    const email = formData.get('email') as string;
    const password = Math.random().toString(36).slice(-8);
    const imageFile = formData.get('imageFile') as File;
    let logoUrl = formData.get('logoUrl') as string;

    if (imageFile && imageFile.size > 0) {
      logoUrl = await uploadImage(imageFile, 'teams');
    }

    try {
      // Create Firebase Auth user via REST API — avoids secondary app interfering with admin auth
      const apiKey = firebaseConfig.apiKey;
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: false }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        if (err.error?.message !== 'EMAIL_EXISTS') {
          throw new Error(err.error?.message || 'Failed to create auth account');
        }
      }

      const captainId = formData.get('captainId') as string;
      const viceCaptainId = formData.get('viceCaptainId') as string;

      if (!captainId || !viceCaptainId) {
        throw new Error('Both Captain and Vice Captain must be selected.');
      }

      if (captainId === viceCaptainId) {
        throw new Error('Captain and Vice Captain cannot be the same player.');
      }

      const teamData = {
        name: formData.get('name') as string,
        totalBudget: parseInt(formData.get('totalBudget') as string),
        remainingBudget: parseInt(formData.get('totalBudget') as string),
        color: formData.get('color') as string,
        logoUrl: logoUrl,
        mobileNumber: mobileNumber,
        email: email,
        players: [],
        captainId,
        viceCaptainId
      };
      
      const newTeamRef = doc(collection(db, 'teams'));
      await setDoc(newTeamRef, teamData);
      // Store email + password in admin-only private subcollection
      await setDoc(doc(db, 'teams', newTeamRef.id, 'private', 'contact'), { email, password });
      
      setGeneratedTeamCreds({ mobile: mobileNumber, email: email, pass: password });
      setIsAddingTeam(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const downloadTeamsCSV = () => {
    const headers = ['Team Name', 'Email', 'Mobile Number', 'Total Budget', 'Remaining Budget'];
    const rows = teams.map(team => [
      team.name,
      team.email || '',
      team.mobileNumber || '',
      team.totalBudget,
      team.remainingBudget
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'teams_credentials.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadImportedCredsCSV = (creds: { name: string; email: string; password: string }[]) => {
    const headers = ['Team Name', 'Email', 'Password'];
    const rows = creds.map(c => [c.name, c.email, c.password]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', 'imported_team_credentials.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const editTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTeam) return;
    
    try {
      const formData = new FormData(e.currentTarget);
      const imageFile = formData.get('imageFile') as File;
      let logoUrl = formData.get('logoUrl') as string;

      if (imageFile && imageFile.size > 0) {
        logoUrl = await uploadImage(imageFile, 'teams');
      }

      const captainId = formData.get('captainId') as string;
      const viceCaptainId = formData.get('viceCaptainId') as string;

      if (!captainId || !viceCaptainId) {
        setError('Both Captain and Vice Captain must be selected.');
        return;
      }

      if (captainId === viceCaptainId) {
        setError('Captain and Vice Captain cannot be the same player.');
        return;
      }

      const emailVal = formData.get('email') as string;
      const team = {
        name: formData.get('name') as string,
        totalBudget: parseInt(formData.get('totalBudget') as string),
        color: formData.get('color') as string,
        logoUrl: logoUrl,
        mobileNumber: formData.get('mobileNumber') as string,
        captainId,
        viceCaptainId,
        ...(emailVal ? { email: emailVal } : {}),
      };
      
      await updateDoc(doc(db, 'teams', editingTeam.id), team);
      
      // Update email in admin-only private subcollection (only if admin)
      if (emailVal && userProfile?.role === 'admin') {
        await setDoc(doc(db, 'teams', editingTeam.id, 'private', 'contact'), { email: emailVal }, { merge: true });
      }
      
      setEditingTeam(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `teams/${editingTeam.id}`);
      setError('Failed to update team: ' + err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const bulkDeletePlayers = async () => {
    if (selectedPlayerIds.length === 0) return;
    try {
      const chunks = [];
      for (let i = 0; i < selectedPlayerIds.length; i += 500) chunks.push(selectedPlayerIds.slice(i, i + 500));
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(id => {
          const p = players.find(pl => pl.id === id);
          batch.delete(doc(db, 'players', id));
          if (p?.soldTo) {
            batch.update(doc(db, 'teams', p.soldTo), {
              players: arrayRemove(id),
              remainingBudget: increment(p.soldPrice || 0)
            });
          }
        });
        await batch.commit();
      }
      setSelectedPlayerIds([]);
      setIsSelectionMode(false);
    } catch (err: any) {
      setError('Bulk delete failed: ' + err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const bulkMarkUnsold = async () => {
    if (selectedPlayerIds.length === 0) return;
    try {
      const chunks = [];
      for (let i = 0; i < selectedPlayerIds.length; i += 500) chunks.push(selectedPlayerIds.slice(i, i + 500));
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(id => {
          const p = players.find(pl => pl.id === id);
          batch.update(doc(db, 'players', id), { status: 'Unsold', soldTo: deleteField(), soldPrice: deleteField() });
          if (p?.soldTo) {
            batch.update(doc(db, 'teams', p.soldTo), {
              players: arrayRemove(id),
              remainingBudget: increment(p.soldPrice || 0)
            });
          }
        });
        await batch.commit();
      }
      setSelectedPlayerIds([]);
      setIsSelectionMode(false);
    } catch (err: any) {
      setError('Bulk update failed: ' + err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const deletePlayer = async (id: string) => {    try {
      const p = players.find(player => player.id === id);
      if (!p) return;

      const batch = writeBatch(db);
      batch.delete(doc(db, 'players', id));

      if (p.soldTo) {
        batch.update(doc(db, 'teams', p.soldTo), {
          players: arrayRemove(id),
          remainingBudget: increment(p.soldPrice || 0)
        });
      }

      await batch.commit();
    } catch (err: any) {
      console.error("Delete player error:", err);
      setError("Failed to delete player: " + err.message);
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      const team = teams.find(t => t.id === id);

      // Delete Firebase Auth account — sign in as the team user then delete
      if (team?.email && team?.password) {
        try {
          const secondaryApp = initializeApp(firebaseConfig, `del-${Date.now()}`);
          const secondaryAuth = getAuth(secondaryApp);
          const { deleteUser } = await import('firebase/auth');
          const cred = await signInWithEmailAndPassword(secondaryAuth, team.email, team.password);
          await deleteUser(cred.user);
          await deleteApp(secondaryApp);
        } catch (_) {
          // Non-fatal — Auth user may already be deleted or password stale
        }
      }

      // Delete private subcollection doc first
      try {
        await deleteDoc(doc(db, 'teams', id, 'private', 'contact'));
      } catch (_) {
        // Non-fatal — may not exist for older teams
      }

      const batch = writeBatch(db);
      batch.delete(doc(db, 'teams', id));
      players.filter(p => p.soldTo === id).forEach(player => {
        batch.update(doc(db, 'players', player.id), {
          status: 'Available',
          soldTo: deleteField(),
          soldPrice: deleteField()
        });
      });
      await batch.commit();
    } catch (err: any) {
      console.error("Delete team error:", err);
      setError("Failed to delete team: " + err.message);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              {loginMode === 'admin' ? <Settings className="w-8 h-8 text-emerald-500" /> : <Shield className="w-8 h-8 text-blue-500" />}
            </div>
            <h2 className="text-3xl font-bold">{loginMode === 'admin' ? 'Admin Login' : 'Team Login'}</h2>
            <p className="text-white/40 mt-2">Enter your credentials to access the portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-xs font-bold text-white/40 uppercase mb-2 block flex items-center gap-2">
                {loginMode === 'admin' ? <Mail className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                {loginMode === 'admin' ? 'Email Address' : 'Mobile Number or Email'}
              </label>
              <input 
                name="identifier" 
                type="text" 
                required 
                placeholder={loginMode === 'admin' ? 'admin@example.com' : 'team@example.com'}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-white/40 uppercase mb-2 block flex items-center gap-2">
                <Lock className="w-3 h-3" />
                Password
              </label>
              <div className="relative">
                <input 
                  name="password" 
                  type={showPassword ? 'text' : 'password'} 
                  required 
                  placeholder="••••••••"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                {loginError}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button 
                type="submit"
                className="w-full py-4 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                Sign In
              </button>
              <button 
                type="button"
                onClick={() => setView('portal')}
                className="w-full py-4 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-all border border-white/10"
              >
                Back to Portal
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  if (view === 'portal') {
    const scheduledMs = settings.scheduledStartTime;
    const msUntilStart = scheduledMs ? scheduledMs - Date.now() : null;
    const showCountdown = msUntilStart !== null && msUntilStart > 0 && auction.status === 'Idle';

    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 gap-6">
        {/* Header with branding */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
              <Trophy className="w-7 h-7 text-black" />
            </div>
            <h1 className="text-4xl font-black tracking-tight">CricAuction</h1>
          </div>
          <p className="text-white/40 text-sm">Select your portal to get started</p>
        </div>

        {/* Scheduled start countdown */}
        {showCountdown && (
          <div className="flex items-center gap-3 px-6 py-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-bold">Auction starts in <ScheduleCountdown targetMs={scheduledMs!} /></span>
          </div>
        )}
        {/* Spectator count */}
        <div className="flex items-center gap-2 text-white/20 text-xs font-bold">
          <EyeIcon className="w-3.5 h-3.5" />
          <span>{spectatorCount} {spectatorCount === 1 ? 'person' : 'people'} online</span>
        </div>
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={() => setView('public')}
            className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-center"
          >
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Trophy className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Public View</h2>
            <p className="text-white/40 text-sm mb-4">Watch the live auction as a spectator.</p>
            <div className="text-xs text-white/20 space-y-1">
              <p>• Real-time bidding updates</p>
              <p>• Player statistics & history</p>
              <p>• No login required</p>
            </div>
            <ArrowRight className="w-5 h-5 mx-auto mt-6 text-white/20 group-hover:text-emerald-500 transition-colors" />
          </button>

          <button 
            onClick={() => {
              if (user && userProfile?.role === 'team') {
                setView('team');
              } else {
                setLoginMode('team');
                setView('login');
              }
            }}
            className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-center"
          >
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Shield className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Team Portal</h2>
            <p className="text-white/40 text-sm mb-4">Login as a team owner to place bids.</p>
            <div className="text-xs text-white/20 space-y-1">
              <p>• Place bids on players</p>
              <p>• Manage your squad</p>
              <p>• Track budget & stats</p>
            </div>
            <ArrowRight className="w-5 h-5 mx-auto mt-6 text-white/20 group-hover:text-blue-500 transition-colors" />
          </button>

          <button 
            onClick={() => {
              if (user && userProfile?.role === 'admin') {
                setView('admin');
              } else {
                setLoginMode('admin');
                setView('login');
              }
            }}
            className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-center"
          >
            <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Settings className="w-8 h-8 text-purple-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Admin Portal</h2>
            <p className="text-white/40 text-sm mb-4">Manage players, teams, and settings.</p>
            <div className="text-xs text-white/20 space-y-1">
              <p>• Control auction flow</p>
              <p>• Add/edit players & teams</p>
              <p>• Configure settings</p>
            </div>
            <ArrowRight className="w-5 h-5 mx-auto mt-6 text-white/20 group-hover:text-purple-500 transition-colors" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="w-full max-w-full mx-auto px-3 sm:px-4 md:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 cursor-pointer flex-shrink-0" onClick={() => setView('portal')}>
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
            </div>
            <span className="font-bold text-base sm:text-xl tracking-tight hidden xs:inline">CricAuction</span>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest text-white/40 hidden sm:inline">
              {view === 'admin' ? 'Admin Mode' : view === 'team' ? 'Team Mode' : 'Live View'}
            </span>
            {user && (
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
              >
                <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> 
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
            <button 
              onClick={() => setView('portal')}
              className="px-2 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 hover:bg-white/10 transition-all hidden md:block"
            >
              Switch Portal
            </button>
            <button
              onClick={() => setSoundEnabled(v => !v)}
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/40 hover:text-white"
              title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
            </button>
          </div>
        </div>
      </nav>

      <main className="w-full min-h-screen mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[60] bg-red-500/90 backdrop-blur-md text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-2xl flex items-center gap-2 sm:gap-3 border border-red-400/50 max-w-[90vw] sm:max-w-md text-sm sm:text-base"
            >
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {view === 'public' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 lg:gap-8">
            {/* Left Column: Live Auction */}
            <div className="lg:col-span-8 space-y-8">
              <section className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
                
                {auction.status === 'Active' && currentPlayer ? (
                  <div className="p-8">
                    <div className="flex flex-col md:flex-row gap-8">
                      <div className="w-full md:w-64 aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative group">
                        <PlayerAvatar
                          playerId={currentPlayer.id}
                          imageUrl={currentPlayer.imageUrl}
                          name={currentPlayer.name}
                          teams={teams}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          badgeSize="md"
                        />
                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/20">
                          {currentPlayer.category}
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-6">
                        <div>
                          <h2 className="text-4xl font-bold tracking-tight mb-2">{currentPlayer.name}</h2>
                          <div className="flex flex-wrap gap-4 text-sm text-white/60">
                            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {currentPlayer.stats.matches} Matches</span>
                            {currentPlayer.stats.runs && <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> {currentPlayer.stats.runs} Runs</span>}
                            {currentPlayer.stats.wickets && <span className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> {currentPlayer.stats.wickets} Wickets</span>}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                            <p className="text-xs text-white/40 uppercase tracking-wider font-bold mb-1">Base Price</p>
                            <p className="text-2xl font-mono font-bold text-emerald-400">₹{currentPlayer.basePrice}L</p>
                          </div>
                          <div className="bg-emerald-500/10 rounded-2xl p-4 border border-emerald-500/20">
                            <p className="text-xs text-emerald-400/60 uppercase tracking-wider font-bold mb-1">Current Bid</p>
                            <p className="text-2xl font-mono font-bold text-emerald-400">₹{auction.highestBid}L</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                              <Timer className={cn("w-6 h-6", displayTime <= 5 ? "text-red-500 animate-pulse" : "text-white/60")} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-white/40 font-bold uppercase">Time Remaining</p>
                                {auction.status === 'Active' && (
                                  <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                                    <span className="text-[10px] text-red-500 font-bold uppercase tracking-tighter">Live</span>
                                  </span>
                                )}
                              </div>
                              <p className={cn("text-xl font-mono font-bold", displayTime <= 5 ? "text-red-500" : "text-white")}>
                                {displayTime}s
                              </p>
                            </div>
                          </div>
                          
                          {highestBidder && (
                            <div className="text-right flex items-center gap-4">
                              <div className="hidden md:flex items-center gap-3 pr-4 border-r border-white/10">
                                <div className="text-right">
                                  <p className="text-[10px] text-white/40 uppercase font-bold">Player Stats</p>
                                  <div className="flex gap-2 text-[10px] font-mono font-bold">
                                    <span className="text-white">{currentPlayer.stats.runs || 0}R</span>
                                    <span className="text-white/40">|</span>
                                    <span className="text-white">{currentPlayer.stats.wickets || 0}W</span>
                                    <span className="text-white/40">|</span>
                                    <span className="text-white">{currentPlayer.stats.economy || 'N/A'}E</span>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-white/40 font-bold uppercase">Highest Bidder</p>
                                <p className="text-lg font-bold text-white" style={{ textShadow: `0 0 20px ${highestBidder.color}` }}>{highestBidder.name}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Player Stats Chart */}
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Performance Statistics</p>
                          <PlayerStatsChart stats={currentPlayer.stats} />
                        </div>

                        {/* Bid History Feed */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">All Bid History (Latest First)</p>
                            <span className="text-xs font-mono font-bold text-emerald-400">{auction.bidHistory?.length || 0} bids</span>
                          </div>
                          <div className="space-y-2 pr-2 custom-scrollbar">
                            <AnimatePresence initial={false}>
                              {descendingBidHistory.length > 0 ? (
                                descendingBidHistory.map((bid, idx) => (
                                  <motion.div 
                                    key={bid.timestamp + idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center justify-between text-sm py-2 px-3 bg-white/5 rounded-lg border border-white/10 hover:border-emerald-500/30 transition-all"
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                                      <span className="text-white/80 font-medium truncate">{bid.bidderName}</span>
                                    </div>
                                    <span className="font-mono font-bold text-emerald-400 flex-shrink-0">₹{bid.amount}L</span>
                                  </motion.div>
                                ))
                              ) : (
                                <p className="text-xs text-white/20 italic text-center py-4">No bids yet...</p>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-96 flex flex-col items-center justify-center text-center p-8">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                      <LayoutDashboard className="w-10 h-10 text-white/20" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Auction Idle</h3>
                    <p className="text-white/40 max-w-sm">Waiting for the administrator to select a player and start the next round.</p>
                    {settings.scheduledStartTime && settings.scheduledStartTime > Date.now() && (
                      <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-sm">
                        <Calendar className="w-4 h-4" />
                        <span>Starts in <ScheduleCountdown targetMs={settings.scheduledStartTime} /></span>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Player List */}
              <section>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-500" />
                  Player Pool
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-white/20 font-normal">
                    <EyeIcon className="w-3.5 h-3.5" /> {spectatorCount} watching
                  </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {players.map(player => (
                    <div 
                      key={player.id}
                      className={cn(
                        "p-4 rounded-2xl border transition-all",
                        player.status === 'Sold' ? "bg-emerald-500/5 border-emerald-500/20" : 
                        player.status === 'Unsold' ? "bg-red-500/5 border-red-500/20 opacity-60" :
                        "bg-white/5 border-white/10 hover:border-white/20"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <PlayerAvatar
                          playerId={player.id}
                          imageUrl={player.imageUrl}
                          name={player.name}
                          teams={teams}
                          className="w-12 h-12 rounded-xl object-cover"
                          badgeSize="xs"
                        />
                        <div className="flex-1">
                          <h4 className="font-bold">{player.name}</h4>
                          <p className="text-xs text-white/40">{player.category} • Base ₹{player.basePrice}L</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <span className={cn(
                            "text-[10px] font-bold uppercase px-2 py-1 rounded-full border",
                            player.status === 'Sold' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                            player.status === 'Unsold' ? "bg-red-500/20 text-red-400 border-red-500/30" :
                            "bg-white/10 text-white/60 border-white/20"
                          )}>
                            {player.status}
                          </span>
                          {player.status === 'Sold' && (
                            <p className="text-xs font-bold text-emerald-400">₹{player.soldPrice}L</p>
                          )}
                          <button 
                            onClick={() => setSelectedPlayerProfile(player)}
                            className="text-[10px] font-bold uppercase text-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-1"
                          >
                            View Profile <ChevronRight className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              setComparePlayerIds(prev =>
                                prev.includes(player.id)
                                  ? prev.filter(id => id !== player.id)
                                  : prev.length < 3 ? [...prev, player.id] : prev
                              );
                            }}
                            className={cn(
                              "text-[10px] font-bold uppercase flex items-center gap-1 transition-colors",
                              comparePlayerIds.includes(player.id) ? "text-blue-400" : "text-white/30 hover:text-blue-400"
                            )}
                          >
                            <GitCompare className="w-3 h-3" />
                            {comparePlayerIds.includes(player.id) ? 'Added' : 'Compare'}
                          </button>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span className="text-[10px] text-white/40"><span className="text-white/70 font-bold">{player.stats.matches}</span> M</span>
                          {player.stats.runs != null && <span className="text-[10px] text-white/40"><span className="text-white/70 font-bold">{player.stats.runs}</span> R</span>}
                          {player.stats.wickets != null && <span className="text-[10px] text-white/40"><span className="text-white/70 font-bold">{player.stats.wickets}</span> W</span>}
                          {player.stats.strikeRate != null && <span className="text-[10px] text-white/40"><span className="text-white/70 font-bold">{player.stats.strikeRate}</span> SR</span>}
                          {player.stats.economy != null && <span className="text-[10px] text-white/40"><span className="text-white/70 font-bold">{player.stats.economy}</span> Eco</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right Column: Teams */}
            <div className="lg:col-span-4 space-y-8">
              <section>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  Teams Standing
                </h3>
                {/* Budget leaderboard */}
                <div className="mb-6 bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs font-black uppercase tracking-widest text-white/40">Budget Leaderboard</span>
                  </div>
                  {[...teams].sort((a, b) => b.remainingBudget - a.remainingBudget).map((team, i) => {
                    const pct = team.totalBudget > 0 ? (team.remainingBudget / team.totalBudget) * 100 : 0;
                    return (
                      <div key={team.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0">
                        <span className="text-xs font-black text-white/20 w-4">{i + 1}</span>
                        <div className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center text-[9px] font-black text-white overflow-hidden" style={{ backgroundColor: team.color }}>
                          {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-cover" loading="lazy" /> : team.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{team.name}</p>
                          <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: team.color }} />
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-400 flex-shrink-0">₹{team.remainingBudget}L</span>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-4">
                  {teams.map(team => (
                    <div key={team.id} className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                      <div className="h-1" style={{ backgroundColor: team.color }} />
                      <div className="p-4">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-3">
                            {team.logoUrl ? (
                              <img src={team.logoUrl} className="w-10 h-10 rounded-xl object-cover border border-white/10" referrerPolicy="no-referrer" loading="lazy" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-lg font-black text-white" style={{ backgroundColor: team.color }}>
                                {team.name[0]}
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-lg">{team.name}</h4>
                              <p className="text-xs text-white/40">
                                Captain: {players.find(p => p.id === team.captainId)?.name || 'TBD'} · Vice: {players.find(p => p.id === team.viceCaptainId)?.name || 'TBD'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Budget</p>
                            <p className="font-mono font-bold text-emerald-400">₹{team.remainingBudget}L</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {team.players.length > 0 ? (
                            team.players.map(pid => {
                              const p = players.find(pl => pl.id === pid);
                              return (
                                <div key={pid} className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 overflow-hidden" title={p?.name}>
                                  {p && (
                                    <PlayerAvatar
                                      playerId={p.id}
                                      imageUrl={p.imageUrl}
                                      name={p.name}
                                      teams={teams}
                                      className="w-full h-full object-cover"
                                      badgeSize="xs"
                                    />
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-white/20 italic">No players bought yet</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {view === 'admin' && (
          <div className="w-full max-w-[100%] mx-auto space-y-12 px-4 sm:px-6 lg:px-8">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-purple-500 rounded-2xl flex items-center justify-center shadow-xl shadow-purple-500/20">
                  <Settings className="w-7 h-7 text-black" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Admin Portal</h2>
                  <p className="text-white/40 font-medium">Auction Control & Management</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={generateSampleData}
                  disabled={isGenerating}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 hover:bg-blue-500/20 transition-all font-bold text-sm shadow-lg shadow-blue-500/5 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> {isGenerating ? 'Generating...' : 'Sample Data'}
                </button>
                {players.some(p => p.status === 'Unsold') && (
                  <button
                    onClick={reAuctionUnsold}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-yellow-500/10 text-yellow-400 rounded-xl border border-yellow-500/20 hover:bg-yellow-500/20 transition-all font-bold text-sm"
                  >
                    <RotateCcw className="w-4 h-4" /> Re-auction Unsold ({players.filter(p => p.status === 'Unsold').length})
                  </button>
                )}
                <button 
                  onClick={() => setShowResetConfirm(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all font-bold text-sm shadow-lg shadow-red-500/5"
                >
                  <RotateCcw className="w-4 h-4" /> Reset All
                </button>
                {teams.some(t => !t.email) && (
                  <button
                    onClick={backfillTeamEmails}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-orange-500/10 text-orange-400 rounded-xl border border-orange-500/20 hover:bg-orange-500/20 transition-all font-bold text-sm"
                    title="Backfill email field on team docs missing it"
                  >
                    <Mail className="w-4 h-4" /> Fix Team Emails ({teams.filter(t => !t.email).length})
                  </button>
                )}
              </div>
            </header>

            {/* CSV Data Management */}
            <section className="bg-white/5 rounded-[2.5rem] border border-white/10 p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <FileText className="w-6 h-6 text-emerald-500" />
                    CSV Data Management
                  </h3>
                  <p className="text-white/40 mt-1">Bulk import players and teams using CSV files.</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => downloadSampleCSV('players')}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-sm font-bold"
                  >
                    <Download className="w-4 h-4" /> Players Sample
                  </button>
                  <button 
                    onClick={() => downloadSampleCSV('teams')}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-sm font-bold"
                  >
                    <Download className="w-4 h-4" /> Teams Sample
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-black/20 rounded-3xl p-6 border border-white/5 flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4">
                    <User className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h4 className="font-bold mb-2">Import Players</h4>
                  <p className="text-xs text-white/40 mb-6">Upload a CSV file containing player details and statistics.</p>
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    ref={playerCsvInputRef}
                    onChange={(e) => handleCSVUpload(e, 'players')}
                  />
                  <button 
                    onClick={() => playerCsvInputRef.current?.click()}
                    className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> Upload Players CSV
                  </button>
                </div>

                <div className="bg-black/20 rounded-3xl p-6 border border-white/5 flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-blue-500" />
                  </div>
                  <h4 className="font-bold mb-2">Import Teams</h4>
                  <p className="text-xs text-white/40 mb-6">Upload a CSV file containing team names, budgets, and colors.</p>
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    ref={teamCsvInputRef}
                    onChange={(e) => handleCSVUpload(e, 'teams')}
                  />
                  <button 
                    onClick={() => teamCsvInputRef.current?.click()}
                    className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-400 transition-all flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> Upload Teams CSV
                  </button>
                </div>
              </div>
            </section>

            {/* Import Status Dialog */}
            <AnimatePresence>
              {importStatus && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setImportStatus(null)}>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                  >
                    <div className="text-center mb-6">
                      <div className={cn(
                        "w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center",
                        importStatus.status === 'processing' ? "bg-blue-500/20 text-blue-500" :
                        importStatus.status === 'completed' ? "bg-emerald-500/20 text-emerald-500" :
                        "bg-red-500/20 text-red-500"
                      )}>
                        {importStatus.status === 'processing' ? <Loader2 className="w-8 h-8 animate-spin" /> :
                         importStatus.status === 'completed' ? <CheckCircle2 className="w-8 h-8" /> :
                         <AlertCircle className="w-8 h-8" />}
                      </div>
                      <h3 className="text-2xl font-bold">
                        {importStatus.status === 'processing' ? `Importing ${importStatus.type}...` :
                         importStatus.status === 'completed' ? 'Import Successful' :
                         'Import Failed'}
                      </h3>
                      <p className="text-white/40 mt-1">
                        {importStatus.status === 'processing' ? `Processing ${importStatus.progress} of ${importStatus.total} records` :
                         importStatus.status === 'completed' ? `Successfully imported ${importStatus.total} ${importStatus.type}` :
                         importStatus.error}
                      </p>
                    </div>

                    {importStatus.status === 'processing' && (
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-6">
                        <motion.div 
                          className="h-full bg-blue-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${(importStatus.progress / (importStatus.total || 1)) * 100}%` }}
                        />
                      </div>
                    )}

                    {importStatus.status !== 'processing' && (
                      <div className="flex flex-col gap-3">
                        {importStatus.status === 'completed' && importStatus.type === 'teams' && importedTeamCreds.length > 0 && (
                          <button
                            onClick={() => downloadImportedCredsCSV(importedTeamCreds)}
                            className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                          >
                            <Download className="w-5 h-5" /> Download Credentials CSV
                          </button>
                        )}
                        <button 
                          onClick={() => setImportStatus(null)}
                          className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold transition-all border border-white/10"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
              {/* Live Auction Control - Full Width */}
              <div className="lg:col-span-4">
                <section className={cn(
                  "p-4 md:p-6 rounded-3xl border transition-all",
                  auction.status === 'Active' ? "bg-emerald-500/5 border-emerald-500/20" : "bg-white/5 border-white/10"
                )}>
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 overflow-x-auto">
                    <div className="flex items-start md:items-center gap-3 md:gap-6 flex-1 min-w-0">
                      <div className="w-14 md:w-20 h-14 md:h-20 flex-shrink-0 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                        {currentPlayer ? (
                          <PlayerAvatar
                            playerId={currentPlayer.id}
                            imageUrl={currentPlayer.imageUrl}
                            name={currentPlayer.name}
                            teams={teams}
                            className="w-full h-full object-cover"
                            badgeSize="xs"
                          />
                        ) : (
                          <User className="w-10 h-10 text-white/10" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-2xl font-bold">{currentPlayer?.name || 'No Active Player'}</h3>
                          {auction.status === 'Active' && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 text-[10px] font-bold uppercase animate-pulse">Live</span>
                          )}
                        </div>
                        <p className="text-white/40 text-sm">{currentPlayer ? `${currentPlayer.category} • Base ₹${currentPlayer.basePrice}L` : 'Select a player from the list below to start an auction.'}</p>
                      </div>
                    </div>

                    {auction.status !== 'Active' && currentPlayer && (
                      <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-3 w-full md:w-auto">
                        <div className="text-right">
                          <p className="text-[10px] text-white/40 font-bold uppercase mb-1">Status</p>
                          <p className="text-lg font-bold text-white/60">
                            {auction.status === 'Ended' ? 'Auction Ended' : auction.status === 'Paused' ? 'Paused' : 'Ready to Start'}
                          </p>
                        </div>
                        {auction.status === 'Paused' ? (
                          <button
                            onClick={resumeAuction}
                            className="px-6 md:px-8 py-2 md:py-3 bg-yellow-500 text-black rounded-xl font-bold hover:bg-yellow-400 transition-all flex items-center gap-2 text-sm md:text-base w-full md:w-auto justify-center"
                          >
                            <Play className="w-5 h-5 fill-current" /> Resume
                          </button>
                        ) : (
                          <button
                            onClick={() => startAuction(currentPlayer.id)}
                            className="px-6 md:px-8 py-2 md:py-3 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all flex items-center gap-2 text-sm md:text-base w-full md:w-auto justify-center"
                          >
                            <Play className="w-5 h-5 fill-current" /> Start Auction
                          </button>
                        )}
                        <button
                          onClick={() => updateDoc(doc(db, 'auction', 'state'), { currentPlayerId: null, status: 'Idle' })}
                          className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:text-white transition-all"
                          title="Clear Selection"
                        >
                          <RotateCcw className="w-5 h-5" />
                        </button>
                      </div>
                    )}

                    {auction.status === 'Active' && (
                      <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center sm:justify-start gap-4 md:gap-6 lg:gap-8 w-full md:w-auto">
                        <div className="text-center">
                          <p className="text-[10px] text-white/40 font-bold uppercase mb-1">Current Bid</p>
                          <p className="text-2xl font-mono font-bold text-emerald-400">₹{auction.highestBid}L</p>
                          {highestBidder && <p className="text-xs font-bold text-white" style={{ textShadow: `0 0 12px ${highestBidder.color}` }}>by {highestBidder.name}</p>}
                        </div>
                        <div className="text-center md:text-left">
                          <p className="text-[10px] text-white/40 font-bold uppercase mb-1">Time Left</p>
                          <p className={cn("text-2xl font-mono font-bold", displayTime <= 5 ? "text-red-500" : "text-white")}>{displayTime}s</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setShowResetTimerConfirm(true)}
                            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/10 transition-all"
                          >
                            Reset Timer
                          </button>
                          <button
                            onClick={pauseAuction}
                            className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-xl text-sm font-bold hover:bg-yellow-500/20 transition-all"
                          >
                            Pause
                          </button>
                          <div className="w-px h-8 bg-white/10" />
                          <button 
                            onClick={() => setShowEndAuctionConfirm(true)}
                            className="px-6 py-2 bg-red-500 text-black rounded-xl text-sm font-bold hover:bg-red-400 transition-all flex items-center gap-2"
                          >
                            <AlertCircle className="w-4 h-4" />
                            End Auction
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Settings & Manage Teams */}
              <div className="lg:col-span-1 space-y-6">
                <section className="bg-white/5 p-6 rounded-3xl border border-white/10">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-purple-500" />
                    Auction Settings
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-white/40 font-bold uppercase mb-2 block">Max Players Per Team</label>
                      <input 
                        type="number" 
                        value={settings.maxPlayersPerTeam}
                        onChange={(e) => updateSettings({ ...settings, maxPlayersPerTeam: parseInt(e.target.value) })}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 font-bold uppercase mb-2 block">Min Bid Increment (₹L)</label>
                      <input 
                        type="number" 
                        value={settings.minBidIncrement}
                        onChange={(e) => updateSettings({ ...settings, minBidIncrement: parseInt(e.target.value) })}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 font-bold uppercase mb-2 block">Timer Duration (s)</label>
                      <input 
                        type="number" 
                        value={settings.timerDuration}
                        onChange={(e) => updateSettings({ ...settings, timerDuration: parseInt(e.target.value) })}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 font-bold uppercase mb-2 block flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Scheduled Start Time
                      </label>
                      <input
                        type="datetime-local"
                        value={settings.scheduledStartTime
                          ? new Date(settings.scheduledStartTime - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                          : ''}
                        onChange={(e) => updateSettings({
                          ...settings,
                          scheduledStartTime: e.target.value ? new Date(e.target.value).getTime() : undefined
                        })}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                      />
                      {settings.scheduledStartTime && settings.scheduledStartTime > Date.now() && (
                        <p className="text-[10px] text-blue-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Starts in <ScheduleCountdown targetMs={settings.scheduledStartTime} />
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="bg-white/5 p-6 rounded-3xl border border-white/10">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-500" />
                      Manage Teams
                    </h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={downloadTeamsCSV}
                        className="p-2 bg-green-500/10 text-green-400 rounded-lg border border-green-500/20 hover:bg-green-500/20 transition-all"
                        title="Download Teams CSV"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {importedTeamCreds.length > 0 && (
                        <button
                          onClick={() => downloadImportedCredsCSV(importedTeamCreds)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all text-xs font-bold"
                          title="Re-download imported team credentials"
                        >
                          <Download className="w-3.5 h-3.5" /> Credentials
                        </button>
                      )}
                      <button 
                        onClick={() => setIsAddingTeam(true)}
                        className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mb-4 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                    <input 
                      type="text" 
                      placeholder="Search teams..." 
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {teams.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase())).map(team => (
                      <div key={team.id} className="p-3 bg-black/20 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 overflow-hidden flex-shrink-0" style={{ backgroundColor: team.color }}>
                              {team.logoUrl ? (
                                <img src={team.logoUrl || null} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                              ) : (
                                <Shield className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <span className="text-sm font-bold truncate text-white">{team.name}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); setTeamCredsModal({ name: team.name, email: team.email || '', password: team.password || '' }); }} className="p-1.5 text-white/40 hover:text-yellow-400 transition-colors" title="View / Reset Credentials"><Lock className="w-3.5 h-3.5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setEditingTeam(team); }} className="p-1.5 text-white/40 hover:text-white transition-colors"><Settings className="w-3.5 h-3.5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setTeamToDelete(team.id); }} className="p-1.5 text-red-500/40 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/40">Budget: ₹{team.remainingBudget}L</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setBudgetAdjustTeamId(team.id); setBudgetAdjustAmount(''); setBudgetAdjustMode('add'); setBudgetAdjustTarget('remaining'); setShowBudgetAdjust(true); }}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-all"
                              title="Adjust Budget"
                            >
                              <Calculator className="w-3 h-3" /> Budget
                            </button>
                            {auction.status === 'Active' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setBidAdjustTeamId(team.id); setBidAdjustAmount(String(auction.highestBid + settings.minBidIncrement)); setShowBidAdjust(true); }}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-all"
                              >
                                <Coins className="w-3 h-3" /> Bid
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Player Management */}
              <div className="lg:col-span-3 space-y-6">
                <section className="bg-[#1a1a1a] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] -mr-32 -mt-32 pointer-events-none" />
                  
                  <div className="flex flex-col gap-5 mb-10 md:mb-12">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 w-full">
                      <div className="w-full sm:w-auto min-w-0">
                        <h3 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent tracking-tight">Player Management</h3>
                        <p className="text-white/40 text-xs sm:text-sm mt-1 sm:mt-2 font-medium">Manage your auction pool and player statistics</p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
                        <div className="relative w-full sm:w-44 flex-1 sm:flex-none">
                          <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-5 pr-10 py-2.5 sm:py-3.5 text-xs sm:text-sm font-bold focus:border-emerald-500/50 outline-none transition-all appearance-none cursor-pointer text-white/80 hover:bg-white/[0.08]"
                          >
                            <option value="All" className="bg-gray-800 text-white">All Status</option>
                            <option value="Available" className="bg-gray-800 text-white">Available</option>
                            <option value="Sold" className="bg-gray-800 text-white">Sold</option>
                            <option value="Unsold" className="bg-gray-800 text-white">Unsold</option>
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20">
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                        <button 
                          onClick={() => { setIsSelectionMode(m => !m); setSelectedPlayerIds([]); }}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2.5 sm:py-3.5 rounded-2xl transition-all font-bold text-xs sm:text-sm whitespace-nowrap border",
                            isSelectionMode
                              ? "bg-white/10 border-white/20 text-white"
                              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                          )}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="hidden sm:inline">{isSelectionMode ? 'Cancel' : 'Select'}</span>
                        </button>
                        <button 
                          onClick={() => setIsAddingPlayer(true)}
                          className="flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3.5 bg-emerald-500 text-black rounded-2xl hover:bg-emerald-400 transition-all font-bold text-xs sm:text-sm whitespace-nowrap justify-center shadow-lg shadow-emerald-500/20 active:scale-95 flex-1 sm:flex-none"
                        >
                          <Plus className="w-4 sm:w-5 h-4 sm:h-5" /> <span className="hidden sm:inline">Add Player</span><span className="sm:hidden">Add</span>
                        </button>                      </div>
                    </div>

                    <div className="relative w-full max-w-full">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-white/20 focus-within:text-emerald-500 transition-colors" />
                      <input 
                        type="text" 
                        placeholder="Search name or category..."
                        value={playerSearch}
                        onChange={(e) => setPlayerSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3.5 text-xs sm:text-sm focus:border-emerald-500/50 focus:bg-white/[0.08] outline-none transition-all placeholder:text-white/10 shadow-inner shadow-white/5"
                      />
                    </div>
                  </div>

                  {/* Stats Summary Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8 md:mb-10">
                    {[
                      { label: 'Total Players', value: players.length, color: 'text-white', icon: Users, bg: 'bg-white/5' },
                      { label: 'Available', value: players.filter(p => p.status === 'Available').length, color: 'text-emerald-500', icon: CheckCircle2, bg: 'bg-emerald-500/5' },
                      { label: 'Sold', value: players.filter(p => p.status === 'Sold').length, color: 'text-blue-500', icon: Trophy, bg: 'bg-blue-500/5' },
                      { label: 'Unsold', value: players.filter(p => p.status === 'Unsold').length, color: 'text-red-500', icon: X, bg: 'bg-red-500/5' }
                    ].map((stat, idx) => (
                      <div key={idx} className={cn("border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 transition-all hover:border-white/10 group relative overflow-hidden", stat.bg)}>
                        <div className="absolute top-0 right-0 p-1 md:p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                          <stat.icon className="w-8 md:w-12 h-8 md:h-12" />
                        </div>
                        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-1 md:mb-2">{stat.label}</p>
                        <p className={cn("text-2xl md:text-3xl font-mono font-bold", stat.color)}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Advanced Filters & Sorting */}
                  <div className="space-y-4 mb-6 md:mb-8">
                    {/* Filters Section */}
                    <div className="bg-white/5 rounded-2xl md:rounded-[2rem] border border-white/5 shadow-inner shadow-white/5 p-4 md:p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 flex-shrink-0">
                          <Filter className="w-4 h-4 text-emerald-500" />
                        </div>
                        <span className="text-xs md:text-sm font-black uppercase tracking-wider text-white/40">Filters</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Min Runs Filter */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-white/30 block">
                            Min Runs
                          </label>
                          <div className="relative">
                            <input 
                              type="number" 
                              value={minRuns}
                              onChange={(e) => setMinRuns(e.target.value === '' ? '' : parseInt(e.target.value))}
                              placeholder="0"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500/50 focus:bg-black/60 outline-none transition-all placeholder:text-white/20 font-mono"
                            />
                            {minRuns !== '' && (
                              <button 
                                onClick={() => setMinRuns('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                                title="Clear"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Max Wickets Filter */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-white/30 block">
                            Max Wickets
                          </label>
                          <div className="relative">
                            <input 
                              type="number" 
                              value={maxWickets}
                              onChange={(e) => setMaxWickets(e.target.value === '' ? '' : parseInt(e.target.value))}
                              placeholder="0"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500/50 focus:bg-black/60 outline-none transition-all placeholder:text-white/20 font-mono"
                            />
                            {maxWickets !== '' && (
                              <button 
                                onClick={() => setMaxWickets('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                                title="Clear"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Clear Filters Button */}
                      {(minRuns !== '' || maxWickets !== '') && (
                        <button
                          onClick={() => {
                            setMinRuns('');
                            setMaxWickets('');
                          }}
                          className="mt-4 flex items-center gap-2 px-4 py-2 text-xs font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Clear Filters
                        </button>
                      )}
                    </div>

                    {/* Sorting Section */}
                    <div className="bg-white/5 rounded-2xl md:rounded-[2rem] border border-white/5 shadow-inner shadow-white/5 p-4 md:p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 flex-shrink-0">
                          <ArrowUpDown className="w-4 h-4 text-blue-500" />
                        </div>
                        <span className="text-xs md:text-sm font-black uppercase tracking-wider text-white/40">Sort By</span>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* Sort Field */}
                        <div className="flex-1">
                          <div className="relative">
                            <select 
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as any)}
                              className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-sm font-bold focus:border-blue-500/50 outline-none transition-all appearance-none cursor-pointer hover:bg-black/60"
                            >
                              <option value="name" className="bg-gray-800 text-white">Name</option>
                              <option value="basePrice" className="bg-gray-800 text-white">Base Price</option>
                              <option value="runs" className="bg-gray-800 text-white">Runs</option>
                              <option value="wickets" className="bg-gray-800 text-white">Wickets</option>
                            </select>
                            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                          </div>
                        </div>

                        {/* Sort Order */}
                        <button 
                          onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all group sm:w-auto"
                          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                        >
                          <ArrowUpDown className={cn("w-4 h-4 transition-transform duration-300", sortOrder === 'desc' ? "rotate-180 text-blue-400" : "text-white/40")} />
                          <span className="text-sm font-bold text-white/60 group-hover:text-white transition-colors">
                            {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bulk action bar */}
                  {isSelectionMode && (
                    <div className="flex items-center justify-between gap-3 mb-4 p-3 bg-white/5 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedPlayerIds(filteredPlayers.map(p => p.id))}
                          className="text-xs font-bold text-white/60 hover:text-white transition-colors"
                        >
                          Select All ({filteredPlayers.length})
                        </button>
                        {selectedPlayerIds.length > 0 && (
                          <span className="text-xs text-emerald-400 font-bold">{selectedPlayerIds.length} selected</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={bulkMarkUnsold}
                          disabled={selectedPlayerIds.length === 0}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-xl hover:bg-yellow-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className="w-3 h-3" /> Mark Unsold
                        </button>
                        <button
                          onClick={bulkDeletePlayers}
                          disabled={selectedPlayerIds.length === 0}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3 h-3" /> Delete Selected
                        </button>
                      </div>
                    </div>
                  )}

                  {filteredPlayers.length === 0 ? (                    <div className="py-12 md:py-20 text-center border border-dashed border-white/10 rounded-[2rem] px-4 md:px-0">
                      <div className="w-12 md:w-16 h-12 md:h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="w-6 md:w-8 h-6 md:h-8 text-white/10" />
                      </div>
                      <h4 className="text-lg md:text-xl font-bold text-white/40">No players found</h4>
                      <p className="text-white/20 text-xs md:text-sm mt-1">Try adjusting your filters or search terms</p>
                      <button 
                        onClick={() => {
                          setPlayerSearch('');
                          setStatusFilter('All');
                          setMinRuns('');
                          setMaxWickets('');
                        }}
                        className="mt-6 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                        {paginatedPlayers.map(player => (
                        <motion.div 
                          layout
                          key={player.id} 
                          onClick={() => {
                            if (!isSelectionMode) {
                              setSelectedPlayerForDetails(player);
                            } else {
                              setSelectedPlayerIds(prev => 
                                prev.includes(player.id) 
                                  ? prev.filter(id => id !== player.id) 
                                  : [...prev, player.id]
                              );
                            }
                          }}
                          className={cn(
                            "group relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col cursor-pointer hover:border-emerald-500/50",
                            isSelectionMode && selectedPlayerIds.includes(player.id) ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-white/10"
                          )}
                        >
                          {/* Selection Checkbox */}
                          {isSelectionMode && (
                            <div className="absolute top-2 right-2 z-20">
                              <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                selectedPlayerIds.includes(player.id) ? "bg-emerald-500 border-emerald-500" : "bg-black/40 border-white/30"
                              )}>
                                {selectedPlayerIds.includes(player.id) && <CheckCircle2 className="w-3 h-3 text-black" />}
                              </div>
                            </div>
                          )}

                          {/* Image */}
                          <div className="relative h-32 sm:h-40 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent z-1" />
                            <PlayerAvatar
                              playerId={player.id}
                              imageUrl={player.imageUrl}
                              name={player.name}
                              teams={teams}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              badgeSize="sm"
                            />
                          </div>

                          {/* Content */}
                          <div className="p-3 flex-1 flex flex-col justify-between">
                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">{player.name}</h4>
                              <p className="text-[10px] text-white/40 truncate">{player.category}</p>
                            </div>

                            {/* Status Badge */}
                            <div className="mt-2 flex items-center justify-between gap-1">
                              <span className={cn(
                                "px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border flex-1 text-center",
                                player.status === 'Available' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                player.status === 'Sold' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                "bg-red-500/10 text-red-500 border-red-500/20"
                              )}>
                                {player.status === 'Available' ? 'Avail' : player.status === 'Sold' ? 'Sold' : 'Unsold'}
                              </span>
                              {player.status === 'Available' && !isSelectionMode && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startAuction(player.id);
                                  }}
                                  className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors"
                                  title="Start Auction"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                </button>
                              )}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isSelectionMode) {
                                    setEditingPlayer(player);
                                  }
                                }}
                                className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
                                title="Edit"
                              >
                                <Settings className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="mt-6 sm:mt-8 space-y-3">
                        <p className="text-xs sm:text-sm text-white/40 text-center sm:text-left">
                          Showing {((playersPage - 1) * playersPerPage) + 1}-{Math.min(playersPage * playersPerPage, filteredPlayers.length)} of {filteredPlayers.length} players
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3">
                          <button
                            onClick={() => setPlayersPage(p => Math.max(1, p - 1))}
                            disabled={playersPage === 1}
                            className="w-full sm:w-auto px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <div className="flex items-center gap-1 sm:gap-2">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (playersPage <= 3) {
                                pageNum = i + 1;
                              } else if (playersPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = playersPage - 2 + i;
                              }
                              return (
                                <button
                                  key={pageNum}
                                  onClick={() => setPlayersPage(pageNum)}
                                  className={cn(
                                    "w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-bold transition-all",
                                    playersPage === pageNum
                                      ? "bg-emerald-500 text-black"
                                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                                  )}
                                >
                                  {pageNum}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => setPlayersPage(p => Math.min(totalPages, p + 1))}
                            disabled={playersPage === totalPages}
                            className="w-full sm:w-auto px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                    </>
                  )}
                </section>
              </div>
            </div>

            {/* Modals for CRUD */}
            <AnimatePresence>
              {(isAddingPlayer || editingPlayer) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl" onClick={() => { setIsAddingPlayer(false); setEditingPlayer(null); }}>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#121212] border border-white/10 rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative overflow-hidden"
                  >
                    {/* Decorative background element */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h3 className="text-3xl font-bold text-white">{editingPlayer ? 'Edit Player' : 'Add New Player'}</h3>
                          <p className="text-white/40 text-sm mt-1">Fill in the professional details for the auction pool</p>
                        </div>
                        <button 
                          onClick={() => { setIsAddingPlayer(false); setEditingPlayer(null); }}
                          className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>

                      <form onSubmit={editingPlayer ? editPlayer : addPlayer} className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                          <div className="col-span-2">
                            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 block">Full Name</label>
                            <input 
                              name="name" 
                              defaultValue={editingPlayer?.name} 
                              required 
                              placeholder="e.g. Virat Kohli"
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:border-emerald-500/50 focus:bg-white/[0.07] outline-none transition-all" 
                            />
                          </div>
                          
                          <div>
                            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 block">Category</label>
                            <div className="relative">
                              <select 
                                name="category" 
                                defaultValue={editingPlayer?.category || 'Batsman'} 
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:border-emerald-500/50 outline-none transition-all appearance-none cursor-pointer"
                              >
                                <option value="Batsman" className="bg-gray-800 text-white">Batsman</option>
                                <option value="Bowler" className="bg-gray-800 text-white">Bowler</option>
                                <option value="All-Rounder" className="bg-gray-800 text-white">All-Rounder</option>
                                <option value="Wicket-Keeper" className="bg-gray-800 text-white">Wicket-Keeper</option>
                              </select>
                              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
                            </div>
                          </div>
                          
                          <div>
                            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 block">Base Price (₹L)</label>
                            <input 
                              name="basePrice" 
                              type="number" 
                              defaultValue={editingPlayer?.basePrice} 
                              required 
                              placeholder="20"
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:border-emerald-500/50 outline-none transition-all" 
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 block">Profile Image</label>
                            <div className="space-y-3">
                              <div className="relative group">
                                <input 
                                  name="imageFile" 
                                  type="file" 
                                  accept="image/*"
                                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-xs focus:border-emerald-500 outline-none file:mr-4 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-emerald-500 file:text-black hover:file:bg-emerald-400 cursor-pointer" 
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-white/20 uppercase font-black">OR</span>
                                <input 
                                  name="imageUrl" 
                                  defaultValue={editingPlayer?.imageUrl} 
                                  placeholder="Paste image URL here..."
                                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:border-emerald-500/50 outline-none transition-all" 
                                />
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                    input.value = `https://picsum.photos/seed/${Math.random()}/400/400`;
                                  }}
                                  className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase hover:bg-white/10 transition-all"
                                >
                                  Random
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="col-span-2 grid grid-cols-3 gap-4 p-5 bg-white/5 rounded-[2rem] border border-white/5">
                            <div>
                              <label className="text-[10px] font-black text-white/20 uppercase tracking-tighter mb-1 block">Matches</label>
                              <input name="matches" type="number" defaultValue={editingPlayer?.stats.matches} required className="w-full bg-transparent border-b border-white/10 px-1 py-1 text-sm focus:border-emerald-500 outline-none transition-all font-mono" />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-white/20 uppercase tracking-tighter mb-1 block">Runs</label>
                              <input name="runs" type="number" defaultValue={editingPlayer?.stats.runs} className="w-full bg-transparent border-b border-white/10 px-1 py-1 text-sm focus:border-emerald-500 outline-none transition-all font-mono" />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-white/20 uppercase tracking-tighter mb-1 block">Wickets</label>
                              <input name="wickets" type="number" defaultValue={editingPlayer?.stats.wickets} className="w-full bg-transparent border-b border-white/10 px-1 py-1 text-sm focus:border-emerald-500 outline-none transition-all font-mono" />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-white/20 uppercase tracking-tighter mb-1 block">Strike Rate</label>
                              <input name="strikeRate" type="number" step="0.1" defaultValue={editingPlayer?.stats.strikeRate} className="w-full bg-transparent border-b border-white/10 px-1 py-1 text-sm focus:border-emerald-500 outline-none transition-all font-mono" />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-white/20 uppercase tracking-tighter mb-1 block">Economy</label>
                              <input name="economy" type="number" step="0.1" defaultValue={editingPlayer?.stats.economy} className="w-full bg-transparent border-b border-white/10 px-1 py-1 text-sm focus:border-emerald-500 outline-none transition-all font-mono" />
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-4 mt-10">
                          <button 
                            type="button" 
                            onClick={() => { setIsAddingPlayer(false); setEditingPlayer(null); }} 
                            className="flex-1 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 font-bold text-white/60 hover:bg-white/10 transition-all"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit" 
                            className="flex-1 px-8 py-4 rounded-2xl bg-emerald-500 text-black font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all active:scale-95"
                          >
                            {editingPlayer ? 'Update Player' : 'Create Player'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </motion.div>
                </div>
              )}

              {(isAddingTeam || editingTeam) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => { setIsAddingTeam(false); setEditingTeam(null); }}>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                  >
                    <h3 className="text-2xl font-bold mb-6">{editingTeam ? 'Edit Team' : 'Add New Team'}</h3>
                    <form onSubmit={editingTeam ? editTeam : addTeam} className="space-y-4">
                      <div className="md:col-span-2">
                        <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Team Logo</label>
                        <div className="flex flex-col gap-2">
                          <input 
                            name="imageFile" 
                            type="file" 
                            accept="image/*"
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-xs focus:border-blue-500 outline-none file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20" 
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/20 uppercase font-bold">OR URL</span>
                            <input 
                              name="logoUrl" 
                              defaultValue={editingTeam?.logoUrl} 
                              placeholder="https://example.com/logo.png"
                              className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none" 
                            />
                            <button 
                              type="button"
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                input.value = `https://picsum.photos/seed/${Math.random()}/200/200`;
                              }}
                              className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all"
                            >
                              Random
                            </button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Team Name</label>
                        <input name="name" defaultValue={editingTeam?.name} required className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Email (for Login)</label>
                        <input name="email" type="email" defaultValue={editingTeam?.email} required placeholder="team@example.com" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Mobile Number</label>
                        <input name="mobileNumber" type="tel" defaultValue={editingTeam?.mobileNumber} required placeholder="9876543210" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Total Budget (₹L)</label>
                        <input name="totalBudget" type="number" defaultValue={editingTeam?.totalBudget} required className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Theme Color</label>
                        <input name="color" type="color" defaultValue={editingTeam?.color || '#3b82f6'} className="w-full h-10 bg-black/50 border border-white/10 rounded-xl px-1 py-1 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Captain (Player)</label>
                        <select name="captainId" defaultValue={editingTeam?.captainId || ''} required className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none text-white">
                          <option value="">Select a Captain</option>
                          {players.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Vice Captain (Player)</label>
                        <select name="viceCaptainId" defaultValue={editingTeam?.viceCaptainId || ''} required className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none text-white">
                          <option value="">Select Vice Captain</option>
                          {players.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-3 mt-8">
                        <button type="button" onClick={() => { setIsAddingTeam(false); setEditingTeam(null); }} className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 font-bold">Cancel</button>
                        <button type="submit" className="flex-1 px-4 py-2 rounded-xl bg-blue-500 text-white font-bold">Save Team</button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
              {playerToDelete && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setPlayerToDelete(null)}>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
                  >
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Delete Player?</h3>
                    <p className="text-white/60 mb-8">
                      Are you sure you want to delete <span className="text-white font-bold">{players.find(p => p.id === playerToDelete)?.name}</span>? This action cannot be undone.
                    </p>
                    <div className="flex gap-3">
                      <button onClick={() => setPlayerToDelete(null)} className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all">Cancel</button>
                      <button 
                        onClick={() => {
                          deletePlayer(playerToDelete);
                          setPlayerToDelete(null);
                        }} 
                        className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-400 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
              {teamToDelete && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setTeamToDelete(null)}>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
                  >
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Delete Team?</h3>
                    <p className="text-white/60 mb-8">
                      Are you sure you want to delete <span className="text-white font-bold">{teams.find(t => t.id === teamToDelete)?.name}</span>? This action cannot be undone.
                    </p>
                    <div className="flex gap-3">
                      <button onClick={() => setTeamToDelete(null)} className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all">Cancel</button>
                      <button 
                        onClick={() => {
                          deleteTeam(teamToDelete);
                          setTeamToDelete(null);
                        }} 
                        className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-400 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
              {showResetConfirm && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)}>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
                  >
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <RotateCcw className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Reset Auction?</h3>
                    <p className="text-white/60 mb-8">
                      This will <span className="text-red-400 font-bold">DELETE ALL</span> teams and players from the database. This action cannot be undone.
                    </p>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setShowResetConfirm(false)} 
                        disabled={isResetting}
                        className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={confirmReset} 
                        disabled={isResetting}
                        className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isResetting ? (
                          <>
                            <RotateCcw className="w-4 h-4 animate-spin" />
                            Resetting...
                          </>
                        ) : (
                          'Reset All'
                        )}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* End Auction Confirmation */}
              {showEndAuctionConfirm && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowEndAuctionConfirm(false)}>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#1a1a1a] border border-red-500/30 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
                  >
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">End Auction Now?</h3>
                    <p className="text-white/60 mb-2">
                      This will finalize the current auction for <strong className="text-white">{currentPlayer?.name}</strong>.
                    </p>
                    {auction.highestBidderId ? (
                      <p className="text-emerald-400 text-sm mb-8">
                        Player will be sold to <strong>{highestBidder?.name}</strong> for ₹{auction.highestBid}L
                      </p>
                    ) : (
                      <p className="text-amber-400 text-sm mb-8">
                        Player will be marked as <strong>Unsold</strong>
                      </p>
                    )}
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setShowEndAuctionConfirm(false)}
                        className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => {
                          endAuction();
                          setShowEndAuctionConfirm(false);
                        }}
                        className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-400 transition-all"
                      >
                        End Now
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Reset Timer Confirmation */}
              {showResetTimerConfirm && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowResetTimerConfirm(false)}>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#1a1a1a] border border-blue-500/30 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
                  >
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Timer className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Reset Timer?</h3>
                    <p className="text-white/60 mb-8">
                      This will reset the auction timer to <strong className="text-white">{settings.timerDuration} seconds</strong> and restart the countdown.
                    </p>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setShowResetTimerConfirm(false)}
                        className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => {
                          updateDoc(doc(db, 'auction', 'state'), { startTime: Date.now(), timeLeft: settings.timerDuration });
                          setShowResetTimerConfirm(false);
                        }}
                        className="flex-1 px-4 py-3 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-400 transition-all"
                      >
                        Reset Timer
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
              {generatedTeamCreds && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setGeneratedTeamCreds(null)}>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#1a1a1a] border border-emerald-500/30 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
                  >
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Shield className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Team Created!</h3>
                    <p className="text-white/60 mb-6 text-sm">
                      Share these credentials with the team owner. They can login using their email.
                    </p>
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/10 mb-8 text-left space-y-3">
                      <div>
                        <p className="text-[10px] text-white/40 uppercase font-bold">Login Email</p>
                        <p className="font-mono text-emerald-400 font-bold">{generatedTeamCreds.email}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 uppercase font-bold">Mobile Number</p>
                        <p className="font-mono text-emerald-400/60 text-xs">{generatedTeamCreds.mobile}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 uppercase font-bold">Generated Password</p>
                        <p className="font-mono text-emerald-400 font-bold">{generatedTeamCreds.pass}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 uppercase font-bold">Login Link</p>
                        <p className="text-[10px] text-blue-400 truncate">{window.location.origin}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setGeneratedTeamCreds(null)} 
                      className="w-full py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-all"
                    >
                      Got it
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`🏏 CricAuction Login\n\nTeam: ${generatedTeamCreds.email.split('@')[0]}\nEmail: ${generatedTeamCreds.email}\nPassword: ${generatedTeamCreds.pass}\nLogin: ${window.location.origin}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] font-bold hover:bg-[#25D366]/20 transition-all flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" /> Share via WhatsApp
                    </a>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Team Credentials Modal */}
            <AnimatePresence>
              {teamCredsModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setTeamCredsModal(null)}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl"
                  >
                    <div className="w-14 h-14 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-7 h-7 text-yellow-400" />
                    </div>
                    <h3 className="text-xl font-bold text-center mb-1">{teamCredsModal.name}</h3>
                    <p className="text-white/40 text-xs text-center mb-6">Login credentials — share with team owner</p>

                    <div className="bg-black/40 rounded-2xl border border-white/10 p-4 space-y-3 mb-6">
                      <div>
                        <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Email</p>
                        <p className="font-mono text-sm text-emerald-400 break-all">{teamCredsModal.email || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Password</p>
                        {teamCredsModal.password ? (
                          <p className="font-mono text-sm text-emerald-400">{teamCredsModal.password}</p>
                        ) : (
                          <p className="text-xs text-white/30 italic">Not on record — use Reset to generate a new one</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => resetTeamPassword(teams.find(t => t.name === teamCredsModal.name && t.email === teamCredsModal.email)!)}
                        className="w-full py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-bold hover:bg-yellow-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" /> Reset Password
                      </button>
                      <button
                        onClick={() => setTeamCredsModal(null)}
                        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all"
                      >
                        Close
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {view === 'team' && (
          <div className="max-w-5xl mx-auto w-full space-y-6 sm:space-y-8">
            {!userProfile?.teamId ? (
              <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10 p-12">
                <Shield className="w-16 h-16 text-red-500/50 mx-auto mb-6" />
                <h2 className="text-3xl font-bold mb-4">Access Denied</h2>
                <p className="text-white/40 mb-8">Your account is not associated with any team. Please contact the administrator.</p>
                <button onClick={() => setView('portal')} className="px-8 py-3 bg-white/10 rounded-xl font-bold hover:bg-white/20 transition-all">Back to Portal</button>
              </div>
            ) : (
              <div className="space-y-6 sm:space-y-8">
            {/* Team Header */}
            <header className="p-4 sm:p-6 bg-[#1a1a1a] rounded-2xl sm:rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
              <div 
                className="absolute top-0 right-0 w-48 h-48 blur-[80px] -mr-24 -mt-24 pointer-events-none opacity-20" 
                style={{ backgroundColor: teams.find(t => t.id === userProfile.teamId)?.color || '#10b981' }}
              />
              <div className="relative z-10 flex flex-row items-center justify-between gap-4">
                {/* Left: logo + name */}
                <div className="flex items-center gap-3 min-w-0">
                  {teams.find(t => t.id === userProfile.teamId)?.logoUrl && (
                    <img 
                      src={teams.find(t => t.id === userProfile.teamId)?.logoUrl || null} 
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl object-cover border-2 flex-shrink-0 shadow-xl"
                      loading="lazy"
                      style={{ borderColor: `${teams.find(t => t.id === userProfile.teamId)?.color || '#10b981'}40` }}
                      referrerPolicy="no-referrer" 
                    />
                  )}
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white leading-tight truncate">
                      {teams.find(t => t.id === userProfile.teamId)?.name}
                    </h2>
                    <p className="text-white/40 text-xs sm:text-sm font-medium hidden sm:block">Team Management Dashboard</p>
                  </div>
                </div>
                {/* Right: budget */}
                <div className="flex-shrink-0 text-right bg-white/5 px-4 py-3 sm:px-6 sm:py-4 rounded-xl sm:rounded-2xl border border-white/10">
                  <p className="text-[9px] sm:text-[10px] text-white/40 uppercase font-black tracking-widest mb-1">Funds</p>
                  <p 
                    className="text-xl sm:text-3xl font-mono font-bold leading-none"
                    style={{ color: teams.find(t => t.id === userProfile.teamId)?.color || '#10b981' }}
                  >
                    ₹{teams.find(t => t.id === userProfile.teamId)?.remainingBudget}L
                  </p>
                  <div className="w-full h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ 
                        width: `${((teams.find(t => t.id === userProfile.teamId)?.remainingBudget || 0) / (teams.find(t => t.id === userProfile.teamId)?.totalBudget || 1000)) * 100}%` 
                      }}
                      transition={{ type: "spring", stiffness: 50, damping: 15 }}
                      className="h-full"
                      style={{ backgroundColor: teams.find(t => t.id === userProfile.teamId)?.color || '#10b981' }}
                    />
                  </div>
                  <p className="text-[9px] text-white/20 mt-1 font-black tracking-widest">
                    {Math.round(((teams.find(t => t.id === userProfile.teamId)?.remainingBudget || 0) / (teams.find(t => t.id === userProfile.teamId)?.totalBudget || 1000)) * 100)}% LEFT
                  </p>
                </div>
              </div>
            </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                  <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                    {auction.status === 'Ended' && currentPlayer ? (
                      <section className="bg-white/5 rounded-3xl border border-white/10 p-8 text-center relative overflow-hidden">
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative z-10"
                        >
                          <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-white/10 mx-auto mb-6 shadow-2xl">
                            <PlayerAvatar
                              playerId={currentPlayer.id}
                              imageUrl={currentPlayer.imageUrl}
                              name={currentPlayer.name}
                              teams={teams}
                              className="w-full h-full object-cover"
                              badgeSize="md"
                            />
                          </div>
                          <h3 className="text-4xl font-black mb-2 uppercase tracking-tighter italic">
                            {auction.highestBidderId ? 'Sold!' : 'Unsold'}
                          </h3>
                          <p className="text-xl font-bold mb-6">
                            {currentPlayer.name}
                          </p>
                          {auction.highestBidderId && (
                            <div className="bg-emerald-500 text-black px-8 py-4 rounded-2xl inline-block shadow-xl shadow-emerald-500/20">
                              <p className="text-[10px] uppercase font-black tracking-widest mb-1">Winning Team</p>
                              <p className="text-2xl font-bold">{teams.find(t => t.id === auction.highestBidderId)?.name}</p>
                              <p className="text-3xl font-mono font-black mt-1">₹{auction.highestBid}L</p>
                            </div>
                          )}
                        </motion.div>
                        {/* Background Decoration */}
                        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent opacity-50" />
                      </section>
                    ) : auction.status === 'Active' && currentPlayer ? (
                      <section className="bg-emerald-500/5 rounded-2xl sm:rounded-3xl border border-emerald-500/20 p-4 sm:p-8">
                        {teams.find(t => t.id === userProfile.teamId)?.players.length! >= settings.maxPlayersPerTeam && (
                          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-400">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-bold uppercase tracking-wider">Squad Full! You have reached the maximum limit of {settings.maxPlayersPerTeam} players.</p>
                          </div>
                        )}
                        {/* You're winning banner */}
                        {auction.highestBidderId === userProfile.teamId && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 p-4 bg-emerald-500 rounded-2xl flex items-center gap-3 shadow-xl shadow-emerald-500/30"
                          >
                            <Trophy className="w-6 h-6 text-black flex-shrink-0" />
                            <div>
                              <p className="text-black font-black uppercase tracking-widest text-sm">You're Winning!</p>
                              <p className="text-black/70 text-xs font-bold">Highest bid: ₹{auction.highestBid}L — hold on until the timer runs out.</p>
                            </div>
                          </motion.div>
                        )}
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <PlayerAvatar
                              playerId={currentPlayer.id}
                              imageUrl={currentPlayer.imageUrl}
                              name={currentPlayer.name}
                              teams={teams}
                              className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl object-cover border border-white/10 flex-shrink-0"
                              badgeSize="sm"
                            />
                            <div>
                              <h3 className="text-lg sm:text-2xl font-bold">{currentPlayer.name}</h3>
                              <p className="text-white/40 text-xs sm:text-sm">{currentPlayer.category} • Base ₹{currentPlayer.basePrice}L</p>
                              <div className="flex flex-wrap gap-2 sm:gap-3 mt-1 text-xs text-white/50">
                                <span>{currentPlayer.stats.matches} Matches</span>
                                {currentPlayer.stats.runs != null && <span>{currentPlayer.stats.runs} Runs</span>}
                                {currentPlayer.stats.wickets != null && <span>{currentPlayer.stats.wickets} Wkts</span>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-white/40 uppercase font-bold">Current Bid</p>
                            <p className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400">₹{auction.highestBid}L</p>
                          </div>
                        </div>

                        {/* Player Stats Chart */}
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-4 mb-6">
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Performance Statistics</p>
                          <PlayerStatsChart stats={currentPlayer.stats} />
                        </div>

                        <div className="space-y-4">
                          {/* Quick Bid Button */}
                          {auction.highestBidderId === null ? (
                            <button 
                              onClick={() => handleBid(auction.highestBid)}
                              disabled={teams.find(t => t.id === userProfile.teamId)?.players.length! >= settings.maxPlayersPerTeam}
                              className="w-full h-16 bg-emerald-500 rounded-2xl text-black font-bold text-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex flex-col items-center justify-center shadow-xl shadow-emerald-500/20 disabled:opacity-20 disabled:cursor-not-allowed disabled:grayscale"
                            >
                              <span>Opening Bid ₹{auction.highestBid}L</span>
                              <span className="text-xs opacity-60">Base Price</span>
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleBid(auction.highestBid + settings.minBidIncrement)}
                              disabled={teams.find(t => t.id === userProfile.teamId)?.players.length! >= settings.maxPlayersPerTeam}
                              className="w-full h-16 bg-emerald-500 rounded-2xl text-black font-bold text-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex flex-col items-center justify-center shadow-xl shadow-emerald-500/20 disabled:opacity-20 disabled:cursor-not-allowed disabled:grayscale"
                            >
                              <span>Bid ₹{auction.highestBid + settings.minBidIncrement}L</span>
                              <span className="text-xs opacity-60">+₹{settings.minBidIncrement}L increment</span>
                            </button>
                          )}

                          {/* Manual Amount Stepper */}
                          <div className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-3">
                            <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Custom Amount</p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setCustomBidAmount(v => String(Math.max(currentPlayer?.basePrice || 0, (parseInt(v) || auction.highestBid) - teamBidStep)))}
                                disabled={teams.find(t => t.id === userProfile.teamId)?.players.length! >= settings.maxPlayersPerTeam}
                                className="w-12 h-12 flex items-center justify-center bg-white/10 border border-white/10 rounded-xl hover:bg-white/20 active:scale-95 transition-all disabled:opacity-20 text-white"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <input
                                type="number"
                                placeholder={String(auction.highestBid + settings.minBidIncrement)}
                                value={customBidAmount}
                                onChange={(e) => setCustomBidAmount(e.target.value)}
                                disabled={teams.find(t => t.id === userProfile.teamId)?.players.length! >= settings.maxPlayersPerTeam}
                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold focus:border-emerald-500 outline-none transition-all disabled:opacity-20"
                              />
                              <button
                                onClick={() => setCustomBidAmount(v => String((parseInt(v) || auction.highestBid) + teamBidStep))}
                                disabled={teams.find(t => t.id === userProfile.teamId)?.players.length! >= settings.maxPlayersPerTeam}
                                className="w-12 h-12 flex items-center justify-center bg-white/10 border border-white/10 rounded-xl hover:bg-white/20 active:scale-95 transition-all disabled:opacity-20 text-white"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            {/* Step Size Selector */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-white/30 font-bold uppercase whitespace-nowrap">Step:</span>
                              <div className="flex gap-1.5 flex-1">
                                {[settings.minBidIncrement, 25, 50, 100].map(step => (
                                  <button
                                    key={step}
                                    onClick={() => setTeamBidStep(step)}
                                    className={cn(
                                      "flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all",
                                      teamBidStep === step
                                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                        : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                                    )}
                                  >
                                    {step}L
                                  </button>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const amount = parseInt(customBidAmount);
                                if (!isNaN(amount) && amount > 0) handleBid(amount);
                              }}
                              disabled={!customBidAmount || isNaN(parseInt(customBidAmount)) || teams.find(t => t.id === userProfile.teamId)?.players.length! >= settings.maxPlayersPerTeam}
                              className="w-full py-3 bg-white/10 border border-white/10 rounded-xl text-white font-bold text-sm hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <ArrowRight className="w-4 h-4" />
                              Place ₹{customBidAmount || '—'}L Bid
                            </button>
                          </div>
                        </div>

                        {/* Bidding History for Teams */}
                        <div className="mt-6 sm:mt-8 space-y-3 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-bold uppercase tracking-widest text-white">Complete Bidding History (Latest First)</p>
                            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">{auction.bidHistory?.length || 0} bids</span>
                          </div>
                          <div className="space-y-2 pr-2 custom-scrollbar max-h-96 overflow-y-auto">
                            {descendingBidHistory.length > 0 ? (
                              descendingBidHistory.map((bid, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm py-2.5 px-4 bg-black/40 rounded-lg border border-white/10 hover:border-emerald-500/30 hover:bg-black/50 transition-all duration-200">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={cn(
                                      "w-2.5 h-2.5 rounded-full flex-shrink-0",
                                      bid.bidderId === userProfile?.teamId ? "bg-emerald-500" : "bg-blue-500/50"
                                    )} />
                                    <span className={cn("font-medium truncate", bid.bidderId === userProfile?.teamId ? "text-emerald-400 font-bold" : "text-white/70")}>
                                      {bid.bidderName} {bid.bidderId === userProfile?.teamId && <span className="text-emerald-400/80 ml-1">(You)</span>}
                                    </span>
                                  </div>
                                  <span className="font-mono font-bold text-white flex-shrink-0 ml-3">₹{bid.amount}L</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-white/30 italic text-center py-6">Waiting for bids...</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-6 flex flex-col items-center justify-center gap-4">
                          <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
                            <Timer className="w-4 h-4" />
                            <span>Auction ends in <span className="text-white font-mono font-bold">{displayTime}s</span></span>
                            {auction.status === 'Active' && (
                              <span className="flex items-center gap-1 ml-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                                <span className="text-[10px] text-red-500 font-bold uppercase">Live</span>
                              </span>
                            )}
                          </div>
                          
                          {displayTime === 0 && auction.status === 'Active' && (
                            auction.highestBidderId === userProfile?.teamId ? (
                              <button 
                                onClick={endAuction}
                                className="w-full py-4 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 transition-all animate-bounce"
                              >
                                Finalize My Win!
                              </button>
                            ) : auction.highestBidderId === null ? (
                              <button 
                                onClick={endAuction}
                                className="w-full py-4 bg-white/10 text-white font-black uppercase tracking-widest rounded-2xl border border-white/10 hover:bg-white/20 transition-all"
                              >
                                Finalize (Unsold)
                              </button>
                            ) : null
                          )}
                        </div>
                      </section>
                    ) : (
                      <div className="bg-white/5 rounded-2xl sm:rounded-3xl border border-white/10 p-6 sm:p-8">
                        {auction.status === 'Paused' ? (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Timer className="w-8 h-8 text-yellow-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-yellow-400 mb-2">Auction Paused</h3>
                            <p className="text-white/40 text-sm">The admin has paused the auction. Stand by.</p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <div className="text-center py-6">
                              <Coins className="w-16 h-16 text-white/10 mx-auto mb-4" />
                              <h3 className="text-2xl font-bold mb-2">No Active Auction</h3>
                              <p className="text-white/40 text-sm mb-6">Waiting for the admin to start the next round.</p>
                            </div>
                            
                            {/* Useful idle state information */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                  <Users className="w-4 h-4 text-blue-400" />
                                  <p className="text-xs text-white/40 uppercase font-bold">Squad Size</p>
                                </div>
                                <p className="text-2xl font-bold">
                                  {teams.find(t => t.id === userProfile.teamId)?.players.length || 0}
                                  <span className="text-sm text-white/40 ml-1">/ {settings.maxPlayersPerTeam}</span>
                                </p>
                                <p className="text-xs text-white/30 mt-1">
                                  {settings.maxPlayersPerTeam - (teams.find(t => t.id === userProfile.teamId)?.players.length || 0)} slots remaining
                                </p>
                              </div>
                              
                              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                                  <p className="text-xs text-white/40 uppercase font-bold">Available Players</p>
                                </div>
                                <p className="text-2xl font-bold text-emerald-400">
                                  {players.filter(p => p.status === 'Available').length}
                                </p>
                                <p className="text-xs text-white/30 mt-1">
                                  {players.filter(p => p.status === 'Sold').length} sold, {players.filter(p => p.status === 'Unsold').length} unsold
                                </p>
                              </div>
                            </div>

                            {budgetProjection && (
                              <div className="bg-blue-500/5 rounded-xl p-4 border border-blue-500/20">
                                <div className="flex items-center gap-2 mb-3">
                                  <Calculator className="w-4 h-4 text-blue-400" />
                                  <p className="text-xs text-blue-400 uppercase font-bold">Budget Projection</p>
                                </div>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-white/60">Avg. base price:</span>
                                    <span className="font-mono font-bold">₹{Math.round(budgetProjection.avgBasePrice)}L</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-white/60">Can afford ~</span>
                                    <span className="font-mono font-bold text-emerald-400">{budgetProjection.canAffordCount} players</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-white/60">Recommended buys:</span>
                                    <span className="font-mono font-bold text-blue-400">{budgetProjection.recommendedCount} players</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="text-center pt-4">
                              <p className="text-xs text-white/20">
                                You'll be notified when the next auction begins
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Confirmation Dialog */}
                    <AnimatePresence>
                      {showConfirmBid && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => { setShowConfirmBid(false); setPendingBidAmount(null); }}>
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ 
                              opacity: 1, 
                              scale: 1, 
                              y: 0,
                              transition: {
                                type: "spring",
                                damping: 15,
                                stiffness: 300
                              }
                            }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
                          >
                            <div className="w-24 h-24 rounded-2xl overflow-hidden border border-white/10 mx-auto mb-4 shadow-xl">
                              {currentPlayer && (
                                <PlayerAvatar
                                  playerId={currentPlayer.id}
                                  imageUrl={currentPlayer.imageUrl}
                                  name={currentPlayer.name}
                                  teams={teams}
                                  className="w-full h-full object-cover"
                                  badgeSize="sm"
                                />
                              )}
                            </div>
                            <h3 className="text-2xl font-bold mb-2">Confirm Your Bid</h3>
                            <p className="text-white/60 mb-6">
                              You are placing a bid for <span className="text-white font-bold">{currentPlayer?.name}</span>
                            </p>
                            
                            <div className="space-y-4 mb-8">
                              <div className="bg-black/40 rounded-2xl p-4 border border-white/10">
                                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Bid Amount</p>
                                <p className="text-3xl font-mono font-bold text-emerald-400">₹{pendingBidAmount}L</p>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-left">
                                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Your Budget</p>
                                  <p className="text-sm font-mono font-bold">₹{teams.find(t => t.id === userProfile.teamId)?.remainingBudget}L</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-left">
                                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">After Bid</p>
                                  <p className="text-sm font-mono font-bold text-red-400">₹{(teams.find(t => t.id === userProfile.teamId)?.remainingBudget || 0) - (pendingBidAmount || 0)}L</p>
                                </div>
                              </div>
                            </div>
                            {/* Budget warning */}
                            {(() => {
                              const myTeam = teams.find(t => t.id === userProfile.teamId);
                              const afterBid = (myTeam?.remainingBudget || 0) - (pendingBidAmount || 0);
                              const slotsLeft = Math.max(0, settings.maxPlayersPerTeam - (myTeam?.players.length || 0) - 1);
                              const availPlayers = players.filter(p => p.status === 'Available');
                              const avgBase = availPlayers.length > 0 ? availPlayers.reduce((s, p) => s + p.basePrice, 0) / availPlayers.length : 0;
                              const canAfford = avgBase > 0 ? Math.floor(afterBid / avgBase) : slotsLeft;
                              if (slotsLeft > 0 && canAfford < slotsLeft) {
                                return (
                                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 text-amber-400 text-xs">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>This bid leaves ₹{afterBid}L for {slotsLeft} remaining slot{slotsLeft > 1 ? 's' : ''} (avg base ₹{Math.round(avgBase)}L). You may not afford all slots.</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            <div className="flex gap-3">
                              <button onClick={() => setShowConfirmBid(false)} className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all">Cancel</button>
                              <button onClick={confirmBid} className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-all">Confirm Bid</button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>

                    <section>
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <h3 className="text-lg sm:text-xl font-bold">Your Squad</h3>
                        <div className="text-right">
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Total Spent</p>
                          <p className="text-lg sm:text-xl font-mono font-bold text-white">₹{(teams.find(t => t.id === userProfile.teamId)?.totalBudget || 0) - (teams.find(t => t.id === userProfile.teamId)?.remainingBudget || 0)}L</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {teams.find(t => t.id === userProfile.teamId)?.players.map(pid => {
                          const p = players.find(pl => pl.id === pid);
                          return (
                            <div key={pid} className="bg-white/5 rounded-xl sm:rounded-2xl border border-white/10 overflow-hidden group hover:border-emerald-500/30 transition-all">
                              <div className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                                <PlayerAvatar
                                  playerId={pid}
                                  imageUrl={p?.imageUrl || ''}
                                  name={p?.name}
                                  teams={teams}
                                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-white/10 flex-shrink-0"
                                  badgeSize="sm"
                                />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-base sm:text-lg truncate">{p?.name}</h4>
                                  <p className="text-xs text-white/40 font-medium uppercase tracking-wider">{p?.category}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Bought</p>
                                  <p className="text-base sm:text-lg font-mono font-bold text-emerald-400">₹{p?.soldPrice}L</p>
                                </div>
                              </div>
                              {p && (
                                <div className="px-4 pb-4">
                                  <PlayerStatsChart stats={p.stats} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {teams.find(t => t.id === userProfile.teamId)?.players.length === 0 && (
                          <div className="col-span-full py-12 text-center border border-dashed border-white/10 rounded-3xl">
                            <p className="text-white/20 italic">Your squad is empty. Start bidding!</p>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6 sm:space-y-8">
                    <section className="bg-white/5 rounded-2xl sm:rounded-3xl border border-white/10 p-4 sm:p-6">
                      <h3 className="font-bold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        Budget Analysis
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs font-bold uppercase mb-2">
                            <span className="text-white/40">Spent</span>
                            <span className="text-white">₹{(teams.find(t => t.id === userProfile.teamId)?.totalBudget || 0) - (teams.find(t => t.id === userProfile.teamId)?.remainingBudget || 0)}L</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 transition-all duration-1000" 
                              style={{ width: `${(((teams.find(t => t.id === userProfile.teamId)?.totalBudget || 0) - (teams.find(t => t.id === userProfile.teamId)?.remainingBudget || 0)) / (teams.find(t => t.id === userProfile.teamId)?.totalBudget || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed">
                          You have spent {(((teams.find(t => t.id === userProfile.teamId)?.totalBudget || 0) - (teams.find(t => t.id === userProfile.teamId)?.remainingBudget || 0)) / (teams.find(t => t.id === userProfile.teamId)?.totalBudget || 1) * 100).toFixed(1)}% of your total budget. 
                          Manage your remaining ₹{teams.find(t => t.id === userProfile.teamId)?.remainingBudget}L wisely.
                        </p>
                      </div>
                    </section>

                    {budgetProjection && (
                      <section className="bg-white/5 rounded-2xl sm:rounded-3xl border border-white/10 p-4 sm:p-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-400">
                          <Calculator className="w-4 h-4" />
                          Budget Projection
                        </h3>
                        <div className="space-y-4">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Avg. Base Price</p>
                              <p className="text-xl font-mono font-bold text-white">₹{budgetProjection.avgBasePrice.toFixed(1)}L</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Est. Affordable</p>
                              <p className="text-3xl font-mono font-bold text-blue-400">~{budgetProjection.canAffordCount}</p>
                            </div>
                          </div>
                          <p className="text-xs text-white/40 leading-relaxed border-t border-white/5 pt-4">
                            Based on the current market, you can afford approximately <span className="text-white font-bold">{budgetProjection.canAffordCount} more players</span> at their base prices. 
                            {budgetProjection.slotsLeft < budgetProjection.canAffordCount && (
                              <span className="block mt-1 text-amber-400/60">
                                Note: You only have {budgetProjection.slotsLeft} squad slots remaining.
                              </span>
                            )}
                          </p>
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Compare floating bar */}
        {comparePlayerIds.length >= 2 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-[#1a1a1a] border border-blue-500/30 rounded-2xl shadow-2xl shadow-blue-500/10">
            <GitCompare className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold text-white/70">{comparePlayerIds.length} players selected</span>
            <button
              onClick={() => setShowCompareModal(true)}
              className="px-4 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-xl hover:bg-blue-400 transition-all"
            >
              Compare
            </button>
            <button onClick={() => setComparePlayerIds([])} className="text-white/30 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Player Comparison Modal */}
        <AnimatePresence>
          {showCompareModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setShowCompareModal(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#1a1a1a] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
              >
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-5 h-5 text-blue-400" />
                    <h3 className="text-xl font-bold">Player Comparison</h3>
                  </div>
                  <button onClick={() => setShowCompareModal(false)} className="p-2 text-white/40 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6">
                  {/* Player headers */}
                  <div className={cn("grid gap-4 mb-6", comparePlayerIds.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
                    {comparePlayerIds.map(pid => {
                      const p = players.find(pl => pl.id === pid);
                      if (!p) return null;
                      return (
                        <div key={pid} className="text-center">
                          <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 mx-auto mb-3">
                            <PlayerAvatar playerId={p.id} imageUrl={p.imageUrl} name={p.name} teams={teams} className="w-full h-full object-cover" badgeSize="sm" />
                          </div>
                          <p className="font-bold text-sm">{p.name}</p>
                          <p className="text-xs text-white/40">{p.category}</p>
                          <p className="text-xs font-mono text-emerald-400 mt-1">Base ₹{p.basePrice}L</p>
                        </div>
                      );
                    })}
                  </div>
                  {/* Stat rows */}
                  {(['matches', 'runs', 'wickets', 'strikeRate', 'economy'] as const).map(stat => {
                    const vals = comparePlayerIds.map(pid => players.find(pl => pl.id === pid)?.stats[stat] ?? null);
                    const max = Math.max(...vals.filter(v => v !== null) as number[]);
                    const labels: Record<string, string> = { matches: 'Matches', runs: 'Runs', wickets: 'Wickets', strikeRate: 'Strike Rate', economy: 'Economy' };
                    return (
                      <div key={stat} className="mb-3">
                        <p className="text-[10px] text-white/30 uppercase font-bold mb-2">{labels[stat]}</p>
                        <div className={cn("grid gap-4", comparePlayerIds.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
                          {vals.map((val, i) => (
                            <div key={i} className={cn("p-3 rounded-xl border text-center", val === max && max > 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/10")}>
                              <p className={cn("text-lg font-mono font-bold", val === max && max > 0 ? "text-emerald-400" : "text-white/60")}>
                                {val ?? '—'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="p-6 border-t border-white/10 flex justify-between">
                  <button onClick={() => setComparePlayerIds([])} className="px-4 py-2 text-sm text-white/40 hover:text-white transition-colors">Clear Selection</button>
                  <button onClick={() => setShowCompareModal(false)} className="px-6 py-2 bg-white/10 rounded-xl font-bold text-sm hover:bg-white/20 transition-all">Close</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Player Profile Modal */}
        <AnimatePresence>
          {selectedPlayerProfile && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setSelectedPlayerProfile(null)}>
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#121212] border border-white/10 rounded-[2.5rem] max-w-2xl w-full overflow-hidden shadow-2xl relative"
              >
                <button 
                  onClick={() => setSelectedPlayerProfile(null)}
                  className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all z-10"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="relative h-48 bg-gradient-to-br from-emerald-500/20 to-blue-500/20">
                  <div className="absolute -bottom-12 left-8 flex items-end gap-6">
                    <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-[#121212] shadow-2xl">
                      <PlayerAvatar
                        playerId={selectedPlayerProfile.id}
                        imageUrl={selectedPlayerProfile.imageUrl}
                        name={selectedPlayerProfile.name}
                        teams={teams}
                        className="w-full h-full object-cover"
                        badgeSize="md"
                      />
                    </div>
                    <div className="pb-4">
                      <h2 className="text-3xl font-black">{selectedPlayerProfile.name}</h2>
                      <p className="text-emerald-400 font-bold uppercase tracking-widest text-sm">{selectedPlayerProfile.category}</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 pt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Player Statistics</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] text-white/20 uppercase font-bold mb-1">Runs</p>
                          <p className="text-xl font-mono font-bold">{selectedPlayerProfile.stats.runs || 0}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] text-white/20 uppercase font-bold mb-1">Wickets</p>
                          <p className="text-xl font-mono font-bold">{selectedPlayerProfile.stats.wickets || 0}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] text-white/20 uppercase font-bold mb-1">Matches</p>
                          <p className="text-xl font-mono font-bold">{selectedPlayerProfile.stats.matches || 0}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] text-white/20 uppercase font-bold mb-1">Avg/SR</p>
                          <p className="text-xl font-mono font-bold">{(selectedPlayerProfile.stats.runs || 0) / (selectedPlayerProfile.stats.matches || 1).toFixed(1)}</p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Auction Status</h3>
                      <div className={cn(
                        "p-4 rounded-2xl border flex items-center justify-between",
                        selectedPlayerProfile.status === 'Sold' ? "bg-emerald-500/10 border-emerald-500/20" :
                        selectedPlayerProfile.status === 'Unsold' ? "bg-red-500/10 border-red-500/20" :
                        "bg-white/5 border-white/10"
                      )}>
                        <div>
                          <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Current Status</p>
                          <p className={cn(
                            "font-bold",
                            selectedPlayerProfile.status === 'Sold' ? "text-emerald-400" :
                            selectedPlayerProfile.status === 'Unsold' ? "text-red-400" :
                            "text-white"
                          )}>{selectedPlayerProfile.status}</p>
                        </div>
                        {selectedPlayerProfile.status === 'Sold' && (
                          <div className="text-right">
                            <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Sold For</p>
                            <p className="text-xl font-mono font-bold text-white">₹{selectedPlayerProfile.soldPrice}L</p>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6">
                    {selectedPlayerProfile.status === 'Sold' && (
                      <section>
                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Purchased By</h3>
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex items-center gap-4">
                          <div 
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black"
                            style={{ backgroundColor: teams.find(t => t.id === selectedPlayerProfile.soldTo)?.color + '20', color: teams.find(t => t.id === selectedPlayerProfile.soldTo)?.color }}
                          >
                            {teams.find(t => t.id === selectedPlayerProfile.soldTo)?.name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-lg">{teams.find(t => t.id === selectedPlayerProfile.soldTo)?.name}</p>
                            <p className="text-xs text-white/40">Winning Bid: ₹{selectedPlayerProfile.soldPrice}L</p>
                          </div>
                        </div>
                      </section>
                    )}

                    <section>
                      <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Base Price</h3>
                      <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center">
                        <p className="text-4xl font-mono font-bold text-white">₹{selectedPlayerProfile.basePrice}L</p>
                        <p className="text-[10px] text-white/20 uppercase font-bold mt-2 tracking-widest">Opening Bid Requirement</p>
                      </div>
                    </section>
                  </div>
                </div>

                <div className="p-8 bg-white/5 border-t border-white/10 flex justify-end">
                  <button 
                    onClick={() => setSelectedPlayerProfile(null)}
                    className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all"
                  >
                    Close Profile
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Admin Budget Adjustment Modal */}
        <AnimatePresence>
          {showBudgetAdjust && budgetAdjustTeamId && (() => {
            const team = teams.find(t => t.id === budgetAdjustTeamId)!;
            const val = parseInt(budgetAdjustAmount) || 0;
            const previewRemaining = budgetAdjustMode === 'set' ? val
              : budgetAdjustMode === 'add' ? team.remainingBudget + val
              : team.remainingBudget - val;
            const previewTotal = budgetAdjustTarget === 'both'
              ? (budgetAdjustMode === 'set' ? val
                : budgetAdjustMode === 'add' ? team.totalBudget + val
                : team.totalBudget - val)
              : team.totalBudget;
            const isInvalid = previewRemaining < 0;

            return (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => { setShowBudgetAdjust(false); setBudgetAdjustTeamId(null); }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black border border-white/10 overflow-hidden" style={{ backgroundColor: team.color }}>
                        {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" /> : team.name[0]}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">Adjust Budget</h3>
                        <p className="text-xs text-white/40">{team.name}</p>
                      </div>
                    </div>
                    <button onClick={() => { setShowBudgetAdjust(false); setBudgetAdjustTeamId(null); }} className="p-2 text-white/40 hover:text-white transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Current balances */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Remaining</p>
                      <p className="text-2xl font-mono font-bold text-emerald-400">₹{team.remainingBudget}L</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Total Budget</p>
                      <p className="text-2xl font-mono font-bold text-white">₹{team.totalBudget}L</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Mode selector */}
                    <div>
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-2">Operation</p>
                      <div className="grid grid-cols-3 gap-2">
                        {([['add', 'Add', 'text-emerald-400', 'border-emerald-500/40', 'bg-emerald-500/10'],
                           ['subtract', 'Subtract', 'text-red-400', 'border-red-500/40', 'bg-red-500/10'],
                           ['set', 'Set Exact', 'text-blue-400', 'border-blue-500/40', 'bg-blue-500/10']] as const).map(([mode, label, tc, bc, bg]) => (
                          <button
                            key={mode}
                            onClick={() => setBudgetAdjustMode(mode)}
                            className={cn(
                              'py-2 rounded-xl text-xs font-bold border transition-all',
                              budgetAdjustMode === mode ? `${bg} ${bc} ${tc}` : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Amount input with stepper */}
                    <div>
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-2">Amount (₹L)</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setBudgetAdjustAmount(v => String(Math.max(0, (parseInt(v) || 0) - 10)))}
                          className="w-11 h-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={budgetAdjustAmount}
                          onChange={(e) => setBudgetAdjustAmount(e.target.value)}
                          placeholder="0"
                          className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-center text-xl font-mono font-bold focus:border-purple-500 outline-none transition-all"
                        />
                        <button
                          onClick={() => setBudgetAdjustAmount(v => String((parseInt(v) || 0) + 10))}
                          className="w-11 h-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Quick presets */}
                      <div className="flex gap-2 mt-2">
                        {[10, 50, 100, 200, 500].map(p => (
                          <button
                            key={p}
                            onClick={() => setBudgetAdjustAmount(String(p))}
                            className="flex-1 py-1.5 text-[10px] font-bold bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-white/50"
                          >
                            {p}L
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Target selector */}
                    <div>
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-2">Apply To</p>
                      <div className="grid grid-cols-2 gap-2">
                        {([['remaining', 'Remaining Only'], ['both', 'Remaining + Total']] as const).map(([t, label]) => (
                          <button
                            key={t}
                            onClick={() => setBudgetAdjustTarget(t)}
                            className={cn(
                              'py-2 rounded-xl text-xs font-bold border transition-all',
                              budgetAdjustTarget === t
                                ? 'bg-purple-500/10 border-purple-500/40 text-purple-400'
                                : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Live preview */}
                    {budgetAdjustAmount !== '' && (
                      <div className={cn('rounded-2xl p-4 border', isInvalid ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10')}>
                        <p className="text-[10px] uppercase font-bold tracking-widest mb-3" style={{ color: isInvalid ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
                          {isInvalid ? 'Invalid — remaining would go below ₹0L' : 'Preview After Change'}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-white/30 mb-1">Remaining</p>
                            <p className={cn('text-lg font-mono font-bold', isInvalid ? 'text-red-400' : 'text-emerald-400')}>
                              ₹{previewRemaining}L
                              {!isInvalid && val > 0 && (
                                <span className={cn('text-xs ml-1', budgetAdjustMode === 'subtract' ? 'text-red-400' : 'text-emerald-400/60')}>
                                  ({budgetAdjustMode === 'add' ? '+' : budgetAdjustMode === 'subtract' ? '-' : '='}{val}L)
                                </span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/30 mb-1">Total Budget</p>
                            <p className="text-lg font-mono font-bold text-white">
                              ₹{previewTotal}L
                              {budgetAdjustTarget === 'both' && val > 0 && (
                                <span className={cn('text-xs ml-1', budgetAdjustMode === 'subtract' ? 'text-red-400' : 'text-white/40')}>
                                  ({budgetAdjustMode === 'add' ? '+' : budgetAdjustMode === 'subtract' ? '-' : '='}{val}L)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={applyBudgetAdjust}
                      disabled={!budgetAdjustAmount || isNaN(parseInt(budgetAdjustAmount)) || isInvalid}
                      className="w-full py-4 bg-purple-500 text-white font-bold rounded-2xl hover:bg-purple-400 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Apply Budget Change
                    </button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>

        {/* Admin Live Bid Adjustment Modal */}
        <AnimatePresence>
          {showBidAdjust && bidAdjustTeamId && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => { setShowBidAdjust(false); setBidAdjustTeamId(null); setBidAdjustAmount(''); }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold">Adjust Live Bid</h3>
                  <button onClick={() => { setShowBidAdjust(false); setBidAdjustTeamId(null); setBidAdjustAmount(''); }} className="p-2 text-white/40 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {(() => {
                  const team = teams.find(t => t.id === bidAdjustTeamId);
                  return (
                    <div className="space-y-5">
                      <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black border border-white/10" style={{ backgroundColor: team?.color }}>
                          {team?.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" loading="lazy" /> : team?.name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-white">{team?.name}</p>
                          <p className="text-xs text-white/40">Budget: ₹{team?.remainingBudget}L</p>
                        </div>
                      </div>

                      <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 text-center">
                        <p className="text-[10px] text-emerald-400/60 uppercase font-bold tracking-widest mb-1">Current Highest Bid</p>
                        <p className="text-3xl font-mono font-bold text-emerald-400">₹{auction.highestBid}L</p>
                        {highestBidder && <p className="text-xs text-white/40 mt-1">by {highestBidder.name}</p>}
                      </div>

                      <div>
                        <label className="text-xs text-white/40 font-bold uppercase mb-2 block">Set New Bid Amount (₹L)</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setBidAdjustAmount(v => String(Math.max(currentPlayer?.basePrice || 0, (parseInt(v) || auction.highestBid) - settings.minBidIncrement)))}
                            className="w-11 h-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white font-bold text-lg"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            value={bidAdjustAmount}
                            onChange={(e) => setBidAdjustAmount(e.target.value)}
                            placeholder={String(auction.highestBid + settings.minBidIncrement)}
                            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold focus:border-emerald-500 outline-none transition-all"
                          />
                          <button
                            onClick={() => setBidAdjustAmount(v => String((parseInt(v) || auction.highestBid) + settings.minBidIncrement))}
                            className="w-11 h-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white font-bold text-lg"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex gap-2 mt-3">
                          {[settings.minBidIncrement, 50, 100].map(step => (
                            <button
                              key={step}
                              onClick={() => setBidAdjustAmount(String((parseInt(bidAdjustAmount) || auction.highestBid) + step))}
                              className="flex-1 py-1.5 text-xs font-bold bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-white/60"
                            >
                              +{step}L
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const amount = parseInt(bidAdjustAmount);
                          if (!isNaN(amount) && amount > 0) adminAdjustBid(bidAdjustTeamId, amount);
                        }}
                        disabled={!bidAdjustAmount || isNaN(parseInt(bidAdjustAmount))}
                        className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Apply Bid for {team?.name}
                      </button>
                    </div>
                  );
                })()}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Next Player Toast (Non-blocking) */}
        <AnimatePresence>
          {showNextPlayerPrompt && nextPlayerId && (
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-6 right-6 z-[100] max-w-md w-full"
            >
              <div className="bg-zinc-900 border border-emerald-500/30 p-6 rounded-2xl shadow-2xl shadow-emerald-500/10">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                    {(() => {
                      const np = players.find(p => p.id === nextPlayerId);
                      return np ? (
                        <PlayerAvatar
                          playerId={np.id}
                          imageUrl={np.imageUrl}
                          name={np.name}
                          teams={teams}
                          className="w-full h-full object-cover"
                          badgeSize="xs"
                        />
                      ) : null;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Auto-starting next player in 4s...
                      </h4>
                      <button 
                        onClick={() => setShowNextPlayerPrompt(false)}
                        className="text-white/40 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-white/60 mb-3">
                      Next up: <strong className="text-white">{players.find(p => p.id === nextPlayerId)?.name}</strong>
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowNextPlayerPrompt(false)}
                        className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => {
                          setShowNextPlayerPrompt(false);
                          startAuction(nextPlayerId);
                        }}
                        className="flex-1 py-2 px-3 bg-emerald-500 text-black rounded-lg text-xs font-bold hover:bg-emerald-400 transition-all flex items-center justify-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" /> Start Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-white/10 py-8 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center text-white/20 text-xs font-bold uppercase tracking-widest">
          &copy; 2026 CricAuction Internal Systems • Real-time Engine v1.0
        </div>
      </footer>
    </div>
  );
}
