// Middleware to protect routes that require authentication
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error_msg', 'Please log in to access this page.');
  return res.redirect('/auth/login');
};

// Middleware to redirect logged-in users away from guest pages (login/register)
const requireGuest = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  return next();
};

module.exports = {
  requireAuth,
  requireGuest
};
