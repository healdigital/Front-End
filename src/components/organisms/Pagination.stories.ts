import type { Meta, StoryObj } from 'storybook/internal/types';
import Pagination from './Pagination.astro';

const meta: Meta<typeof Pagination> = {
    component: Pagination,
    title: 'Organisms/Pagination',
    tags: ['autodocs'],
    argTypes: {
        currentPage: { control: 'number' },
        totalPages: { control: 'number' },
        baseUrl: { control: 'text' },
    },
};

export default meta;
type Story = StoryObj<typeof Pagination>;

export const Default: Story = {
    args: {
        currentPage: 1,
        totalPages: 5,
        baseUrl: '/recipes',
    },
};

export const MiddlePage: Story = {
    args: {
        currentPage: 3,
        totalPages: 5,
        baseUrl: '/recipes',
    },
};

export const LastPage: Story = {
    args: {
        currentPage: 5,
        totalPages: 5,
        baseUrl: '/recipes',
    },
};

export const ManyPages: Story = {
    args: {
        currentPage: 5,
        totalPages: 20,
        baseUrl: '/recipes',
    },
};
