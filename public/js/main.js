/**
 * Library Management System - Client-side Utilities
 * Includes Theme Management (Light/Dark mode) and Form Confirmations
 */

// Function to update the theme toggle button UI
function updateThemeToggleUI(theme) {
  const toggleBtn = document.getElementById('themeToggle');
  if (!toggleBtn) return;

  if (theme === 'dark') {
    toggleBtn.innerHTML = '<i class="bi bi-sun-fill text-warning"></i> <span class="d-none d-sm-inline">Light</span>';
    toggleBtn.setAttribute('title', 'Switch to Light Mode');
  } else {
    toggleBtn.innerHTML = '<i class="bi bi-moon-stars-fill text-light"></i> <span class="d-none d-sm-inline">Dark</span>';
    toggleBtn.setAttribute('title', 'Switch to Dark Mode');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Theme Switcher
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  updateThemeToggleUI(currentTheme);

  const toggleBtn = document.getElementById('themeToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';

      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('theme', nextTheme);
      updateThemeToggleUI(nextTheme);
    });
  }

  // 2. Auto-dismiss flash alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert-dismissible');
  alerts.forEach((alert) => {
    setTimeout(() => {
      try {
        const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
        if (bsAlert) {
          bsAlert.close();
        }
      } catch (e) {
        alert.remove();
      }
    }, 5000);
  });

  // 3. Confirmation for book deletion
  const deleteForms = document.querySelectorAll('.confirm-delete-form');
  deleteForms.forEach((form) => {
    form.addEventListener('submit', (e) => {
      const bookTitle = form.getAttribute('data-book-title') || 'this book';
      const confirmed = window.confirm(`Are you sure you want to delete "${bookTitle}"? This action cannot be undone.`);
      if (!confirmed) {
        e.preventDefault();
      }
    });
  });

  // 4. Confirmation for book returns
  const returnForms = document.querySelectorAll('.confirm-return-form');
  returnForms.forEach((form) => {
    form.addEventListener('submit', (e) => {
      const bookTitle = form.getAttribute('data-book-title') || 'this book';
      const confirmed = window.confirm(`Confirm return for "${bookTitle}"?`);
      if (!confirmed) {
        e.preventDefault();
      }
    });
  });
});
