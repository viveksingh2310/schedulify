const Appointment = require('../models/Appointment');
const User = require('../models/User');
const sendMail = require('../utils/sendMail');
const jwt = require('jsonwebtoken');

exports.getCreateAppointment = async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id);

    if (!user) return res.redirect('/login');

    res.render('create-appointment', { user });
  } catch (err) {
    console.error('Error rendering create-appointment:', err.message);
    res.redirect('/login');
  }
};
exports.editAppointment = async (req, res) => {
  const { id } = req.params;
  const { title, description, date, startTime, endTime, withId } = req.body;

  try {
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).send('Appointment not found');
    }

    // Update fields
    appointment.title = title;
    appointment.description = description;
    appointment.date = date;
    appointment.startTime = startTime;
    appointment.endTime = endTime;
    appointment.withId = withId;

    await appointment.save();

    res.redirect('/appointments'); // redirect to appointments listing after successful edit
  } catch (err) {
    console.error('Error updating appointment:', err.message);
    res.status(500).send('Internal Server Error');
  }
};
exports.createAppointment = async (req, res) => {
  try {
    const { title, description, withId, date, startTime, endTime } = req.body;

    const appointment = new Appointment({
      title,
      description,
      withId,
      createdBy: req.user._id,
      date,
      startTime,
      endTime
    });
    await appointment.save();
    await User.findByIdAndUpdate(req.user._id, { $push: { appointments: appointment._id } });
    await User.findByIdAndUpdate(withId, { $push: { appointments: appointment._id } });

    const withUser = await User.findById(withId);
    if (withUser) {
      await sendMail(withUser.email, 'New Appointment', `You have a new appointment scheduled: ${title}`);
    }

    res.redirect('/calendar');
  } catch (err) {
    console.error('Error creating appointment:', err.message);
    res.status(500).send('Failed to create appointment');
  }
};
exports.checkAvailability = async (req, res) => {
  const { date, startTime, endTime, withId } = req.body;
// console.log('date in server is '+date+'  '+withId);
  try {
    if (!date) {
      return res.status(400).json({ available: false, message: 'Invalid date format.' });
    }

    // Parse as date only
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ available: false, message: 'Invalid date.' });
    }

    const dayStart = new Date(parsedDate);
    dayStart.setUTCHours(0, 0, 0, 0);

    const dayEnd = new Date(parsedDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const existing = await Appointment.findOne({
      withId,
      date: { $gte: dayStart, $lte: dayEnd },
      $or: [
        {
          startTime: { $lte: startTime },
          endTime: { $gt: startTime }
        },
        {
          startTime: { $lt: endTime },
          endTime: { $gte: endTime }
        },
        {
          startTime: { $gte: startTime },
          endTime: { $lte: endTime }
        }
      ]
    });

    if (existing) {
      return res.status(409).json({ available: false, message: 'Slot already booked' });
    }

    return res.status(200).json({ available: true, message: 'Slot available' });
  } catch (err) {
    console.error('Error checking slot availability:', err.message);
    return res.status(500).json({ available: false, message: 'Server error' });
  }
};
exports.checkSlotAvailability =  async (req, res, next) => {
  const { withId, date, startTime, endTime } = req.body;

  // Ensure all required fields are present
  if (!withId || !date || !startTime || !endTime) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    const appointments = await Appointment.find({
      withId,
      date: new Date(date), // Only check for same date
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ]
    });
    if (appointments.length > 0) {
      return res.status(409).json({ message: 'Time slot not available' });
    }
    next();
  } catch (err) {
    console.error('Slot check error:', err.message);
    res.status(500).json({ message: 'Server error while checking slot availability' });
  }
};
exports.cancelAppointment = async (req, res) => {
  const { id } = req.params;
  const appointment = await Appointment.findById(id);

  if (!appointment) return res.status(404).send("Not found");

  await Appointment.findByIdAndDelete(id);

  await sendMail(req.user.email, 'Appointment Cancelled', `Your appointment "${appointment.title}" has been cancelled.`);
  res.redirect('/calendar');
};
exports.getAppointments = async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded._id).populate({
      path: 'appointments',
      populate: [
        { path: 'withId', select: 'name email' },
        { path: 'createdBy', select: 'name email' }
      ]
    });

    if (!user) return res.redirect('/login');

    res.render('appointments', {
      user,
      appointments: user.appointments || []
    });
  } catch (err) {
    console.error('Error fetching appointments:', err.message);
    res.redirect('/login');
  }
};
exports.getOneAppointment = async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id).populate({
      path: 'appointments',
      populate: [
        { path: 'withId', select: 'name email' },
        { path: 'createdBy', select: 'name email' }
      ]
    });
    if (!user) return res.status(401).json({ message: 'User not found' });
    const appointmentId = req.params.id;
    const appointment = await Appointment.findById(appointmentId)
      .populate({ path: 'withId', select: 'name email' })
      .populate({ path: 'createdBy', select: 'name email' });
    if (!appointment)
      return res.status(404).json({ message: 'Appointment not found' });
    // You can either render a view or return JSON:
    res.render('appointment', { user, appointment });
    // res.json({ user, appointment });

  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime } = req.body;

    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { date, startTime, endTime },
      { new: true }
    ).populate('withId');

    if (!appointment) {
      return res.status(404).send('Appointment not found');
    }

    // Notify both users (creator and the participant)
    await sendMail(req.user.email, 'Appointment Rescheduled', `Your appointment "${appointment.title}" has been rescheduled.`);
    
    if (appointment.withId && appointment.withId.email) {
      await sendMail(appointment.withId.email, 'Appointment Rescheduled', `The appointment "${appointment.title}" has been rescheduled.`);
    }

    res.redirect('/calendar');
  } catch (err) {
    console.error('Error rescheduling appointment:', err.message);
    res.status(500).send('Failed to reschedule appointment');
  }
};

