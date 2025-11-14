# 📱 Suporte Mobile e Dark Mode

## ✨ Novidades Implementadas

### 1. **Dark Mode (Modo Escuro)** 🌙
- Toggle entre modo claro e escuro
- Preferência salva no localStorage
- Detecta preferência do sistema automaticamente
- Transições suaves entre temas
- Botão ☀️/🌙 no header

### 2. **Responsividade Mobile** 📱
- **Desktop** (> 960px): Menu lateral fixo
- **Tablet** (768px - 960px): Layout otimizado
- **Mobile** (< 768px): Menu hambúrguer com slide-in
- **Mobile pequeno** (< 480px): Layout compacto

### 3. **Melhorias de UX**
- Overlay escuro ao abrir menu mobile
- Fechamento automático do menu ao navegar
- Scrollbar customizada
- Inputs e selects com foco visual
- Animações e transições suaves

## 🎨 Variáveis CSS (Temas)

### Light Mode
```css
--color-bg-primary: #f8fafc
--color-bg-card: #ffffff
--color-text-primary: #0f172a
```

### Dark Mode
```css
--color-bg-primary: #0f172a
--color-bg-card: #1e293b
--color-text-primary: #f1f5f9
```

## 📁 Arquivos Modificados/Criados

### Novos Arquivos:
1. **`src/composables/useDarkMode.ts`**
   - Gerencia estado do dark mode
   - Salva preferência no localStorage
   - Aplica classe `dark` no `<html>`

2. **`frontend/MOBILE_DARKMODE_README.md`**
   - Documentação completa

### Arquivos Modificados:
1. **`src/App.vue`**
   - Menu responsivo com hamburger
   - Toggle de dark mode
   - Layout adaptável
   - Overlay para mobile

2. **`src/styles/main.css`**
   - CSS Variables para temas
   - Media queries responsivas
   - Scrollbar customizada
   - Inputs com foco visual

## 🚀 Como Usar

### Toggle Dark Mode
```vue
<script setup>
import { useDarkMode } from '@/composables/useDarkMode';

const { isDark, toggle } = useDarkMode();
</script>

<template>
  <button @click="toggle">
    {{ isDark ? '☀️' : '🌙' }}
  </button>
</template>
```

### Usar Variáveis CSS
```css
.meu-componente {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}
```

## 📱 Breakpoints

```css
/* Tablet */
@media (max-width: 960px) { }

/* Mobile */
@media (max-width: 768px) { }

/* Mobile pequeno */
@media (max-width: 480px) { }
```

## 🎯 Features Implementadas

### ✅ Dark Mode
- [x] Toggle entre claro/escuro
- [x] Salvar preferência
- [x] Detectar preferência do sistema
- [x] Variáveis CSS para todos os componentes
- [x] Transições suaves

### ✅ Responsividade
- [x] Menu lateral no desktop
- [x] Menu hambúrguer no mobile
- [x] Overlay no menu mobile
- [x] Layout adaptável
- [x] Tipografia responsiva (clamp)
- [x] Tabelas com scroll horizontal
- [x] Botões adaptáveis

### ✅ UX
- [x] Animações suaves
- [x] Scrollbar customizada
- [x] Foco visual em inputs
- [x] Hover states
- [x] Touch-friendly (iOS smooth scrolling)

## 🔧 Customização

### Adicionar Nova Cor ao Tema
Edite `src/styles/main.css`:

```css
:root {
  --minha-cor-light: #valor-claro;
}

:root.dark {
  --minha-cor-light: #valor-escuro;
}
```

### Ajustar Breakpoints
Edite os valores em `@media` conforme necessário.

## 📊 Compatibilidade

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (iOS 12+)
- ✅ Mobile browsers
- ✅ Tablets (iPad, Android)

## 🐛 Troubleshooting

### Dark mode não salva
Verifique se o localStorage está habilitado no navegador.

### Menu não fecha no mobile
Certifique-se de chamar `fecharMenuMobile()` no RouterLink.

### Cores não mudam
Verifique se está usando `var(--nome-da-variavel)` no CSS.

## 📚 Referências

- [CSS Variables](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [Media Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries)
- [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

---

**Desenvolvido para Fauna Safety** 🦅
**Mobile-First & Dark Mode Ready** 🌙📱
