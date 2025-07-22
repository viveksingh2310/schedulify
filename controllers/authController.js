const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.signup = async (req, res) => {
  const { name, email, password, designation, profileUrl } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send('User with this email already exists.');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      designation,
      profileUrl,
      type: 'user',           // default user type
      appointments: [],        // empty initially
    });
    await newUser.save();
    res.redirect('/login');
  } catch (err) {
    console.error('Signup Error:', err);
    res.status(400).send('Error signing up: ' + err.message);
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).send('User not found');

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).send('Incorrect password');

  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.cookie('token', token).redirect('/dashboard');
};

