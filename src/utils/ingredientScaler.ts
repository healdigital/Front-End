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

      const multiplierNum = parseFloat(multiplier);
      const originalAmounts = ingredientContainer.getAttribute('data-original-amounts');

      // Get all amount elements
      const amounts = ingredientContainer.querySelectorAll('.wprm-recipe-ingredient-amount');

      amounts.forEach((amount, index) => {
        const originalValue = amount.getAttribute('data-original-value') || amount.textContent;

        if (!amount.getAttribute('data-original-value')) {
          amount.setAttribute('data-original-value', originalValue || '0');
        }

        const original = parseFloat(originalValue || '0');
        const newValue = calculateScaledAmount(original, multiplierNum);
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
        const original = parseInt(originalServings || '12');
        servingsDisplay.textContent = String(original * multiplierNum);
      }
    });
  });
}

export function calculateScaledAmount(original: number, multiplier: number): string {
  if (isNaN(original) || isNaN(multiplier)) return '0';
  if (multiplier < 0) return '0'; // Assuming multiplier can't be negative for servings

  // Floating point precision handling
  const raw = original * multiplier;
  // Round to 2 decimals
  const fixed = raw.toFixed(2);
  // Remove trailing zeros and decimal point if integer
  return fixed.replace(/\.?0+$/, '');
}
