import React, { useState, useEffect, useMemo, Component, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  User, 
  Timer, 
  TrendingUp, 
  Shield, 
  ChevronRight, 
  AlertCircle,
  Coins,
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
  EyeOff
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Player, Team, AuctionState, Category, AuctionSettings } from './types';
import { auth, db, storage } from './firebase';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
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
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  runTransaction,
  writeBatch,
  deleteField
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
  throw new Error(JSON.stringify(errInfo));
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

export default function App() {
  return (
    <AuctionApp />
  );
}

function AuctionApp() {
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
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // New State for CRUD
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [generatedTeamCreds, setGeneratedTeamCreds] = useState<{ mobile: string; pass: string } | null>(null);
  
  // New State for Bidding
  const [customBidAmount, setCustomBidAmount] = useState<string>('');
  const [showConfirmBid, setShowConfirmBid] = useState(false);
  const [pendingBidAmount, setPendingBidAmount] = useState<number | null>(null);

  // New State for Search and Confirmation
  const [playerSearch, setPlayerSearch] = useState('');
  const [minRuns, setMinRuns] = useState<number | ''>('');
  const [maxWickets, setMaxWickets] = useState<number | ''>('');
  const [teamSearch, setTeamSearch] = useState('');
  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      try {
        setUser(u);
        if (u) {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as { role: 'admin' | 'team'; teamId?: string };
            setUserProfile(profile);
            if (profile.role === 'team' && profile.teamId) {
              setSelectedTeamId(profile.teamId);
            }
          } else if (u.email === 'yashmahadevwala00@gmail.com') {
            // Auto-bootstrap default admin
            const profile = { role: 'admin' as const };
            await setDoc(doc(db, 'users', u.uid), profile);
            setUserProfile(profile);
          } else if (u.email?.endsWith('@auction.com')) {
            // Auto-bootstrap team user
            const mobile = u.email.split('@')[0];
            const teamsQuery = query(collection(db, 'teams'), where('mobileNumber', '==', mobile));
            const teamSnap = await getDocs(teamsQuery);
            if (!teamSnap.empty) {
              const teamId = teamSnap.docs[0].id;
              const profile = { role: 'team' as const, teamId };
              await setDoc(doc(db, 'users', u.uid), profile);
              setUserProfile(profile);
              setSelectedTeamId(teamId);
            }
          }
        } else {
          setUserProfile(null);
          setSelectedTeamId(null);
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

  const currentPlayer = useMemo(() => 
    players.find(p => p.id === auction.currentPlayerId), 
    [players, auction.currentPlayerId]
  );

  const highestBidder = useMemo(() => 
    teams.find(t => t.id === auction.highestBidderId),
    [teams, auction.highestBidderId]
  );

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
      let email = identifier;
      if (loginMode === 'team') {
        // Use mobile number as email prefix for team login
        // If the user already entered the full email, don't append it again
        if (!identifier.includes('@')) {
          email = `${identifier}@auction.com`;
        }
      }
      await signInWithEmailAndPassword(auth, email, password);
      setView('portal');
    } catch (err: any) {
      // Provide more user-friendly error messages
      let message = err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Invalid mobile number or password. Please check your credentials.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid mobile number.';
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
    const team = teams.find(t => t.id === selectedTeamId);
    if (!team) return;

    try {
      await runTransaction(db, async (transaction) => {
        const auctionDoc = await transaction.get(doc(db, 'auction', 'state'));
        if (!auctionDoc.exists()) return;
        const currentAuction = auctionDoc.data() as AuctionState;

        if (pendingBidAmount <= currentAuction.highestBid) {
          throw new Error('Bid must be higher than current highest bid');
        }

        if (pendingBidAmount > team.remainingBudget) {
          throw new Error('Insufficient budget');
        }

        transaction.update(doc(db, 'auction', 'state'), {
          highestBid: pendingBidAmount,
          highestBidderId: selectedTeamId,
          bidHistory: arrayUnion({
            amount: pendingBidAmount,
            bidderId: selectedTeamId,
            bidderName: team.name,
            timestamp: Date.now()
          })
        });
      });
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }

    setShowConfirmBid(false);
    setPendingBidAmount(null);
    setCustomBidAmount('');
  };

  const startAuction = async (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    await updateDoc(doc(db, 'auction', 'state'), {
      currentPlayerId: playerId,
      highestBid: player.basePrice,
      highestBidderId: null,
      timeLeft: settings.timerDuration,
      status: 'Active',
      bidHistory: []
    });
  };

  const resetAuction = async () => {
    setShowResetConfirm(true);
  };

  const confirmReset = async () => {
    setIsResetting(true);
    setError(null);
    try {
      const allOps = [
        ...players.map(player => ({
          type: 'delete',
          ref: doc(db, 'players', player.id)
        })),
        ...teams.map(team => ({
          type: 'delete',
          ref: doc(db, 'teams', team.id)
        })),
        {
          type: 'update',
          ref: doc(db, 'auction', 'state'),
          data: {
            currentPlayerId: null,
            highestBid: 0,
            highestBidderId: null,
            timeLeft: 0,
            status: 'Idle' as const,
            bidHistory: []
          }
        }
      ];

      // Firestore batch limit is 500
      for (let i = 0; i < allOps.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = allOps.slice(i, i + 500);
        chunk.forEach(op => {
          if (op.type === 'delete') {
            batch.delete(op.ref);
          } else {
            batch.update(op.ref, op.data);
          }
        });
        await batch.commit();
      }

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

  const adjustBudget = async (teamId: string, amount: number) => {
    await updateDoc(doc(db, 'teams', teamId), {
      remainingBudget: increment(amount),
      totalBudget: increment(amount)
    });
  };

  const updateSettings = async (newSettings: AuctionSettings) => {
    await setDoc(doc(db, 'auction', 'settings'), newSettings);
  };

  const PlayerStatsChart = ({ stats }: { stats: Player['stats'] }) => {
    const data = [
      { name: 'Matches', value: stats.matches || 0, color: '#10b981' },
      { name: 'Runs', value: stats.runs || 0, color: '#3b82f6' },
      { name: 'Wickets', value: stats.wickets || 0, color: '#f59e0b' },
    ];

    return (
      <div className="h-48 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#ffffff40', fontSize: 10 }} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#ffffff40', fontSize: 10 }} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ffffff10', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
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
      }
    };
    await updateDoc(doc(db, 'players', editingPlayer.id), player);
    setEditingPlayer(null);
  };

  const addTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const mobileNumber = formData.get('mobileNumber') as string;
    const password = Math.random().toString(36).slice(-8);
    const imageFile = formData.get('imageFile') as File;
    let logoUrl = formData.get('logoUrl') as string;

    if (imageFile && imageFile.size > 0) {
      logoUrl = await uploadImage(imageFile, 'teams');
    }

    try {
      const email = `${mobileNumber}@auction.com`;
      
      // Create user in Firebase Auth using a secondary app instance to avoid signing out the admin
      const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      try {
        await createUserWithEmailAndPassword(secondaryAuth, email, password);
      } catch (authErr: any) {
        // If user already exists, we can ignore it or handle it
        if (authErr.code !== 'auth/email-already-in-use') {
          throw authErr;
        }
      }
      await deleteApp(secondaryApp);

      const teamData = {
        name: formData.get('name') as string,
        totalBudget: parseInt(formData.get('totalBudget') as string),
        remainingBudget: parseInt(formData.get('totalBudget') as string),
        color: formData.get('color') as string,
        logoUrl: logoUrl,
        mobileNumber: mobileNumber,
        players: []
      };
      
      const newTeamRef = doc(collection(db, 'teams'));
      await setDoc(newTeamRef, teamData);
      
      setGeneratedTeamCreds({ mobile: mobileNumber, pass: password });
      setIsAddingTeam(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const editTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTeam) return;
    const formData = new FormData(e.currentTarget);
    const imageFile = formData.get('imageFile') as File;
    let logoUrl = formData.get('logoUrl') as string;

    if (imageFile && imageFile.size > 0) {
      logoUrl = await uploadImage(imageFile, 'teams');
    }

    const team = {
      name: formData.get('name') as string,
      totalBudget: parseInt(formData.get('totalBudget') as string),
      color: formData.get('color') as string,
      logoUrl: logoUrl,
    };
    await updateDoc(doc(db, 'teams', editingTeam.id), team);
    setEditingTeam(null);
  };

  const deletePlayer = async (id: string) => {
    try {
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
                {loginMode === 'admin' ? 'Email Address' : 'Mobile Number'}
              </label>
              <input 
                name="identifier" 
                type={loginMode === 'admin' ? 'email' : 'text'} 
                required 
                placeholder={loginMode === 'admin' ? 'admin@example.com' : '9876543210'}
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
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={() => setView('public')}
            className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-center"
          >
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Trophy className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Public View</h2>
            <p className="text-white/40 text-sm">Watch the live auction as a spectator.</p>
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
            <p className="text-white/40 text-sm">Login as a team owner to place bids.</p>
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
            <p className="text-white/40 text-sm">Manage players, teams, and settings.</p>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('portal')}>
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-xl tracking-tight">CricAuction</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-widest text-white/40">
              {view === 'admin' ? 'Admin Mode' : view === 'team' ? 'Team Mode' : 'Live View'}
            </span>
            {user && (
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
              >
                <LogOut className="w-3 h-3" /> Logout
              </button>
            )}
            <button 
              onClick={() => setView('portal')}
              className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              Switch Portal
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-red-500/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-red-400/50"
            >
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {view === 'public' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Live Auction */}
            <div className="lg:col-span-8 space-y-8">
              <section className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
                
                {auction.status === 'Active' && currentPlayer ? (
                  <div className="p-8">
                    <div className="flex flex-col md:flex-row gap-8">
                      <div className="w-full md:w-64 aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative group">
                        <img 
                          src={currentPlayer.imageUrl || null} 
                          alt={currentPlayer.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          referrerPolicy="no-referrer"
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
                              <Timer className={cn("w-6 h-6", auction.timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-white/60")} />
                            </div>
                            <div>
                              <p className="text-xs text-white/40 font-bold uppercase">Time Remaining</p>
                              <p className={cn("text-xl font-mono font-bold", auction.timeLeft <= 5 ? "text-red-500" : "text-white")}>
                                {auction.timeLeft}s
                              </p>
                            </div>
                          </div>
                          
                          {highestBidder && (
                            <div className="text-right">
                              <p className="text-xs text-white/40 font-bold uppercase">Highest Bidder</p>
                              <p className="text-lg font-bold" style={{ color: highestBidder.color }}>{highestBidder.name}</p>
                            </div>
                          )}
                        </div>

                        {/* Recent Bids Feed */}
                        <div className="space-y-2">
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Bid History</p>
                          <div className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            <AnimatePresence initial={false}>
                              {auction.bidHistory?.map((bid, idx) => (
                                <motion.div 
                                  key={bid.timestamp + idx}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-white/60">{bid.bidderName}</span>
                                  </div>
                                  <span className="font-mono font-bold text-emerald-400">₹{bid.amount}L</span>
                                </motion.div>
                              ))}
                              {(!auction.bidHistory || auction.bidHistory.length === 0) && (
                                <p className="text-xs text-white/20 italic">No bids yet...</p>
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
                  </div>
                )}
              </section>

              {/* Player List */}
              <section>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-500" />
                  Player Pool
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
                        <img 
                          src={player.imageUrl || null} 
                          className="w-12 h-12 rounded-xl object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                        <div className="flex-1">
                          <h4 className="font-bold">{player.name}</h4>
                          <p className="text-xs text-white/40">{player.category} • Base ₹{player.basePrice}L</p>
                        </div>
                        <div className="text-right">
                          <span className={cn(
                            "text-[10px] font-bold uppercase px-2 py-1 rounded-full border",
                            player.status === 'Sold' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                            player.status === 'Unsold' ? "bg-red-500/20 text-red-400 border-red-500/30" :
                            "bg-white/10 text-white/60 border-white/20"
                          )}>
                            {player.status}
                          </span>
                          {player.status === 'Sold' && (
                            <p className="text-xs font-bold mt-1 text-emerald-400">₹{player.soldPrice}L</p>
                          )}
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
                <div className="space-y-4">
                  {teams.map(team => (
                    <div key={team.id} className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                      <div className="h-1" style={{ backgroundColor: team.color }} />
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="font-bold">{team.name}</h4>
                          <div className="text-right">
                            <p className="text-xs text-white/40 uppercase font-bold">Budget</p>
                            <p className="font-mono font-bold text-emerald-400">₹{team.remainingBudget}L</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {team.players.length > 0 ? (
                            team.players.map(pid => {
                              const p = players.find(pl => pl.id === pid);
                              return (
                                <div key={pid} className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 overflow-hidden" title={p?.name}>
                                  <img src={p?.imageUrl || null} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
          <div className="max-w-6xl mx-auto space-y-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-3xl font-bold mb-2">Admin Control</h2>
                <p className="text-white/40 text-sm">Manage the auction flow, team budgets, and system settings.</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={resetAuction}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all font-bold text-sm"
                >
                  <RotateCcw className="w-4 h-4" /> Reset All
                </button>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Settings Panel */}
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
                  </div>
                </section>

                <section className="bg-white/5 p-6 rounded-3xl border border-white/10">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-500" />
                      Manage Teams
                    </h3>
                    <button 
                      onClick={() => setIsAddingTeam(true)}
                      className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
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
                  <div className="space-y-4">
                    {teams.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase())).map(team => (
                      <div key={team.id} className="p-3 bg-black/20 rounded-2xl border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 overflow-hidden" style={{ backgroundColor: team.color }}>
                              {team.logoUrl ? (
                                <img src={team.logoUrl || null} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <Shield className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <span className="text-sm font-bold" style={{ color: team.color }}>{team.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditingTeam(team)} className="p-1.5 text-white/40 hover:text-white transition-colors"><Settings className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setTeamToDelete(team.id)} className="p-1.5 text-red-500/40 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/40">Budget: ₹{team.remainingBudget}L</span>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => adjustBudget(team.id, -10)}
                              className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => adjustBudget(team.id, 10)}
                              className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition-all"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Player Management */}
              <div className="lg:col-span-2 space-y-6">
                <section className="bg-white/5 p-6 rounded-3xl border border-white/10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <h3 className="text-lg font-bold">Player Management</h3>
                    <div className="flex flex-col md:flex-row items-center gap-4 flex-1 md:max-w-2xl justify-end">
                      <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input 
                          type="text" 
                          placeholder="Search name or category..."
                          value={playerSearch}
                          onChange={(e) => setPlayerSearch(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:border-emerald-500 outline-none transition-colors"
                        />
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative w-full md:w-28">
                          <input 
                            type="number" 
                            placeholder="Min Runs"
                            value={minRuns}
                            onChange={(e) => setMinRuns(e.target.value === '' ? '' : parseInt(e.target.value))}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs focus:border-emerald-500 outline-none transition-colors"
                          />
                        </div>
                        <div className="relative w-full md:w-28">
                          <input 
                            type="number" 
                            placeholder="Max Wkts"
                            value={maxWickets}
                            onChange={(e) => setMaxWickets(e.target.value === '' ? '' : parseInt(e.target.value))}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs focus:border-emerald-500 outline-none transition-colors"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsAddingPlayer(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all font-bold text-sm whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" /> Add Player
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {players.filter(p => {
                      const matchesSearch = p.name.toLowerCase().includes(playerSearch.toLowerCase()) || 
                                          p.category.toLowerCase().includes(playerSearch.toLowerCase());
                      const matchesRuns = minRuns === '' || (p.stats.runs || 0) >= minRuns;
                      const matchesWickets = maxWickets === '' || (p.stats.wickets || 0) <= maxWickets;
                      return matchesSearch && matchesRuns && matchesWickets;
                    }).map(player => (
                      <div key={player.id} className="bg-black/20 p-6 rounded-3xl border border-white/5 flex flex-col group hover:border-emerald-500/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <img src={player.imageUrl || null} className="w-16 h-16 rounded-2xl object-cover border border-white/10" referrerPolicy="no-referrer" />
                            <div>
                              <h4 className="font-bold text-lg">{player.name}</h4>
                              <p className="text-xs text-white/40 uppercase font-bold tracking-wider">{player.category} • ₹{player.basePrice}L</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {player.status === 'Available' && (
                              <button 
                                onClick={() => startAuction(player.id)}
                                disabled={auction.status === 'Active'}
                                className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <Play className="w-5 h-5 fill-current" />
                              </button>
                            )}
                            <button onClick={() => setEditingPlayer(player)} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/10">
                              <Settings className="w-5 h-5" />
                            </button>
                            <button onClick={() => setPlayerToDelete(player.id)} className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="pt-4 border-t border-white/5">
                          <p className="text-[10px] text-white/40 uppercase font-bold mb-2">Performance Stats</p>
                          <PlayerStatsChart stats={player.stats} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            {/* Modals for CRUD */}
            <AnimatePresence>
              {(isAddingPlayer || editingPlayer) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                  >
                    <h3 className="text-2xl font-bold mb-6">{editingPlayer ? 'Edit Player' : 'Add New Player'}</h3>
                    <form onSubmit={editingPlayer ? editPlayer : addPlayer} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Name</label>
                          <input name="name" defaultValue={editingPlayer?.name} required className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-emerald-500 outline-none" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Category</label>
                          <select name="category" defaultValue={editingPlayer?.category || 'Batsman'} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-emerald-500 outline-none">
                            <option value="Batsman">Batsman</option>
                            <option value="Bowler">Bowler</option>
                            <option value="All-Rounder">All-Rounder</option>
                            <option value="Wicketkeeper">Wicketkeeper</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Base Price (₹L)</label>
                          <input name="basePrice" type="number" defaultValue={editingPlayer?.basePrice} required className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-emerald-500 outline-none" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Player Image</label>
                          <div className="flex flex-col gap-2">
                            <input 
                              name="imageFile" 
                              type="file" 
                              accept="image/*"
                              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-xs focus:border-emerald-500 outline-none file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20" 
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-white/20 uppercase font-bold">OR URL</span>
                              <input name="imageUrl" defaultValue={editingPlayer?.imageUrl} className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-emerald-500 outline-none" placeholder="https://..." />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Matches</label>
                          <input name="matches" type="number" defaultValue={editingPlayer?.stats.matches} required className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-emerald-500 outline-none" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Runs (Optional)</label>
                          <input name="runs" type="number" defaultValue={editingPlayer?.stats.runs} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-emerald-500 outline-none" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Wickets (Optional)</label>
                          <input name="wickets" type="number" defaultValue={editingPlayer?.stats.wickets} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-emerald-500 outline-none" />
                        </div>
                      </div>
                      <div className="flex gap-3 mt-8">
                        <button type="button" onClick={() => { setIsAddingPlayer(false); setEditingPlayer(null); }} className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 font-bold">Cancel</button>
                        <button type="submit" className="flex-1 px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold">Save Player</button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {(isAddingTeam || editingTeam) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
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
                      {!editingTeam && (
                        <div>
                          <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Mobile Number (for Login)</label>
                          <input name="mobileNumber" type="tel" required placeholder="9876543210" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none" />
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Total Budget (₹L)</label>
                        <input name="totalBudget" type="number" defaultValue={editingTeam?.totalBudget} required className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-white/40 uppercase mb-1 block">Theme Color</label>
                        <input name="color" type="color" defaultValue={editingTeam?.color || '#3b82f6'} className="w-full h-10 bg-black/50 border border-white/10 rounded-xl px-1 py-1 outline-none" />
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
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
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
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
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
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
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
              {generatedTeamCreds && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#1a1a1a] border border-emerald-500/30 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
                  >
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Shield className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Team Created!</h3>
                    <p className="text-white/60 mb-6 text-sm">
                      Share these credentials with the team owner. They can login using their mobile number or the full email.
                    </p>
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/10 mb-8 text-left space-y-3">
                      <div>
                        <p className="text-[10px] text-white/40 uppercase font-bold">Mobile Number (Login ID)</p>
                        <p className="font-mono text-emerald-400 font-bold">{generatedTeamCreds.mobile}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 uppercase font-bold">Full Login Email</p>
                        <p className="font-mono text-emerald-400/60 text-xs">{generatedTeamCreds.mobile}@auction.com</p>
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
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {view === 'team' && (
          <div className="max-w-4xl mx-auto space-y-12">
            {!userProfile?.teamId ? (
              <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10 p-12">
                <Shield className="w-16 h-16 text-red-500/50 mx-auto mb-6" />
                <h2 className="text-3xl font-bold mb-4">Access Denied</h2>
                <p className="text-white/40 mb-8">Your account is not associated with any team. Please contact the administrator.</p>
                <button onClick={() => setView('portal')} className="px-8 py-3 bg-white/10 rounded-xl font-bold hover:bg-white/20 transition-all">Back to Portal</button>
              </div>
            ) : (
              <div className="space-y-12">
                <header className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-4">
                      {teams.find(t => t.id === userProfile.teamId)?.logoUrl && (
                        <img 
                          src={teams.find(t => t.id === userProfile.teamId)?.logoUrl || null} 
                          className="w-12 h-12 rounded-xl object-cover border border-white/10" 
                          referrerPolicy="no-referrer" 
                        />
                      )}
                      <div>
                        <h2 className="text-3xl font-bold">{teams.find(t => t.id === userProfile.teamId)?.name}</h2>
                        <p className="text-white/40">Team Management Dashboard</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/40 uppercase font-bold">Available Funds</p>
                    <p className="text-3xl font-mono font-bold text-emerald-400">₹{teams.find(t => t.id === userProfile.teamId)?.remainingBudget}L</p>
                  </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    {auction.status === 'Active' && currentPlayer ? (
                      <section className="bg-emerald-500/5 rounded-3xl border border-emerald-500/20 p-8">
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-4">
                            <img src={currentPlayer.imageUrl || null} className="w-20 h-20 rounded-2xl object-cover border border-white/10" referrerPolicy="no-referrer" />
                            <div>
                              <h3 className="text-2xl font-bold">{currentPlayer.name}</h3>
                              <p className="text-white/40">{currentPlayer.category} • Base ₹{currentPlayer.basePrice}L</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-white/40 uppercase font-bold">Current Bid</p>
                            <p className="text-3xl font-mono font-bold text-emerald-400">₹{auction.highestBid}L</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={() => handleBid(auction.highestBidderId === null ? auction.highestBid : auction.highestBid + settings.minBidIncrement)}
                            className="h-20 bg-emerald-500 rounded-2xl text-black font-bold text-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center justify-center"
                          >
                            <span>Bid ₹{auction.highestBidderId === null ? auction.highestBid : auction.highestBid + settings.minBidIncrement}L</span>
                            <span className="text-xs opacity-60">Next Increment</span>
                          </button>
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <input 
                                type="number" 
                                placeholder="Custom Bid"
                                value={customBidAmount}
                                onChange={(e) => setCustomBidAmount(e.target.value)}
                                className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 text-sm focus:border-emerald-500 outline-none"
                              />
                              <button 
                                onClick={() => {
                                  const amount = parseInt(customBidAmount);
                                  if (!isNaN(amount)) handleBid(amount);
                                }}
                                className="px-4 bg-white/20 rounded-xl hover:bg-white/30 transition-all border border-white/10"
                              >
                                <ArrowRight className="w-5 h-5" />
                              </button>
                            </div>
                            <button 
                              onClick={() => handleBid(auction.highestBid + 50)}
                              className="h-10 bg-white/5 rounded-xl text-white font-bold text-sm hover:bg-white/10 transition-all border border-white/10"
                            >
                              +50L Jump
                            </button>
                          </div>
                        </div>

                        {/* Bid History for Teams */}
                        <div className="mt-8 space-y-3">
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Bidding History</p>
                          <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                            {auction.bidHistory?.map((bid, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-white/5 last:border-0">
                                <span className={cn("font-medium", bid.bidderId === userProfile.teamId ? "text-emerald-400" : "text-white/60")}>
                                  {bid.bidderName} {bid.bidderId === userProfile.teamId && '(You)'}
                                </span>
                                <span className="font-mono font-bold">₹{bid.amount}L</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="mt-6 flex items-center justify-center gap-2 text-white/40 text-sm">
                          <Timer className="w-4 h-4" />
                          <span>Auction ends in <span className="text-white font-mono font-bold">{auction.timeLeft}s</span></span>
                        </div>
                      </section>
                    ) : (
                      <div className="h-64 bg-white/5 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-center p-8">
                        <Coins className="w-12 h-12 text-white/10 mb-4" />
                        <h3 className="text-xl font-bold">No Active Auction</h3>
                        <p className="text-white/40 text-sm">Wait for the admin to start a new round.</p>
                      </div>
                    )}

                    {/* Confirmation Dialog */}
                    <AnimatePresence>
                      {showConfirmBid && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
                            className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
                          >
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                              <AlertCircle className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className="text-2xl font-bold mb-2">Confirm Bid</h3>
                            <p className="text-white/60 mb-6">
                              You are about to place a bid of <span className="text-emerald-400 font-bold">₹{pendingBidAmount}L</span> for <span className="text-white font-bold">{currentPlayer?.name}</span>.
                            </p>
                            <div className="bg-black/30 rounded-2xl p-4 mb-8 border border-white/5">
                              <div className="flex justify-between text-xs font-bold uppercase mb-1">
                                <span className="text-white/40">Remaining Budget</span>
                                <span className="text-emerald-400">₹{teams.find(t => t.id === userProfile.teamId)?.remainingBudget}L</span>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <button onClick={() => setShowConfirmBid(false)} className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all">Cancel</button>
                              <button onClick={confirmBid} className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-all">Confirm Bid</button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>

                    <section>
                      <h3 className="text-xl font-bold mb-6">Your Squad</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {teams.find(t => t.id === userProfile.teamId)?.players.map(pid => {
                          const p = players.find(pl => pl.id === pid);
                          return (
                            <div key={pid} className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                              <img src={p?.imageUrl || null} className="w-12 h-12 rounded-xl object-cover" referrerPolicy="no-referrer" />
                              <div className="flex-1">
                                <h4 className="font-bold">{p?.name}</h4>
                                <p className="text-xs text-white/40">{p?.category}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-emerald-400 font-bold">₹{p?.soldPrice}L</p>
                              </div>
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

                  <div className="space-y-8">
                    <section className="bg-white/5 rounded-3xl border border-white/10 p-6">
                      <h3 className="font-bold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        Budget Analysis
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs font-bold uppercase mb-2">
                            <span className="text-white/40">Spent</span>
                            <span className="text-white">₹{1000 - (teams.find(t => t.id === userProfile.teamId)?.remainingBudget || 0)}L</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 transition-all duration-1000" 
                              style={{ width: `${((1000 - (teams.find(t => t.id === userProfile.teamId)?.remainingBudget || 0)) / 1000) * 100}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed">
                          You have spent {((1000 - (teams.find(t => t.id === userProfile.teamId)?.remainingBudget || 0)) / 1000 * 100).toFixed(1)}% of your total budget. 
                          Manage your remaining ₹{teams.find(t => t.id === userProfile.teamId)?.remainingBudget}L wisely for upcoming star players.
                        </p>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 py-8 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center text-white/20 text-xs font-bold uppercase tracking-widest">
          &copy; 2026 CricAuction Internal Systems • Real-time Engine v1.0
        </div>
      </footer>
    </div>
  );
}
