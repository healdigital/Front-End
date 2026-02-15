import type { Meta, StoryObj } from 'storybook/internal/types';
import WorkshopCard from './WorkshopCard.astro';

const meta: Meta<typeof WorkshopCard> = {
    component: WorkshopCard,
    title: 'Organisms/WorkshopCard',
    tags: ['autodocs'],
    argTypes: {
        title: { control: 'text' },
        price: { control: 'number' },
        maxParticipants: { control: 'number' },
        currentParticipants: { control: 'number' },
    },
};

export default meta;
type Story = StoryObj<typeof WorkshopCard>;

export const Available: Story = {
    args: {
        title: 'Atelier Pâtisserie : Les Macarons',
        slug: '/ateliers/macarons',
        image: 'https://placehold.co/388x240',
        date: new Date('2023-11-15T14:00:00'),
        price: 85,
        duration: '3h00',
        maxParticipants: 10,
        currentParticipants: 4,
    },
};

export const Full: Story = {
    args: {
        title: 'Cours de Cuisine Italienne',
        slug: '/ateliers/italie',
        image: 'https://placehold.co/388x240',
        date: new Date('2023-11-20T18:00:00'),
        price: 95,
        duration: '4h00',
        maxParticipants: 12,
        currentParticipants: 12,
    },
};
