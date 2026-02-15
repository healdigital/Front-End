# Component Documentation

This guide complements Storybook and provides quick usage patterns and design notes for all components in `atoms`, `molecules`, and `organisms`.

## Storybook Entry Points

- Run local Storybook: `npm run storybook`
- Build static docs: `npm run build-storybook`
- Visual regression (Chromatic): `npm run test:visual`

## Chromatic Setup

- Set `CHROMATIC_PROJECT_TOKEN` in CI/local environment.
- `npm run test:visual` builds Storybook then publishes snapshots to Chromatic.
- Snapshots are configured on 3 breakpoints in Storybook preview:
  - Mobile: `375px`
  - Tablet: `768px`
  - Desktop: `1280px`
- Every story state under `atoms`, `molecules`, and `organisms` is included in visual regression.

## Atoms

| Component | Usage Example | Usage Pattern | Design Notes |
| --- | --- | --- | --- |
| `Badge` | `<Badge variant="category">Dessert</Badge>` | Surface short taxonomy/state labels. | Keep content to one short word group. |
| `Button` | `<Button variant="primary">Reserver</Button>` | Primary CTA or secondary action. | One strong primary button per section. |
| `Checkbox` | `<Checkbox label="J'accepte" required />` | Consent and boolean form input. | Always pair with label and inline error. |
| `Icon` | `<Icon name="search" size="sm" />` | Visual support for actions and metadata. | Avoid icon-only controls without `aria-label`. |
| `Input` | `<Input label="Email" type="email" />` | Text/email/search data entry. | Show validation state via `error`. |
| `Logo` | `<Logo class="text-xl" />` | Brand home link in top-level nav. | Keep position and size stable across breakpoints. |

## Molecules

| Component | Usage Example | Usage Pattern | Design Notes |
| --- | --- | --- | --- |
| `DateBadge` | `<DateBadge date={new Date()} />` | Compact event date marker. | Keep fixed dimensions to avoid layout shifts. |
| `FilterDropdown` | `<FilterDropdown label="Categorie" options={options} />` | Lightweight archive/listing filters. | Prefer small, explicit option sets. |
| `Navigation` | `<Navigation activePath="/recettes" />` | Main navigation group for header. | Use `activePath` from routing context when possible. |
| `SearchField` | `<SearchField id="search-header" />` | Fast access search in header zones. | Keep placeholder action-oriented and short. |
| `SocialShare` | `<SocialShare url={url} title={title} />` | Share actions for content cards/pages. | Keep it secondary to the main CTA. |

## Organisms

| Component | Usage Example | Usage Pattern | Design Notes |
| --- | --- | --- | --- |
| `Header` | `<Header activePath={Astro.url.pathname} />` | Global navigation shell. | Keep sticky behavior subtle and unobtrusive. |
| `Footer` | `<Footer />` | Site-wide closing section. | Group links by intent and keep legal links lightweight. |
| `MasterclassCard` | `<MasterclassCard {...props} />` | Premium offer card in landing pages. | Emphasize value bullets and single CTA. |
| `NewsletterModal` | `<NewsletterModal triggerId="open-newsletter" />` | Subscription conversion flow. | Keep form short and validate inline. |
| `Pagination` | `<Pagination currentPage={2} totalPages={12} baseUrl="/articles" />` | Page navigation for long lists. | Preserve keyboard and screen-reader behavior. |
| `RecipeCard` | `<RecipeCard {...props} />` | Recipe discovery cards in grids. | Keep text lengths bounded for vertical rhythm. |
| `WorkshopCard` | `<WorkshopCard {...props} />` | Event/session card with booking state. | Status color must clearly differentiate availability. |

## Usage Patterns

- Build pages from atoms to organisms; avoid skipping abstraction layers for reusable UI.
- Keep props explicit and typed; do not overload `class` for functional behavior.
- Reuse existing variants before introducing new visual tokens.
- Treat error and disabled states as first-class states in stories and QA.

## Design Notes

- Spacing and typography should remain consistent across desktop/tablet/mobile.
- Ensure every interactive element has a visible focus state.
- Prioritize AA contrast for text and status indicators.
- Motion should be purposeful and respect reduced-motion preferences.
