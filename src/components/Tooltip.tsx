'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export default function Tooltip({ content, children, position = 'top', delay = 300, maxWidth = 'md' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [actualPosition, setActualPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newPosition = position;

      // Check if tooltip would overflow viewport and adjust position
      if (position === 'top' && containerRect.top - tooltipRect.height < 10) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && containerRect.bottom + tooltipRect.height > viewportHeight - 10) {
        newPosition = 'top';
      } else if (position === 'left' && containerRect.left - tooltipRect.width < 10) {
        newPosition = 'right';
      } else if (position === 'right' && containerRect.right + tooltipRect.width > viewportWidth - 10) {
        newPosition = 'left';
      }

      setActualPosition(newPosition);
    }
  }, [isVisible, position]);

  const getMaxWidthClass = () => {
    switch (maxWidth) {
      case 'sm':
        return 'max-w-48'; // ~192px
      case 'md':
        return 'max-w-80'; // ~320px
      case 'lg':
        return 'max-w-96'; // ~384px
      case 'xl':
        return 'max-w-[32rem]'; // ~512px
      case '2xl':
        return 'max-w-[40rem]'; // ~640px
      default:
        return 'max-w-80';
    }
  };

  const getPositionClasses = () => {
    switch (actualPosition) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-3';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-3';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-3';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-3';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-3';
    }
  };

  const getArrowClasses = () => {
    switch (actualPosition) {
      case 'top':
        return 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800 dark:border-t-gray-200';
      case 'bottom':
        return 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-800 dark:border-b-gray-200';
      case 'left':
        return 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-800 dark:border-l-gray-200';
      case 'right':
        return 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-800 dark:border-r-gray-200';
      default:
        return 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800 dark:border-t-gray-200';
    }
  };

  return (
    <div ref={containerRef} className='relative inline-block' onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 px-4 py-3 text-sm leading-relaxed text-white bg-gray-800 dark:bg-gray-200 dark:text-gray-800 rounded-lg shadow-lg whitespace-nowrap ${getMaxWidthClass()} transition-all duration-200 ease-in-out transform ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          } ${getPositionClasses()}`}
          style={{
            whiteSpace: 'normal',
            wordWrap: 'break-word',
            minWidth: '200px',
          }}
        >
          {content}
          {/* Arrow */}
          <div className={`absolute w-0 h-0 border-4 ${getArrowClasses()}`} />
        </div>
      )}
    </div>
  );
}
