import type { Meta, StoryObj } from 'storybook/internal/types';
import DateBadge from './DateBadge.astro';

const meta: Meta<typeof DateBadge> = {
    component: DateBadge,
    title: 'Molecules/DateBadge',
    tags: ['autodocs'],
    argTypes: {
        date: { control: 'date' },
    },
};

export default meta;
type Story = StoryObj<typeof DateBadge>;

export const Default: Story = {
    args: {
        date: new Date('2023-10-25'),
    },
};

export const FutureDate: Story = {
    args: {
        date: new Date('2024-01-01'),
    },
};
