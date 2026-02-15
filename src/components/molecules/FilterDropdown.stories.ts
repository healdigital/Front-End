import type { Meta, StoryObj } from 'storybook/internal/types';
import FilterDropdown from './FilterDropdown.astro';

const meta: Meta<typeof FilterDropdown> = {
    component: FilterDropdown,
    title: 'Molecules/FilterDropdown',
    tags: ['autodocs'],
    argTypes: {
        label: { control: 'text' },
        options: { control: 'object' },
    },
};

export default meta;
type Story = StoryObj<typeof FilterDropdown>;

export const Default: Story = {
    args: {
        label: 'Categories',
        options: [
            { label: 'All', value: 'all' },
            { label: 'Starters', value: 'starters' },
            { label: 'Main Courses', value: 'mains' },
            { label: 'Desserts', value: 'desserts' },
        ],
    },
};

export const SortBy: Story = {
    args: {
        label: 'Sort By',
        options: [
            { label: 'Newest', value: 'newest' },
            { label: 'Popular', value: 'popular' },
            { label: 'Oldest', value: 'oldest' },
        ],
    },
};
