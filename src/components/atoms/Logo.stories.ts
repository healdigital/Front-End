import type { Meta, StoryObj } from 'storybook/internal/types';
import Logo from './Logo.astro';

const meta: Meta<typeof Logo> = {
    component: Logo,
    title: 'Atoms/Logo',
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component: 'Brand atom used as the primary home link in navigation contexts.',
            },
        },
    },
    argTypes: {
        class: {
            control: 'text',
            description: 'Additional utility classes applied to the logo link.',
        },
    },
};

export default meta;
type Story = StoryObj<typeof Logo>;

export const Default: Story = {};

export const CompactHeader: Story = {
    args: {
        class: 'text-xl',
    },
};
