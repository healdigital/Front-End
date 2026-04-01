# Club Ad-Free Navigation — Astro Blog Implementation Brief

## Goal

Club members (paying subscribers via Fluent Cart on `atelier-lacuisinedebernard.com`) should
browse the blog at `lacuisinedebernard.com` with **zero ads**.

## Approach — why it works without SSR

Mediavine loads via `<script async src="...">` in `<head>`. Replacing that with a
synchronous inline script that **conditionally injects** the tag means the SDK is never
fetched for members. No SSR, no flicker, no infrastructure change. `output: 'static'`
stays unchanged.

**Token flow:**

```
[Blog header] → click "Club"
    → LoginModal POST /wp-json/lcdb/v1/blog-auth (WordPress + Fluent Cart check)
    → JWT returned → stored in cookie lcdb_club (blog domain)
    → page.reload()
    → <head> inline script reads cookie BEFORE Mediavine → SDK never loads
```

---

## 1 · `BaseLayout.astro`

**File:** `src/layouts/BaseLayout.astro`

### 1a — Replace Mediavine static tag (lines 62–64)

**Remove:**
```astro
{loadAds && mediavineScriptSrc && (
  <script async src={mediavineScriptSrc}></script>
)}
```

**Replace with two inline scripts.** Pass `mediavineScriptSrc` and `loadAds` into the
inline scope with `define:vars`:

```astro
{loadAds && mediavineScriptSrc && (
  <>
    {/* Script 1 — synchronous club-member gate. Runs during HTML parsing,
        before any async resource is fetched. Sets a global flag and a
        data attribute on <html> so CSS can also hide ad slots. */}
    <script is:inline>
      window.__lcdbClubMember = (function () {
        try {
          var raw = document.cookie.split('; ').find(function (r) {
            return r.startsWith('lcdb_club=');
          });
          if (!raw) return false;
          var token = raw.split('=').slice(1).join('=');
          var parts = token.split('.');
          if (parts.length !== 3) return false;
          // Decode base64url payload (no signature check — ad removal only).
          var payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (!payload || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return false;
          if (payload.iss !== 'atelier-lacuisinedebernard.com') return false;
          document.documentElement.setAttribute('data-club-member', 'true');
          return true;
        } catch (e) {
          return false;
        }
      })();
    </script>

    {/* Script 2 — conditional Mediavine loader.
        Only injects the SDK script tag if the user is NOT a Club member. */}
    <script is:inline define:vars={{ mediavineScriptSrc }}>
      if (!window.__lcdbClubMember) {
        var s = document.createElement('script');
        s.async = true;
        s.src = mediavineScriptSrc;
        document.head.appendChild(s);
      }
    </script>
  </>
)}
```

### 1b — Import and render ClubLoginModal

Add the import at the top of the frontmatter block (with the other component imports):
```astro
import ClubLoginModal from '../components/ClubLoginModal.astro';
```

Add the component inside `<body>`, just before `<GlobalFooter>` (current line 81):
```astro
<ClubLoginModal />
<GlobalFooter currentLang={lang} />
```

### 1c — Import the client auth script

At the bottom of the file, after the existing `<script>` block (after line 134), add:
```astro
<script>
  import '../scripts/clubAuth';
</script>
```

---

## 2 · `Header.astro`

**File:** `src/components/Header.astro`

### 2a — Desktop Club button

Insert **between** the language dropdown closing `</div>` (line 200) and the favorites
`<a>` (line 201). The exact insertion point is right after the closing `</div>` of
`data-lang-menu`:

