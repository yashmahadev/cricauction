import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

/**
 * Cloud Function: Auction Timer Manager
 * 
 * Triggered whenever the auction/state document is updated.
 * Manages the countdown timer independently of client browsers.
 * 
 * How it works:
 * 1. When auction status becomes 'Active', schedules a task to end the auction
 * 2. Calculates exact end time based on startTime + timeLeft
 * 3. Uses Cloud Scheduler to trigger endAuction at the right moment
 * 4. Handles cancellation if auction is paused/ended manually
 */

interface AuctionState {
  currentPlayerId: string | null;
  highestBid: number;
  highestBidderId: string | null;
  timeLeft: number;
  startTime?: number;
  status: 'Idle' | 'Active' | 'Paused' | 'Ended';
  bidHistory: Array<{
    amount: number;
    bidderId: string;
    bidderName: string;
    timestamp: number;
  }>;
  scheduledEndTime?: number; // When the auction should auto-end
}

interface Team {
  id: string;
  name: string;
  totalBudget: number;
  remainingBudget: number;
  players: string[];
  color: string;
  logoUrl?: string;
  mobileNumber?: string;
  email?: string;
  ownerUid?: string;
  captainId?: string;
  viceCaptainId?: string;
}

interface Player {
  id: string;
  name: string;
  category: string;
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
  soldTo?: string;
  soldPrice?: number;
}

/**
 * Firestore Trigger: Monitor auction state changes
 * Automatically schedules auction end when status becomes Active or a bid resets the timer.
 * This is the sole authority for ending auctions — no client-side auto-end needed.
 */
export const onAuctionStateChange = functions.firestore
  .document('auction/state')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as AuctionState;
    const after = change.after.data() as AuctionState;

    const isNowActive = after.status === 'Active';
    const wasActive = before.status === 'Active';

    // Recalculate scheduledEndTime whenever auction is Active and startTime changed
    // This covers: auction start, bid placed (timer reset), resume from pause
    if (isNowActive && after.startTime && after.startTime !== before.startTime) {
      const scheduledEndTime = after.startTime + (after.timeLeft * 1000);

      await change.after.ref.update({ scheduledEndTime });

      functions.logger.info('Auction timer updated', {
        playerId: after.currentPlayerId,
        startTime: after.startTime,
        scheduledEndTime,
        duration: after.timeLeft,
        reason: wasActive ? 'bid_placed_or_timer_reset' : 'auction_started',
      });
    }

    // Auction was manually ended or paused - clear scheduled end
    if (wasActive && !isNowActive) {
      await change.after.ref.update({
        scheduledEndTime: admin.firestore.FieldValue.delete(),
      });

      functions.logger.info('Auction stopped', {
        newStatus: after.status,
        playerId: after.currentPlayerId,
      });
    }

    return null;
  });

/**
 * Scheduled Function: Check for expired auctions
 * Runs every 5 seconds to check if any active auctions have expired
 * 
 * This is more reliable than individual scheduled tasks per auction
 * because it handles edge cases and doesn't require Cloud Scheduler setup
 */
export const checkExpiredAuctions = functions.pubsub
  .schedule('every 5 seconds')
  .onRun(async (context) => {
    const now = Date.now();
    
    try {
      const auctionRef = db.doc('auction/state');
      const auctionDoc = await auctionRef.get();

      if (!auctionDoc.exists) {
        return null;
      }

      const auction = auctionDoc.data() as AuctionState;

      // Check if auction is active and has expired
      if (
        auction.status === 'Active' &&
        auction.scheduledEndTime &&
        now >= auction.scheduledEndTime
      ) {
        functions.logger.info('Auction expired, ending now', {
          playerId: auction.currentPlayerId,
          scheduledEndTime: auction.scheduledEndTime,
          currentTime: now,
          delay: now - auction.scheduledEndTime,
        });

        // End the auction
        await endAuction(auction.currentPlayerId);
      }
    } catch (error) {
      functions.logger.error('Error checking expired auctions', error);
    }

    return null;
  });

