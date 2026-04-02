const VIDEO_COURSES_SOURCE_URL =
  process.env.VIDEO_COURSES_API_URL ||
  'https://atelier-lacuisinedebernard.com/api/video-courses';

const VIDEO_COURSES_FETCH_TIMEOUT_MS = 5000;
const VIDEO_COURSES_USER_AGENT =
  'Mozilla/5.0 (compatible; LCDBAstro/1.0; +https://lacuisinedebernard.com)';

const DEFAULT_CLUB_URL = 'https://atelier-lacuisinedebernard.com/club/';

const COURSE_OVERRIDES: Array<{
  matcher: RegExp;
  title?: string;
  href: string;
  image: string;
}> = [
  {
    matcher: /millefeuille/i,
    title: 'Millefeuille',
    href: 'https://atelier-lacuisinedebernard.com/club/course/millefeuille/lessons',
    image:
      'https://atelier-lacuisinedebernard.com/wp-content/uploads/fluent-community/fluentcom-5ESxvDoe6eY88sOtUNMsiMhVUbvsOG1q-fluentcom-IMG_8120-2.jpg',
  },
  {
    matcher: /pate feuilletee inversee|feuilletee inversee|feuillet[eÃ©]e invers[eÃ©]e/i,
    title: 'La pâte feuilletée inversée',
    href: 'https://atelier-lacuisinedebernard.com/club/course/pate-feuilletee-inversee/lessons',
    image:
      'https://atelier-lacuisinedebernard.com/wp-content/uploads/fluent-community/fluentcom-JDg2G8Pr8b5t7FDLhdbw3HTJDfxsUo9p-fluentcom-Capture-decran-2026-03-26-a-18.16.24.png',
  },
  {
    matcher: /creme patissiere|creme diplomate|cremes de base|cr[eÃ¨]me p[aÃ¢]tissi[eÃ¨]re|cr[eÃ¨]me diplomate/i,
    title: 'Les Crèmes de Base',
    href: 'https://atelier-lacuisinedebernard.com/club/course/les-cremes-de-base/lessons',
    image:
      'https://atelier-lacuisinedebernard.com/wp-content/uploads/fluent-community/fluentcom-wXu5Bo0LxL1HJHwS16cOnKEkBQVrRvqX-fluentcom-IMG_8113-2.jpg',
  },
];

const LESSON_URL_MAP: Array<{ matcher: RegExp; href: string }> = [
  {
    matcher: /millefeuille/i,
    href: 'https://atelier-lacuisinedebernard.com/club/course/millefeuille/lessons',
  },
  {
    matcher: /pate feuilletee inversee|feuilletee inversee|feuillet[eé]e invers[eé]e/i,
    href: 'https://atelier-lacuisinedebernard.com/club/course/pate-feuilletee-inversee/lessons',
  },
  {
    matcher: /creme patissiere|creme diplomate|cremes de base|cr[eè]me p[aâ]tissi[eè]re|cr[eè]me diplomate/i,
    href: 'https://atelier-lacuisinedebernard.com/club/course/les-cremes-de-base/lessons',
  },
];

const FALLBACK_IMAGE_MAP: Array<{ matcher: RegExp; src: string }> = [
  { matcher: /millefeuille/i, src: '/images/masterclass-featured.jpg' },
  {
    matcher: /pate feuilletee inversee|feuilletee inversee|feuillet[eé]e invers[eé]e/i,
    src: '/images/masterclass-patisserie.jpg',
  },
  {
    matcher: /creme patissiere|creme diplomate|cremes de base|cr[eè]me p[aâ]tissi[eè]re|cr[eè]me diplomate/i,
    src: '/images/masterclass-video.jpg',
  },
  { matcher: /chocolat/i, src: '/images/masterclass-featured.jpg' },
];

export interface VideoCourse {
  id: string;
  title: string;
  shortDescription: string;
  courseUrl: string;
  priceType: string;
  price: number;
  image: string | null;
  publishedAt: string;
  lessonCount: number | null;
  duration: string | null;
}