```astro
{/* Club member status — desktop */}
<div class="relative" data-no-translate="true">
  {/* Logged-out state — shown by default, hidden by JS when member */}
  <button
    type="button"
    class="flex items-center gap-[7px] text-white/85 hover:text-white text-[14px] header-utility-text"
    data-club-login-trigger
    aria-label="Connexion Club"
  >
    <Icon name="user" size="sm" class="w-[18px] h-[18px]" />
    <span data-header-utility-label>Club</span>
  </button>

  {/* Logged-in state — hidden by default, shown by JS when member */}
  <div class="hidden items-center gap-[7px]" data-club-member-status>
    <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:#bba86b"></span>
    <span
      class="text-[14px] header-utility-text"
      style="color:#bba86b"
      data-club-member-name
    ></span>
    <button
      type="button"
      class="text-white/50 hover:text-white/85 text-[12px] header-utility-text transition-colors"
      data-club-logout-trigger
      aria-label="Se déconnecter du Club"
    >
      ✕
    </button>
  </div>
</div>
```

### 2b — Mobile Club button

Insert inside the `data-header-mobile-flex` div (around line 210), after the mobile
language menu closing `</div>` (after the `data-mobile-header-lang-menu` div) and
before the search button:

```astro
{/* Club — mobile */}
<button
  type="button"
  class="text-white/80 hover:text-white transition-colors"
  aria-label="Club"
  data-club-login-trigger
  data-no-translate="true"
>
  <Icon name="user" size="md" />
</button>
```

> **Note:** There will be two elements with `data-club-login-trigger` (desktop + mobile).
> The JS in `clubAuth.ts` binds a `querySelectorAll` so both work.

---

## 3 · `ClubLoginModal.astro` — new file

**File:** `src/components/ClubLoginModal.astro`

Mirror the exact same `<dialog>` pattern used by `NewsletterModal.astro` (id prefix,
`showModal()` / `close()`, focus trap, `aria-modal`, backdrop click to close, ESC key).

