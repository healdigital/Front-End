import type { Meta, StoryObj } from 'storybook/internal/types';
import Navigation from './Navigation.astro';

const meta: Meta<typeof Navigation> = {
    component: Navigation,
    title: 'Molecules/Navigation',
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component: 'Main site navigation used by the Header organism for desktop and mobile menu contexts.',
            },
        },
    },
    argTypes: {
        activePath: { control: 'text' },
        class: { control: 'text' },
    },
};

export default meta;
type Story = StoryObj<typeof Navigation>;

export const Default: Story = {
    args: {
        activePath: '/recettes',
    },
};

export const VerticalMenu: Story = {
    args: {
        activePath: '/voyages',
        class: 'flex-col items-start gap-4',
    },
};