const fallbackVideoCourses: VideoCourse[] = [
  {
    id: 'fallback-video-course',
    title: 'Millefeuille',
    shortDescription:
      "Le montage d'un grand classique, explique pas a pas pour mieux comprendre l'assemblage, l'equilibre et les textures d'un dessert emblematique.",
    courseUrl: 'https://atelier-lacuisinedebernard.com/club/course/millefeuille/lessons',
    priceType: 'free',
    price: 0,
    image: '/images/masterclass-featured.jpg',
    publishedAt: '',
    lessonCount: null,
    duration: null,
  },
];

const decodeEntities = (value: string): string =>
  String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&hellip;/g, '...')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeCourseText = (value: unknown): string =>
  decodeEntities(String(value || ''))
    .replace(/\s*\.{3}\s*Lire la suite$/i, '')
    .replace(/\s*Lire la suite$/i, '')
    .replace(/([.!?])(?=[A-Z0-9\u00c0-\u0178])/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeHref = (value: unknown, title: string): string => {
  const mappedHref = LESSON_URL_MAP.find((entry) => entry.matcher.test(title))?.href;
  if (mappedHref) return mappedHref;

  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_CLUB_URL;
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith('/') ? `https://atelier-lacuisinedebernard.com${raw}` : raw;
};

const toPositiveNumber = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
};

const normalizeDuration = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (raw) return raw;
  return null;
};

const getFallbackImage = (title: string): string => {
  const courseOverride = COURSE_OVERRIDES.find((entry) => entry.matcher.test(title));
  if (courseOverride?.image) return courseOverride.image;
  const mappedImage = FALLBACK_IMAGE_MAP.find((entry) => entry.matcher.test(title))?.src;
  return mappedImage || '/images/masterclass-video.jpg';
};

const mapVideoCourse = (item: Record<string, unknown>, index: number): VideoCourse | null => {
  if (!item || typeof item !== 'object') return null;

  const rawTitle = normalizeCourseText(item.title);
  if (!rawTitle) return null;

  const courseOverride = COURSE_OVERRIDES.find((entry) => entry.matcher.test(rawTitle));
  const title = courseOverride?.title || rawTitle;

  const normalizedImage =
    typeof item.image === 'string' && item.image.trim()
      ? item.image.trim()
      : courseOverride?.image || getFallbackImage(title);

  return {
    id: String(item.id || index + 1),
    title,
    shortDescription: normalizeCourseText(item.shortDescription),
    courseUrl: courseOverride?.href || normalizeHref(item.courseUrl, title),
    priceType: String(item.priceType || 'free').trim().toLowerCase(),
    price: toPositiveNumber(item.price, 0),
    image: normalizedImage,
    publishedAt: String(item.publishedAt || ''),
    lessonCount:
      item.lessonCount === undefined || item.lessonCount === null
        ? null
        : toPositiveNumber(item.lessonCount, 0),
    duration: normalizeDuration(item.duration),
  };
};

let videoCoursesPromise: Promise<VideoCourse[]> | null = null;

export const loadVideoCourses = async (): Promise<VideoCourse[]> => {
  if (videoCoursesPromise) return videoCoursesPromise;

  videoCoursesPromise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VIDEO_COURSES_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(VIDEO_COURSES_SOURCE_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': VIDEO_COURSES_USER_AGENT,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`video_courses_fetch_http_${response.status}`);
      }

      const payload = await response.json();
      const items = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];

      const normalized = items
        .map((item, index) => mapVideoCourse(item as Record<string, unknown>, index))
        .filter(Boolean) as VideoCourse[];

      const deduped = normalized.filter(
        (course, index, list) => list.findIndex((item) => item.title === course.title) === index,
      );

      return deduped.length ? deduped : fallbackVideoCourses;
    } catch (error) {
      console.warn('[VIDEO] Video courses fetch failed:', error);
      return fallbackVideoCourses;
    } finally {
      clearTimeout(timeout);
    }
  })();

  return videoCoursesPromise;
};
