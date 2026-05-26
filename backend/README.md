# CourseSim — Backend Setup Guide

## Folder Structure

```
CourseSim-main/
├── index.html
├── courses.html
├── admin.html
├── script.js            ← REPLACE with backend/script.js
├── style.css
├── ...
└── backend/             ← this folder
    ├── server.js
    ├── script.js        ← copy this file up one level to replace script.js
    ├── package.json
    └── data/
        ├── users.json
        ├── courses.json
        ├── enrollments.json
        └── requests.json
```

---

## Step 1 — Install dependencies

Open a terminal inside the `CourseSim-main/backend/` folder and run:

```bash
npm install
```

---

## Step 2 — Start the backend server

```bash
node server.js
```

You should see:

```
✅  CourseSim backend running on http://localhost:3000
```

Leave this terminal running while you use the app.

> **Optional:** Auto-restart on file changes:
> ```bash
> npm run dev
> ```

---

## Step 3 — Replace script.js in the frontend

Copy `backend/script.js` up one level into `CourseSim-main/`, replacing the original:

```bash
# Run from inside CourseSim-main/

copy backend\script.js script.js      # Windows CMD
cp   backend/script.js  script.js     # Mac / Linux / Git Bash
```

---

## Step 4 — Open the frontend

Open `CourseSim-main/index.html` in your browser.
The backend must already be running on port 3000.

> Quick static server option (keeps paths clean):
> ```bash
> npx serve .
> ```
> Then open http://localhost:3000 — wait, that's your API port.
> Use a different port for the frontend:
> ```bash
> npx serve . -p 5500
> ```
> Then visit http://localhost:5500

---

## Demo Accounts

| Role       | ID        | Password |
|------------|-----------|----------|
| Admin      | ADMIN-001 | admin123 |
| Registrar  | REG-001   | reg123   |
| Student    | Register on the app  |

---

## API Endpoints Reference

| Method | Endpoint            | Description                        |
|--------|---------------------|------------------------------------|
| POST   | /api/register       | Register a new student             |
| POST   | /api/login          | Login (any role)                   |
| GET    | /api/courses        | Get all courses + enrollment count |
| POST   | /api/courses        | Add a course (Admin)               |
| DELETE | /api/courses/:code  | Remove a course (Admin)            |
| GET    | /api/requests       | Get requests (filter by status/id) |
| POST   | /api/requests       | Submit enroll or drop request      |
| PATCH  | /api/requests/:id   | Approve or reject a request        |
| DELETE | /api/requests/:id   | Cancel a pending request           |
| GET    | /api/enrollments    | Get enrollments (filter by id)     |
| PATCH  | /api/grades         | Assign a grade                     |
| GET    | /api/users          | Get all students (Admin)           |
| DELETE | /api/users/:id      | Remove a student (Admin)           |
| GET    | /api/acad           | Get current academic period        |
| PUT    | /api/acad           | Set academic period (Admin)        |
| GET    | /api/stats          | Dashboard stats                    |

---

## Resetting Data

To wipe all data and start fresh, delete the contents of the JSON files in `/data`:

- `users.json` → restore the two system accounts (see original file)
- `courses.json` → restore the 4 default ICT courses
- `enrollments.json` → `[]`
- `requests.json` → `[]`
