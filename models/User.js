const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  designation: { type: String, default: 'user' },
  type: { type: String, enum: ['user', 'admin'], default: 'user' },
  profileUrl: { type: String },
  appointments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
