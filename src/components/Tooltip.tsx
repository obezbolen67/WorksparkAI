// src/components/Tooltip.tsx
import { useState, type ReactNode, Children, isValidElement, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import '../css/Tooltip.css';

interface TooltipProps {
  children: ReactNode;
  text: string;
  className?: string;
}

const Tooltip = ({ children, text, className }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [style, setStyle] = useState({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  if (!text) {
    return <>{children}</>;
  }

  // Attempt to check for a `disabled` prop on the first valid child element.
  let isDisabled = false;
  const childArray = Children.toArray(children);
  if (childArray.length > 0 && isValidElement(childArray[0])) {
      isDisabled = (childArray[0].props as any).disabled;
  }

  const handleMouseEnter = () => {
    if (isDisabled || !triggerRef.current) return;
    setIsVisible(true);
  };
  
  useLayoutEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // --- UPDATED: Position tooltip below the trigger element ---
      const top = triggerRect.bottom + 8; // 8px gap below the trigger
      const left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);

      setStyle({
        top: `${top}px`,
        left: `${left}px`,
      });
    }
  }, [isVisible]);

  return (
    <div
      ref={triggerRef}
      className={`tooltip-container ${className || ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {createPortal(
        <div 
          ref={tooltipRef}
          className={`tooltip-content ${isVisible ? 'visible' : ''}`}
          style={style}
        >
          {text}
        </div>,
        document.body
      )}
    </div>
  );
};

export default Tooltip;