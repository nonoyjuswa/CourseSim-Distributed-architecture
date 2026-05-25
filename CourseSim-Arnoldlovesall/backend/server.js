/*  ============================================================
    CourseSim — Backend Server
    Stack : Node.js + Express
    Data  : JSON flat files in /data
    Port  : 3000  (change via PORT env var)
    ============================================================ */

const express = require("express");
const cors    = require("cors");
const fs      = require("fs");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());          // allow requests from the browser frontend
app.use(express.json());  // parse JSON request bodies

// ── File helpers ──────────────────────────────────────────────
const dataPath = (file) => path.join(__dirname, "data", file);

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(dataPath(file), "utf8"));
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(dataPath(file), JSON.stringify(data, null, 2));
}

// ── Constants ─────────────────────────────────────────────────
const PASSING_GRADE = 75;

// ── Helper: generate a student ID ────────────────────────────
function generateStudentId(users) {
  const year    = new Date().getFullYear();
  const seq     = String(users.filter((u) => u.role === "student").length + 1).padStart(4, "0");
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letter  = letters[Math.floor(Math.random() * 26)];
  return `${year}-${seq}-${letter}`;
}

// =============================================================
// AUTH ROUTES
// =============================================================

// POST /api/register
// Body: { name, password, yearLevel }
app.post("/api/register", (req, res) => {
  const { name, password, yearLevel } = req.body;

  if (!name || !password || !yearLevel)
    return res.status(400).json({ error: "Please fill in all fields." });

  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters." });

  const users = readJSON("users.json");

  // Generate a unique ID
  let id, attempts = 0;
  do { id = generateStudentId(users); attempts++; }
  while (users.some((u) => u.id === id) && attempts < 20);

  const newUser = { id, name, password, role: "student", yearLevel };
  users.push(newUser);
  writeJSON("users.json", users);

  // Return user without password
  const { password: _pw, ...safeUser } = newUser;
  res.status(201).json({ message: "Registration successful.", user: safeUser });
});

// POST /api/login
// Body: { id, password }
app.post("/api/login", (req, res) => {
  const { id, password } = req.body;

  if (!id || !password)
    return res.status(400).json({ error: "Please enter your ID and password." });

  const users = readJSON("users.json");
  const user  = users.find((u) => u.id === id && u.password === password);

  if (!user)
    return res.status(401).json({ error: "Invalid ID or password." });

  const { password: _pw, ...safeUser } = user;
  res.json({ message: "Login successful.", user: safeUser });
});

// =============================================================
// COURSE ROUTES
// =============================================================

// GET /api/courses
// Returns all courses with current enrollment counts
app.get("/api/courses", (req, res) => {
  const courses     = readJSON("courses.json");
  const enrollments = readJSON("enrollments.json");

  const enriched = courses.map((course) => ({
    ...course,
    enrolledCount: enrollments.filter(
      (e) => e.courseCode === course.code && e.active
    ).length,
  }));

  res.json(enriched);
});

// POST /api/courses  (Admin only — enforced on frontend by role)
// Body: { code, title, capacity, prerequisite }
app.post("/api/courses", (req, res) => {
  const { code, title, capacity, prerequisite } = req.body;

  if (!code || !title || !capacity || capacity < 1)
    return res.status(400).json({ error: "Fill in code, title, and capacity (≥ 1)." });

  const courses = readJSON("courses.json");

  if (courses.find((c) => c.code.toUpperCase() === code.toUpperCase()))
    return res.status(409).json({ error: "Course code already exists." });

  const newCourse = {
    code: code.toUpperCase(),
    title,
    capacity: Number(capacity),
    prerequisite: prerequisite?.toUpperCase() || null,
  };

  courses.push(newCourse);
  writeJSON("courses.json", courses);
  res.status(201).json({ message: `Course ${newCourse.code} added.`, course: newCourse });
});

// DELETE /api/courses/:code  (Admin only)
app.delete("/api/courses/:code", (req, res) => {
  const code        = req.params.code.toUpperCase();
  const courses     = readJSON("courses.json");
  const enrollments = readJSON("enrollments.json");

  if (enrollments.some((e) => e.courseCode === code && e.active))
    return res.status(400).json({ error: `Cannot remove ${code}: students are currently enrolled.` });

  const updated = courses.filter((c) => c.code.toUpperCase() !== code);
  if (updated.length === courses.length)
    return res.status(404).json({ error: "Course not found." });

  writeJSON("courses.json", updated);
  res.json({ message: `Course ${code} removed.` });
});

// =============================================================
// ENROLLMENT REQUEST ROUTES
// =============================================================

// GET /api/requests
// Query params: ?status=pending|approved|rejected  and/or  ?studentId=xxx
app.get("/api/requests", (req, res) => {
  let requests = readJSON("requests.json");

  if (req.query.status)
    requests = requests.filter((r) => r.status === req.query.status);

  if (req.query.studentId)
    requests = requests.filter((r) => r.studentId === req.query.studentId);

  res.json(requests);
});

