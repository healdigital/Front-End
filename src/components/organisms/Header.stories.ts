import type { Meta, StoryObj } from 'storybook/internal/types';
import Header from './Header.astro';

const meta: Meta<typeof Header> = {
    component: Header,
    title: 'Organisms/Header',
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
    },
    argTypes: {
        activePath: { control: 'text' },
    },
};

export default meta;
type Story = StoryObj<typeof Header>;

export const Default: Story = {
    args: {
        activePath: '/',
    },
};

export const ActiveRecipes: Story = {
    args: {
        activePath: '/recipes',
    },
};
