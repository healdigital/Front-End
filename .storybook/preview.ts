import type { Preview } from 'storybook/internal/types';
import '../src/styles/global.css'; // Assuming this is where Tailwind is imported

const customViewports = {
    mobile: {
        name: 'Mobile (375)',
        styles: {
            width: '375px',
            height: '812px',
        },
    },
    tablet: {
        name: 'Tablet (768)',
        styles: {
            width: '768px',
            height: '1024px',
        },
    },
    desktop: {
        name: 'Desktop (1280)',
        styles: {
            width: '1280px',
            height: '900px',
        },
    },
};

const preview: Preview = {
    parameters: {
        actions: { argTypesRegex: "^on[A-Z].*" },
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
        viewport: {
            viewports: customViewports,
            defaultViewport: 'desktop',
        },
        chromatic: {
            viewports: [375, 768, 1280],
            pauseAnimationAtEnd: true,
        },
        layout: 'fullscreen',
    },
};

export default preview;
