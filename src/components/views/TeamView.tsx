import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy, Shield, Timer, TrendingUp, Users, Coins, Calculator,
  AlertCircle, ArrowRight, Plus, Minus, X
} from 'lucide-react';
import { Player, Team, AuctionState, AuctionSettings, BidRecord } from '../../types';
import { cn } from '../../lib/utils';
import { PlayerStatsChart, PlayerAvatar } from '../shared/PlayerComponents';

interface BudgetProjection {
  avgBasePrice: number;
  canAffordCount: number;
  slotsLeft: number;
  recommendedCount: number;
}

interface Props {
  players: Player[];
  teams: Team[];
  auction: AuctionState;
  settings: AuctionSettings;
  displayTime: number;
  teamId: string;
  descendingBidHistory: BidRecord[];
  customBidAmount: string;
  teamBidStep: number;
  showConfirmBid: boolean;
  pendingBidAmount: number | null;
  budgetProjection: BudgetProjection | null;
  onSetCustomBidAmount: (v: string | ((prev: string) => string)) => void;
  onSetTeamBidStep: (v: number) => void;
  onHandleBid: (amount: number) => void;
  onConfirmBid: () => void;
  onCancelBid: () => void;
  onEndAuction: () => void;
  onGoPortal: () => void;
}

export function TeamView({
  players, teams, auction, settings, displayTime, teamId,
  descendingBidHistory, customBidAmount, teamBidStep,
  showConfirmBid, pendingBidAmount, budgetProjection,
  onSetCustomBidAmount, onSetTeamBidStep, onHandleBid,
  onConfirmBid, onCancelBid, onEndAuction, onGoPortal
}: Props) {
  const myTeam = teams.find(t => t.id === teamId);
  const currentPlayer = players.find(p => p.id === auction.currentPlayerId);
  const squadFull = (myTeam?.players.length ?? 0) >= settings.maxPlayersPerTeam;

  if (!myTeam) {
    return (
      <div className="max-w-5xl mx-auto w-full space-y-6 sm:space-y-8">
        <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10 p-12">
          <Shield className="w-16 h-16 text-red-500/50 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Access Denied</h2>
          <p className="text-white/40 mb-8">Your account is not associated with any team.</p>
          <button onClick={onGoPortal} className="px-8 py-3 bg-white/10 rounded-xl font-bold hover:bg-white/20 transition-all">Back to Portal</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full space-y-6 sm:space-y-8">
      {/* Team Header */}
      <header className="p-4 sm:p-6 bg-[#1a1a1a] rounded-2xl sm:rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 blur-[80px] -mr-24 -mt-24 pointer-events-none opacity-20" style={{ backgroundColor: myTeam.color || '#10b981' }} />
        <div className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {myTeam.logoUrl && (
              <img src={myTeam.logoUrl} className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl object-cover border-2 flex-shrink-0 shadow-xl" loading="lazy" style={{ borderColor: `${myTeam.color || '#10b981'}40` }} referrerPolicy="no-referrer" />
            )}
            <div className="min-w-0">
              <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white leading-tight truncate">{myTeam.name}</h2>
              <p className="text-white/40 text-xs sm:text-sm font-medium hidden sm:block">Team Management Dashboard</p>
            </div>
          </div>
          <div className="flex-shrink-0 text-right bg-white/5 px-4 py-3 sm:px-6 sm:py-4 rounded-xl sm:rounded-2xl border border-white/10">
            <p className="text-[9px] sm:text-[10px] text-white/40 uppercase font-black tracking-widest mb-1">Funds</p>
            <p className="text-xl sm:text-3xl font-mono font-bold leading-none" style={{ color: myTeam.color || '#10b981' }}>₹{myTeam.remainingBudget}L</p>
            <div className="w-full h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${(myTeam.remainingBudget / (myTeam.totalBudget || 1000)) * 100}%` }} transition={{ type: 'spring', stiffness: 50, damping: 15 }} className="h-full" style={{ backgroundColor: myTeam.color || '#10b981' }} />
            </div>
            <p className="text-[9px] text-white/20 mt-1 font-black tracking-widest">{Math.round((myTeam.remainingBudget / (myTeam.totalBudget || 1000)) * 100)}% LEFT</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
          {/* Ended result */}
          {auction.status === 'Ended' && currentPlayer ? (
            <section className="bg-white/5 rounded-3xl border border-white/10 p-8 text-center relative overflow-hidden">
              <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10">
                <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-white/10 mx-auto mb-6 shadow-2xl">
                  <PlayerAvatar playerId={currentPlayer.id} imageUrl={currentPlayer.imageUrl} name={currentPlayer.name} teams={teams} className="w-full h-full object-cover" badgeSize="md" />
                </div>
                <h3 className="text-4xl font-black mb-2 uppercase tracking-tighter italic">{auction.highestBidderId ? 'Sold!' : 'Unsold'}</h3>
                <p className="text-xl font-bold mb-6">{currentPlayer.name}</p>
                {auction.highestBidderId && (
                  <div className="bg-emerald-500 text-black px-8 py-4 rounded-2xl inline-block shadow-xl shadow-emerald-500/20">
                    <p className="text-[10px] uppercase font-black tracking-widest mb-1">Winning Team</p>
                    <p className="text-2xl font-bold">{teams.find(t => t.id === auction.highestBidderId)?.name}</p>
                    <p className="text-3xl font-mono font-black mt-1">₹{auction.highestBid}L</p>
                  </div>
                )}
              </motion.div>
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent opacity-50" />
            </section>
          ) : auction.status === 'Active' && currentPlayer ? (
            /* Active bidding section */
            <section className="bg-emerald-500/5 rounded-2xl sm:rounded-3xl border border-emerald-500/20 p-4 sm:p-8">
              {squadFull && (
                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-bold uppercase tracking-wider">Squad Full! Max {settings.maxPlayersPerTeam} players reached.</p>
                </div>
              )}
              {auction.highestBidderId === teamId && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-emerald-500 rounded-2xl flex items-center gap-3 shadow-xl shadow-emerald-500/30">
                  <Trophy className="w-6 h-6 text-black flex-shrink-0" />
                  <div>
                    <p className="text-black font-black uppercase tracking-widest text-sm">You're Winning!</p>
                    <p className="text-black/70 text-xs font-bold">Highest bid: ₹{auction.highestBid}L — hold on until the timer runs out.</p>
                  </div>
                </motion.div>
              )}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <PlayerAvatar playerId={currentPlayer.id} imageUrl={currentPlayer.imageUrl} name={currentPlayer.name} teams={teams} className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl object-cover border border-white/10 flex-shrink-0" badgeSize="sm" />
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
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4 mb-6">
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Performance Statistics</p>
                <PlayerStatsChart stats={currentPlayer.stats} />
              </div>
              <div className="space-y-4">
                {auction.highestBidderId === null ? (
                  <button onClick={() => onHandleBid(auction.highestBid)} disabled={squadFull} className="w-full h-16 bg-emerald-500 rounded-2xl text-black font-bold text-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex flex-col items-center justify-center shadow-xl shadow-emerald-500/20 disabled:opacity-20 disabled:cursor-not-allowed disabled:grayscale">
                    <span>Opening Bid ₹{auction.highestBid}L</span>
                    <span className="text-xs opacity-60">Base Price</span>
                  </button>
                ) : (
                  <button onClick={() => onHandleBid(auction.highestBid + settings.minBidIncrement)} disabled={squadFull} className="w-full h-16 bg-emerald-500 rounded-2xl text-black font-bold text-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex flex-col items-center justify-center shadow-xl shadow-emerald-500/20 disabled:opacity-20 disabled:cursor-not-allowed disabled:grayscale">
                    <span>Bid ₹{auction.highestBid + settings.minBidIncrement}L</span>
                    <span className="text-xs opacity-60">+₹{settings.minBidIncrement}L increment</span>
                  </button>
                )}
                <div className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-3">
                  <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Custom Amount</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onSetCustomBidAmount(v => String(Math.max(currentPlayer?.basePrice || 0, (parseInt(v) || auction.highestBid) - teamBidStep)))} disabled={squadFull} className="w-12 h-12 flex items-center justify-center bg-white/10 border border-white/10 rounded-xl hover:bg-white/20 active:scale-95 transition-all disabled:opacity-20 text-white"><Minus className="w-4 h-4" /></button>
                    <input type="number" placeholder={String(auction.highestBid + settings.minBidIncrement)} value={customBidAmount} onChange={(e) => onSetCustomBidAmount(e.target.value)} disabled={squadFull} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold focus:border-emerald-500 outline-none transition-all disabled:opacity-20" />
                    <button onClick={() => onSetCustomBidAmount(v => String((parseInt(v) || auction.highestBid) + teamBidStep))} disabled={squadFull} className="w-12 h-12 flex items-center justify-center bg-white/10 border border-white/10 rounded-xl hover:bg-white/20 active:scale-95 transition-all disabled:opacity-20 text-white"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 font-bold uppercase whitespace-nowrap">Step:</span>
                    <div className="flex gap-1.5 flex-1">
                      {[settings.minBidIncrement, 25, 50, 100].map(step => (
                        <button key={step} onClick={() => onSetTeamBidStep(step)} className={cn("flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all", teamBidStep === step ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10")}>{step}L</button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => { const a = parseInt(customBidAmount); if (!isNaN(a) && a > 0) onHandleBid(a); }} disabled={!customBidAmount || isNaN(parseInt(customBidAmount)) || squadFull} className="w-full py-3 bg-white/10 border border-white/10 rounded-xl text-white font-bold text-sm hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    Place ₹{customBidAmount || '—'}L Bid
                  </button>
                </div>
              </div>
              <div className="mt-6 sm:mt-8 space-y-3 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold uppercase tracking-widest text-white">Bidding History (Latest First)</p>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">{auction.bidHistory?.length || 0} bids</span>
                </div>
                <div className="space-y-2 pr-2 custom-scrollbar max-h-96 overflow-y-auto">
                  {descendingBidHistory.length > 0 ? descendingBidHistory.map((bid, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm py-2.5 px-4 bg-black/40 rounded-lg border border-white/10 hover:border-emerald-500/30 transition-all">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", bid.bidderId === teamId ? "bg-emerald-500" : "bg-blue-500/50")} />
                        <span className={cn("font-medium truncate", bid.bidderId === teamId ? "text-emerald-400 font-bold" : "text-white/70")}>{bid.bidderName}{bid.bidderId === teamId && <span className="text-emerald-400/80 ml-1">(You)</span>}</span>
                      </div>
                      <span className="font-mono font-bold text-white flex-shrink-0 ml-3">₹{bid.amount}L</span>
                    </div>
                  )) : <p className="text-xs text-white/30 italic text-center py-6">Waiting for bids...</p>}
                </div>
              </div>
              <div className="mt-6 flex flex-col items-center justify-center gap-4">
                <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
                  <Timer className="w-4 h-4" />
                  <span>Auction ends in <span className="text-white font-mono font-bold">{displayTime}s</span></span>
                  {auction.status === 'Active' && <span className="flex items-center gap-1 ml-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" /><span className="text-[10px] text-red-500 font-bold uppercase">Live</span></span>}
                </div>
                {displayTime === 0 && auction.status === 'Active' && auction.highestBidderId === teamId && (
                  <button onClick={onEndAuction} className="w-full py-4 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 transition-all animate-bounce">Finalize My Win!</button>
                )}
              </div>
            </section>
          ) : (
            /* Idle / Paused */
            <div className="bg-white/5 rounded-2xl sm:rounded-3xl border border-white/10 p-6 sm:p-8">
              {auction.status === 'Paused' ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><Timer className="w-8 h-8 text-yellow-400" /></div>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-blue-400" /><p className="text-xs text-white/40 uppercase font-bold">Squad Size</p></div>
                      <p className="text-2xl font-bold">{myTeam.players.length}<span className="text-sm text-white/40 ml-1">/ {settings.maxPlayersPerTeam}</span></p>
                      <p className="text-xs text-white/30 mt-1">{settings.maxPlayersPerTeam - myTeam.players.length} slots remaining</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-emerald-400" /><p className="text-xs text-white/40 uppercase font-bold">Available Players</p></div>
                      <p className="text-2xl font-bold text-emerald-400">{players.filter(p => p.status === 'Available').length}</p>
                      <p className="text-xs text-white/30 mt-1">{players.filter(p => p.status === 'Sold').length} sold, {players.filter(p => p.status === 'Unsold').length} unsold</p>
                    </div>
                  </div>
                  {budgetProjection && (
                    <div className="bg-blue-500/5 rounded-xl p-4 border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-3"><Calculator className="w-4 h-4 text-blue-400" /><p className="text-xs text-blue-400 uppercase font-bold">Budget Projection</p></div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-white/60">Avg. base price:</span><span className="font-mono font-bold">₹{Math.round(budgetProjection.avgBasePrice)}L</span></div>
                        <div className="flex justify-between"><span className="text-white/60">Can afford ~</span><span className="font-mono font-bold text-emerald-400">{budgetProjection.canAffordCount} players</span></div>
                        <div className="flex justify-between"><span className="text-white/60">Recommended buys:</span><span className="font-mono font-bold text-blue-400">{budgetProjection.recommendedCount} players</span></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Confirm Bid Modal */}
          <AnimatePresence>
            {showConfirmBid && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onCancelBid}>
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 15, stiffness: 300 } }} exit={{ opacity: 0, scale: 0.9, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-[#1a1a1a] border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-8 max-w-sm w-full shadow-2xl text-center">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border border-white/10 mx-auto mb-4 shadow-xl">
                    {currentPlayer && <PlayerAvatar playerId={currentPlayer.id} imageUrl={currentPlayer.imageUrl} name={currentPlayer.name} teams={teams} className="w-full h-full object-cover" badgeSize="sm" />}
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Confirm Your Bid</h3>
                  <p className="text-white/60 mb-6">You are placing a bid for <span className="text-white font-bold">{currentPlayer?.name}</span></p>
                  <div className="space-y-4 mb-8">
                    <div className="bg-black/40 rounded-2xl p-4 border border-white/10">
                      <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Bid Amount</p>
                      <p className="text-3xl font-mono font-bold text-emerald-400">₹{pendingBidAmount}L</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-left">
                        <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Your Budget</p>
                        <p className="text-sm font-mono font-bold">₹{myTeam.remainingBudget}L</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-left">
                        <p className="text-[10px] text-white/40 uppercase font-bold mb-1">After Bid</p>
                        <p className="text-sm font-mono font-bold text-red-400">₹{myTeam.remainingBudget - (pendingBidAmount || 0)}L</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={onCancelBid} className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all">Cancel</button>
                    <button onClick={onConfirmBid} className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-all">Confirm Bid</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Squad */}
          <section>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-bold">Your Squad</h3>
              <div className="text-right">
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Total Spent</p>
                <p className="text-lg sm:text-xl font-mono font-bold text-white">₹{myTeam.totalBudget - myTeam.remainingBudget}L</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {myTeam.players.map(pid => {
                const p = players.find(pl => pl.id === pid);
                return (
                  <div key={pid} className="bg-white/5 rounded-xl sm:rounded-2xl border border-white/10 overflow-hidden group hover:border-emerald-500/30 transition-all">
                    <div className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                      <PlayerAvatar playerId={pid} imageUrl={p?.imageUrl || ''} name={p?.name} teams={teams} className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-white/10 flex-shrink-0" badgeSize="sm" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-base sm:text-lg truncate">{p?.name}</h4>
                        <p className="text-xs text-white/40 font-medium uppercase tracking-wider">{p?.category}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Bought</p>
                        <p className="text-base sm:text-lg font-mono font-bold text-emerald-400">₹{p?.soldPrice}L</p>
                      </div>
                    </div>
                    {p && <div className="px-4 pb-4"><PlayerStatsChart stats={p.stats} /></div>}
                  </div>
                );
              })}
              {myTeam.players.length === 0 && (
                <div className="col-span-full py-12 text-center border border-dashed border-white/10 rounded-3xl">
                  <p className="text-white/20 italic">Your squad is empty. Start bidding!</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6 sm:space-y-8">
          <section className="bg-white/5 rounded-2xl sm:rounded-3xl border border-white/10 p-4 sm:p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" />Budget Analysis</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold uppercase mb-2">
                  <span className="text-white/40">Spent</span>
                  <span className="text-white">₹{myTeam.totalBudget - myTeam.remainingBudget}L</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${((myTeam.totalBudget - myTeam.remainingBudget) / (myTeam.totalBudget || 1)) * 100}%` }} />
                </div>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">
                You have spent {(((myTeam.totalBudget - myTeam.remainingBudget) / (myTeam.totalBudget || 1)) * 100).toFixed(1)}% of your total budget. Manage your remaining ₹{myTeam.remainingBudget}L wisely.
              </p>
            </div>
          </section>
          {budgetProjection && (
            <section className="bg-white/5 rounded-2xl sm:rounded-3xl border border-white/10 p-4 sm:p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-400"><Calculator className="w-4 h-4" />Budget Projection</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div><p className="text-[10px] text-white/40 uppercase font-bold mb-1">Avg. Base Price</p><p className="text-xl font-mono font-bold text-white">₹{budgetProjection.avgBasePrice.toFixed(1)}L</p></div>
                  <div className="text-right"><p className="text-[10px] text-white/40 uppercase font-bold mb-1">Est. Affordable</p><p className="text-3xl font-mono font-bold text-blue-400">~{budgetProjection.canAffordCount}</p></div>
                </div>
                <p className="text-xs text-white/40 leading-relaxed border-t border-white/5 pt-4">
                  Based on the current market, you can afford approximately <span className="text-white font-bold">{budgetProjection.canAffordCount} more players</span> at their base prices.
                  {budgetProjection.slotsLeft < budgetProjection.canAffordCount && <span className="block mt-1 text-amber-400/60">Note: You only have {budgetProjection.slotsLeft} squad slots remaining.</span>}
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
