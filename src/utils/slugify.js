// Utils to slugify Arabic, French, Spanish, Portuguese text to ASCII
// This ensures all URLs are clean ASCII without encoding issues

const transliterationMap = {
  // Arabic
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
  'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh',
  'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
  'ع': '', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ي': 'y', 'ة': 'a',
  'ء': '',
  
  // Common accented characters
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
  'à': 'a', 'â': 'a', 'ä': 'a',
  'ü': 'u', 'û': 'u', 'ù': 'u',
  'ö': 'o', 'ô': 'o',
  'ç': 'c',
  'ñ': 'n',
  'ã': 'a', 'õ': 'o',
};

/**
 * Convert any text to ASCII slug suitable for URLs
 * Handles Arabic, French, Spanish, Portuguese, etc.
 */
export function createAsciiSlug(text) {
  if (!text) return '';
  
  let slug = text.toLowerCase();
  
  // Apply transliteration
  for (const [char, replacement] of Object.entries(transliterationMap)) {
    slug = slug.replaceAll(char, replacement);
  }
  
  // Replace remaining non-ASCII with hyphens
  slug = slug.replace(/[^a-z0-9\s-]/g, '');
  
  // Replace spaces and multiple hyphens with single hyphen
  slug = slug.replace(/\s+/g, '-').replace(/-+/g, '-');
  
  // Remove leading/trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');
  
  return slug;
}

/**
 * Fix slug in recipe object
 */
export function fixRecipeSlug(recipe) {
  if (!recipe.slug || recipe.slug.isascii?.()) {
    return recipe;
  }
  
  // Create new ASCII slug from recipe name
  recipe.slug = createAsciiSlug(recipe.name);
  
  return recipe;
}
