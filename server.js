require('dotenv').config();
const Appointment = require('./models/Appointment');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));
const userRoutes=require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');

app.use('/', authRoutes);
app.use('/appointments', appointmentRoutes);
app.use('/users',userRoutes);

app.get('/calendar', async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const appointments = await Appointment.find({ createdBy: decoded._id });
    const user = await User.findById(decoded._id); // ✅ Get the user details
    const calendarEvents = appointments.map(appt => ({
      title: appt.title,
      start: `${appt.date.toISOString().split('T')[0]}T${appt.startTime}`,
      end: `${appt.date.toISOString().split('T')[0]}T${appt.endTime}`,
      description: appt.description
    }));
    res.render('calendar', { appointments, calendarEvents, user });
  } catch (err) {
    console.error('Calendar Route Error:', err);
    res.redirect('/login');
  }
});
app.get('/dashboard', async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id);

    if (!user) return res.redirect('/login');

    res.render('dashboard', { user });
  } catch (err) {
    console.error('JWT Decode Error:', err.message);
    res.redirect('/login');
  }
});

// app.get('/create-appointment', (req, res) => {
//   res.render('create-appointment');
// });
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
