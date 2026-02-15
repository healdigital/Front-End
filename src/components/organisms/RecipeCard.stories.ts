import type { Meta, StoryObj } from 'storybook/internal/types';
import RecipeCard from './RecipeCard.astro';

const meta: Meta<typeof RecipeCard> = {
    component: RecipeCard,
    title: 'Organisms/RecipeCard',
    tags: ['autodocs'],
    argTypes: {
        title: { control: 'text' },
        description: { control: 'text' },
        image: { control: 'text' },
        prepTime: { control: 'text' },
        difficulty: { control: 'text' },
        isFavorite: { control: 'boolean' },
    },
};

export default meta;
type Story = StoryObj<typeof RecipeCard>;

export const Default: Story = {
    args: {
        title: 'Gâteau au Chocolat Fondant',
        slug: '/recettes/gateau-chocolat',
        image: 'https://placehold.co/432x256',
        description: 'Un gâteau au chocolat riche et fondant, parfait pour les amateurs de cacao. Facile à réaliser et prêt en moins de 30 minutes.',
        prepTime: '25 min',
        difficulty: 'Facile',
        category: 'DESSERT',
        isFavorite: false,
    },
};

export const Favorite: Story = {
    args: {
        ...Default.args,
        title: 'Lasagnes à la Bolognaise',
        slug: '/recettes/lasagnes',
        difficulty: 'Moyen',
        prepTime: '1h 30min',
        category: 'PLAT',
        isFavorite: true,
    },
};
