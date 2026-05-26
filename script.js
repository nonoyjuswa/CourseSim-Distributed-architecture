/* =====================================================
   CourseSim – script.js  (API version)
   All data operations now go through the REST API.
   Backend must be running on http://localhost:3000
   ===================================================== */

const API = "http://localhost:3000";

const PASSING_GRADE = 75;

/* ── OOP Classes (kept for compatibility) ─────────── */
class Student {
  constructor(name) { this.name = name; this.enrolledCourses = []; }
  enroll(course) {
    if (!this.enrolledCourses.includes(course)) { this.enrolledCourses.push(course); return true; }
    return false;
  }
  drop(course)  { this.enrolledCourses = this.enrolledCourses.filter(c => c !== course); }
  viewCourses() { return this.enrolledCourses; }
}

class Course {
  constructor(code, title, capacity, prerequisite = null) {
    this.code = code; this.title = title;
    this.capacity = capacity; this.prerequisite = prerequisite;
    this.students = [];
  }
  isFull()         { return this.students.length >= this.capacity; }
  addStudent(s)    { if (!this.isFull() && !this.students.includes(s)) { this.students.push(s); return true; } return false; }
  removeStudent(s) { this.students = this.students.filter(x => x !== s); }
}

class Enrollment {
  constructor(student, course) { this.student = student; this.course = course; this.grade = null; }
  assignGrade(g) { this.grade = g; }
}

