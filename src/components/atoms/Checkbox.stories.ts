import type { Meta, StoryObj } from 'storybook/internal/types';
import Checkbox from './Checkbox.astro';

const meta: Meta<typeof Checkbox> = {
    component: Checkbox,
    title: 'Atoms/Checkbox',
    tags: ['autodocs'],
    argTypes: {
        checked: {
            control: 'boolean',
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
    },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
    args: {
        label: 'Subscribe to newsletter',
        checked: false,
    },
};

export const Checked: Story = {
    args: {
        label: 'I agree to the terms',
        checked: true,
    },
};

export const WithError: Story = {
    args: {
        label: 'Required checkbox',
        error: 'You must agree to continue',
    },
};

export const Disabled: Story = {
    args: {
        label: 'Disabled checkbox',
        disabled: true,
        checked: true,
    },
};
