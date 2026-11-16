import React, { useMemo } from 'react';
import { getFlagDataUrl } from '../utils/flagRenderer';

interface FlagBadgeProps {
  code: string;
  name: string;
  size?: number;
  className?: string;
  title?: string;
}

export const FlagBadge: React.FC<FlagBadgeProps> = ({
  code,
  name,
  size = 24,
  className = '',
  title,
}) => {
  const src = useMemo(() => getFlagDataUrl(code), [code]);

  return (
    <img
      src={src}
      alt={name}
      title={title ?? name}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className={`rounded-full object-cover shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
