import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  fallbackIcon?: React.ReactNode;
  containerClassName?: string;
}

/**
 * A robust image component with fallback, lazy loading, and error handling.
 * Prevents "broken image" icons from appearing in production.
 */
export function SafeImage({ 
  src, 
  alt, 
  className, 
  fallbackSrc = 'https://picsum.photos/seed/orycomptabilite/200/200?blur=2',
  fallbackIcon = <ImageOff className="text-slate-400" size={24} />,
  containerClassName,
  ...props 
}: SafeImageProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  const handleLoad = () => {
    setLoading(false);
  };

  if (error && !fallbackSrc) {
    return (
      <div className={cn("flex items-center justify-center bg-slate-100 rounded-lg", containerClassName)}>
        {fallbackIcon}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {loading && (
        <div className="absolute inset-0 bg-slate-100 animate-pulse rounded-lg" />
      )}
      <img
        src={error ? fallbackSrc : src}
        alt={alt}
        className={cn(
          className,
          loading ? "opacity-0" : "opacity-100",
          "transition-opacity duration-300"
        )}
        onError={handleError}
        onLoad={handleLoad}
        loading="lazy"
        referrerPolicy="no-referrer"
        {...props}
      />
    </div>
  );
}
