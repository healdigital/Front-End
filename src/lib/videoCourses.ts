const VIDEO_COURSES_SOURCE_URL =
  process.env.VIDEO_COURSES_API_URL ||
  'https://atelier-lacuisinedebernard.com/api/video-courses';

const VIDEO_COURSES_FETCH_TIMEOUT_MS = 5000;

export interface VideoCourse {
  id: string;
  title: string;
  shortDescription: string;
  courseUrl: string;
  priceType: string;
  price: number;
  image: string | null;
  publishedAt: string;
}

const fallbackVideoCourses: VideoCourse[] = [
  {
    id: 'fallback-video-course',
    title: 'Millefeuille',
    shortDescription:
      "Le montage d'un grand classique, expliqué pas à pas pour mieux comprendre l'assemblage, l'équilibre et les textures d'un dessert emblématique.",
    courseUrl: 'https://atelier-lacuisinedebernard.com/club/course/module-2/lessons',
    priceType: 'free',
    price: 0,
    image: null,
    publishedAt: '',
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
    .replace(/([.!?])([A-ZÀ-Ý])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeHref = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return 'https://atelier-lacuisinedebernard.com/club/course/module-2/lessons';
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith('/') ? `https://atelier-lacuisinedebernard.com${raw}` : raw;
};

const toPositiveNumber = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
};

const mapVideoCourse = (item: any, index: number): VideoCourse | null => {
  if (!item || typeof item !== 'object') return null;

  const title = normalizeCourseText(item.title);
  if (!title) return null;

  return {
    id: String(item.id || index + 1),
    title,
    shortDescription: normalizeCourseText(item.shortDescription),
    courseUrl: normalizeHref(item.courseUrl),
    priceType: String(item.priceType || 'free').trim().toLowerCase(),
    price: toPositiveNumber(item.price, 0),
    image: typeof item.image === 'string' && item.image.trim() ? item.image.trim() : null,
    publishedAt: String(item.publishedAt || ''),
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
        headers: { Accept: 'application/json' },
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
        .map((item, index) => mapVideoCourse(item, index))
        .filter(Boolean) as VideoCourse[];

      return normalized.length ? normalized : fallbackVideoCourses;
    } catch (error) {
      console.warn('[VIDEO] Video courses fetch failed:', error);
      return fallbackVideoCourses;
    } finally {
      clearTimeout(timeout);
    }
  })();

  return videoCoursesPromise;
};
