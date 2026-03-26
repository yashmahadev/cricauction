import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Users, Timer, TrendingUp, Shield, ChevronRight,
  LayoutDashboard, BarChart2, Calendar, GitCompare, Eye as EyeIcon
} from 'lucide-react';
import { Player, Team, AuctionState, AuctionSettings, BidRecord } from '../../types';
import { cn } from '../../lib/utils';
import { PlayerStatsChart, PlayerAvatar } from '../shared/PlayerComponents';
import { ScheduleCountdown } from '../shared/ScheduleCountdown';

interface Props {
  players: Player[];
  teams: Team[];
  auction: AuctionState;
  settings: AuctionSettings;
  displayTime: number;
  spectatorCount: number;
  descendingBidHistory: BidRecord[];
  comparePlayerIds: string[];
  onToggleCompare: (id: string) => void;
  onViewProfile: (player: Player) => void;
}

export function PublicView({
  players, teams, auction, settings, displayTime, spectatorCount,
  descendingBidHistory, comparePlayerIds, onToggleCompare, onViewProfile
}: Props) {
  const currentPlayer = players.find(p => p.id === auction.currentPlayerId);
  const highestBidder = teams.find(t => t.id === auction.highestBidderId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
      {/* Left Column: Live Auction */}
      <div className="lg:col-span-8 space-y-8">
        <section className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />

          {auction.status === 'Active' && currentPlayer ? (
            <div className="p-4 sm:p-6 lg:p-8">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 lg:gap-8">
                <div className="w-full sm:w-40 lg:w-64 aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative group flex-shrink-0">
                  <PlayerAvatar playerId={currentPlayer.id} imageUrl={currentPlayer.imageUrl} name={currentPlayer.name} teams={teams} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" badgeSize="md" />
                  <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full text-xs font-bold border border-white/20">{currentPlayer.category}</div>
                </div>

                <div className="flex-1 min-w-0 space-y-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-2 truncate">{currentPlayer.name}</h2>
                    <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-white/60">
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {currentPlayer.stats.matches} Matches</span>
                      {currentPlayer.stats.runs && <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {currentPlayer.stats.runs} Runs</span>}
                      {currentPlayer.stats.wickets && <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {currentPlayer.stats.wickets} Wickets</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-2xl p-3 sm:p-4 border border-white/10">
                      <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-1">Base Price</p>
                      <p className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">₹{currentPlayer.basePrice}L</p>
                    </div>
                    <div className="bg-emerald-500/10 rounded-2xl p-3 sm:p-4 border border-emerald-500/20">
                      <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider font-bold mb-1">Current Bid</p>
                      <p className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">₹{auction.highestBid}L</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 sm:p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                        <Timer className={cn("w-4 h-4 sm:w-6 sm:h-6", displayTime <= 5 ? "text-red-500 animate-pulse" : "text-white/60")} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-white/40 font-bold uppercase">Time Remaining</p>
                          {auction.status === 'Active' && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                              <span className="text-[10px] text-red-500 font-bold uppercase tracking-tighter">Live</span>
                            </span>
                          )}
                        </div>
                        <p className={cn("text-lg sm:text-xl font-mono font-bold", displayTime <= 5 ? "text-red-500" : "text-white")}>{displayTime}s</p>
                      </div>
                    </div>
                    {highestBidder && (
                      <div className="text-right flex items-center gap-2 sm:gap-4">
                        <div className="hidden sm:flex items-center gap-3 pr-4 border-r border-white/10">
                          <div className="text-right">
                            <p className="text-[10px] text-white/40 uppercase font-bold">Player Stats</p>
                            <div className="flex gap-2 text-[10px] font-mono font-bold">
                              <span className="text-white">{currentPlayer.stats.runs || 0}R</span>
                              <span className="text-white/40">|</span>
                              <span className="text-white">{currentPlayer.stats.wickets || 0}W</span>
                              <span className="text-white/40">|</span>
                              <span className="text-white">{currentPlayer.stats.economy != null ? Number(currentPlayer.stats.economy).toFixed(2) : 'N/A'}E</span>
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

                  <div className="bg-white/5 rounded-2xl border border-white/10 p-3 sm:p-4">
                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Performance Statistics</p>
                    <PlayerStatsChart stats={currentPlayer.stats} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">All Bid History (Latest First)</p>
                      <span className="text-xs font-mono font-bold text-emerald-400">{auction.bidHistory?.length || 0} bids</span>
                    </div>
                    <div className="space-y-2 pr-2 custom-scrollbar">
                      <AnimatePresence initial={false}>
                        {descendingBidHistory.length > 0 ? (
                          descendingBidHistory.map((bid, idx) => (
                            <motion.div key={bid.timestamp + idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between text-sm py-2 px-3 bg-white/5 rounded-lg border border-white/10 hover:border-emerald-500/30 transition-all">
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

        {/* Player Pool */}
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
              <div key={player.id} className={cn("p-4 rounded-2xl border transition-all", player.status === 'Sold' ? "bg-emerald-500/5 border-emerald-500/20" : player.status === 'Unsold' ? "bg-red-500/5 border-red-500/20 opacity-60" : "bg-white/5 border-white/10 hover:border-white/20")}>
                <div className="flex items-center gap-4">
                  <PlayerAvatar playerId={player.id} imageUrl={player.imageUrl} name={player.name} teams={teams} className="w-12 h-12 rounded-xl object-cover" badgeSize="xs" />
                  <div className="flex-1">
                    <h4 className="font-bold">{player.name}</h4>
                    <p className="text-xs text-white/40">{player.category} • Base ₹{player.basePrice}L</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <span className={cn("text-[10px] font-bold uppercase px-2 py-1 rounded-full border", player.status === 'Sold' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : player.status === 'Unsold' ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-white/10 text-white/60 border-white/20")}>{player.status}</span>
                    {player.status === 'Sold' && <p className="text-xs font-bold text-emerald-400">₹{player.soldPrice}L</p>}
                    <button onClick={() => onViewProfile(player)} className="text-[10px] font-bold uppercase text-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-1">View Profile <ChevronRight className="w-3 h-3" /></button>
                    <button onClick={() => onToggleCompare(player.id)} className={cn("text-[10px] font-bold uppercase flex items-center gap-1 transition-colors", comparePlayerIds.includes(player.id) ? "text-blue-400" : "text-white/30 hover:text-blue-400")}>
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
                    {player.stats.strikeRate != null && <span className="text-[10px] text-white/40"><span className="text-white/70 font-bold">{Number(player.stats.strikeRate).toFixed(2)}</span> SR</span>}
                    {player.stats.economy != null && <span className="text-[10px] text-white/40"><span className="text-white/70 font-bold">{Number(player.stats.economy).toFixed(2)}</span> Eco</span>}
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
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            Teams Standing
          </h3>
          <div className="mb-4 bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-black uppercase tracking-widest text-white/40">Budget Leaderboard</span>
            </div>
            {[...teams].sort((a, b) => b.remainingBudget - a.remainingBudget).map((team, i) => {
              const pct = team.totalBudget > 0 ? (team.remainingBudget / team.totalBudget) * 100 : 0;
              return (
                <div key={team.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-white/5 last:border-0">
                  <span className="text-xs font-black text-white/20 w-4 flex-shrink-0">{i + 1}</span>
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex-shrink-0 flex items-center justify-center text-[9px] font-black text-white overflow-hidden" style={{ backgroundColor: team.color }}>
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
          <div className="space-y-3">
            {teams.map(team => (
              <div key={team.id} className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div className="h-1" style={{ backgroundColor: team.color }} />
                <div className="p-3 sm:p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      {team.logoUrl ? (
                        <img src={team.logoUrl} className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-cover border border-white/10 flex-shrink-0" referrerPolicy="no-referrer" loading="lazy" />
                      ) : (
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-white/10 flex items-center justify-center text-base font-black text-white flex-shrink-0" style={{ backgroundColor: team.color }}>{team.name[0]}</div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm sm:text-base truncate">{team.name}</h4>
                        <p className="text-[10px] text-white/40 truncate">
                          Captain: {players.find(p => p.id === team.captainId)?.name || 'TBD'} · Vice: {players.find(p => p.id === team.viceCaptainId)?.name || 'TBD'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">Budget</p>
                      <p className="font-mono font-bold text-emerald-400 text-sm">₹{team.remainingBudget}L</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {team.players.length > 0 ? (
                      team.players.map(pid => {
                        const p = players.find(pl => pl.id === pid);
                        return (
                          <div key={pid} className="w-7 h-7 rounded-lg bg-white/10 border border-white/10 overflow-hidden" title={p?.name}>
                            {p && <PlayerAvatar playerId={p.id} imageUrl={p.imageUrl} name={p.name} teams={teams} className="w-full h-full object-cover" badgeSize="xs" />}
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
  );
}
