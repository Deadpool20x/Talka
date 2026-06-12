'use client';

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'offline' | 'away';
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

const dotClasses = {
  sm: 'w-2 h-2 ring-1',
  md: 'w-2.5 h-2.5 ring-2',
  lg: 'w-3 h-3 ring-2',
};

const statusColors = {
  online: 'bg-emerald-400',
  away: 'bg-amber-400',
  offline: 'bg-slate-400',
};

export function Avatar({ src, alt, size = 'md', status }: AvatarProps) {
  const initials = alt
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative inline-flex shrink-0">
      {src ? (
        <img
          src={src}
          alt={alt}
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 font-semibold text-white select-none`}
        >
          {initials}
        </div>
      )}
      {status && (
        <span
          aria-label={`Status: ${status}`}
          className={`absolute bottom-0 right-0 block rounded-full ring-slate-900 ${dotClasses[size]} ${statusColors[status]}`}
        />
      )}
    </div>
  );
}
