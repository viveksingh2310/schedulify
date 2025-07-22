const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.getAllUserName = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(decoded._id);

    if (!currentUser) return res.status(401).json({ message: 'User not found' });

    const users = await User.find(
      { _id: { $ne: currentUser._id } },
      { name: 1 } // _id is included by default unless explicitly excluded
    );

    res.status(200).json(users); // [{ _id: 'abc123', name: 'Alice' }, ...]
  } catch (err) {
    console.error('Error fetching user names:', err.message);
    res.status(500).json({ message: 'Failed to retrieve user names' });
  }
};
exports.getUserProfile = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).render('error', { message: 'Unauthorized: No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(decoded._id).select('-password'); // Exclude password

    if (!currentUser) {
      return res.status(404).render('error', { message: 'User not found' });
    }

    res.render('profile', { user: currentUser });  // 👈 render profile.ejs with user object
  } catch (err) {
    console.error('Error fetching user profile:', err.message);
    res.status(500).render('error', { message: 'Failed to retrieve user profile' });
  }
};
exports.updateUser = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).render('error', { message: 'Unauthorized: No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded._id;

    // Extract updated fields from form
    const { email, designation, type } = req.body;

    // Optional: Validate fields if needed here

    // Update the user in the database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        email,
        designation,
        type,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).render('error', { message: 'User not found' });
    }

    // Render profile with updated data
    res.render('profile', { user: updatedUser });
  } catch (err) {
    console.error('Error updating user:', err.message);
    res.status(500).render('error', { message: 'Failed to update user profile' });
  }
};