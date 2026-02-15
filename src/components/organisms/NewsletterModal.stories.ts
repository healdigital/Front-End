import type { Meta, StoryObj } from 'storybook/internal/types';
import NewsletterModal from './NewsletterModal.astro';

const meta: Meta<typeof NewsletterModal> = {
    component: NewsletterModal,
    title: 'Organisms/NewsletterModal',
    tags: ['autodocs'],
    argTypes: {
        triggerId: { control: 'text' },
    },
};

export default meta;
type Story = StoryObj<typeof NewsletterModal>;

export const Default: Story = {
    render: (args) => ({
        components: { NewsletterModal },
        template: `
      <div>
        <button id="open-modal-btn" class="px-4 py-2 bg-primary-turquoise text-primary-black rounded">
          Ouvrir la modale
        </button>
        <NewsletterModal triggerId="open-modal-btn" />
      </div>
    `,
    }),
};
