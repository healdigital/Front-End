import type { Meta, StoryObj } from 'storybook/internal/types';
import SocialShare from './SocialShare.astro';

const meta: Meta<typeof SocialShare> = {
    component: SocialShare,
    title: 'Molecules/SocialShare',
    tags: ['autodocs'],
    argTypes: {
        url: { control: 'text' },
        title: { control: 'text' },
    },
};

export default meta;
type Story = StoryObj<typeof SocialShare>;

export const Default: Story = {
    args: {
        url: 'https://lacuisinedebernard.com',
        title: 'La Cuisine de Bernard',
    },
};

export const Custom: Story = {
    args: {
        url: 'https://example.com/recipe',
        title: 'Amazing Recipe',
    },
};
