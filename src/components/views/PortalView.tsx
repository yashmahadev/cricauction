import React from 'react';
import { Trophy, Shield, Settings, ArrowRight, Calendar, Eye as EyeIcon } from 'lucide-react';
import { AuctionState, AuctionSettings } from '../../types';
import { ScheduleCountdown } from '../shared/ScheduleCountdown';

interface Props {
  auction: AuctionState;
  settings: AuctionSettings;
  spectatorCount: number;
  isLoggedInAsAdmin: boolean;
  isLoggedInAsTeam: boolean;
  onGoPublic: () => void;
  onGoTeam: () => void;
  onGoAdmin: () => void;
}

export function PortalView({
  auction, settings, spectatorCount,
  isLoggedInAsAdmin, isLoggedInAsTeam,
  onGoPublic, onGoTeam, onGoAdmin
}: Props) {
  const scheduledMs = settings.scheduledStartTime;
  const showCountdown = scheduledMs && scheduledMs > Date.now() && auction.status === 'Idle';

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 gap-6">
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
            <Trophy className="w-7 h-7 text-black" />
          </div>
          <h1 className="text-4xl font-black tracking-tight">CricAuction</h1>
        </div>
        <p className="text-white/40 text-sm">Select your portal to get started</p>
      </div>

      {showCountdown && (
        <div className="flex items-center gap-3 px-6 py-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
          <Calendar className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-bold">Auction starts in <ScheduleCountdown targetMs={scheduledMs!} /></span>
        </div>
      )}

      <div className="flex items-center gap-2 text-white/20 text-xs font-bold">
        <EyeIcon className="w-3.5 h-3.5" />
        <span>{spectatorCount} {spectatorCount === 1 ? 'person' : 'people'} online</span>
      </div>

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        <button onClick={onGoPublic} className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-center">
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

        <button onClick={onGoTeam} className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-center">
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

        <button onClick={onGoAdmin} className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-center">
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
