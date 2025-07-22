const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  withId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String, // 'HH:mm' format
    required: true
  },
  endTime: {
    type: String, // 'HH:mm' format
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
