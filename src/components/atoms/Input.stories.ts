import type { Meta, StoryObj } from 'storybook/internal/types';
import Input from './Input.astro';

const meta: Meta<typeof Input> = {
    component: Input,
    title: 'Atoms/Input',
    tags: ['autodocs'],
    argTypes: {
        type: {
            control: { type: 'select' },
            options: ['text', 'email', 'password', 'search'],
        },
        disabled: {
            control: 'boolean',
        },
        label: {
            control: 'text',
        },
        error: {
            control: 'text',
        },
        placeholder: {
            control: 'text',
        },
    },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
    args: {
        label: 'Username',
        placeholder: 'Enter your username',
    },
};

export const Email: Story = {
    args: {
        label: 'Email',
        type: 'email',
        placeholder: 'you@example.com',
    },
};

export const WithError: Story = {
    args: {
        label: 'Email',
        type: 'email',
        value: 'invalid-email',
        error: 'Please enter a valid email address',
    },
};

export const Disabled: Story = {
    args: {
        label: 'Disabled Input',
        disabled: true,
        value: 'Cannot edit this',
    },
};
