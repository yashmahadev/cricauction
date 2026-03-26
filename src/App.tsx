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
import { auth, db } from './firebase';
import { cn } from './lib/utils';
import { PlayerStatsChart, PlayerAvatar } from './components/shared/PlayerComponents';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
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
import { useSound } from './hooks/useSound';
import { useAuctionTimer } from './hooks/useAuctionTimer';
import { LoginView } from './components/views/LoginView';
import { PortalView } from './components/views/PortalView';
import { PublicView } from './components/views/PublicView';
import { ScheduleCountdown } from './components/shared/ScheduleCountdown';
import { TeamView } from './components/views/TeamView';
import { AdminView } from './components/views/AdminView';
import {
  startAuction as startAuctionAction,
  pauseAuction as pauseAuctionAction,
  resumeAuction as resumeAuctionAction,
  endAuction as endAuctionAction,
  reAuctionUnsold as reAuctionUnsoldAction,
  placeBid,
  adminAdjustBid as adminAdjustBidAction,
} from './lib/auctionActions';
import {
  uploadImage,
  normalizeCategory,
  addPlayer as addPlayerAction,
  editPlayer as editPlayerAction,
  deletePlayer as deletePlayerAction,
  bulkDeletePlayers as bulkDeletePlayersAction,
  bulkMarkUnsold as bulkMarkUnsoldAction,
} from './lib/playerActions';
import {
  addTeam as addTeamAction,
  editTeam as editTeamAction,
  deleteTeam as deleteTeamAction,
  resetTeamPassword as resetTeamPasswordAction,
  applyBudgetAdjust as applyBudgetAdjustAction,
} from './lib/teamActions';

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
  const { soundEnabled, setSoundEnabled, playSound } = useSound();

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

  // Timer display logic — client-side countdown only; Cloud Function handles auto-end
  const { displayTime } = useAuctionTimer(auction);

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
    const err = await placeBid(selectedTeamId, pendingBidAmount, auction, teams, settings);
    if (err) {
      setError(err);
      setTimeout(() => setError(null), 3000);
    }
    setShowConfirmBid(false);
    setPendingBidAmount(null);
    setCustomBidAmount('');
  };

  const endAuction = async () => {
    const err = await endAuctionAction(auction);
    if (err) {
      setError(err);
      setTimeout(() => setError(null), 3000);
    }
  };

  const startAuction = async (playerId: string) => {
    const err = await startAuctionAction(playerId, players, teams, settings);
    if (err) {
      setError(err);
      setTimeout(() => setError(null), 3000);
    }
  };

  const pauseAuction = async () => {
    await pauseAuctionAction(auction);
  };

  const resumeAuction = async () => {
    await resumeAuctionAction(auction);
  };

  const reAuctionUnsold = async () => {
    const err = await reAuctionUnsoldAction(players);
    if (err) {
      setError(err);
      setTimeout(() => setError(null), 3000);
    }
  };

  const resetTeamPassword = async (team: Team) => {
    const result = await resetTeamPasswordAction(team);
    if ('error' in result) {
      setError(result.error);
      setTimeout(() => setError(null), 3000);
    } else {
      setTeamCredsModal(result.creds);
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
    const val = parseInt(budgetAdjustAmount);
    if (isNaN(val) || val < 0) {
      setError('Please enter a valid positive amount');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const err = await applyBudgetAdjustAction(budgetAdjustTeamId, teams, val, budgetAdjustMode, budgetAdjustTarget);
    if (err) {
      setError(err);
      setTimeout(() => setError(null), 3000);
      return;
    }
    setShowBudgetAdjust(false);
    setBudgetAdjustTeamId(null);
    setBudgetAdjustAmount('');
    setBudgetAdjustMode('add');
    setBudgetAdjustTarget('remaining');
  };

  const adminAdjustBid = async (teamId: string, amount: number) => {
    const err = await adminAdjustBidAction(teamId, amount, auction, teams, players, settings);
    if (err) {
      setError(err);
      setTimeout(() => setError(null), 3000);
      return;
    }
    setShowBidAdjust(false);
    setBidAdjustTeamId(null);
    setBidAdjustAmount('');
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
    await addPlayerAction(new FormData(e.currentTarget));
    setIsAddingPlayer(false);
  };

  const editPlayer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPlayer) return;
    await editPlayerAction(editingPlayer.id, new FormData(e.currentTarget));
    setEditingPlayer(null);
  };

  const addTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = await addTeamAction(new FormData(e.currentTarget));
    if ('error' in result) {
      setError(result.error);
    } else {
      setGeneratedTeamCreds(result.creds);
      setIsAddingTeam(false);
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
    const err = await editTeamAction(editingTeam.id, new FormData(e.currentTarget), userProfile?.role === 'admin');
    if (err) {
      setError(err);
      setTimeout(() => setError(null), 3000);
    } else {
      setEditingTeam(null);
    }
  };

  const bulkDeletePlayers = async () => {
    if (selectedPlayerIds.length === 0) return;
    try {
      await bulkDeletePlayersAction(selectedPlayerIds, players);
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
      await bulkMarkUnsoldAction(selectedPlayerIds, players);
      setSelectedPlayerIds([]);
      setIsSelectionMode(false);
    } catch (err: any) {
      setError('Bulk update failed: ' + err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const deletePlayer = async (id: string) => {
    try {
      await deletePlayerAction(id, players);
    } catch (err: any) {
      setError('Failed to delete player: ' + err.message);
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      await deleteTeamAction(id, teams, players);
    } catch (err: any) {
      setError('Failed to delete team: ' + err.message);
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
      <LoginView
        loginMode={loginMode}
        loginError={loginError}
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword(v => !v)}
        onSubmit={handleLogin}
        onBack={() => setView('portal')}
      />
    );
  }

  if (view === 'portal') {
    return (
      <PortalView
        auction={auction}
        settings={settings}
        spectatorCount={spectatorCount}
        isLoggedInAsAdmin={!!(user && userProfile?.role === 'admin')}
        isLoggedInAsTeam={!!(user && userProfile?.role === 'team')}
        onGoPublic={() => setView('public')}
        onGoTeam={() => {
          if (user && userProfile?.role === 'team') setView('team');
          else { setLoginMode('team'); setView('login'); }
        }}
        onGoAdmin={() => {
          if (user && userProfile?.role === 'admin') setView('admin');
          else { setLoginMode('admin'); setView('login'); }
        }}
      />
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
          <PublicView
            players={players}
            teams={teams}
            auction={auction}
            settings={settings}
            displayTime={displayTime}
            spectatorCount={spectatorCount}
            descendingBidHistory={descendingBidHistory}
            comparePlayerIds={comparePlayerIds}
            onToggleCompare={(id) => setComparePlayerIds(prev =>
              prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
            )}
            onViewProfile={setSelectedPlayerProfile}
          />
        )}


        {view === 'admin' && (
          <AdminView
            players={players}
            teams={teams}
            auction={auction}
            settings={settings}
            displayTime={displayTime}
            playerSearch={playerSearch} setPlayerSearch={setPlayerSearch}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            minRuns={minRuns} setMinRuns={setMinRuns}
            maxWickets={maxWickets} setMaxWickets={setMaxWickets}
            sortBy={sortBy} setSortBy={setSortBy}
            sortOrder={sortOrder} setSortOrder={setSortOrder}
            paginatedPlayers={paginatedPlayers}
            filteredPlayers={filteredPlayers}
            playersPage={playersPage} setPlayersPage={setPlayersPage}
            totalPages={totalPages}
            isSelectionMode={isSelectionMode} setIsSelectionMode={setIsSelectionMode}
            selectedPlayerIds={selectedPlayerIds} setSelectedPlayerIds={setSelectedPlayerIds}
            teamSearch={teamSearch} setTeamSearch={setTeamSearch}
            importStatus={importStatus} setImportStatus={setImportStatus}
            importedTeamCreds={importedTeamCreds}
            isGenerating={isGenerating}
            onGenerateSampleData={generateSampleData}
            onReAuctionUnsold={reAuctionUnsold}
            onResetAll={() => setShowResetConfirm(true)}
            onBackfillEmails={backfillTeamEmails}
            onDownloadSampleCSV={downloadSampleCSV}
            onCSVUpload={handleCSVUpload}
            onDownloadTeamsCSV={downloadTeamsCSV}
            onDownloadImportedCredsCSV={downloadImportedCredsCSV}
            onUpdateSettings={updateSettings}
            onStartAuction={startAuction}
            onPauseAuction={pauseAuction}
            onResumeAuction={resumeAuction}
            onClearSelection={() => updateDoc(doc(db, 'auction', 'state'), { currentPlayerId: null, status: 'Idle' })}
            onBulkDelete={bulkDeletePlayers}
            onBulkMarkUnsold={bulkMarkUnsold}
            onAddPlayer={() => setIsAddingPlayer(true)}
            onEditPlayer={setEditingPlayer}
            onDeletePlayer={(id) => setPlayerToDelete(id)}
            onViewPlayerProfile={setSelectedPlayerProfile}
            onAddTeam={() => setIsAddingTeam(true)}
            onEditTeam={setEditingTeam}
            onDeleteTeam={(id) => setTeamToDelete(id)}
            onViewTeamCreds={(t) => setTeamCredsModal({ name: t.name, email: t.email || '', password: t.password || '' })}
            onBudgetAdjust={(id) => { setBudgetAdjustTeamId(id); setBudgetAdjustAmount(''); setBudgetAdjustMode('add'); setBudgetAdjustTarget('remaining'); setShowBudgetAdjust(true); }}
            onBidAdjust={(id) => { setBidAdjustTeamId(id); setBidAdjustAmount(String(auction.highestBid + settings.minBidIncrement)); setShowBidAdjust(true); }}
            onShowEndAuctionConfirm={() => setShowEndAuctionConfirm(true)}
            onShowResetTimerConfirm={() => setShowResetTimerConfirm(true)}
          />
        )}
