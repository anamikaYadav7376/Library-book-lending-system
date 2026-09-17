// 404 Not Found Middleware
const notFoundHandler = (req, res, next) => {
  res.status(404).render('errors/404', {
    title: '404 - Page Not Found',
    message: 'The page you are looking for does not exist or has been moved.'
  });
};

// 500 Internal Server Error Middleware
const errorHandler = (err, req, res, next) => {
  console.error('Server Error:', err.stack || err.message || err);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).render('errors/500', {
    title: '500 - Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred on the server. Please try again later.' 
      : err.message || 'Internal Server Error'
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
