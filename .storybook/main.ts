import type { StorybookConfig } from 'storybook-astro';

const config: StorybookConfig = {
    stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
    addons: [
        '@storybook/addon-essentials',
    ],
    framework: {
        name: 'storybook-astro',
        options: {},
    },
    core: {
        builder: '@storybook/builder-vite',
    },
};
export default config;
