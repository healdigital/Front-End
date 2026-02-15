export interface Recipe {
  id: string;
  slug: string;
  title: string;
  description: string;
  author?: string;
  prepTime?: string;
  cookTime?: string;
  servings?: number;
  difficulty?: 'facile' | 'moyen' | 'difficile';
  ingredients: string[];
  instructions: string[];
  tags?: string[];
  image?: string;
  publishedAt?: Date;
}

export interface Author {
  id: string;
  slug: string;
  name: string;
  bio?: string;
  image?: string;
}

export async function getAllRecipes(): Promise<Recipe[]> {
  // TODO: Implement fetching recipes from data source
  return [];
}

export async function getRecipeBySlug(slug: string): Promise<Recipe | null> {
  // TODO: Implement fetching single recipe by slug
  return null;
}

export async function getAllAuthors(): Promise<Author[]> {
  // TODO: Implement fetching authors from data source
  return [];
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  // TODO: Implement fetching single author by slug
  return null;
}

export function formatRecipeForJson(recipe: Recipe) {
  return {
    '@context': 'https://schema.org/',
    '@type': 'Recipe',
    name: recipe.title,
    description: recipe.description,
    image: recipe.image,
    author: recipe.author ? { '@type': 'Person', name: recipe.author } : undefined,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    recipeYield: recipe.servings ? `${recipe.servings} personnes` : undefined,
    recipeIngredient: recipe.ingredients,
    recipeInstructions: recipe.instructions.map((instruction, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      text: instruction
    }))
  };
}
