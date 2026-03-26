import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings, Shield, User, Users, Trophy, Timer, Play, RotateCcw, Plus, Trash2,
  Search, Download, Upload, FileText, Filter, ArrowUpDown, ChevronDown,
  CheckCircle2, Loader2, AlertCircle, X, Lock, Calculator, Coins, Mail,
  Clock, Calendar
} from 'lucide-react';
import { Player, Team, AuctionState, AuctionSettings } from '../../types';
import { cn } from '../../lib/utils';
import { PlayerAvatar } from '../shared/PlayerComponents';
import { ScheduleCountdown } from '../shared/ScheduleCountdown';

interface ImportStatus {
  type: 'players' | 'teams';
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  total: number;
  error?: string;
}

interface Props {
  players: Player[];
  teams: Team[];
  auction: AuctionState;
  settings: AuctionSettings;
  displayTime: number;
  // player filters/sort
  playerSearch: string; setPlayerSearch: (v: string) => void;
  statusFilter: 'All' | 'Available' | 'Sold' | 'Unsold'; setStatusFilter: (v: any) => void;
  minRuns: number | ''; setMinRuns: (v: number | '') => void;
  maxWickets: number | ''; setMaxWickets: (v: number | '') => void;
  sortBy: 'name' | 'basePrice' | 'runs' | 'wickets'; setSortBy: (v: any) => void;
  sortOrder: 'asc' | 'desc'; setSortOrder: (v: any) => void;
  paginatedPlayers: Player[];
  filteredPlayers: Player[];
  playersPage: number; setPlayersPage: (v: number) => void;
  totalPages: number;
  isSelectionMode: boolean; setIsSelectionMode: (v: (prev: boolean) => boolean) => void;
  selectedPlayerIds: string[]; setSelectedPlayerIds: (v: string[]) => void;
  teamSearch: string; setTeamSearch: (v: string) => void;
  importStatus: ImportStatus | null; setImportStatus: (v: ImportStatus | null) => void;
  importedTeamCreds: { name: string; email: string; password: string }[];
  isGenerating: boolean;
  // actions
  onGenerateSampleData: () => void;
  onReAuctionUnsold: () => void;
  onResetAll: () => void;
  onBackfillEmails: () => void;
  onDownloadSampleCSV: (type: 'players' | 'teams') => void;
  onCSVUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'players' | 'teams') => void;
  onDownloadTeamsCSV: () => void;
  onDownloadImportedCredsCSV: (creds: { name: string; email: string; password: string }[]) => void;
  onUpdateSettings: (s: AuctionSettings) => void;
  onStartAuction: (id: string) => void;
  onPauseAuction: () => void;
  onResumeAuction: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkMarkUnsold: () => void;
  onAddPlayer: () => void;
  onEditPlayer: (p: Player) => void;
  onDeletePlayer: (id: string) => void;
  onViewPlayerProfile: (p: Player) => void;
  onAddTeam: () => void;
  onEditTeam: (t: Team) => void;
  onDeleteTeam: (id: string) => void;
  onViewTeamCreds: (t: Team) => void;
  onBudgetAdjust: (teamId: string) => void;
  onBidAdjust: (teamId: string) => void;
  onShowEndAuctionConfirm: () => void;
  onShowResetTimerConfirm: () => void;
}

