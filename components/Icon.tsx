import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  title?: string;
}

export const Icon: React.FC<IconProps> = ({ name, className = "", filled = false, title }) => {
  return (
    <span className={`material-symbols-outlined ${filled ? 'filled' : ''} ${className}`} title={title}>
      {name}
    </span>
  );
};