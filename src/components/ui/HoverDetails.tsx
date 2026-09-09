import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import styles from '../usage/RequestTokenCell.module.scss';

export function HoverDetails({
  label,
  triggerContent,
  children,
  className,
}: {
  label: string;
  triggerContent: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const show = () => {
    cancelClose();
    setOpen(true);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (document.activeElement !== trigger.current && !popup.current?.matches(':hover'))
        setOpen(false);
    }, 160);
  };
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );
  useLayoutEffect(() => {
    if (!open || !trigger.current || !popup.current) return;
    const bounds = trigger.current.getBoundingClientRect();
    const box = popup.current.getBoundingClientRect();
    // Render outside the scrolling table, with a bounded position for narrow screens.
    setPosition({
      left: Math.max(8, Math.min(bounds.right - box.width, window.innerWidth - box.width - 8)),
      top: Math.max(
        8,
        Math.min(
          bounds.bottom + 6 + box.height <= window.innerHeight - 8
            ? bounds.bottom + 6
            : bounds.top - box.height - 6,
          window.innerHeight - box.height - 8
        )
      ),
    });
    const closeOnOutside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnScroll = (event: Event) => {
      if (!popup.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={className || styles.info}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') show();
        }}
        onPointerLeave={scheduleClose}
        onFocus={show}
        onBlur={scheduleClose}
        onClick={show}
      >
        {triggerContent}
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="tooltip"
            className={styles.popover}
            style={position}
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
          >
            {children}
          </div>,
          document.body
        )}
    </>
  );
}
