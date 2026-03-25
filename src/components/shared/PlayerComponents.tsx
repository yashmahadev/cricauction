import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { cn } from '../../lib/utils';
import { Player, Team } from '../../types';

export const PlayerStatsChart = React.memo(({ stats }: { stats: Player['stats'] }) => {
  const data = [
    { name: 'Matches', value: stats.matches || 0, color: '#10b981' },
    { name: 'Runs', value: stats.runs || 0, color: '#3b82f6' },
    { name: 'Wickets', value: stats.wickets || 0, color: '#f59e0b' },
    { name: 'S/R', value: stats.strikeRate || 0, color: '#ec4899' },
    { name: 'Econ', value: stats.economy || 0, color: '#8b5cf6' },
  ];

  return (
    <div className="h-40 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#ffffff40', fontSize: 9 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#ffffff40', fontSize: 9 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '10px' }}
            itemStyle={{ color: '#fff' }}
            cursor={{ fill: '#ffffff05' }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

export const PlayerAvatar = React.memo(({
  playerId,
  imageUrl,
  name,
  teams,
  className = '',
  badgeSize = 'sm',
}: {
  playerId: string;
  imageUrl: string;
  name?: string;
  teams: Team[];
  className?: string;
  badgeSize?: 'xs' | 'sm' | 'md';
}) => {
  const isCaptain = teams.some(t => t.captainId === playerId);
  const isViceCaptain = !isCaptain && teams.some(t => t.viceCaptainId === playerId);
  const hasRole = isCaptain || isViceCaptain;

  return (
    <div className="relative inline-block">
      <img
        src={imageUrl || undefined}
        alt={name}
        className={className}
        referrerPolicy="no-referrer"
        loading="lazy"
      />
      {hasRole && badgeSize === 'xs' && (
        <span
          className={cn(
            'absolute top-0 right-0 w-2.5 h-2.5 rounded-full border border-black/40 shadow shadow-black/60',
            isCaptain ? 'bg-yellow-400' : 'bg-sky-400'
          )}
          title={isCaptain ? 'Captain' : 'Vice Captain'}
        />
      )}
      {hasRole && badgeSize !== 'xs' && (
        <span
          className={cn(
            'absolute bottom-1.5 left-1/2 -translate-x-1/2 z-10 font-black uppercase tracking-widest leading-none whitespace-nowrap rounded-full border shadow-md shadow-black/70',
            badgeSize === 'md' ? 'text-[10px] px-2.5 py-[3px]' : 'text-[8px] px-2 py-[2px]',
            isCaptain
              ? 'bg-yellow-400 text-black border-yellow-200/80'
              : 'bg-sky-400 text-black border-sky-200/80'
          )}
        >
          {isCaptain ? '★ C' : 'VC'}
        </span>
      )}
    </div>
  );
});