// POST /api/requests
// Body: { studentId, studentName, courseCode, type: "enroll"|"drop", schoolYear, semester }
app.post("/api/requests", (req, res) => {
  const { studentId, studentName, courseCode, type, schoolYear, semester } = req.body;

  if (!studentId || !courseCode || !type)
    return res.status(400).json({ error: "Missing required fields." });

  const courses     = readJSON("courses.json");
  const enrollments = readJSON("enrollments.json");
  const requests    = readJSON("requests.json");

  const course = courses.find(
    (c) => c.code.toLowerCase() === courseCode.toLowerCase()
  );
  if (!course) return res.status(404).json({ error: "Course not found." });

  if (type === "enroll") {
    // Check capacity
    const activeCount = enrollments.filter(
      (e) => e.courseCode === course.code && e.active
    ).length;
    if (activeCount >= course.capacity)
      return res.status(400).json({ error: "Course is full." });

    // Check already enrolled
    if (enrollments.some((e) => e.studentId === studentId && e.courseCode === course.code && e.active))
      return res.status(400).json({ error: "Already enrolled in this course." });

    // Check duplicate pending request
    if (requests.some((r) => r.studentId === studentId && r.courseCode === course.code && r.status === "pending" && r.type === "enroll"))
      return res.status(400).json({ error: "Enroll request already pending." });

    // Check prerequisite
    if (course.prerequisite) {
      const hasPrereq = enrollments.some(
        (e) =>
          e.studentId === studentId &&
          e.courseCode === course.prerequisite &&
          e.active &&
          e.grade >= PASSING_GRADE
      );
      if (!hasPrereq)
        return res.status(400).json({ error: `Prerequisite required: ${course.prerequisite}` });
    }
  }

  if (type === "drop") {
    if (!enrollments.some((e) => e.studentId === studentId && e.courseCode === course.code && e.active))
      return res.status(400).json({ error: "Not enrolled in this course." });

    if (requests.some((r) => r.studentId === studentId && r.courseCode === course.code && r.status === "pending" && r.type === "drop"))
      return res.status(400).json({ error: "Drop request already pending." });
  }

  const newRequest = {
    id:           Date.now(),
    type,
    studentId,
    studentName,
    courseCode:   course.code,
    courseTitle:  course.title,
    status:       "pending",
    schoolYear:   schoolYear || String(new Date().getFullYear()),
    semester:     semester   || "1st",
    submittedAt:  new Date().toLocaleString(),
  };

  requests.push(newRequest);
  writeJSON("requests.json", requests);
  res.status(201).json({ message: `${type} request submitted.`, request: newRequest });
});

// DELETE /api/requests/:id  (Student cancels their own pending request)
app.delete("/api/requests/:id", (req, res) => {
  const id       = Number(req.params.id);
  const requests = readJSON("requests.json");
  const idx      = requests.findIndex((r) => r.id === id && r.status === "pending");

  if (idx === -1)
    return res.status(404).json({ error: "Pending request not found." });

  requests.splice(idx, 1);
  writeJSON("requests.json", requests);
  res.json({ message: "Request cancelled." });
});

// PATCH /api/requests/:id
// Body: { action: "approve"|"reject" }
app.patch("/api/requests/:id", (req, res) => {
  const id       = Number(req.params.id);
  const { action } = req.body;

  if (!["approve", "reject"].includes(action))
    return res.status(400).json({ error: 'action must be "approve" or "reject".' });

  const requests    = readJSON("requests.json");
  const enrollments = readJSON("enrollments.json");

  const req_item = requests.find((r) => r.id === id);
  if (!req_item) return res.status(404).json({ error: "Request not found." });
  if (req_item.status !== "pending")
    return res.status(400).json({ error: "Request is no longer pending." });

  req_item.status     = action === "approve" ? "approved" : "rejected";
  req_item.reviewedAt = new Date().toLocaleString();

  if (action === "approve") {
    if (req_item.type === "enroll") {
      enrollments.push({
        studentId:   req_item.studentId,
        studentName: req_item.studentName,
        courseCode:  req_item.courseCode,
        courseTitle: req_item.courseTitle,
        active:      true,
        grade:       null,
        schoolYear:  req_item.schoolYear,
        semester:    req_item.semester,
        enrolledAt:  new Date().toLocaleString(),
      });
    } else if (req_item.type === "drop") {
      const idx = enrollments.findIndex(
        (e) => e.studentId === req_item.studentId && e.courseCode === req_item.courseCode && e.active
      );
      if (idx !== -1) enrollments[idx].active = false;
    }
    writeJSON("enrollments.json", enrollments);
  }

  writeJSON("requests.json", requests);
  res.json({ message: `Request ${req_item.status}.`, request: req_item });
});

// =============================================================
// ENROLLMENT ROUTES
// =============================================================

// GET /api/enrollments
// Query: ?studentId=xxx  and/or  ?active=true
app.get("/api/enrollments", (req, res) => {
  let enrollments = readJSON("enrollments.json");

  if (req.query.studentId)
    enrollments = enrollments.filter((e) => e.studentId === req.query.studentId);

  if (req.query.active === "true")
    enrollments = enrollments.filter((e) => e.active);

  res.json(enrollments);
});

