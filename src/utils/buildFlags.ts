const isTruthy = (value: string | undefined): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

// Toggle for ultra-fast builds where only article detail routes are generated.
export const BUILD_ONLY_ARTICLE_PAGES =
  isTruthy(process.env.BUILD_ONLY_ARTICLE_PAGES) || isTruthy(process.env.BUILD_ONLY_ARTICLES);
