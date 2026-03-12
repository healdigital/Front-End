export const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

type MatchMediaFn = (query: string) => MediaQueryList;

interface ResolveMotionDurationOptions {
  prefersReducedMotion: boolean;
  regularDurationMs: number;
  reducedDurationMs?: number;
}

function getMatchMedia(matchMediaOverride?: MatchMediaFn): MatchMediaFn | undefined {
  if (matchMediaOverride) return matchMediaOverride;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia.bind(window);
  }
  return undefined;
}

export function resolveMotionDuration({
  prefersReducedMotion,
  regularDurationMs,
  reducedDurationMs = 0,
}: ResolveMotionDurationOptions): number {
  return prefersReducedMotion ? reducedDurationMs : regularDurationMs;
}

export function isReducedMotionPreferred(matchMediaOverride?: MatchMediaFn): boolean {
  const matchMedia = getMatchMedia(matchMediaOverride);
  if (!matchMedia) return false;

  try {
    return Boolean(matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches);
  } catch {
    return false;
  }
}

export function subscribeToReducedMotionPreference(
  onChange: (prefersReducedMotion: boolean) => void,
  matchMediaOverride?: MatchMediaFn,
): () => void {
  const matchMedia = getMatchMedia(matchMediaOverride);
  if (!matchMedia) return () => {};

  const mediaQueryList = matchMedia(REDUCED_MOTION_MEDIA_QUERY);
  const handler = (event: MediaQueryListEvent) => {
    onChange(event.matches);
  };

  onChange(mediaQueryList.matches);

  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', handler);
    return () => mediaQueryList.removeEventListener('change', handler);
  }

  if (typeof mediaQueryList.addListener === 'function') {
    mediaQueryList.addListener(handler);
    return () => mediaQueryList.removeListener(handler);
  }

  return () => {};
}