/* ── API helpers ──────────────────────────────────── */
async function apiFetch(path, options = {}) {
  try {
    const res  = await fetch(`${API}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data;
  } catch (err) {
    throw err;
  }
}

/* ── Session helpers (still uses localStorage for session only) ── */
function getCurrentUser() { return JSON.parse(localStorage.getItem("cs_currentUser") || "null"); }
function setCurrentUser(user) { localStorage.setItem("cs_currentUser", JSON.stringify(user)); }
function clearCurrentUser()   { localStorage.removeItem("cs_currentUser"); }

/* ── Misc helpers ─────────────────────────────────── */
function togglePassword(inputId, btn) {
  const el = document.getElementById(inputId);
  el.type = el.type === "password" ? "text" : "password";
  btn.textContent = el.type === "password" ? "Show" : "Hide";
}
function setMessage(text, color) {
  const el = document.getElementById("message") || document.getElementById("authMessage");
  if (!el) return;
  el.textContent = text;
  el.style.color = color || "#bfdbfe";
}
function initials(name) {
  return (name || "?").split(" ").map(n => n[0] || "").join("").slice(0, 2).toUpperCase();
}
function gradeStatus(grade) {
  if (grade === null || grade === undefined) return { label: "Pending", cls: "gs-pending" };
  if (grade >= PASSING_GRADE) return { label: "Passed",  cls: "gs-passed" };
  return { label: "Failed", cls: "gs-failed" };
}

/* ── Auth ─────────────────────────────────────────── */
async function registerAccount() {
  const name      = (document.getElementById("regName")?.value     || "").trim();
  const password  = (document.getElementById("regPassword")?.value || "").trim();
  const yearLvl   = (document.getElementById("regYear")?.value     || "").trim();
  const idDisp    = document.getElementById("generatedId");

  if (!name || !password || !yearLvl) return setMessage("Please fill in all fields.");
  if (password.length < 6)            return setMessage("Password must be at least 6 characters.");

  try {
    const data = await apiFetch("/api/register", {
      method: "POST",
      body:   JSON.stringify({ name, password, yearLevel: yearLvl }),
    });
    if (idDisp) { idDisp.textContent = `Your Student ID: ${data.user.id}`; idDisp.style.display = "block"; }
    setMessage("✓ Registration successful! Save your ID above, then log in.", "#86efac");
  } catch (err) {
    setMessage(err.message);
  }
}

async function login() {
  const id       = (document.getElementById("loginId")?.value       || "").trim();
  const password = (document.getElementById("loginPassword")?.value || "").trim();

  try {
    const data = await apiFetch("/api/login", {
      method: "POST",
      body:   JSON.stringify({ id, password }),
    });
    setCurrentUser(data.user);
    setMessage("✓ Login successful! Redirecting…", "#86efac");
    setTimeout(() => {
      if      (data.user.role === "admin")     window.location.href = "admin.html";
      else if (data.user.role === "registrar") window.location.href = "enrollments.html";
      else                                     window.location.href = "courses.html";
    }, 800);
  } catch (err) {
    setMessage(err.message);
  }
}

function logout() { clearCurrentUser(); window.location.href = "index.html"; }

/* ── Sidebar ──────────────────────────────────────── */
function syncUserUI() {
  const p   = getCurrentUser();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("sidebarName", p ? p.name : "Guest");
  set("sidebarId",   p ? p.id   : "—");
  const av = document.getElementById("sidebarAvatar");
  if (av) av.textContent = initials(p ? p.name : "Guest");
  const rp = document.getElementById("sidebarRole");
  if (rp) { rp.textContent = p ? p.role.charAt(0).toUpperCase() + p.role.slice(1) : ""; rp.className = "role-pill " + (p ? p.role : ""); }
  const ll = document.getElementById("navLogout");
  if (ll) {
    if (p) { ll.textContent = "Logout"; ll.href = "#"; ll.onclick = (e) => { e.preventDefault(); logout(); }; }
    else   { ll.textContent = "Login";  ll.href = "index.html"; ll.onclick = null; }
  }
}

/* ── Drag & Drop ──────────────────────────────────── */
let draggedCourseCode = null;
let _courses = [];  // module-level cache

async function renderDragDrop() {
  const availableList = document.getElementById("availableCourses");
  const enrolledList  = document.getElementById("enrolledCourses");
  if (!availableList || !enrolledList) return;

  const user = getCurrentUser();
  if (!user) return;

  try {
    const [courses, enrollments, requests, acad] = await Promise.all([
      apiFetch("/api/courses"),
      apiFetch(`/api/enrollments?studentId=${user.id}&active=true`),
      apiFetch(`/api/requests?studentId=${user.id}`),
      apiFetch("/api/acad"),
    ]);
    _courses = courses;

    const period        = acad;
    const myActive      = enrollments.filter(e => e.schoolYear === period.schoolYear && e.semester === period.semester).map(e => e.courseCode);
    const myPending     = requests.filter(r => r.status === "pending" && r.type === "enroll").map(r => r.courseCode);
    const myDropPending = requests.filter(r => r.status === "pending" && r.type === "drop").map(r => r.courseCode);

    // ── Available column ──
    availableList.innerHTML = "";
    courses.forEach(course => {
      if (myActive.includes(course.code) || myPending.includes(course.code)) return;

      const isFull    = course.enrolledCount >= course.capacity;
      const hasPrereq = !course.prerequisite ||
        enrollments.some(e => e.courseCode === course.prerequisite && e.grade >= PASSING_GRADE);
      const isLocked  = !hasPrereq || isFull;

      const card = document.createElement("div");
      card.className = "course-card" + (isLocked ? " locked" : " draggable");
      card.dataset.code = course.code;

      if (!isLocked) {
        card.draggable = true;
        card.addEventListener("dragstart", e => { draggedCourseCode = course.code; card.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
        card.addEventListener("dragend",   () => { draggedCourseCode = null; card.classList.remove("dragging"); });
      }

      const lockReason = isFull ? "Course full" : `Needs: ${course.prerequisite}`;
      card.innerHTML = `
        <div class="cc-header">
          <span class="cc-code">${course.code}</span>
          <span class="cc-cap ${isFull ? "cap-full" : ""}">${course.enrolledCount}/${course.capacity}</span>
        </div>
        <div class="cc-title">${course.title}</div>
        ${course.prerequisite ? `<div class="cc-prereq">Prereq: ${course.prerequisite}</div>` : ""}
        ${isLocked ? `<div class="cc-lock">🔒 ${lockReason}</div>` : ""}`;
      availableList.appendChild(card);
    });

    if (!availableList.children.length)
      availableList.innerHTML = '<div class="dd-empty">No courses available to enroll in.</div>';

    // ── Enrolled / Pending column ──
    enrolledList.innerHTML = "";

    myActive.forEach(code => {
      const course = courses.find(c => c.code === code);
      if (!course) return;
      const isPendingDrop = myDropPending.includes(code);
      const enr       = enrollments.find(e => e.courseCode === code);
      const gradeText = enr?.grade !== null && enr?.grade !== undefined ? `Grade: ${enr.grade}` : "Grade: pending";
      const card = document.createElement("div");
      card.className = "course-card enrolled" + (isPendingDrop ? " pending-drop" : "");
      card.innerHTML = `
        <div class="cc-header">
          <span class="cc-code">${course.code}</span>
          <span class="cc-status ${isPendingDrop ? "status-drop" : "status-enrolled"}">${isPendingDrop ? "Drop pending" : "Enrolled"}</span>
        </div>
        <div class="cc-title">${course.title}</div>
        <div class="cc-grade">${gradeText}</div>
        ${!isPendingDrop ? `<button class="drop-btn" onclick="submitDropRequest('${code}')">Request Drop</button>` : ""}`;
      enrolledList.appendChild(card);
    });

    myPending.forEach(code => {
      const course = courses.find(c => c.code === code);
      if (!course) return;
      const req  = requests.find(r => r.courseCode === code && r.status === "pending" && r.type === "enroll");
      const card = document.createElement("div");
      card.className = "course-card pending-enroll";
      card.innerHTML = `
        <div class="cc-header">
          <span class="cc-code">${course.code}</span>
          <span class="cc-status status-pending">Pending approval</span>
        </div>
        <div class="cc-title">${course.title}</div>
        <button class="cancel-btn" onclick="cancelEnrollRequest(${req?.id})">✕ Cancel Request</button>`;
      enrolledList.appendChild(card);
    });

    if (!enrolledList.children.length)
      enrolledList.innerHTML = '<div class="dd-empty">Drag courses here to enroll.</div>';

    const dropZone = document.getElementById("enrolledZone");
    if (dropZone) {
      dropZone.ondragover  = e => { e.preventDefault(); dropZone.classList.add("drop-active"); };
      dropZone.ondragleave = () => dropZone.classList.remove("drop-active");
      dropZone.ondrop      = e => { e.preventDefault(); dropZone.classList.remove("drop-active"); if (draggedCourseCode) { submitEnrollRequest(draggedCourseCode); draggedCourseCode = null; } };
    }

    renderStats();
  } catch (err) {
    setMessage("Could not load courses. Is the server running?");
    console.error(err);
  }
}

/* ── Request actions ──────────────────────────────── */
async function submitEnrollRequest(courseCode) {
  const user = getCurrentUser();
  const acad = await apiFetch("/api/acad");
  if (!user || user.role !== "student") return setMessage("Must be logged in as student.");

  try {
    await apiFetch("/api/requests", {
      method: "POST",
      body:   JSON.stringify({
        studentId:   user.id,
        studentName: user.name,
        courseCode,
        type:        "enroll",
        schoolYear:  acad.schoolYear,
        semester:    acad.semester,
      }),
    });
    renderDragDrop();
    setMessage(`✓ Enroll request for ${courseCode} submitted.`, "#86efac");
  } catch (err) {
    setMessage(err.message);
  }
}

async function submitDropRequest(courseCode) {
  const user = getCurrentUser();
  if (!user || user.role !== "student") return setMessage("Must be logged in as student.");

  try {
    await apiFetch("/api/requests", {
      method: "POST",
      body:   JSON.stringify({ studentId: user.id, studentName: user.name, courseCode, type: "drop" }),
    });
    renderDragDrop();
    setMessage(`✓ Drop request for ${courseCode} submitted.`, "#86efac");
  } catch (err) {
    setMessage(err.message);
  }
}

async function cancelEnrollRequest(reqId) {
  if (!reqId) return;
  try {
    await apiFetch(`/api/requests/${reqId}`, { method: "DELETE" });
    renderDragDrop();
    setMessage("Request cancelled.", "#fde047");
  } catch (err) {
    setMessage(err.message);
  }
}

async function approveRequest(reqId) {
  try {
    await apiFetch(`/api/requests/${reqId}`, {
      method: "PATCH",
      body:   JSON.stringify({ action: "approve" }),
    });
    renderRequests(); renderHistory(); renderAllEnrollments(); renderStats();
  } catch (err) {
    setMessage(err.message);
  }
}

async function rejectRequest(reqId) {
  try {
    await apiFetch(`/api/requests/${reqId}`, {
      method: "PATCH",
      body:   JSON.stringify({ action: "reject" }),
    });
    renderRequests(); renderHistory();
  } catch (err) {
    setMessage(err.message);
  }
}

/* ── Registrar renders ────────────────────────────── */
async function renderRequests() {
  const list = document.getElementById("requestList");
  if (!list) return;

  try {
    const reqs = await apiFetch("/api/requests?status=pending");
    list.innerHTML = reqs.length ? "" : '<li class="empty-state">No pending requests.</li>';
    reqs.forEach(req => {
      const li = document.createElement("li");
      li.className = "request-item";
      li.innerHTML = `
        <div class="request-header">
          <span class="req-badge ${req.type === "enroll" ? "enroll-badge" : "drop-badge"}">${req.type}</span>
          <span class="req-name">${req.studentName}</span>
          <span class="req-id">${req.studentId}</span>
        </div>
        <div class="req-course">${req.courseCode} – ${req.courseTitle}</div>
        ${req.schoolYear ? `<div class="req-time">Period: ${req.schoolYear} – ${req.semester} Sem</div>` : ""}
        <div class="req-time">Submitted: ${req.submittedAt}</div>
        <div class="req-actions">
          <button class="approve-btn" onclick="approveRequest(${req.id})">Approve</button>
          <button class="reject-btn"  onclick="rejectRequest(${req.id})">Reject</button>
        </div>`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }
}

async function renderHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;

  try {
    const all  = await apiFetch("/api/requests");
    const reqs = all.filter(r => r.status !== "pending").reverse();
    list.innerHTML = reqs.length ? "" : '<li class="empty-state">No history yet.</li>';
    reqs.forEach(req => {
      const li = document.createElement("li");
      li.className = "request-item";
      li.innerHTML = `
        <div class="request-header">
          <span class="req-badge ${req.type === "enroll" ? "enroll-badge" : "drop-badge"}">${req.type}</span>
          <span class="req-badge ${req.status === "approved" ? "approved-badge" : "rejected-badge"}">${req.status}</span>
          <span class="req-name">${req.studentName}</span>
        </div>
        <div class="req-course">${req.courseCode} – ${req.courseTitle}</div>
        <div class="req-time">Reviewed: ${req.reviewedAt || "—"}</div>`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }
}

async function renderAllEnrollments() {
  const list = document.getElementById("allEnrollList");
  if (!list) return;

  try {
    const active = await apiFetch("/api/enrollments?active=true");
    list.innerHTML = active.length ? "" : '<li class="empty-state">No active enrollments.</li>';
    const byStudent = {};
    active.forEach(e => {
      if (!byStudent[e.studentId]) byStudent[e.studentId] = { name: e.studentName, id: e.studentId, courses: [] };
      byStudent[e.studentId].courses.push(e);
    });
    Object.values(byStudent).forEach(s => {
      const li   = document.createElement("li"); li.className = "student-item";
      const rows = s.courses.map(c => `${c.courseCode}${c.grade !== null ? ` (${c.grade})` : " (pending)"}`).join(", ");
      li.innerHTML = `<div class="student-title">${s.name} <span style="font-size:.78rem;opacity:.6">${s.id}</span></div><div class="student-meta">${rows}</div>`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }
}

/* ── Academic History (Student) ───────────────────── */
async function renderAcadHistory() {
  const container = document.getElementById("acadHistory");
  if (!container) return;
  const user = getCurrentUser();
  if (!user) return;

  try {
    const allEnrolls = await apiFetch(`/api/enrollments?studentId=${user.id}`);
    if (!allEnrolls.length) {
      container.innerHTML = '<p class="empty-state">No enrollment history yet.</p>';
      return;
    }

    const grouped = {};
    allEnrolls.forEach(e => {
      const key = `${e.schoolYear || "Unknown"}|||${e.semester || "Unknown"}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    });

    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      const [ayA] = a.split("|||"); const [ayB] = b.split("|||");
      return ayB.localeCompare(ayA);
    });

    container.innerHTML = "";
    sortedKeys.forEach(key => {
      const [sy, sem] = key.split("|||");
      const enrolls   = grouped[key];
      const section   = document.createElement("div");
      section.className = "hist-section";

      const passed  = enrolls.filter(e => e.grade !== null && e.grade >= PASSING_GRADE).length;
      const failed  = enrolls.filter(e => e.grade !== null && e.grade < PASSING_GRADE).length;
      const pending = enrolls.filter(e => e.grade === null).length;

      section.innerHTML = `
        <div class="hist-header">
          <div>
            <span class="hist-year">${sy}</span>
            <span class="hist-sem">${sem} Semester</span>
          </div>
          <div class="hist-summary">
            <span class="hs-item hs-pass">✓ ${passed} Passed</span>
            ${failed  ? `<span class="hs-item hs-fail">✗ ${failed} Failed</span>`   : ""}
            ${pending ? `<span class="hs-item hs-pend">⏳ ${pending} Pending</span>` : ""}
          </div>
        </div>
        <table class="hist-table">
          <thead><tr><th>Code</th><th>Course</th><th>Status</th><th>Grade</th><th>Result</th></tr></thead>
          <tbody>
            ${enrolls.map(e => {
              const st          = gradeStatus(e.grade);
              const activeLabel = e.active ? "" : ' <span class="dropped-tag">Dropped</span>';
              return `<tr>
                <td class="ht-code">${e.courseCode}${activeLabel}</td>
                <td>${e.courseTitle || e.courseCode}</td>
                <td>${e.active ? "Enrolled" : "Dropped"}</td>
                <td class="ht-grade">${e.grade !== null ? e.grade : "—"}</td>
                <td><span class="grade-status ${st.cls}">${e.active ? (e.grade !== null ? st.label : "Pending") : "Dropped"}</span></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>`;
      container.appendChild(section);
    });
  } catch (err) {
    console.error(err);
  }
}

/* ── My Enrollments (current period) ─────────────── */
async function renderMyEnrollments() {
  const list = document.getElementById("myEnrollList");
  if (!list) return;
  const user = getCurrentUser();

  try {
    const [enrollments, acad] = await Promise.all([
      apiFetch(`/api/enrollments?studentId=${user.id}&active=true`),
      apiFetch("/api/acad"),
    ]);
    const mine = enrollments.filter(e => e.schoolYear === acad.schoolYear && e.semester === acad.semester);
    list.innerHTML = mine.length ? "" : '<li class="empty-state">No active enrollments this period.</li>';
    mine.forEach(e => {
      const st = gradeStatus(e.grade);
      const li = document.createElement("li"); li.className = "student-item";
      li.innerHTML = `
        <div class="student-title">${e.courseCode} – ${e.courseTitle}</div>
        <div class="student-meta">
          ${e.enrolledAt} &nbsp;·&nbsp;
          Grade: <strong>${e.grade !== null ? e.grade : "pending"}</strong> &nbsp;
          <span class="grade-status ${st.cls}">${e.grade !== null ? st.label : "Pending"}</span>
        </div>`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }
}

async function renderMyRequests() {
  const list = document.getElementById("myRequestList");
  if (!list) return;
  const user = getCurrentUser();

  try {
    const reqs = (await apiFetch(`/api/requests?studentId=${user.id}`)).reverse();
    list.innerHTML = reqs.length ? "" : '<li class="empty-state">No requests yet.</li>';
    reqs.forEach(req => {
      const li = document.createElement("li"); li.className = "request-item";
      li.innerHTML = `
        <div class="request-header">
          <span class="req-badge ${req.type === "enroll" ? "enroll-badge" : "drop-badge"}">${req.type}</span>
          <span class="req-badge ${req.status === "approved" ? "approved-badge" : req.status === "rejected" ? "rejected-badge" : "pending-badge"}">${req.status}</span>
        </div>
        <div class="req-course">${req.courseCode} – ${req.courseTitle}</div>
        <div class="req-time">Submitted: ${req.submittedAt}</div>`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }
}

/* ── Stats ────────────────────────────────────────── */
async function renderStats() {
  try {
    const s   = await apiFetch("/api/stats");
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("studentCount", s.studentCount);
    set("courseCount",  s.courseCount);
    set("enrollCount",  s.enrollCount);
    set("fullCount",    s.fullCount);
    set("pendingCount", s.pendingCount);
  } catch (err) {
    console.error(err);
  }
}

/* ── Grade Assignment ─────────────────────────────── */
async function assignGrade() {
  const studentId  = (document.getElementById("studentIdInput")?.value  || "").trim();
  const courseCode = (document.getElementById("courseCodeInput")?.value || "").trim();
  const raw        = (document.getElementById("gradeInput")?.value      || "").trim();

  if (!studentId || !courseCode) return setMessage("Enter student ID and course code.");
  if (raw === "" || isNaN(Number(raw))) return setMessage("Enter a valid grade 0–100.");

  try {
    const data = await apiFetch("/api/grades", {
      method: "PATCH",
      body:   JSON.stringify({ studentId, courseCode, grade: Number(raw) }),
    });
    setMessage(`✓ ${data.message}`, "#86efac");
    renderAllEnrollments();
  } catch (err) {
    setMessage(err.message);
  }
}

/* ── Admin: Academic Period ───────────────────────── */
async function renderAcadPeriodAdmin() {
  try {
    const p  = await apiFetch("/api/acad");
    const sy = document.getElementById("acadYear"); if (sy) sy.value = p.schoolYear;
    const ss = document.getElementById("acadSem");  if (ss) ss.value = p.semester;
    const lb = document.getElementById("currentPeriodLabel");
    if (lb) lb.textContent = `${p.schoolYear} – ${p.semester} Semester`;
  } catch (err) {
    console.error(err);
  }
}

async function saveAcadPeriodAdmin() {
  const sy = (document.getElementById("acadYear")?.value || "").trim();
  const ss = (document.getElementById("acadSem")?.value  || "").trim();
  if (!sy || !ss) return setMessage("Fill in both school year and semester.");

  try {
    const data = await apiFetch("/api/acad", {
      method: "PUT",
      body:   JSON.stringify({ schoolYear: sy, semester: ss }),
    });
    setMessage(`✓ ${data.message}`, "#86efac");
    renderAcadPeriodAdmin();
  } catch (err) {
    setMessage(err.message);
  }
}

/* ── Admin: Course Management ─────────────────────── */
async function adminAddCourse() {
  const code     = (document.getElementById("newCode")?.value     || "").trim().toUpperCase();
  const title    = (document.getElementById("newTitle")?.value    || "").trim();
  const capacity = parseInt(document.getElementById("newCapacity")?.value || "0");
  const prereq   = (document.getElementById("newPrereq")?.value   || "").trim().toUpperCase() || null;

  if (!code || !title || capacity < 1) return setMessage("Fill in code, title, and capacity (≥1).");

  try {
    const data = await apiFetch("/api/courses", {
      method: "POST",
      body:   JSON.stringify({ code, title, capacity, prerequisite: prereq }),
    });
    setMessage(`✓ ${data.message}`, "#86efac");
    renderAdminCourses();
    ["newCode", "newTitle", "newCapacity", "newPrereq"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  } catch (err) {
    setMessage(err.message);
  }
}

async function adminRemoveCourse(code) {
  try {
    const data = await apiFetch(`/api/courses/${encodeURIComponent(code)}`, { method: "DELETE" });
    setMessage(`✓ ${data.message}`, "#86efac");
    renderAdminCourses();
  } catch (err) {
    setMessage(err.message);
  }
}

async function renderAdminCourses() {
  const list = document.getElementById("adminCourseList");
  if (!list) return;

  try {
    const [courses, enrollments] = await Promise.all([
      apiFetch("/api/courses"),
      apiFetch("/api/enrollments?active=true"),
    ]);
    list.innerHTML = "";
    courses.forEach(course => {
      const cnt = enrollments.filter(e => e.courseCode === course.code).length;
      const li  = document.createElement("li"); li.className = "course-item";
      li.innerHTML = `
        <div class="course-title">${course.code} – ${course.title}</div>
        <div class="course-meta">Capacity: ${cnt}/${course.capacity}${course.prerequisite ? ` · Prereq: ${course.prerequisite}` : ""}${cnt >= course.capacity ? ' <span class="badge-full">FULL</span>' : ""}</div>
        <div class="action-row" style="margin-top:8px">
          <button class="remove-btn" onclick="adminRemoveCourse('${course.code}')">Remove Course</button>
        </div>`;
      list.appendChild(li);
    });
    renderStats();
  } catch (err) {
    console.error(err);
  }
}

/* ── Admin: User Management ───────────────────────── */
async function renderAdminUsers() {
  const list = document.getElementById("adminUserList");
  if (!list) return;

  try {
    const [users, enrollments] = await Promise.all([
      apiFetch("/api/users"),
      apiFetch("/api/enrollments?active=true"),
    ]);
    list.innerHTML = users.length ? "" : '<li class="empty-state">No student accounts yet.</li>';
    users.forEach(u => {
      const enrollCount = enrollments.filter(e => e.studentId === u.id).length;
      const li = document.createElement("li"); li.className = "student-item user-item";
      li.innerHTML = `
        <div class="user-item-header">
          <div class="user-avatar-sm">${initials(u.name)}</div>
          <div class="user-info">
            <div class="student-title">${u.name}</div>
            <div class="student-meta">${u.id} &nbsp;·&nbsp; ${u.yearLevel || "—"} Year &nbsp;·&nbsp; ${enrollCount} active enrollment${enrollCount !== 1 ? "s" : ""}</div>
          </div>
          <button class="remove-btn user-remove-btn" onclick="adminRemoveUser('${u.id}')">Remove</button>
        </div>`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }
}

async function adminRemoveUser(userId) {
  if (!confirm(`Remove user ${userId}? This will also remove all their enrollment records.`)) return;
  try {
    const data = await apiFetch(`/api/users/${userId}`, { method: "DELETE" });
    setMessage(`✓ ${data.message}`, "#86efac");
    // If this user is currently logged in, log them out
    const cur = getCurrentUser();
    if (cur && cur.id === userId) logout();
    renderAdminUsers();
    renderStats();
  } catch (err) {
    setMessage(err.message);
  }
}

/* ── Init ─────────────────────────────────────────── */
(async function init() {
  syncUserUI();
  await Promise.allSettled([
    renderStats(),
    renderDragDrop(),
    renderRequests(),
    renderHistory(),
    renderMyEnrollments(),
    renderMyRequests(),
    renderAllEnrollments(),
    renderAdminCourses(),
    renderAdminUsers(),
    renderAcadPeriodAdmin(),
    renderAcadHistory(),
  ]);
    const loginId   = document.getElementById("loginId");
    const loginPass = document.getElementById("loginPassword");
    const regName = document.getElementById("regName");
    const regPass = document.getElementById("regPassword");

    function handleLoginEnter(e) {
      if (e.key === "Enter") login();
    }
    function handleRegisterEnter(e) {
    if (e.key === "Enter") registerAccount();
    }

    if (loginId)   loginId.addEventListener("keydown",   handleLoginEnter);
    if (loginPass) loginPass.addEventListener("keydown", handleLoginEnter);
    if (regName) regName.addEventListener("keydown", handleRegisterEnter);
    if (regPass) regPass.addEventListener("keydown", handleRegisterEnter);
})();
