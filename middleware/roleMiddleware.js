// Middleware to restrict access based on user role
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.flash('error_msg', 'Please log in to perform this action.');
      return res.redirect('/auth/login');
    }

    if (req.session.user.role !== requiredRole) {
      req.flash('error_msg', 'Access denied: You are not authorized to perform this action.');
      return res.status(403).render('errors/404', {
        title: '403 Forbidden - Access Denied',
        message: 'You do not have the required permissions to access this page.'
      });
    }

    next();
  };
};

module.exports = {
  requireRole
};
