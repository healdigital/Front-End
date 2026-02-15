import type { Meta, StoryObj } from 'storybook/internal/types';
import MasterclassCard from './MasterclassCard.astro';

const meta: Meta<typeof MasterclassCard> = {
    component: MasterclassCard,
    title: 'Organisms/MasterclassCard',
    tags: ['autodocs'],
    argTypes: {
        title: { control: 'text' },
        price: { control: 'number' },
    },
};

export default meta;
type Story = StoryObj<typeof MasterclassCard>;

export const Default: Story = {
    args: {
        title: 'Maîtriser les Sauces',
        slug: '/masterclass/sauces',
        image: 'https://placehold.co/603x340',
        price: 120,
        features: ['Accès illimité', 'Certificat inclus', 'Support chef'],
        location: 'Paris',
    },
};
