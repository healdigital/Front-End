import type { Meta, StoryObj } from 'storybook/internal/types';
import Badge from './Badge.astro';

const meta: Meta<typeof Badge> = {
    component: Badge,
    title: 'Atoms/Badge',
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: { type: 'select' },
            options: ['category', 'status', 'premium'],
        },
        icon: {
            control: 'text',
        },
    },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Category: Story = {
    args: {
        variant: 'category',
        children: 'Category Name',
    },
};

export const Status: Story = {
    args: {
        variant: 'status',
        children: 'Active',
    },
};

export const Premium: Story = {
    args: {
        variant: 'premium',
        children: 'Premium',
        icon: 'star',
    },
};

export const WithIcon: Story = {
    args: {
        variant: 'category',
        children: 'Vegetarian',
        icon: 'leaf', // Assuming leaf icon class exists or logic supports it
    },
};