```astro
---
// No props — singleton modal, always rendered once in BaseLayout.
---

<dialog
  id="club-login-modal"
  class="club-modal fixed inset-0 z-50 hidden items-center justify-center bg-transparent overflow-hidden"
  aria-modal="true"
  aria-labelledby="club-modal-title"
>
  <div class="club-modal-panel" data-modal-panel>
    {/* Close button */}
    <button
      id="club-modal-close"
      class="club-modal-close"
      aria-label="Fermer"
      type="button"
    >
      <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    {/* Gold accent line */}
    <div class="club-modal-accent" aria-hidden="true"></div>

    {/* Content */}
    <div class="club-modal-content">
      <h2 id="club-modal-title" class="club-modal-title">Connexion Club</h2>
      <p class="club-modal-subtitle">
        Identifiez-vous pour profiter de votre expérience sans publicité.
      </p>

      <form id="club-modal-form" class="club-modal-form" novalidate>
        <div class="club-modal-field">
          <label class="sr-only" for="club-modal-email">Adresse email</label>
          <input
            type="email"
            id="club-modal-email"
            name="email"
            class="club-modal-input"
            placeholder="Votre adresse email"
            autocomplete="email"
            required
          />
        </div>

        <div class="club-modal-field">
          <label class="sr-only" for="club-modal-password">Mot de passe</label>
          <input
            type="password"
            id="club-modal-password"
            name="password"
            class="club-modal-input"
            placeholder="Votre mot de passe"
            autocomplete="current-password"
            required
          />
        </div>

        <p
          id="club-modal-error"
          class="club-modal-error hidden"
          role="alert"
          aria-live="polite"
        ></p>

        <button type="submit" id="club-modal-submit" class="club-modal-submit">
          Se connecter
        </button>
      </form>

      <p class="club-modal-join">
        Pas encore membre ?&nbsp;
        <a
          href="https://atelier-lacuisinedebernard.com/club/"
          target="_blank"
          rel="noopener noreferrer"
          class="club-modal-join-link"
        >
          Rejoindre le Club
        </a>
      </p>
    </div>
  </div>
</dialog>

<style is:global>
  /* ── Dialog shell ──────────────────────────────────────────── */
  #club-login-modal {
    border: 0;
    max-width: none;
    max-height: none;
    width: 100%;
    height: 100%;
    padding: 0;
    background: transparent;
    margin: 0;
    box-sizing: border-box;
  }

  #club-login-modal::backdrop {
    background: rgba(28, 30, 36, 0.84);
    backdrop-filter: blur(2px);
    opacity: 0;
    transition: opacity 0.28s ease;
  }

  #club-login-modal[open]::backdrop {
    opacity: 1;
  }

  #club-login-modal.flex {
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
  }

  /* ── Panel ─────────────────────────────────────────────────── */
  .club-modal-panel {
    position: relative;
    width: min(100%, 420px);
    background: #f3f0ea;
    box-shadow: 0 24px 56px rgba(10, 18, 28, 0.28);
    overflow: hidden;
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }

  #club-login-modal[open] .club-modal-panel {
    animation: club-modal-fade-in 0.28s ease forwards;
  }

  @keyframes club-modal-fade-in {
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ── Accent gold line ──────────────────────────────────────── */
  .club-modal-accent {
    height: 4px;
    background: #bba86b;
  }

  /* ── Content ───────────────────────────────────────────────── */
  .club-modal-content {
    padding: 36px 36px 32px;
  }

  .club-modal-title {
    margin: 0;
    color: #111111;
    font-family: var(--font-heading);
    font-size: clamp(2rem, 5vw, 2.6rem);
    line-height: 1;
    letter-spacing: -0.01em;
  }

  .club-modal-subtitle {
    margin: 10px 0 0;
    color: #5b5b5b;
    font-family: var(--font-body);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  /* ── Form ──────────────────────────────────────────────────── */
  .club-modal-form {
    margin-top: 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .club-modal-field {
    width: 100%;
  }

  .club-modal-input {
    width: 100%;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid #d8d2c2;
    background: #ffffff;
    color: #111111;
    font-family: var(--font-body);
    font-size: 0.95rem;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    box-sizing: border-box;
  }

  .club-modal-input::placeholder {
    color: #a59f95;
  }

  .club-modal-input:focus {
    border-color: #bba86b;
    box-shadow: inset 0 0 0 1px #bba86b;
  }

  .club-modal-input[aria-invalid="true"] {
    border-color: #c64545;
    box-shadow: inset 0 0 0 1px #c64545;
  }

  /* ── Error ─────────────────────────────────────────────────── */
  .club-modal-error {
    margin: 0;
    padding: 8px 12px;
    background: #fdf2f2;
    border-left: 3px solid #c64545;
    color: #c64545;
    font-family: var(--font-body);
    font-size: 0.82rem;
    line-height: 1.35;
  }

  /* ── Submit ────────────────────────────────────────────────── */
  .club-modal-submit {
    width: 100%;
    min-height: 46px;
    margin-top: 4px;
    border: 0;
    background: #bba86b;
    color: #ffffff;
    font-family: var(--font-button);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.2s ease;
    -webkit-font-smoothing: antialiased;
  }

  .club-modal-submit:hover {
    background: #a89560;
  }

  .club-modal-submit:active {
    transform: scale(0.98);
  }

  .club-modal-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ── Join link ─────────────────────────────────────────────── */
  .club-modal-join {
    margin: 18px 0 0;
    color: #7b7b6f;
    font-family: var(--font-body);
    font-size: 0.82rem;
    text-align: center;
  }

  .club-modal-join-link {
    color: #bba86b;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* ── Close button ──────────────────────────────────────────── */
  .club-modal-close {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 2;
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: #5b5b5b;
    cursor: pointer;
    transition: color 0.2s ease;
  }

  .club-modal-close:hover {
    color: #111111;
  }

  /* ── Mobile ────────────────────────────────────────────────── */
  @media (max-width: 480px) {
    .club-modal-content {
      padding: 28px 20px 24px;
    }

    #club-login-modal.flex {
      padding: 16px;
    }
  }
</style>
```

---

## 4 · `src/scripts/clubAuth.ts` — new file

**File:** `src/scripts/clubAuth.ts`

