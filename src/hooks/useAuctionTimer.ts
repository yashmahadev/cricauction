import { useState, useEffect, useRef } from 'react';
import { AuctionState } from '../types';

/**
 * Client-side display timer only.
 * Auto-end is handled exclusively by the Cloud Function (checkExpiredAuctions).
 */
export function useAuctionTimer(auction: AuctionState) {
  const [displayTime, setDisplayTime] = useState(0);
  const prevDisplayTimeRef = useRef(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (auction.status === 'Active' && auction.startTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - auction.startTime!) / 1000);
        const remaining = Math.max(0, auction.timeLeft - elapsed);
        setDisplayTime(remaining);
        prevDisplayTimeRef.current = remaining;
      }, 1000);
    } else {
      setDisplayTime(auction.timeLeft);
      prevDisplayTimeRef.current = auction.timeLeft;
    }
    return () => clearInterval(interval);
  }, [auction.status, auction.startTime, auction.timeLeft]);

  return { displayTime, prevDisplayTimeRef };
}
