import { useCallback, useEffect, useRef } from 'react';

interface UseCueViewportScrollParams {
  activeCueId: number | null;
  isEditing: boolean;
}

export const useCueViewportScroll = ({ activeCueId, isEditing }: UseCueViewportScrollParams) => {
  const cueRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const cueViewportRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<number | null>(null);

  const handleUserScrollInteraction = useCallback(() => {
    isUserScrollingRef.current = true;
    if (userScrollTimeoutRef.current !== null) {
      window.clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
      userScrollTimeoutRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current !== null) {
        window.clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeCueId === null || isUserScrollingRef.current || isEditing) {
      return;
    }
    const container = cueViewportRef.current;
    const cue = cueRefs.current.get(activeCueId);
    if (!container || !cue) return;
    const top =
      cue.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [activeCueId, isEditing]);

  return {
    cueRefs,
    cueViewportRef,
    handleUserScrollInteraction,
  };
};
