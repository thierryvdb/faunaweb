import { ref, watch, onMounted } from 'vue';

const STORAGE_KEY = 'fauna-theme';
const isDark = ref(false);

export function useDarkMode() {
  const toggle = () => {
    isDark.value = !isDark.value;
    applyTheme();
  };

  const setDark = (value: boolean) => {
    isDark.value = value;
    applyTheme();
  };

  const applyTheme = () => {
    const html = document.documentElement;
    if (isDark.value) {
      html.classList.add('dark');
      localStorage.setItem(STORAGE_KEY, 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem(STORAGE_KEY, 'light');
    }
  };

  const loadTheme = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      isDark.value = saved === 'dark';
    } else {
      // Detecta preferência do sistema
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    applyTheme();
  };

  onMounted(() => {
    loadTheme();
  });

  return {
    isDark,
    toggle,
    setDark
  };
}
