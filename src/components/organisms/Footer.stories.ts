import type { Meta, StoryObj } from 'storybook/internal/types';
import Footer from './Footer.astro';

const meta: Meta<typeof Footer> = {
    component: Footer,
    title: 'Organisms/Footer',
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
    },
};

export default meta;
type Story = StoryObj<typeof Footer>;

export const Default: Story = {};
