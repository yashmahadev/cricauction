import { db } from '../firebase';
import {
  doc, setDoc, updateDoc, runTransaction, writeBatch, arrayUnion
} from 'firebase/firestore';
import { AuctionState, AuctionSettings, Team } from '../types';

export async function startAuction(
  playerId: string,
  players: { id: string; basePrice: number }[],
  teams: { captainId?: string; viceCaptainId?: string }[],
  settings: AuctionSettings
): Promise<string | null> {
  const player = players.find(p => p.id === playerId);
  if (!player) return 'Player not found';

  const isProtected = teams.some(t => t.captainId === playerId || t.viceCaptainId === playerId);
  if (isProtected) return 'Cannot auction a player who is a Team Captain or Vice Captain!';

  await setDoc(doc(db, 'auction', 'state'), {
    currentPlayerId: playerId,
    highestBid: player.basePrice,
    highestBidderId: null,
    timeLeft: settings.timerDuration,
    startTime: Date.now(),
    status: 'Active',
    bidHistory: []
  });
  return null;
}

export async function pauseAuction(auction: AuctionState): Promise<void> {
  if (auction.status !== 'Active') return;
  const elapsed = auction.startTime ? Math.floor((Date.now() - auction.startTime) / 1000) : 0;
  const remaining = Math.max(0, auction.timeLeft - elapsed);
  await updateDoc(doc(db, 'auction', 'state'), { status: 'Paused', timeLeft: remaining });
}

export async function resumeAuction(auction: AuctionState): Promise<void> {
  if (auction.status !== 'Paused') return;
  await updateDoc(doc(db, 'auction', 'state'), { status: 'Active', startTime: Date.now() });
}

export async function endAuction(auction: AuctionState): Promise<string | null> {
  if (!auction.currentPlayerId) return null;
  try {
    await runTransaction(db, async (transaction) => {
      const auctionDoc = await transaction.get(doc(db, 'auction', 'state'));
      if (!auctionDoc.exists()) return;
      const current = auctionDoc.data() as AuctionState;
      if (current.status !== 'Active') return;

      let winningTeam: Team | null = null;
      if (current.highestBidderId) {
        const teamDoc = await transaction.get(doc(db, 'teams', current.highestBidderId));
        if (teamDoc.exists()) winningTeam = teamDoc.data() as Team;
      }

      transaction.update(doc(db, 'auction', 'state'), { status: 'Ended', timeLeft: 0 });

      if (current.highestBidderId && winningTeam) {
        transaction.update(doc(db, 'teams', current.highestBidderId), {
          remainingBudget: winningTeam.remainingBudget - current.highestBid,
          players: arrayUnion(current.currentPlayerId)
        });
        transaction.update(doc(db, 'players', current.currentPlayerId!), {
          status: 'Sold',
          soldTo: current.highestBidderId,
          soldPrice: current.highestBid
        });
      } else {
        transaction.update(doc(db, 'players', current.currentPlayerId!), { status: 'Unsold' });
      }
    });
    return null;
  } catch (err: any) {
    return err.message;
  }
}

export async function reAuctionUnsold(
  players: { id: string; status: string }[]
): Promise<string | null> {
  const unsold = players.filter(p => p.status === 'Unsold');
  if (unsold.length === 0) return null;
  try {
    for (let i = 0; i < unsold.length; i += 500) {
      const batch = writeBatch(db);
      unsold.slice(i, i + 500).forEach(p =>
        batch.update(doc(db, 'players', p.id), { status: 'Available' })
      );
      await batch.commit();
    }
    return null;
  } catch (err: any) {
    return 'Failed to re-queue unsold players: ' + err.message;
  }
}

export async function placeBid(
  selectedTeamId: string,
  amount: number,
  auction: AuctionState,
  teams: Team[],
  settings: AuctionSettings
): Promise<string | null> {
  const currentTeam = teams.find(t => t.id === selectedTeamId);
  if (!currentTeam) return 'Team not found';
  if (amount < auction.highestBid) return 'Bid must be at least the current highest bid';
  if (amount === auction.highestBid && auction.highestBidderId !== null) return 'Bid must be higher than current highest bid';
  if (amount > currentTeam.remainingBudget) return 'Insufficient budget';
  if (auction.status !== 'Active') return 'Auction is not active';

  try {
    await updateDoc(doc(db, 'auction', 'state'), {
      highestBid: amount,
      highestBidderId: selectedTeamId,
      startTime: Date.now(),
      timeLeft: settings.timerDuration,
      bidHistory: arrayUnion({
        amount,
        bidderId: selectedTeamId,
        bidderName: currentTeam.name,
        timestamp: Date.now()
      })
    });
    return null;
  } catch (err: any) {
    return err.message;
  }
}

export async function adminAdjustBid(
  teamId: string,
  amount: number,
  auction: AuctionState,
  teams: Team[],
  players: { id: string; basePrice: number }[],
  settings: AuctionSettings
): Promise<string | null> {
  if (!auction.currentPlayerId || auction.status !== 'Active') return 'No active auction';
  const team = teams.find(t => t.id === teamId);
  if (!team) return 'Team not found';
  if (amount > team.remainingBudget) return 'Bid amount exceeds team remaining budget';
  const currentPlayer = players.find(p => p.id === auction.currentPlayerId);
  if (!currentPlayer || amount < currentPlayer.basePrice) return 'Bid amount cannot be less than base price';

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
    return null;
  } catch (err: any) {
    return err.message;
  }
}
