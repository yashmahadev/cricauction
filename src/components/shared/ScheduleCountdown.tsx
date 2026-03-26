import React, { useState, useEffect } from 'react';

export const ScheduleCountdown = React.memo(({ targetMs }: { targetMs: number }) => {
  const [remaining, setRemaining] = useState(Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setRemaining(Math.max(0, targetMs - Date.now())), 1000);
    return () => clearInterval(t);
  }, [targetMs]);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  if (remaining <= 0) return <span className="font-mono font-bold">now!</span>;
  return <span className="font-mono font-bold">{h > 0 ? `${h}h ` : ''}{m}m {s}s</span>;
});
