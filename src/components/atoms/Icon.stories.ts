import type { Meta, StoryObj } from 'storybook/internal/types';
import Icon from './Icon.astro';

const meta: Meta<typeof Icon> = {
    component: Icon,
    title: 'Atoms/Icon',
    tags: ['autodocs'],
    argTypes: {
        name: {
            control: { type: 'select' },
            options: ['check', 'close', 'menu', 'search', 'user', 'arrow-right', 'star', 'chevron-down', 'lock', 'facebook', 'instagram', 'pinterest', 'youtube'],
        },
        size: {
            control: { type: 'select' },
            options: ['sm', 'md', 'lg'],
        },
    },
};

export default meta;
type Story = StoryObj<typeof Icon>;

export const Default: Story = {
    args: {
        name: 'user',
        size: 'md',
    },
};

export const Small: Story = {
    args: {
        name: 'check',
        size: 'sm',
    },
};

export const Large: Story = {
    args: {
        name: 'search',
        size: 'lg',
    },
};

export const Social: Story = {
    args: {
        name: 'instagram',
        size: 'md',
    },
};
