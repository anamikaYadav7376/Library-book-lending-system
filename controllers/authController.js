const User = require('../models/User');

// GET /auth/signin (The unified landing page)
const getSignIn = (req, res) => {
  res.render('auth/signin', {
    title: 'Sign In - Library Management System'
  });
};

// GET /auth/register
const getRegister = (req, res) => {
  const roleQuery = req.query.role;

  // If no role query param is passed, redirect to role selection landing page
  if (!roleQuery) {
    return res.redirect('/auth/signin');
  }

  const role = roleQuery === 'staff' ? 'librarian' : 'member';

  res.render('auth/register', {
    title: `${role === 'librarian' ? 'Staff' : 'Student'} Registration`,
    errors: [],
    formData: {},
    role
  });
};

// POST /auth/register
const postRegister = async (req, res, next) => {
  const { name, email, password, confirmPassword, role } = req.body;
  const errors = [];
  const assignedRole = role === 'librarian' ? 'librarian' : 'member';

  if (!name || !name.trim()) errors.push('Name is required');
  if (!email || !email.trim()) errors.push('Email is required');
  if (!password) {
    errors.push('Password is required');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  if (password !== confirmPassword) errors.push('Passwords do not match');

  if (errors.length > 0) {
    return res.render('auth/register', {
      title: `${assignedRole === 'librarian' ? 'Staff' : 'Student'} Registration`,
      errors,
      formData: { name, email },
      role: assignedRole
    });
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      req.flash('error_msg', 'An account with this email address already exists. Please log in.');
      return res.redirect('/auth/login');
    }

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: assignedRole
    });

    await user.save();

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    req.flash('success_msg', `Welcome to the Library, ${user.name}! Your account has been created.`);
    return res.redirect('/dashboard');
  } catch (error) {
    next(error);
  }
};

// GET /auth/login
const getLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Login - Library Management System',
    errors: [],
    formData: {}
  });
};

// POST /auth/login
const postLogin = async (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || !email.trim()) errors.push('Please enter your email address');
  if (!password) errors.push('Please enter your password');

  if (errors.length > 0) {
    return res.render('auth/login', {
      title: 'Login - Library Management System',
      errors,
      formData: { email }
    });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.render('auth/login', {
        title: 'Login - Library Management System',
        errors: ['Invalid email or password'],
        formData: { email }
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Login - Library Management System',
        errors: ['Invalid email or password'],
        formData: { email }
      });
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    req.flash('success_msg', `Welcome back, ${user.name}!`);
    return res.redirect('/dashboard');
  } catch (error) {
    next(error);
  }
};

// Logout
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destruction error:', err);
    res.clearCookie('connect.sid');
    res.redirect('/auth/login');
  });
};

module.exports = {
  getSignIn,
  getRegister,
  postRegister,
  getLogin,
  postLogin,
  logout
};