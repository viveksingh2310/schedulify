const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  createAppointment,
  cancelAppointment,
  rescheduleAppointment,
  getAppointments,
  getCreateAppointment,
  checkSlotAvailability,
  getOneAppointment,
  editAppointment,
  checkAvailability
} = require('../controllers/appointmentController');

router.get('/', auth, getAppointments);
router.get('/create',getCreateAppointment);
router.get('/:id',getOneAppointment);
router.post('/:id/edit',editAppointment);
// router.get('/create-appointment')
router.post('/check-availability', auth, checkAvailability);
router.post('/create', auth,checkSlotAvailability,createAppointment);
router.post('/reschedule/:id', auth, checkSlotAvailability, rescheduleAppointment);
router.post('/cancel/:id', auth, cancelAppointment);

module.exports = router;