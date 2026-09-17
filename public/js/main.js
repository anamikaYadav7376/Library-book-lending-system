/**
 * Library Management System - Client-side Utilities
 */

document.addEventListener('DOMContentLoaded', () => {
  // Auto-dismiss flash alerts after 5 seconds
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

  // Confirmation for book deletion
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

  // Confirmation for book returns
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
