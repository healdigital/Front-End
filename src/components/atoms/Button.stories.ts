import type { Meta, StoryObj } from 'storybook/internal/types';
import Button from './Button.astro';

const meta: Meta<typeof Button> = {
    component: Button,
    title: 'Atoms/Button',
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: { type: 'select' },
            options: ['primary', 'secondary'],
        },
        size: {
            control: { type: 'select' },
            options: ['sm', 'md', 'lg'],
        },
        isDisabled: {
            control: 'boolean',
        },
    },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
    args: {
        variant: 'primary',
        size: 'md',
        children: 'Primary Button',
    },
};

export const Secondary: Story = {
    args: {
        variant: 'secondary',
        size: 'md',
        children: 'Secondary Button',
    },
};

export const Large: Story = {
    args: {
        size: 'lg',
        children: 'Large Button',
    },
};

export const Disabled: Story = {
    args: {
        isDisabled: true,
        children: 'Disabled Button',
    },
};
