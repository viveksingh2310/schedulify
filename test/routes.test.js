const { test, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Never load .env or connect to a real database in this suite.
process.env.JWT_SECRET = 'test-only-signing-secret';
process.env.SENDGRID_API_KEY = 'SG.test-only.not-a-real-key';
process.env.EMAIL_USER = 'sender@example.test';
mongoose.set('bufferCommands', false);

const User = require('../models/User');
const Appointment = require('../models/Appointment');
const sgMail = require('@sendgrid/mail');
const authRoutes = require('../routes/authRoutes');
const appointmentRoutes = require('../routes/appointmentRoutes');
const userRoutes = require('../routes/userRoutes');

const creatorId = '507f1f77bcf86cd799439011';
const participantId = '507f1f77bcf86cd799439012';
const booking = {
  title: 'Project meeting', description: 'Plan the release',
  withId: participantId, date: '2030-06-15', startTime: '10:00', endTime: '11:00',
};
let server;
let baseUrl;
let passwordHash;

before(async () => {
  passwordHash = await bcrypt.hash('correct-password', 10);
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use('/', authRoutes);
  app.use('/appointments', appointmentRoutes);
  app.use('/users', userRoutes);
  app.use((err, req, res, next) => res.status(500).send('Internal Server Error'));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  mock.restoreAll();
  // Unexpected email delivery fails instead of reaching the network.
  mock.method(sgMail, 'send', async () => { throw new Error('Unexpected email call'); });
  mock.method(console, 'error', () => {});
  mock.method(console, 'log', () => {});
});

after(async () => {
  mock.restoreAll();
  if (server) await new Promise((resolve, reject) => {
    server.close(err => err ? reject(err) : resolve());
    server.closeAllConnections();
  });
});

function token(options = {}) {
  return jwt.sign({ _id: creatorId }, process.env.JWT_SECRET, { expiresIn: '1h', ...options });
}

async function request(route, { body, authenticated = false, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(5000),
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' }),
      ...(authenticated ? { Cookie: `token=${token()}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : new URLSearchParams(body),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, text };
}

for (const route of ['/', '/signup']) {
  test(`GET ${route} renders an account form`, async () => {
    const res = await request(route);
    assert.equal(res.status, 200);
    assert.match(res.text, /<form/);
    assert.match(res.text, /name="password"/);
  });
}

test('signup hashes the password and creates an ordinary user', async () => {
  mock.method(User, 'findOne', async () => null);
  let saved;
  mock.method(User.prototype, 'save', async function () { saved = this; return this; });
  const res = await request('/signup', { body: {
    name: 'Alice', email: 'alice@example.test', password: 'correct-password', type: 'admin',
  } });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/');
  assert.equal(saved.email, 'alice@example.test');
  assert.equal(saved.type, 'user');
  assert.notEqual(saved.password, 'correct-password');
  assert.equal(await bcrypt.compare('correct-password', saved.password), true);
});

test('signup rejects an existing email without saving another user', async () => {
  mock.method(User, 'findOne', async () => ({ _id: creatorId }));
  const save = mock.method(User.prototype, 'save', async () => {});
  const res = await request('/signup', { body: { email: 'alice@example.test', password: 'secret' } });
  assert.equal(res.status, 400);
  assert.match(res.text, /already exists/);
  assert.equal(save.mock.callCount(), 0);
});

test('login issues a signed expiring token and redirects to dashboard', async () => {
  mock.method(User, 'findOne', async () => ({ _id: creatorId, password: passwordHash }));
  const res = await request('/login', { body: { email: 'alice@example.test', password: 'correct-password' } });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/dashboard');
  const cookie = res.headers.get('set-cookie');
  assert.ok(cookie);
  const decoded = jwt.verify(cookie.match(/token=([^;]+)/)[1], process.env.JWT_SECRET);
  assert.equal(decoded._id, creatorId);
  assert.equal(decoded.exp - decoded.iat, 86400);
});

for (const scenario of ['unknown user', 'wrong password']) {
  test(`login rejects ${scenario} without setting a cookie`, async () => {
    mock.method(User, 'findOne', async () => scenario === 'unknown user' ? null : { password: passwordHash });
    const res = await request('/login', { body: { email: 'alice@example.test', password: 'incorrect' } });
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('set-cookie'), null);
  });
}

for (const route of ['/appointments/create', '/appointments/check-availability', '/appointments/cancel/507f1f77bcf86cd799439013', '/appointments/reschedule/507f1f77bcf86cd799439013']) {
  test(`POST ${route} requires authentication`, async () => {
    const res = await request(route, { body: booking });
    assert.equal(res.status, 401);
  });
}

test('protected routes reject tampered and expired tokens', async () => {
  for (const value of ['invalid-token', token({ expiresIn: -1 })]) {
    const res = await request('/appointments', { headers: { Cookie: `token=${value}` } });
    assert.equal(res.status, 400);
  }
});

test('availability accepts bearer authentication', async () => {
  mock.method(Appointment, 'findOne', async () => null);
  const res = await request('/appointments/check-availability', {
    body: booking, headers: { Authorization: `Bearer ${token()}` },
  });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(res.text).available, true);
});

for (const date of ['', 'not-a-date']) {
  test(`availability rejects invalid date ${JSON.stringify(date)} before querying`, async () => {
    const find = mock.method(Appointment, 'findOne', async () => null);
    const res = await request('/appointments/check-availability', { authenticated: true, body: { ...booking, date } });
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(res.text).available, false);
    assert.equal(find.mock.callCount(), 0);
  });
}

test('availability reports a database conflict', async () => {
  mock.method(Appointment, 'findOne', async () => ({ ...booking }));
  const res = await request('/appointments/check-availability', { authenticated: true, body: booking });
  assert.equal(res.status, 409);
  assert.equal(JSON.parse(res.text).available, false);
});

test('availability reports database failure instead of claiming the slot is free', async () => {
  mock.method(Appointment, 'findOne', async () => { throw new Error('Database unavailable'); });
  const res = await request('/appointments/check-availability', { authenticated: true, body: booking });
  assert.equal(res.status, 500);
  assert.equal(JSON.parse(res.text).available, false);
});

test('creation rejects missing slot fields without saving', async () => {
  const save = mock.method(Appointment.prototype, 'save', async () => {});
  const res = await request('/appointments/create', { authenticated: true, body: { title: 'Meeting' } });
  assert.equal(res.status, 400);
  assert.equal(save.mock.callCount(), 0);
});

test('creation rejects an occupied slot without saving or sending email', async () => {
  mock.method(Appointment, 'find', async () => [{ ...booking }]);
  const save = mock.method(Appointment.prototype, 'save', async () => {});
  const res = await request('/appointments/create', { authenticated: true, body: booking });
  assert.equal(res.status, 409);
  assert.equal(save.mock.callCount(), 0);
  assert.equal(sgMail.send.mock.callCount(), 0);
});

for (const emailFails of [false, true]) {
  test(`creation saves for both users when email ${emailFails ? 'fails' : 'succeeds'}`, async () => {
    mock.method(Appointment, 'find', async () => []);
    let saved;
    mock.method(Appointment.prototype, 'save', async function () { saved = this; return this; });
    const update = mock.method(User, 'findByIdAndUpdate', async () => ({}));
    mock.method(User, 'findById', async () => ({ email: 'bob@example.test' }));
    const send = mock.method(sgMail, 'send', async () => {
      if (emailFails) throw new Error('Email provider unavailable');
      return [{}];
    });
    const res = await request('/appointments/create', { authenticated: true, body: { ...booking, createdBy: participantId } });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/calendar');
    assert.equal(String(saved.createdBy), creatorId);
    assert.equal(saved.title, booking.title);
    assert.equal(update.mock.callCount(), 2);
    assert.deepEqual(update.mock.calls.map(call => String(call.arguments[0])), [creatorId, participantId]);
    for (const call of update.mock.calls) {
      assert.equal(String(call.arguments[1].$push.appointments), String(saved._id));
    }
    assert.equal(send.mock.callCount(), 1);
    assert.equal(send.mock.calls[0].arguments[0].to, 'bob@example.test');
    assert.match(send.mock.calls[0].arguments[0].text, /Project meeting/);
  });
}

test('failed appointment save returns an error without updating users or sending email', async () => {
  mock.method(Appointment, 'find', async () => []);
  mock.method(Appointment.prototype, 'save', async () => { throw new Error('Write failed'); });
  const update = mock.method(User, 'findByIdAndUpdate', async () => ({}));
  const res = await request('/appointments/create', { authenticated: true, body: booking });
  assert.equal(res.status, 500);
  assert.equal(update.mock.callCount(), 0);
  assert.equal(sgMail.send.mock.callCount(), 0);
});

test('user picker returns users other than the signed-in user', async () => {
  mock.method(User, 'findById', async () => ({ _id: creatorId }));
  const find = mock.method(User, 'find', async () => [{ _id: participantId, name: 'Bob' }]);
  const res = await request('/users/nameId', { authenticated: true });
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.text), [{ _id: participantId, name: 'Bob' }]);
  assert.deepEqual(find.mock.calls[0].arguments, [{ _id: { $ne: creatorId } }, { name: 1 }]);
});
