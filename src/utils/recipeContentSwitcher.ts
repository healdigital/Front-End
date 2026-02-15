/**
 * Recipe Content Switcher
 * Handles dynamic switching of recipe content between languages
 * without requiring page reload
 */

// Extend window object to include our custom properties
declare global {
  interface Window {
    langVersions?: {
      [lang: string]: RecipeData;
    };
  }
}

interface RecipeData {
  recipe: {
    name: string;
    summary?: string;
    ingredients?: any[];
    instructions_flat?: any[];
    notes?: string;
    tags?: {
      course?: string[];
      cuisine?: string[];
      keyword?: string[];
    };
    [key: string]: any;
  };
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html?.replace(/<[^>]*>/g, "").trim() || "";
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(html: string): string {
  if (!html) return "";
  
  let decoded = html;
  
  // Handle numeric entities FIRST (before &amp; replacement)
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });
  
  decoded = decoded.replace(/&#(\d+);/g, (match, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });
  
  const entities: { [key: string]: string } = {
    'C&#039;est': "C'est",
    'c&#039;est': "c'est",
    'm&amp;m': 'm&m',
    "M&amp;M's": "M&M's",
    'm&amp;m&#039;s': "m&m's",
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&rdquo;': '"',
    '&ldquo;': '"',
    '&ndash;': '–',
    '&mdash;': '—',
    '&nbsp;': ' ',
    '&cent;': '¢',
    '&pound;': '£',
    '&yen;': '¥',
    '&euro;': '€',
    '&copy;': '©',
    '&reg;': '®',
    '&deg;': '°',
    '&times;': '×',
    '&divide;': '÷',
    '&frac14;': '¼',
    '&frac12;': '½',
    '&frac34;': '¾',
    '&hellip;': '…',
    '&bull;': '•'
  };

  Object.entries(entities).forEach(([entity, char]) => {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  });

  return decoded;
}

/**
 * Format time values (in minutes) to readable format
 */
function formatTime(minutes: string | number): string {
  const mins = parseInt(String(minutes), 10);
  if (isNaN(mins) || mins === 0) return '0 min';
  
  const hours = Math.floor(mins / 60);
  const mins_remainder = mins % 60;
  
  if (hours === 0) return `${mins} min`;
  if (mins_remainder === 0) return `${hours}h`;
  return `${hours}h ${mins_remainder}min`;
}

/**
 * Switch recipe content to a different language
 * Requires that window.langVersions is populated on the page
 */
export function switchRecipeLanguage(lang: string): void {
  if (!window.langVersions || !window.langVersions[lang]) {
    console.warn(`❌ Recipe content for language "${lang}" not available`);
    console.warn('Available languages:', window.langVersions ? Object.keys(window.langVersions) : 'none');
    return;
  }

  console.log(`✅ Switching recipe content to: ${lang}`);

  const recipeData: RecipeData = window.langVersions[lang];
  const recipe = recipeData.recipe;
  
  if (!recipe) {
    console.error(`Recipe data missing for language "${lang}"`);
    return;
  }

  // Update page title
  const titleEl = document.querySelector('.recipe-title');
  if (titleEl) {
    titleEl.textContent = recipe.name || '';
  }

  // Update recipe intro/summary
  const introEl = document.querySelector('.recipe-intro');
  if (introEl && recipe.summary) {
    introEl.textContent = decodeHtmlEntities(stripHtml(recipe.summary));
  }

  // Update ingredients section
  const ingredientsSection = document.querySelector('.ingredients-section');
  if (ingredientsSection && recipe.ingredients) {
    const list = ingredientsSection.querySelector('.ingredients-list');
    if (list) {
      list.innerHTML = recipe.ingredients.map((ing: any) => {
        const amount = ing.amount || '';
        const unit = ing.unit || '';
        const name = decodeHtmlEntities(stripHtml(ing.name || ''));
        const notes = ing.notes ? ` (${decodeHtmlEntities(stripHtml(ing.notes))})` : '';
        return `<li class="ingredient-item"><span>${amount}${amount && unit ? ' ' : ''}${unit}${amount || unit ? ' ' : ''}</span><span>${name}${notes}</span></li>`;
      }).join('');
    }
  }

  // Update instructions section
  const instructionsSection = document.querySelector('.instructions-section');
  if (instructionsSection && recipe.instructions_flat) {
    const list = instructionsSection.querySelector('.instructions-list');
    if (list) {
      let stepCount = 0;
      list.innerHTML = recipe.instructions_flat.map((instruction: any, idx: number) => {
        if (typeof instruction === 'object' && instruction !== null && instruction.type === "instruction") {
          stepCount++;
          const text = decodeHtmlEntities(stripHtml(instruction.text || instruction.name || ''));
          const image = instruction.image_url ? `<figure class="step-image"><img src="${instruction.image_url}" alt="Step ${stepCount}" loading="lazy" decoding="async" /></figure>` : '';
          return `<li class="instruction-item"><div class="instruction-step"><span class="step-number">${stepCount}</span><p class="step-text">${text}</p></div>${image}</li>`;
        }
        if (typeof instruction === 'string') {
          stepCount++;
          const text = decodeHtmlEntities(stripHtml(instruction.trim()));
          return `<li class="instruction-item"><div class="instruction-step"><span class="step-number">${stepCount}</span><p class="step-text">${text}</p></div></li>`;
        }
        return '';
      }).join('');
    }
  }

  // Update notes section
  const notesSection = document.querySelector('.notes-section');
  if (notesSection && recipe.notes) {
    const content = notesSection.querySelector('.notes-content');
    if (content) {
      content.textContent = decodeHtmlEntities(stripHtml(recipe.notes));
    }
  }

  // Update categories in recipe meta
  if (recipe.tags?.course) {
    const categories = document.querySelector('.tag-group .tags-container');
    if (categories && recipe.tags.course.length > 0) {
      categories.innerHTML = recipe.tags.course.map((course: string) => {
        const slug = String(course).toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return `<a href="/categories/${slug}" class="tag-badge category-badge">${course}</a>`;
      }).join('');
    }
  }

  // Dispatch event so other systems know content has changed
  window.dispatchEvent(new CustomEvent('recipe-content-switched', { detail: { lang } }));
  
  console.log(`✅ Recipe content switched to ${lang} - Updated: title, ingredients, instructions, notes, categories`);
}

/**
 * Initialize recipe content switcher
 * Must be called after window.langVersions is set
 */
export function initializeRecipeContentSwitcher(): void {
  console.log('📖 Recipe content switcher initialized');
  console.log('   Available languages:', window.langVersions ? Object.keys(window.langVersions) : 'none');
  
  // Listen for language change events
  window.addEventListener('page-translated', (e: any) => {
    const newLang = e.detail?.lang;
    console.log(`📖 page-translated event received for language: ${newLang}`);
    if (newLang && window.langVersions && window.langVersions[newLang]) {
      switchRecipeLanguage(newLang);
    }
  });
}
