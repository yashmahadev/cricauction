export type Category = 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper';

export interface Player {
  id: string;
  name: string;
  category: Category;
  basePrice: number;
  imageUrl: string;
  stats: {
    matches: number;
    runs?: number;
    wickets?: number;
    strikeRate?: number;
    economy?: number;
  };
  status: 'Available' | 'Sold' | 'Unsold';
  soldTo?: string; // Team ID
  soldPrice?: number;
}

export interface Team {
  id: string;
  name: string;
  totalBudget: number;
  remainingBudget: number;
  players: string[]; // Player IDs
  color: string;
  logoUrl?: string;
  mobileNumber?: string;
  ownerUid?: string;
}

export interface BidRecord {
  amount: number;
  bidderId: string;
  bidderName: string;
  timestamp: number;
}

export interface AuctionState {
  currentPlayerId: string | null;
  highestBid: number;
  highestBidderId: string | null;
  timeLeft: number;
  status: 'Idle' | 'Active' | 'Ended';
  bidHistory: BidRecord[];
}

export interface AuctionSettings {
  maxPlayersPerTeam: number;
  minBidIncrement: number;
  timerDuration: number;
}

export interface ServerToClientEvents {
  'auction:update': (state: AuctionState) => void;
  'auction:start': (player: Player) => void;
  'auction:end': (result: { playerId: string; teamId: string | null; price: number }) => void;
  'bid:update': (bid: { amount: number; bidderId: string; bidderName: string }) => void;
  'teams:update': (teams: Team[]) => void;
  'players:update': (players: Player[]) => void;
  'settings:update': (settings: AuctionSettings) => void;
  'error': (msg: string) => void;
}

export interface ClientToServerEvents {
  'bid:place': (data: { playerId: string; amount: number; teamId: string }) => void;
  'admin:start-auction': (playerId: string) => void;
  'admin:reset': () => void;
  'admin:adjust-budget': (data: { teamId: string; amount: number }) => void;
  'admin:update-settings': (settings: AuctionSettings) => void;
  'admin:add-player': (player: Omit<Player, 'id' | 'status'>) => void;
  'admin:edit-player': (player: Player) => void;
  'admin:delete-player': (playerId: string) => void;
  'admin:add-team': (team: Omit<Team, 'id' | 'remainingBudget' | 'players'>) => void;
  'admin:edit-team': (team: Team) => void;
  'admin:delete-team': (teamId: string) => void;
}
