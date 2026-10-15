const { test } = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const Appointment = require('../models/Appointment');

test('user requires name, email, and password', () => {
  const error = new User({}).validateSync();
  for (const field of ['name', 'email', 'password']) assert.ok(error.errors[field]);
});

test('user defaults to ordinary role and rejects unknown roles', () => {
  const user = new User({ name: 'Alice', email: 'alice@example.test', password: 'hashed' });
  assert.equal(user.validateSync(), undefined);
  assert.equal(user.type, 'user');
  assert.deepEqual(user.appointments.toObject(), []);
  user.type = 'superuser';
  assert.ok(user.validateSync().errors.type);
});

test('appointment requires title, participants, date, and times', () => {
  const error = new Appointment({}).validateSync();
  for (const field of ['title', 'createdBy', 'withId', 'date', 'startTime', 'endTime']) {
    assert.ok(error.errors[field], `${field} must be required`);
  }
});

test('appointment accepts valid fields and rejects malformed identifiers and dates', () => {
  const appointment = new Appointment({
    title: 'Meeting', createdBy: '507f1f77bcf86cd799439011', withId: '507f1f77bcf86cd799439012',
    date: '2030-06-15', startTime: '10:00', endTime: '11:00',
  });
  assert.equal(appointment.validateSync(), undefined);
  appointment.withId = 'invalid-id';
  appointment.date = 'invalid-date';
  const error = appointment.validateSync();
  assert.ok(error.errors.withId);
  assert.ok(error.errors.date);
});
