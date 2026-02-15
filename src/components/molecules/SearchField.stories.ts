import type { Meta, StoryObj } from 'storybook/internal/types';
import SearchField from './SearchField.astro';

const meta: Meta<typeof SearchField> = {
    component: SearchField,
    title: 'Molecules/SearchField',
    tags: ['autodocs'],
    argTypes: {
    },
};

export default meta;
type Story = StoryObj<typeof SearchField>;

export const Default: Story = {};
