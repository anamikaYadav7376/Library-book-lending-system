const User = require('../models/User');

// GET /auth/register
const getRegister = (req, res) => {
  res.render('auth/register', {
    title: 'Member Registration - Library Management System',
    errors: [],
    formData: {}
  });
};

// POST /auth/register
const postRegister = async (req, res, next) => {
  const { name, email, password, confirmPassword } = req.body;
  const errors = [];

  if (!name || !name.trim()) {
    errors.push('Name is required');
  }
  if (!email || !email.trim()) {
    errors.push('Email is required');
  }
  if (!password) {
    errors.push('Password is required');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }

  if (errors.length > 0) {
    return res.render('auth/register', {
      title: 'Member Registration - Library Management System',
      errors,
      formData: { name, email }
    });
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.render('auth/register', {
        title: 'Member Registration - Library Management System',
        errors: ['An account with this email address already exists'],
        formData: { name, email }
      });
    }

    // Role is strictly 'member' for public registration
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'member'
    });

    await user.save();

    // Auto-login newly registered user
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

  if (!email || !email.trim()) {
    errors.push('Please enter your email address');
  }
  if (!password) {
    errors.push('Please enter your password');
  }

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

    // Store user session info
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

// POST /auth/logout or GET /auth/logout
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
    }
    res.clearCookie('connect.sid');
    res.redirect('/auth/login');
  });
};

module.exports = {
  getRegister,
  postRegister,
  getLogin,
  postLogin,
  logout
};