/**
 * HTTP Callable Function: Manually trigger auction end
 * Can be called by admin clients as a backup or for testing
 */
export const endAuctionManually = functions.https.onCall(async (data, context) => {
  // Verify the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to end auction'
    );
  }

  // Verify the caller is an admin
  const userDoc = await db.doc(`users/${context.auth.uid}`).get();
  const userData = userDoc.data();

  if (!userData || userData.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Must be an admin to end auction'
    );
  }

  const { playerId } = data;

  if (!playerId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'playerId is required'
    );
  }

  try {
    await endAuction(playerId);
    return { success: true, message: 'Auction ended successfully' };
  } catch (error) {
    functions.logger.error('Error ending auction manually', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to end auction',
      error
    );
  }
});

/**
 * Core function: End the auction for a specific player
 * Handles the transaction to update player, team, and auction state
 */
async function endAuction(playerId: string | null): Promise<void> {
  if (!playerId) {
    functions.logger.warn('endAuction called with null playerId');
    return;
  }

  try {
    await db.runTransaction(async (transaction) => {
      // Read all necessary documents first
      const auctionRef = db.doc('auction/state');
      const playerRef = db.doc(`players/${playerId}`);
      
      const auctionDoc = await transaction.get(auctionRef);
      const playerDoc = await transaction.get(playerRef);

      if (!auctionDoc.exists) {
        throw new Error('Auction state document not found');
      }

      if (!playerDoc.exists) {
        throw new Error(`Player ${playerId} not found`);
      }

      const auction = auctionDoc.data() as AuctionState;
      const player = playerDoc.data() as Player;

      // Verify auction is still active
      if (auction.status !== 'Active') {
        functions.logger.info('Auction already ended', {
          playerId,
          status: auction.status,
        });
        return;
      }

      // Verify this is the current player
      if (auction.currentPlayerId !== playerId) {
        functions.logger.warn('Player mismatch in endAuction', {
          expected: auction.currentPlayerId,
          received: playerId,
        });
        return;
      }

      let winningTeam: Team | null = null;

      // If there's a highest bidder, get their team data
      if (auction.highestBidderId) {
        const teamRef = db.doc(`teams/${auction.highestBidderId}`);
        const teamDoc = await transaction.get(teamRef);

        if (teamDoc.exists) {
          winningTeam = { id: teamDoc.id, ...teamDoc.data() } as Team;
        }
      }

      // All reads complete - now perform writes
      
      // Update auction state to Ended
      transaction.update(auctionRef, {
        status: 'Ended',
        timeLeft: 0,
        scheduledEndTime: admin.firestore.FieldValue.delete(),
      });

      if (auction.highestBidderId && winningTeam) {
        // Player was sold - update team and player
        transaction.update(db.doc(`teams/${auction.highestBidderId}`), {
          remainingBudget: winningTeam.remainingBudget - auction.highestBid,
          players: admin.firestore.FieldValue.arrayUnion(playerId),
        });

        transaction.update(playerRef, {
          status: 'Sold',
          soldTo: auction.highestBidderId,
          soldPrice: auction.highestBid,
        });

        functions.logger.info('Player sold', {
          playerId,
          playerName: player.name,
          teamId: auction.highestBidderId,
          teamName: winningTeam.name,
          price: auction.highestBid,
        });
      } else {
        // Player went unsold
        transaction.update(playerRef, {
          status: 'Unsold',
        });

        functions.logger.info('Player unsold', {
          playerId,
          playerName: player.name,
        });
      }
    });

    functions.logger.info('Auction ended successfully', { playerId });
  } catch (error) {
    functions.logger.error('Error in endAuction transaction', {
      playerId,
      error,
    });
    throw error;
  }
}

/**
 * HTTP Function: Health check endpoint
 * Useful for monitoring and debugging
 */
export const healthCheck = functions.https.onRequest((req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    service: 'cricauction-functions',
    version: '1.0.0',
  });
});
