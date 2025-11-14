import { ref, computed } from 'vue';

const STORAGE_KEY = 'fauna-theme';
const isDark = ref(false);

// Detecta se está em mobile (768px ou menos)
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 768;
};

const applyTheme = () => {
  if (typeof document === 'undefined') return; // SSR safety

  const html = document.documentElement;

  // Desktop sempre dark
  if (!isMobile()) {
    html.classList.add('dark');
    isDark.value = true;
    return;
  }

  // Mobile: aplica escolha do usuário
  if (isDark.value) {
    html.classList.add('dark');
    localStorage.setItem(STORAGE_KEY, 'dark');
  } else {
    html.classList.remove('dark');
    localStorage.setItem(STORAGE_KEY, 'light');
  }
};

const loadTheme = () => {
  if (typeof window === 'undefined') return; // SSR safety

  // Desktop sempre dark
  if (!isMobile()) {
    isDark.value = true;
    applyTheme();
    return;
  }

  // Mobile: carrega preferência salva
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    isDark.value = saved === 'dark';
  } else {
    // Detecta preferência do sistema
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  applyTheme();
};

// Initialize theme immediately when module loads
loadTheme();

// Atualiza tema ao redimensionar janela
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    applyTheme();
  });
}

export function useDarkMode() {
  const toggle = () => {
    // Só permite toggle no mobile
    if (!isMobile()) return;

    isDark.value = !isDark.value;
    applyTheme();
  };

  const setDark = (value: boolean) => {
    // Só permite alteração no mobile
    if (!isMobile()) return;

    isDark.value = value;
    applyTheme();
  };

  // Computed para saber se pode alterar o tema
  const canToggle = computed(() => isMobile());

  return {
    isDark,
    toggle,
    setDark,
    canToggle
  };
}
