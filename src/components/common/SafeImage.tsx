import React, { useState, useEffect } from 'react';
import { ImageOff } from 'lucide-react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackText?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt = 'Imagem do item',
  className = '',
  fallbackText = 'Foto indisponível',
  onError,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 p-4 select-none ${className}`}
        role="img"
        aria-label={alt || fallbackText}
      >
        <ImageOff className="w-8 h-8 mb-1.5 opacity-60" />
        <span className="text-xs font-medium tracking-wide text-center">{fallbackText}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        setHasError(true);
        if (onError) onError(e);
      }}
      loading="lazy"
      {...props}
    />
  );
};
