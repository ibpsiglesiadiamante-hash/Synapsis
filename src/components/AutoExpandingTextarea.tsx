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
      minHeight = 36,
      style,
      ...props
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    const adjustHeight = useCallback(() => {
      const el = internalRef.current;
      if (!el) return;

      // If browser supports native CSS field-sizing: content, let the browser handle sizing seamlessly
      if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('field-sizing', 'content')) {
        return;
      }

      // Height recalculation without jarring collapse
      el.style.height = 'auto';
      const scrollH = el.scrollHeight;
      const targetHeight = Math.max(scrollH, minHeight || 36);
      el.style.height = `${targetHeight}px`;
    }, [minHeight]);

    // Update synchronously before paint when value changes (handles initial load and keystrokes)
    useLayoutEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    // Handle paste and font rendering updates immediately after paint
    useEffect(() => {
      const raf = requestAnimationFrame(() => {
        adjustHeight();
      });
      return () => cancelAnimationFrame(raf);
    }, [value, adjustHeight]);

    // Handle window resize
    useEffect(() => {
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
        onInput={(e) => {
          props.onInput?.(e);
          adjustHeight();
        }}
        onPaste={(e) => {
          props.onPaste?.(e);
          // Recalculate on paste so multiline content immediately expands
          requestAnimationFrame(() => adjustHeight());
          setTimeout(adjustHeight, 16);
        }}
        className={`auto-expand-textarea resize-none block w-full leading-relaxed ${className}`}
        style={{
          fieldSizing: 'content',
          overflowY: 'auto',
          resize: 'none',
          lineHeight: '1.65',
          minHeight: `${minHeight}px`,
          ...style,
        } as React.CSSProperties}
        {...props}
      />
    );
  }
);

AutoExpandingTextarea.displayName = 'AutoExpandingTextarea';
export default AutoExpandingTextarea;