```typescript
/**
 * Club auth — client-side script.
 *
 * Responsibilities:
 *  - Open / close the login modal (#club-login-modal)
 *  - POST credentials to WordPress Fluent Cart auth API
 *  - Store the JWT in cookie `lcdb_club`
 *  - Update the header UI (login ↔ member state)
 *  - Background token refresh when expiry < 24 h
 *  - Clear cookie on logout
 *
 * This script is bundled by Astro and imported once in BaseLayout.astro.
 * It uses `querySelectorAll` for triggers so it works for both
 * desktop and mobile header buttons.
 */

const COOKIE_NAME = 'lcdb_club';
const COOKIE_TTL = 60 * 60 * 24 * 7; // 7 days in seconds
const API_BASE = import.meta.env.PUBLIC_CLUB_AUTH_API as string;
// e.g. https://atelier-lacuisinedebernard.com/wp-json/lcdb/v1/blog-auth

// ── Cookie helpers ─────────────────────────────────────────────────────

function setCookie(name: string, value: string, maxAge: number): void {
  document.cookie =
    `${name}=${value}; path=/; max-age=${maxAge}; secure; samesite=lax`;
}

function clearCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0`;
}

function getCookie(name: string): string | null {
  const match = document.cookie
    .split('; ')
    .find((r) => r.startsWith(`${name}=`));
  return match ? match.split('=').slice(1).join('=') : null;
}

// ── JWT helpers (no signature — ad removal only) ───────────────────────

interface JwtPayload {
  sub: number;
  email: string;
  name: string;
  plan: string;
  exp: number;
  iss: string;
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

function isTokenValid(token: string): JwtPayload | null {
  const payload = parseJwt(token);
  if (!payload) return null;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (payload.iss !== 'atelier-lacuisinedebernard.com') return null;
  return payload;
}

function isTokenExpiringWithin24h(payload: JwtPayload): boolean {
  const secondsLeft = payload.exp - Math.floor(Date.now() / 1000);
  return secondsLeft < 60 * 60 * 24;
}

// ── Header UI ─────────────────────────────────────────────────────────

function updateHeaderUI(member: { name: string } | null): void {
  const loginTriggers = document.querySelectorAll<HTMLElement>('[data-club-login-trigger]');
  const memberStatus = document.querySelector<HTMLElement>('[data-club-member-status]');
  const memberNameEl = document.querySelector<HTMLElement>('[data-club-member-name]');

  if (member) {
    // Show member state, hide login triggers.
    loginTriggers.forEach((el) => el.classList.add('hidden'));
    if (memberStatus) {
      memberStatus.classList.remove('hidden');
      memberStatus.classList.add('flex');
    }
    if (memberNameEl) {
      memberNameEl.textContent = member.name.split(' ')[0]; // first name only
    }
  } else {
    // Show login triggers, hide member state.
    loginTriggers.forEach((el) => el.classList.remove('hidden'));
    if (memberStatus) {
      memberStatus.classList.add('hidden');
      memberStatus.classList.remove('flex');
    }
  }
}

// ── Modal helpers ─────────────────────────────────────────────────────

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function openModal(dialog: HTMLDialogElement): void {
  if (!dialog.open) dialog.showModal();
  dialog.classList.remove('hidden');
  dialog.classList.add('flex');
  document.body.style.overflow = 'hidden';
  const first = dialog.querySelector<HTMLElement>(FOCUSABLE);
  setTimeout(() => first?.focus(), 0);
}

function closeModal(dialog: HTMLDialogElement, { reset = true } = {}): void {
  if (dialog.open) dialog.close();
  dialog.classList.add('hidden');
  dialog.classList.remove('flex');
  document.body.style.overflow = '';
  if (reset) resetForm();
}

function resetForm(): void {
  const form = document.getElementById('club-modal-form') as HTMLFormElement | null;
  const error = document.getElementById('club-modal-error') as HTMLElement | null;
  const submit = document.getElementById('club-modal-submit') as HTMLButtonElement | null;
  form?.reset();
  if (error) { error.textContent = ''; error.classList.add('hidden'); }
  if (submit) { submit.disabled = false; submit.textContent = 'Se connecter'; }
}

function showError(message: string): void {
  const el = document.getElementById('club-modal-error');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

// ── Login ─────────────────────────────────────────────────────────────

async function login(email: string, password: string): Promise<void> {
  const submit = document.getElementById('club-modal-submit') as HTMLButtonElement | null;
  if (submit) { submit.disabled = true; submit.textContent = 'Connexion…'; }

  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      const message =
        data.error === 'invalid_credentials'
          ? 'Email ou mot de passe incorrect.'
          : data.error === 'no_active_subscription'
          ? 'Aucun abonnement Club actif trouvé pour ce compte.'
          : data.error === 'too_many_attempts'
          ? 'Trop de tentatives. Réessayez dans 5 minutes.'
          : data.message ?? 'Une erreur est survenue. Réessayez.';

      showError(message);
      if (submit) { submit.disabled = false; submit.textContent = 'Se connecter'; }
      return;
    }

    // Store JWT cookie.
    setCookie(COOKIE_NAME, data.token, COOKIE_TTL);

    // Reload so the inline <head> script re-evaluates the cookie
    // and removes Mediavine on the next page load.
    window.location.reload();

  } catch {
    showError('Erreur réseau. Vérifiez votre connexion et réessayez.');
    if (submit) { submit.disabled = false; submit.textContent = 'Se connecter'; }
  }
}

