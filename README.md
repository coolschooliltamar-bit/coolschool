# CoolSchool

A school learning platform for students, teachers and principals, built as standalone HTML pages (HTML, CSS and JavaScript in each file — no build step, no dependencies).

Open `login.html` in a browser to start.

## Pages

| Page | File | Who |
|---|---|---|
| Sign in | `login.html` | Everyone |
| Register (student / teacher / principal) | `register.html` | Everyone |
| Home | `index.html` | Everyone (principals get the approvals dashboard) |
| Schedule & calendar | `schedule.html` | Students, teachers |
| Grades & submissions | `grades.html` | Students, teachers |
| My tasks (to do, awaiting grade, completed with feedback) | `tasks.html` | Students |
| Learning path | `path.html` | Teachers |
| Library | `library.html` | Students, teachers |
| Weekly timetable editor | `timetable.html` | Principals |
| Settings | `settings.html` | Everyone |

## Demo accounts

Password for all: `demo1234`

| Role | Email |
|---|---|
| Principal | principal@coolschool.demo |
| Teacher | levi@coolschool.demo |
| Student | noa@coolschool.demo |
| Teacher (awaiting approval) | shapiro@coolschool.demo |

## Highlights

- Hebrew / English / Arabic with right-to-left layout, light and dark themes, three font sizes
- Teachers who register must be approved by a principal (the principal is notified)
- Principals edit the weekly timetable for the whole school year; teachers and students are notified of changes
- Teachers grade submissions and view student files; grade weights (per class) always total 100%
- Grades are calculated, not typed: **Exams** = average of exam grades the teacher enters, **Assignments** = average of graded submissions, **Participation** = from Mashov (each lesson starts at 100: late −30, missing equipment −15, disruption −20, absent = 0; each commendation +5, max 100)
- Students see their own Mashov record (on time / late / absent / equipment / disruption / commendation) on their Grades page and get notified of new marks and grades
- Mashov: teachers click a lesson in the schedule to mark each student – absence, tardiness, disruption, commendation, missing equipment, present – saved per lesson date
- Students see all their tasks in one place – what is still due, what is awaiting a grade, and completed work with the teacher's grade and feedback
- Students hand in work, build and share personal learning paths in the library
- Works on phones, tablets and desktops

## Note

This is a front-end prototype: all data (accounts, grades, files, timetable) is stored in the browser's `localStorage` on each device. A real deployment needs a backend for accounts, storage and notifications.
