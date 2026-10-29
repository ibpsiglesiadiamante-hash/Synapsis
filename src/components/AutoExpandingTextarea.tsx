import React, { useEffect, useLayoutEffect, useRef, useCallback } from 'react';

interface AutoExpandingTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onValueChange?: (val: string) => void;
  minHeight?: number;
}

export const AutoExpandingTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoExpandingTextareaProps
>(
  (
    {
      value,
      onChange,
      onValueChange,
      className = '',
      rows = 1,
      minHeight,
      style,
      ...props
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    const adjustHeight = useCallback(() => {
      const el = internalRef.current;
      if (!el) return;

      // Use 'auto' instead of '0px' to avoid collapsing to zero,
      // losing typing cursor, dropping keystrokes, and layout thrashing
      el.style.height = 'auto';
      const targetHeight = Math.max(el.scrollHeight, minHeight || 0);
      el.style.height = `${targetHeight}px`;
    }, [minHeight]);

    // Recalculate height safely on value change
    useLayoutEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    // Adjust on window resize
    useEffect(() => {
      adjustHeight();
      const handleResize = () => adjustHeight();
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }, [adjustHeight]);

    return (
      <textarea
        ref={(node) => {
          internalRef.current = node;
          if (typeof forwardedRef === 'function') {
            forwardedRef(node);
          } else if (forwardedRef) {
            (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
          }
        }}
        rows={rows}
        value={value ?? ''}
        onChange={(e) => {
          onChange?.(e);
          onValueChange?.(e.target.value);
          adjustHeight();
        }}
        className={`auto-expand-textarea resize-none block w-full ${className}`}
        style={{
          fieldSizing: 'content', // Modern CSS native auto-sizing
          overflowY: 'hidden',
          resize: 'none',
          minHeight: minHeight ? `${minHeight}px` : undefined,
          ...style,
        }}
        {...props}
      />
    );
  }
);

AutoExpandingTextarea.displayName = 'AutoExpandingTextarea';
export default AutoExpandingTextarea;