// =============================================================
// GRADE ROUTES
// =============================================================

// PATCH /api/grades
// Body: { studentId, courseCode, grade }
app.patch("/api/grades", (req, res) => {
  const { studentId, courseCode, grade } = req.body;

  if (!studentId || !courseCode)
    return res.status(400).json({ error: "Provide studentId and courseCode." });

  const numGrade = Number(grade);
  if (grade === undefined || grade === "" || isNaN(numGrade) || numGrade < 0 || numGrade > 100)
    return res.status(400).json({ error: "Grade must be a number between 0 and 100." });

  const enrollments = readJSON("enrollments.json");
  const idx = enrollments.findIndex(
    (e) =>
      e.studentId === studentId &&
      e.courseCode.toLowerCase() === courseCode.toLowerCase() &&
      e.active
  );

  if (idx === -1)
    return res.status(404).json({ error: "Active enrollment not found." });

  enrollments[idx].grade = numGrade;
  writeJSON("enrollments.json", enrollments);

  res.json({
    message:    `Grade ${numGrade} assigned to ${enrollments[idx].studentName} for ${courseCode}.`,
    enrollment: enrollments[idx],
  });
});

// =============================================================
// ADMIN — USER MANAGEMENT
// =============================================================

// GET /api/users  (Admin only)
app.get("/api/users", (req, res) => {
  const users = readJSON("users.json")
    .filter((u) => u.role === "student")
    .map(({ password: _pw, ...safe }) => safe); // never send passwords
  res.json(users);
});

// DELETE /api/users/:id  (Admin only)
app.delete("/api/users/:id", (req, res) => {
  const userId = req.params.id;
  const users  = readJSON("users.json");

  if (!users.find((u) => u.id === userId && u.role === "student"))
    return res.status(404).json({ error: "Student not found." });

  writeJSON("users.json",      users.filter((u) => u.id !== userId));
  writeJSON("enrollments.json", readJSON("enrollments.json").filter((e) => e.studentId !== userId));
  writeJSON("requests.json",    readJSON("requests.json").filter((r) => r.studentId !== userId));

  res.json({ message: `User ${userId} and all related records removed.` });
});

// =============================================================
// ADMIN — ACADEMIC PERIOD
// =============================================================

const ACAD_FILE = "acad.json";

// GET /api/acad
app.get("/api/acad", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(dataPath(ACAD_FILE), "utf8"));
    res.json(data);
  } catch {
    const year = new Date().getFullYear();
    res.json({ schoolYear: `${year}-${year + 1}`, semester: "1st" });
  }
});

// PUT /api/acad
// Body: { schoolYear, semester }
app.put("/api/acad", (req, res) => {
  const { schoolYear, semester } = req.body;
  if (!schoolYear || !semester)
    return res.status(400).json({ error: "Provide schoolYear and semester." });

  writeJSON(ACAD_FILE, { schoolYear, semester });
  res.json({ message: `Academic period set to ${schoolYear} – ${semester} Semester.`, schoolYear, semester });
});

// =============================================================
// STATS
// =============================================================

// GET /api/stats
app.get("/api/stats", (req, res) => {
  const courses     = readJSON("courses.json");
  const enrollments = readJSON("enrollments.json").filter((e) => e.active);
  const requests    = readJSON("requests.json");
  const users       = readJSON("users.json").filter((u) => u.role === "student");

  const uniqueStudents = [...new Set(enrollments.map((e) => e.studentId))].length;
  const fullCourses    = courses.filter(
    (c) => enrollments.filter((e) => e.courseCode === c.code).length >= c.capacity
  ).length;

  res.json({
    studentCount: users.length,
    courseCount:  courses.length,
    enrollCount:  enrollments.length,
    fullCount:    fullCourses,
    pendingCount: requests.filter((r) => r.status === "pending").length,
    uniqueStudentsEnrolled: uniqueStudents,
  });
});

// =============================================================
// START SERVER
// =============================================================
app.listen(PORT, () => {
  console.log(`\n✅  CourseSim backend running on http://localhost:${PORT}`);
  console.log(`    Endpoints ready:`);
  console.log(`      POST   /api/register`);
  console.log(`      POST   /api/login`);
  console.log(`      GET    /api/courses`);
  console.log(`      POST   /api/courses`);
  console.log(`      DELETE /api/courses/:code`);
  console.log(`      GET    /api/requests`);
  console.log(`      POST   /api/requests`);
  console.log(`      PATCH  /api/requests/:id`);
  console.log(`      DELETE /api/requests/:id`);
  console.log(`      GET    /api/enrollments`);
  console.log(`      PATCH  /api/grades`);
  console.log(`      GET    /api/users`);
  console.log(`      DELETE /api/users/:id`);
  console.log(`      GET    /api/acad`);
  console.log(`      PUT    /api/acad`);
  console.log(`      GET    /api/stats\n`);
});