// ── Logout ────────────────────────────────────────────────────────────

function logout(): void {
  clearCookie(COOKIE_NAME);
  window.location.reload();
}

// ── Background token refresh ──────────────────────────────────────────

async function maybeRefreshToken(): Promise<void> {
  const token = getCookie(COOKIE_NAME);
  if (!token) return;

  const payload = isTokenValid(token);
  if (!payload) {
    // Token invalid/expired — clean up.
    clearCookie(COOKIE_NAME);
    updateHeaderUI(null);
    return;
  }

  // Update header to show member name immediately on page load.
  updateHeaderUI({ name: payload.name });

  if (!isTokenExpiringWithin24h(payload)) return;

  // Refresh silently.
  try {
    const res = await fetch(`${API_BASE}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();

    if (res.ok && data.success && data.token) {
      setCookie(COOKIE_NAME, data.token, COOKIE_TTL);
    } else if (data.error === 'subscription_expired') {
      clearCookie(COOKIE_NAME);
      updateHeaderUI(null);
    }
  } catch {
    // Network failure — keep existing token, try again next visit.
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────

function init(): void {
  const dialog = document.getElementById('club-login-modal') as HTMLDialogElement | null;
  if (!dialog) return;

  const closeBtn = document.getElementById('club-modal-close');
  const form = document.getElementById('club-modal-form') as HTMLFormElement | null;
  const panel = dialog.querySelector<HTMLElement>('[data-modal-panel]');

  // Open triggers (desktop + mobile — querySelectorAll catches both).
  document.querySelectorAll<HTMLElement>('[data-club-login-trigger]').forEach((btn) => {
    btn.addEventListener('click', () => openModal(dialog));
  });

  // Logout triggers.
  document.querySelectorAll<HTMLElement>('[data-club-logout-trigger]').forEach((btn) => {
    btn.addEventListener('click', logout);
  });

  // Close button.
  closeBtn?.addEventListener('click', () => closeModal(dialog));

  // Backdrop click.
  dialog.addEventListener('click', (e) => {
    if (panel && panel.contains(e.target as Node)) return;
    closeModal(dialog);
  });

  // ESC key (native dialog cancel event).
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeModal(dialog);
  });

  // Focus trap.
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE)
    ).filter((el) => !el.hasAttribute('disabled'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  // Form submit.
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('club-modal-email') as HTMLInputElement;
    const passwordInput = document.getElementById('club-modal-password') as HTMLInputElement;
    const errorEl = document.getElementById('club-modal-error');
    if (errorEl) errorEl.classList.add('hidden');
    await login(emailInput.value.trim(), passwordInput.value);
  });

  // On page load — check existing token and update UI.
  maybeRefreshToken();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

---

## 5 · `src/styles/global.css`

**File:** `src/styles/global.css`

Append at the bottom of the file:

```css
/* ── Club member — ad-free ───────────────────────────────────────────── */
/* Collapses Mediavine slot divs for Club members.
   The SDK is never loaded for members (see BaseLayout.astro inline script),
   but this CSS removes the reserved min-height so no whitespace remains. */
html[data-club-member="true"] .mv-ad-slot {
  display: none !important;
  min-height: 0 !important;
}
```

---

## 6 · `.env.example`

**File:** `Front-End-main/.env.example`

Append:

```dotenv
# Club member authentication — ad-free navigation
# WordPress REST endpoint provided by the lcdb-blog-auth plugin
PUBLIC_CLUB_AUTH_API=https://atelier-lacuisinedebernard.com/wp-json/lcdb/v1/blog-auth
```

Also add the variable to your local `.env`:

```dotenv
PUBLIC_CLUB_AUTH_API=https://atelier-lacuisinedebernard.com/wp-json/lcdb/v1/blog-auth
```

---

## Files changed / created — summary

| Action | File |
|--------|------|
| Modify | `src/layouts/BaseLayout.astro` — replace Mediavine tag, add modal + script |
| Modify | `src/components/Header.astro` — add Club button (desktop + mobile) |
| **Create** | `src/components/ClubLoginModal.astro` |
| **Create** | `src/scripts/clubAuth.ts` |
| Modify | `src/styles/global.css` — append Club ad-hide rule |
| Modify | `.env.example` — add `PUBLIC_CLUB_AUTH_API` |

No changes needed:
- `astro.config.mjs` — stays `output: 'static'`
- `src/components/MediavineSlot.astro` — unchanged
- Any page file (`[slug].astro`, `articles/[slug].astro`, `videos.astro`) — `loadAds={true}` unchanged
- `package.json` — no new dependencies (JWT parsing is manual base64 decode)
- `tailwind.config.js` — `status.premium: '#bba86b'` already defined

---

## Cookie specification

| Property | Value | Reason |
|----------|-------|--------|
| Name | `lcdb_club` | Namespaced |
| Value | JWT string | Self-contained, no server session needed |
| `path` | `/` | Available on all blog pages |
| `max-age` | `604800` (7 d) | Matches JWT `exp` |
| `secure` | yes | HTTPS only |
| `samesite` | `lax` | CSRF protection, allows normal navigation |
| `httpOnly` | **no** | Required: the inline `<head>` script must read it |
| `domain` | (not set) | Defaults to `lacuisinedebernard.com` |

---

## How to verify

| Scenario | Expected |
|----------|----------|
| No cookie | Mediavine script loads normally, ads visible in article/recipe/video pages |
| Valid `lcdb_club` cookie | No Mediavine `<script>` in Network tab, `.mv-ad-slot` divs have `display:none`, no whitespace |
| Expired cookie | Ads reappear, header shows login button |
| Login with wrong credentials | Error message in modal, no cookie set |
| Login with valid Club credentials | Cookie set, page reloads, ads gone, header shows gold dot + first name |
| Logout | Cookie cleared, page reloads, ads return |
| Token expiring in < 24 h | Refresh endpoint called silently in background, new cookie set |
| Membership canceled (refresh) | `subscription_expired` error → cookie cleared → ads reappear on next load |
| Mobile | Club icon visible in mobile header, modal opens correctly, dismisses on backdrop tap |

---

## WordPress plugin prerequisite

The `lcdb-blog-auth` WordPress plugin must be installed and active on
`atelier-lacuisinedebernard.com` before this blog-side code will work.
The plugin file is at `/LCDB Atelier/lcdb-blog-auth/lcdb-blog-auth.php`.

After activation, verify the signing secret was auto-generated:

```bash
wp option get lcdb_blog_auth_secret
```

If empty, generate one manually:

```bash
wp option update lcdb_blog_auth_secret "$(openssl rand -base64 48)"
```