export function AdminView(props: Props) {
  const {
    players, teams, auction, settings, displayTime,
    playerSearch, setPlayerSearch, statusFilter, setStatusFilter,
    minRuns, setMinRuns, maxWickets, setMaxWickets,
    sortBy, setSortBy, sortOrder, setSortOrder,
    paginatedPlayers, filteredPlayers, playersPage, setPlayersPage, totalPages,
    isSelectionMode, setIsSelectionMode, selectedPlayerIds, setSelectedPlayerIds,
    teamSearch, setTeamSearch, importStatus, setImportStatus, importedTeamCreds, isGenerating,
    onGenerateSampleData, onReAuctionUnsold, onResetAll, onBackfillEmails,
    onDownloadSampleCSV, onCSVUpload, onDownloadTeamsCSV, onDownloadImportedCredsCSV,
    onUpdateSettings, onStartAuction, onPauseAuction, onResumeAuction, onClearSelection,
    onBulkDelete, onBulkMarkUnsold, onAddPlayer, onEditPlayer, onDeletePlayer, onViewPlayerProfile,
    onAddTeam, onEditTeam, onDeleteTeam, onViewTeamCreds, onBudgetAdjust, onBidAdjust,
    onShowEndAuctionConfirm, onShowResetTimerConfirm,
  } = props;

  const playerCsvInputRef = useRef<HTMLInputElement>(null);
  const teamCsvInputRef = useRef<HTMLInputElement>(null);
  const currentPlayer = players.find(p => p.id === auction.currentPlayerId);
  const highestBidder = teams.find(t => t.id === auction.highestBidderId);

  return (
    <div className="w-full max-w-[100%] mx-auto space-y-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
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
          <button onClick={onGenerateSampleData} disabled={isGenerating} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 hover:bg-blue-500/20 transition-all font-bold text-sm disabled:opacity-50">
            <Plus className="w-4 h-4" /> {isGenerating ? 'Generating...' : 'Sample Data'}
          </button>
          {players.some(p => p.status === 'Unsold') && (
            <button onClick={onReAuctionUnsold} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-yellow-500/10 text-yellow-400 rounded-xl border border-yellow-500/20 hover:bg-yellow-500/20 transition-all font-bold text-sm">
              <RotateCcw className="w-4 h-4" /> Re-auction Unsold ({players.filter(p => p.status === 'Unsold').length})
            </button>
          )}
          <button onClick={onResetAll} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all font-bold text-sm">
            <RotateCcw className="w-4 h-4" /> Reset All
          </button>
          {teams.some(t => !t.email) && (
            <button onClick={onBackfillEmails} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-orange-500/10 text-orange-400 rounded-xl border border-orange-500/20 hover:bg-orange-500/20 transition-all font-bold text-sm">
              <Mail className="w-4 h-4" /> Fix Team Emails ({teams.filter(t => !t.email).length})
            </button>
          )}
        </div>
      </header>

      {/* CSV Data Management */}
      <section className="bg-white/5 rounded-[2.5rem] border border-white/10 p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-3"><FileText className="w-6 h-6 text-emerald-500" />CSV Data Management</h3>
            <p className="text-white/40 mt-1">Bulk import players and teams using CSV files.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => onDownloadSampleCSV('players')} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-sm font-bold"><Download className="w-4 h-4" /> Players Sample</button>
            <button onClick={() => onDownloadSampleCSV('teams')} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-sm font-bold"><Download className="w-4 h-4" /> Teams Sample</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-black/20 rounded-3xl p-6 border border-white/5 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4"><User className="w-6 h-6 text-emerald-500" /></div>
            <h4 className="font-bold mb-2">Import Players</h4>
            <p className="text-xs text-white/40 mb-6">Upload a CSV file containing player details and statistics.</p>
            <input type="file" accept=".csv" className="hidden" ref={playerCsvInputRef} onChange={(e) => onCSVUpload(e, 'players')} />
            <button onClick={() => playerCsvInputRef.current?.click()} className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"><Upload className="w-4 h-4" /> Upload Players CSV</button>
          </div>
          <div className="bg-black/20 rounded-3xl p-6 border border-white/5 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4"><Users className="w-6 h-6 text-blue-500" /></div>
            <h4 className="font-bold mb-2">Import Teams</h4>
            <p className="text-xs text-white/40 mb-6">Upload a CSV file containing team names, budgets, and colors.</p>
            <input type="file" accept=".csv" className="hidden" ref={teamCsvInputRef} onChange={(e) => onCSVUpload(e, 'teams')} />
            <button onClick={() => teamCsvInputRef.current?.click()} className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-400 transition-all flex items-center justify-center gap-2"><Upload className="w-4 h-4" /> Upload Teams CSV</button>
          </div>
        </div>
      </section>

      {/* Import Status Dialog */}
      <AnimatePresence>
        {importStatus && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setImportStatus(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-4 sm:p-8 max-w-md w-full shadow-2xl">
              <div className="text-center mb-4 sm:mb-6">
                <div className={cn("w-12 h-12 sm:w-16 sm:h-16 rounded-2xl mx-auto mb-3 sm:mb-4 flex items-center justify-center", importStatus.status === 'processing' ? "bg-blue-500/20 text-blue-500" : importStatus.status === 'completed' ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500")}>
                  {importStatus.status === 'processing' ? <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin" /> : importStatus.status === 'completed' ? <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8" /> : <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8" />}
                </div>
                <h3 className="text-lg sm:text-2xl font-bold">{importStatus.status === 'processing' ? `Importing ${importStatus.type}...` : importStatus.status === 'completed' ? 'Import Successful' : 'Import Failed'}</h3>
                <p className="text-white/40 mt-1 text-sm">{importStatus.status === 'processing' ? `Processing ${importStatus.progress} of ${importStatus.total} records` : importStatus.status === 'completed' ? `Successfully imported ${importStatus.total} ${importStatus.type}` : importStatus.error}</p>
              </div>
              {importStatus.status === 'processing' && (
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-6">
                  <motion.div className="h-full bg-blue-500" initial={{ width: 0 }} animate={{ width: `${(importStatus.progress / (importStatus.total || 1)) * 100}%` }} />
                </div>
              )}
              {importStatus.status !== 'processing' && (
                <div className="flex flex-col gap-3">
                  {importStatus.status === 'completed' && importStatus.type === 'teams' && importedTeamCreds.length > 0 && (
                    <button onClick={() => onDownloadImportedCredsCSV(importedTeamCreds)} className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"><Download className="w-5 h-5" /> Download Credentials CSV</button>
                  )}
                  <button onClick={() => setImportStatus(null)} className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold transition-all border border-white/10">Close</button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
        {/* Live Auction Control */}
        <div className="lg:col-span-4">
          <section className={cn("p-4 rounded-3xl border transition-all", auction.status === 'Active' ? "bg-emerald-500/5 border-emerald-500/20" : "bg-white/5 border-white/10")}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                {currentPlayer ? <PlayerAvatar playerId={currentPlayer.id} imageUrl={currentPlayer.imageUrl} name={currentPlayer.name} teams={teams} className="w-full h-full object-cover" badgeSize="xs" /> : <User className="w-6 h-6 text-white/10" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-xl font-bold truncate">{currentPlayer?.name || 'No Active Player'}</h3>
                  {auction.status === 'Active' && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 text-[10px] font-bold uppercase animate-pulse flex-shrink-0">Live</span>}
                </div>
                <p className="text-white/40 text-xs truncate">{currentPlayer ? `${currentPlayer.category} • Base ₹${currentPlayer.basePrice}L` : 'Select a player from the list below.'}</p>
              </div>
            </div>
            {auction.status === 'Active' && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <div className="flex-shrink-0">
                  <p className="text-[9px] text-white/40 font-bold uppercase">Current Bid</p>
                  <p className="text-lg sm:text-2xl font-mono font-bold text-emerald-400 leading-tight">₹{auction.highestBid}L</p>
                  {highestBidder && <p className="text-[10px] font-bold text-white/70 truncate max-w-[100px]">by {highestBidder.name}</p>}
                </div>
                <div className="flex-shrink-0">
                  <p className="text-[9px] text-white/40 font-bold uppercase">Time Left</p>
                  <p className={cn("text-lg sm:text-2xl font-mono font-bold leading-tight", displayTime <= 5 ? "text-red-500" : "text-white")}>{displayTime}s</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap ml-auto">
                  <button onClick={onShowResetTimerConfirm} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold hover:bg-white/10 transition-all whitespace-nowrap">Reset Timer</button>
                  <button onClick={onPauseAuction} className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-lg text-xs font-bold hover:bg-yellow-500/20 transition-all">Pause</button>
                  <button onClick={onShowEndAuctionConfirm} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-400 transition-all flex items-center gap-1 whitespace-nowrap"><AlertCircle className="w-3 h-3" /> End Auction</button>
                </div>
              </div>
            )}
            {auction.status !== 'Active' && currentPlayer && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-sm font-bold text-white/50 mr-auto">{auction.status === 'Ended' ? 'Auction Ended' : auction.status === 'Paused' ? 'Paused' : 'Ready to Start'}</p>
                {auction.status === 'Paused' ? (
                  <button onClick={onResumeAuction} className="px-4 py-2 bg-yellow-500 text-black rounded-xl font-bold hover:bg-yellow-400 transition-all flex items-center gap-2 text-sm"><Play className="w-4 h-4 fill-current" /> Resume</button>
                ) : (
                  <button onClick={() => onStartAuction(currentPlayer.id)} className="px-4 py-2 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all flex items-center gap-2 text-sm"><Play className="w-4 h-4 fill-current" /> Start Auction</button>
                )}
                <button onClick={onClearSelection} className="p-2 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:text-white transition-all" title="Clear Selection"><RotateCcw className="w-4 h-4" /></button>
              </div>
            )}
          </section>
        </div>

        {/* Settings & Manage Teams */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-white/5 p-6 rounded-3xl border border-white/10">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Settings className="w-5 h-5 text-purple-500" />Auction Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 font-bold uppercase mb-2 block">Max Players Per Team</label>
                <input type="number" value={settings.maxPlayersPerTeam} onChange={(e) => onUpdateSettings({ ...settings, maxPlayersPerTeam: parseInt(e.target.value) })} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-white/40 font-bold uppercase mb-2 block">Min Bid Increment (₹L)</label>
                <input type="number" value={settings.minBidIncrement} onChange={(e) => onUpdateSettings({ ...settings, minBidIncrement: parseInt(e.target.value) })} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-white/40 font-bold uppercase mb-2 block">Timer Duration (s)</label>
                <input type="number" value={settings.timerDuration} onChange={(e) => onUpdateSettings({ ...settings, timerDuration: parseInt(e.target.value) })} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-white/40 font-bold uppercase mb-2 flex items-center gap-1"><Calendar className="w-3 h-3" /> Scheduled Start Time</label>
                <input type="datetime-local" value={settings.scheduledStartTime ? new Date(settings.scheduledStartTime - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={(e) => onUpdateSettings({ ...settings, scheduledStartTime: e.target.value ? new Date(e.target.value).getTime() : undefined })} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors" />
                {settings.scheduledStartTime && settings.scheduledStartTime > Date.now() && (
                  <p className="text-[10px] text-blue-400 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />Starts in <ScheduleCountdown targetMs={settings.scheduledStartTime} /></p>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white/5 p-6 rounded-3xl border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-blue-500" />Manage Teams</h3>
              <div className="flex items-center gap-2">
                <button onClick={onDownloadTeamsCSV} className="p-2 bg-green-500/10 text-green-400 rounded-lg border border-green-500/20 hover:bg-green-500/20 transition-all" title="Download Teams CSV"><Download className="w-4 h-4" /></button>
                {importedTeamCreds.length > 0 && (
                  <button onClick={() => onDownloadImportedCredsCSV(importedTeamCreds)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all text-xs font-bold"><Download className="w-3.5 h-3.5" /> Credentials</button>
                )}
                <button onClick={onAddTeam} className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-all"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="mb-4 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
              <input type="text" placeholder="Search teams..." value={teamSearch} onChange={(e) => setTeamSearch(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:border-blue-500 outline-none transition-all" />
            </div>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {teams.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase())).map(team => (
                <div key={team.id} className="p-3 bg-black/20 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 overflow-hidden flex-shrink-0" style={{ backgroundColor: team.color }}>
                        {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" /> : <Shield className="w-4 h-4 text-white" />}
                      </div>
                      <span className="text-sm font-bold truncate text-white">{team.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); onViewTeamCreds(team); }} className="p-1.5 text-white/40 hover:text-yellow-400 transition-colors" title="View / Reset Credentials"><Lock className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); onEditTeam(team); }} className="p-1.5 text-white/40 hover:text-white transition-colors"><Settings className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteTeam(team.id); }} className="p-1.5 text-red-500/40 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">Budget: ₹{team.remainingBudget}L</span>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); onBudgetAdjust(team.id); }} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-all"><Calculator className="w-3 h-3" /> Budget</button>
                      {auction.status === 'Active' && (
                        <button onClick={(e) => { e.stopPropagation(); onBidAdjust(team.id); }} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-all"><Coins className="w-3 h-3" /> Bid</button>
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
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="w-full bg-white/5 border border-white/10 rounded-2xl pl-5 pr-10 py-2.5 sm:py-3.5 text-xs sm:text-sm font-bold focus:border-emerald-500/50 outline-none transition-all appearance-none cursor-pointer text-white/80 hover:bg-white/[0.08]">
                      <option value="All" className="bg-gray-800 text-white">All Status</option>
                      <option value="Available" className="bg-gray-800 text-white">Available</option>
                      <option value="Sold" className="bg-gray-800 text-white">Sold</option>
                      <option value="Unsold" className="bg-gray-800 text-white">Unsold</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20"><ChevronDown className="w-4 h-4" /></div>
                  </div>
                  <button onClick={() => { setIsSelectionMode(m => !m); setSelectedPlayerIds([]); }} className={cn("flex items-center gap-2 px-4 py-2.5 sm:py-3.5 rounded-2xl transition-all font-bold text-xs sm:text-sm whitespace-nowrap border", isSelectionMode ? "bg-white/10 border-white/20 text-white" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10")}>
                    <CheckCircle2 className="w-4 h-4" /><span className="hidden sm:inline">{isSelectionMode ? 'Cancel' : 'Select'}</span>
                  </button>
                  <button onClick={onAddPlayer} className="flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3.5 bg-emerald-500 text-black rounded-2xl hover:bg-emerald-400 transition-all font-bold text-xs sm:text-sm whitespace-nowrap justify-center shadow-lg shadow-emerald-500/20 active:scale-95 flex-1 sm:flex-none">
                    <Plus className="w-4 sm:w-5 h-4 sm:h-5" /><span className="hidden sm:inline">Add Player</span><span className="sm:hidden">Add</span>
                  </button>
                </div>
              </div>
              <div className="relative w-full max-w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-white/20" />
                <input type="text" placeholder="Search name or category..." value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3.5 text-xs sm:text-sm focus:border-emerald-500/50 focus:bg-white/[0.08] outline-none transition-all placeholder:text-white/10" />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8 md:mb-10">
              {[
                { label: 'Total Players', value: players.length, color: 'text-white', icon: Users, bg: 'bg-white/5' },
                { label: 'Available', value: players.filter(p => p.status === 'Available').length, color: 'text-emerald-500', icon: CheckCircle2, bg: 'bg-emerald-500/5' },
                { label: 'Sold', value: players.filter(p => p.status === 'Sold').length, color: 'text-blue-500', icon: Trophy, bg: 'bg-blue-500/5' },
                { label: 'Unsold', value: players.filter(p => p.status === 'Unsold').length, color: 'text-red-500', icon: X, bg: 'bg-red-500/5' }
              ].map((stat, idx) => (
                <div key={idx} className={cn("border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 transition-all hover:border-white/10 group relative overflow-hidden", stat.bg)}>
                  <div className="absolute top-0 right-0 p-1 md:p-2 opacity-5 group-hover:opacity-10 transition-opacity"><stat.icon className="w-8 md:w-12 h-8 md:h-12" /></div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-1 md:mb-2">{stat.label}</p>
                  <p className={cn("text-2xl md:text-3xl font-mono font-bold", stat.color)}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Filters & Sort */}
            <div className="space-y-4 mb-6 md:mb-8">
              <div className="bg-white/5 rounded-2xl md:rounded-[2rem] border border-white/5 p-4 md:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10"><Filter className="w-4 h-4 text-emerald-500" /></div>
                  <span className="text-xs md:text-sm font-black uppercase tracking-wider text-white/40">Filters</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-white/30 block">Min Runs</label>
                    <div className="relative">
                      <input type="number" value={minRuns} onChange={(e) => setMinRuns(e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="0" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500/50 outline-none transition-all placeholder:text-white/20 font-mono" />
                      {minRuns !== '' && <button onClick={() => setMinRuns('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-all"><X className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-white/30 block">Max Wickets</label>
                    <div className="relative">
                      <input type="number" value={maxWickets} onChange={(e) => setMaxWickets(e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="0" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500/50 outline-none transition-all placeholder:text-white/20 font-mono" />
                      {maxWickets !== '' && <button onClick={() => setMaxWickets('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-all"><X className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                </div>
                {(minRuns !== '' || maxWickets !== '') && (
                  <button onClick={() => { setMinRuns(''); setMaxWickets(''); }} className="mt-4 flex items-center gap-2 px-4 py-2 text-xs font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"><RotateCcw className="w-3.5 h-3.5" />Clear Filters</button>
                )}
              </div>
              <div className="bg-white/5 rounded-2xl md:rounded-[2rem] border border-white/5 p-4 md:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10"><ArrowUpDown className="w-4 h-4 text-blue-500" /></div>
                  <span className="text-xs md:text-sm font-black uppercase tracking-wider text-white/40">Sort By</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-sm font-bold focus:border-blue-500/50 outline-none transition-all appearance-none cursor-pointer hover:bg-black/60">
                      <option value="name" className="bg-gray-800 text-white">Name</option>
                      <option value="basePrice" className="bg-gray-800 text-white">Base Price</option>
                      <option value="runs" className="bg-gray-800 text-white">Runs</option>
                      <option value="wickets" className="bg-gray-800 text-white">Wickets</option>
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                  </div>
                  <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl hover:bg-white/10 transition-all group sm:w-auto">
                    <ArrowUpDown className={cn("w-4 h-4 transition-transform duration-300", sortOrder === 'desc' ? "rotate-180 text-blue-400" : "text-white/40")} />
                    <span className="text-sm font-bold text-white/60 group-hover:text-white transition-colors">{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bulk action bar */}
            {isSelectionMode && (
              <div className="flex items-center justify-between gap-3 mb-4 p-3 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedPlayerIds(filteredPlayers.map(p => p.id))} className="text-xs font-bold text-white/60 hover:text-white transition-colors">Select All ({filteredPlayers.length})</button>
                  {selectedPlayerIds.length > 0 && <span className="text-xs text-emerald-400 font-bold">{selectedPlayerIds.length} selected</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={onBulkMarkUnsold} disabled={selectedPlayerIds.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-xl hover:bg-yellow-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"><RotateCcw className="w-3 h-3" /> Mark Unsold</button>
                  <button onClick={onBulkDelete} disabled={selectedPlayerIds.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 className="w-3 h-3" /> Delete Selected</button>
                </div>
              </div>
            )}

            {/* Player grid */}
            {filteredPlayers.length === 0 ? (
              <div className="py-12 md:py-20 text-center border border-dashed border-white/10 rounded-[2rem] px-4">
                <div className="w-12 md:w-16 h-12 md:h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4"><Search className="w-6 md:w-8 h-6 md:h-8 text-white/10" /></div>
                <h4 className="text-lg md:text-xl font-bold text-white/40">No players found</h4>
                <p className="text-white/20 text-xs md:text-sm mt-1">Try adjusting your filters or search terms</p>
                <button onClick={() => { setPlayerSearch(''); setStatusFilter('All'); setMinRuns(''); setMaxWickets(''); }} className="mt-6 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all">Clear All Filters</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                  {paginatedPlayers.map(player => (
                    <motion.div layout key={player.id}
                      onClick={() => { if (!isSelectionMode) { onViewPlayerProfile(player); } else { setSelectedPlayerIds(prev => prev.includes(player.id) ? prev.filter(id => id !== player.id) : [...prev, player.id]); } }}
                      className={cn("group relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col cursor-pointer hover:border-emerald-500/50", isSelectionMode && selectedPlayerIds.includes(player.id) ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-white/10")}
                    >
                      {isSelectionMode && (
                        <div className="absolute top-2 right-2 z-20">
                          <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", selectedPlayerIds.includes(player.id) ? "bg-emerald-500 border-emerald-500" : "bg-black/40 border-white/30")}>
                            {selectedPlayerIds.includes(player.id) && <CheckCircle2 className="w-3 h-3 text-black" />}
                          </div>
                        </div>
                      )}
                      <div className="relative h-32 sm:h-40 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent z-1" />
                        <PlayerAvatar playerId={player.id} imageUrl={player.imageUrl} name={player.name} teams={teams} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" badgeSize="sm" />
                      </div>
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">{player.name}</h4>
                          <p className="text-[10px] text-white/40 truncate">{player.category}</p>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-1">
                          <span className={cn("px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border flex-1 text-center", player.status === 'Available' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : player.status === 'Sold' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-red-500/10 text-red-500 border-red-500/20")}>
                            {player.status === 'Available' ? 'Avail' : player.status}
                          </span>
                          {player.status === 'Available' && !isSelectionMode && (
                            <button onClick={(e) => { e.stopPropagation(); onStartAuction(player.id); }} className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors" title="Start Auction"><Play className="w-3 h-3 fill-current" /></button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); if (!isSelectionMode) onEditPlayer(player); }} className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors" title="Edit"><Settings className="w-3 h-3" /></button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="mt-6 sm:mt-8 space-y-3">
                    <p className="text-xs sm:text-sm text-white/40 text-center sm:text-left">Showing {((playersPage - 1) * 20) + 1}-{Math.min(playersPage * 20, filteredPlayers.length)} of {filteredPlayers.length} players</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3">
                      <button onClick={() => setPlayersPage(p => Math.max(1, p - 1))} disabled={playersPage === 1} className="w-full sm:w-auto px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed">Previous</button>
                      <div className="flex items-center gap-1 sm:gap-2">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum = totalPages <= 5 ? i + 1 : playersPage <= 3 ? i + 1 : playersPage >= totalPages - 2 ? totalPages - 4 + i : playersPage - 2 + i;
                          return (
                            <button key={pageNum} onClick={() => setPlayersPage(pageNum)} className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-bold transition-all", playersPage === pageNum ? "bg-emerald-500 text-black" : "bg-white/5 border border-white/10 hover:bg-white/10")}>{pageNum}</button>
                          );
                        })}
                      </div>
                      <button onClick={() => setPlayersPage(p => Math.min(totalPages, p + 1))} disabled={playersPage === totalPages} className="w-full sm:w-auto px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
