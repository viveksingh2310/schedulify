# Automated tests

Use Node.js 22, matching the GitHub Actions workflow:

```sh
npm ci
npm test
```

The suite uses Node's built-in test runner; no extra dependencies or secrets are
required. Route tests run the real Express routers on a temporary loopback port,
use real bcrypt and JWT operations, and mock Mongoose operations and SendGrid
delivery. They never load `.env`, connect to MongoDB, or send real email. The
environment running the tests must permit local HTTP connections.

Covered behaviours include account forms, signup and password hashing, duplicate
accounts, successful and rejected logins, expired and malformed tokens,
authentication on protected booking routes, availability responses, appointment
creation, persistence/email failures, the user picker, and model validation.

These are focused route and model tests, not a full end-to-end suite. Database
query semantics, concurrent booking conflicts, the server startup/dashboard/
calendar routes, browser interactions, and complete edit/cancel/reschedule flows
are not covered. Passing tests do not resolve the previously identified ownership
checks, profile role editing, or booking consistency issues.

Every push runs dependency installation, JavaScript syntax checks, and `npm test`
in `.github/workflows/ci.yml`. A failing test fails CI; no tests are skipped or
configured to ignore failures. The workflow does not deploy the application.
