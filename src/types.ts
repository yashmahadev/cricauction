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
  email?: string;
  password?: string; // admin-only, stored in private subcollection, never in main doc
  ownerUid?: string;
  captainId?: string;      // Player ID
  viceCaptainId?: string;  // Player ID
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
  startTime?: number; // Timestamp when the auction started or last bid was placed
  status: 'Idle' | 'Active' | 'Paused' | 'Ended';
  bidHistory: BidRecord[];
  scheduledEndTime?: number; // Timestamp when Cloud Function will auto-end the auction
}

export interface AuctionSettings {
  maxPlayersPerTeam: number;
  minBidIncrement: number;
  timerDuration: number;
  scheduledStartTime?: number; // Unix ms timestamp, optional
}

