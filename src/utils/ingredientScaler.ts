const parseNumericValue = (value: string | null | undefined): number | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const normalized = raw.replace(',', '.').trim();
  const fractionMatch = normalized.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
    return null;
  }

  const numericMatch = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!numericMatch) return null;

  const parsed = Number(numericMatch[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

export function initializeIngredientScaler(): void {
  if (typeof document === 'undefined') return;

  // Find all ingredient scaling buttons
  const scalingButtons = document.querySelectorAll('.wprm-recipe-adjustable-servings');
  
  scalingButtons.forEach(button => {
    button.addEventListener('click', (e: Event) => {
      const target = e.currentTarget as HTMLElement;
      const multiplier = target.getAttribute('data-multiplier');
      const recipeId = target.getAttribute('data-recipe');

      if (!multiplier || !recipeId) return;

      // Get all ingredient quantities for this recipe
      const ingredientContainer = document.querySelector(
        `#recipe-${recipeId}-ingredients, [data-recipe="${recipeId}"] .wprm-recipe-ingredients-container`
      );

      if (!ingredientContainer) return;

      const multiplierNum = parseNumericValue(multiplier);
      if (multiplierNum === null || multiplierNum <= 0) return;

      // Get all amount elements
      const amounts = ingredientContainer.querySelectorAll('.wprm-recipe-ingredient-amount');

      amounts.forEach((amount, index) => {
        const originalValue = amount.getAttribute('data-original-value') || amount.textContent;
        
        if (!amount.getAttribute('data-original-value')) {
          amount.setAttribute('data-original-value', originalValue || '0');
        }

        const original = parseNumericValue(originalValue);
        if (original === null) return;
        const newValue = (original * multiplierNum).toFixed(2).replace(/\.?0+$/, '');
        amount.textContent = newValue;
      });

      // Update active button state
      const allButtons = document.querySelectorAll(
        `.wprm-recipe-adjustable-servings[data-recipe="${recipeId}"]`
      );
      allButtons.forEach(btn => btn.classList.remove('wprm-toggle-active'));
      target.classList.add('wprm-toggle-active');

      // Update servings display
      const servingsDisplay = document.querySelector(
        `.wprm-recipe-servings[data-recipe="${recipeId}"]`
      );
      if (servingsDisplay) {
        const originalServings = servingsDisplay.getAttribute('data-original-servings') || 
                                 servingsDisplay.textContent;
        if (!servingsDisplay.getAttribute('data-original-servings')) {
          servingsDisplay.setAttribute('data-original-servings', originalServings || '12');
        }
        const original = parseNumericValue(originalServings);
        if (original === null) return;
        servingsDisplay.textContent = String(original * multiplierNum);
      }
    });
  });
}
