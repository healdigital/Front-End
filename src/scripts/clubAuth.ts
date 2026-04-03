const COOKIE_NAME = 'lcdb_club';
const COOKIE_TTL = 60 * 60 * 24 * 7;
const API_BASE = import.meta.env.PUBLIC_CLUB_AUTH_API as string | undefined;
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface JwtPayload {
  sub: number;
  email: string;
  name: string;
  plan: string;
  exp: number;
  iss: string;
}

function setCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; secure; samesite=lax`;
}

function clearCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0`;
}

function getCookie(name: string): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? match.split('=').slice(1).join('=') : null;
}

function decodeBase64Url(value: string): string | null {
  try {
    let normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4;
    if (padding) {
      normalized += '='.repeat(4 - padding);
    }
    return atob(normalized);
  } catch {
    return null;
  }
}

function parseJwt(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const decoded = decodeBase64Url(parts[1]);
  if (!decoded) return null;

  try {
    return JSON.parse(decoded) as JwtPayload;
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
  return payload.exp - Math.floor(Date.now() / 1000) < 60 * 60 * 24;
}

function updateHeaderUI(member: { name: string } | null): void {
  const loginTriggers = document.querySelectorAll<HTMLElement>('[data-club-login-trigger]');
  const memberStatus = document.querySelector<HTMLElement>('[data-club-member-status]');
  const memberNameEl = document.querySelector<HTMLElement>('[data-club-member-name]');

  if (member) {
    loginTriggers.forEach((element) => element.classList.add('hidden'));
    if (memberStatus) {
      memberStatus.classList.remove('hidden');
      memberStatus.classList.add('flex');
    }
    if (memberNameEl) {
      memberNameEl.textContent = member.name.split(' ')[0] || member.name;
    }
  } else {
    loginTriggers.forEach((element) => element.classList.remove('hidden'));
    if (memberStatus) {
      memberStatus.classList.add('hidden');
      memberStatus.classList.remove('flex');
    }
    if (memberNameEl) {
      memberNameEl.textContent = '';
    }
  }
}

function resetForm(): void {
  const form = document.getElementById('club-modal-form') as HTMLFormElement | null;
  const error = document.getElementById('club-modal-error') as HTMLElement | null;
  const submit = document.getElementById('club-modal-submit') as HTMLButtonElement | null;

  form?.reset();
  if (error) {
    error.textContent = '';
    error.classList.add('hidden');
  }
  if (submit) {
    submit.disabled = false;
    submit.textContent = 'Se connecter';
  }
}

function showError(message: string): void {
  const error = document.getElementById('club-modal-error');
  if (!error) return;
  error.textContent = message;
  error.classList.remove('hidden');
}

function openModal(dialog: HTMLDialogElement): void {
  if (!dialog.open) dialog.showModal();
  dialog.classList.remove('hidden');
  dialog.classList.add('flex');
  document.body.style.overflow = 'hidden';

  const firstFocusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  window.setTimeout(() => firstFocusable?.focus(), 0);
}

function closeModal(dialog: HTMLDialogElement, reset = true): void {
  if (dialog.open) dialog.close();
  dialog.classList.add('hidden');
  dialog.classList.remove('flex');
  document.body.style.overflow = '';
  if (reset) resetForm();
}

async function login(email: string, password: string): Promise<void> {
  const submit = document.getElementById('club-modal-submit') as HTMLButtonElement | null;

  if (!API_BASE) {
    showError('Configuration Club manquante.');
    return;
  }

  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Connexion...';
  }

  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const message =
        data.error === 'invalid_credentials'
          ? 'Email ou mot de passe incorrect.'
          : data.error === 'no_active_subscription'
            ? 'Aucun abonnement Club actif trouvé pour ce compte.'
            : data.error === 'too_many_attempts'
              ? 'Trop de tentatives. Réessayez dans 5 minutes.'
              : data.message ?? 'Une erreur est survenue. Réessayez.';

      showError(message);
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Se connecter';
      }
      return;
    }

    setCookie(COOKIE_NAME, data.token, COOKIE_TTL);
    window.location.reload();
  } catch {
    showError('Erreur réseau. Vérifiez votre connexion et réessayez.');
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Se connecter';
    }
  }
}

function logout(): void {
  clearCookie(COOKIE_NAME);
  window.location.reload();
}

async function maybeRefreshToken(): Promise<void> {
  const token = getCookie(COOKIE_NAME);
  if (!token) return;

  const payload = isTokenValid(token);
  if (!payload) {
    clearCookie(COOKIE_NAME);
    updateHeaderUI(null);
    return;
  }

  updateHeaderUI({ name: payload.name });

  if (!API_BASE || !isTokenExpiringWithin24h(payload)) return;

  try {
    const response = await fetch(`${API_BASE}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await response.json();

    if (response.ok && data.success && data.token) {
      setCookie(COOKIE_NAME, data.token, COOKIE_TTL);
    } else if (data.error === 'subscription_expired') {
      clearCookie(COOKIE_NAME);
      updateHeaderUI(null);
    }
  } catch {
    // Keep the existing token and try again on a future visit.
  }
}

function init(): void {
  const dialog = document.getElementById('club-login-modal') as HTMLDialogElement | null;
  if (!dialog) return;

  const closeBtn = document.getElementById('club-modal-close');
  const form = document.getElementById('club-modal-form') as HTMLFormElement | null;
  const panel = dialog.querySelector<HTMLElement>('[data-modal-panel]');

  document.querySelectorAll<HTMLElement>('[data-club-login-trigger]').forEach((button) => {
    button.addEventListener('click', () => openModal(dialog));
  });

  document.querySelectorAll<HTMLElement>('[data-club-logout-trigger]').forEach((button) => {
    button.addEventListener('click', logout);
  });

  closeBtn?.addEventListener('click', () => closeModal(dialog));

  dialog.addEventListener('click', (event) => {
    if (panel && panel.contains(event.target as Node)) return;
    closeModal(dialog);
  });

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeModal(dialog);
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((element) => !element.hasAttribute('disabled'));

    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const emailInput = document.getElementById('club-modal-email') as HTMLInputElement | null;
    const passwordInput = document.getElementById('club-modal-password') as HTMLInputElement | null;
    const errorEl = document.getElementById('club-modal-error');

    if (!emailInput || !passwordInput) return;

    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }

    await login(emailInput.value.trim(), passwordInput.value);
  });

  void maybeRefreshToken();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
