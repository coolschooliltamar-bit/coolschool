# CoolSchool

A school learning platform for students, teachers and principals, built as standalone HTML pages (HTML, CSS and JavaScript in each file — no build step, no dependencies).

Open `index.html` in a browser to start – it takes you to sign in (or to your dashboard if you are already signed in).

## Pages

| Page | File | Who |
|---|---|---|
| Entry point – redirects to sign in or dashboard | `index.html` | Public |
| Sign in | `login.html` | Everyone |
| Register (student / teacher / principal) | `register.html` | Everyone |
| Home (dashboard) | `home.html` | Everyone (principals get the approvals dashboard) |
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
- Teachers grade submissions and view student files; grade weights (per class) can be typed freely and are scaled to exactly 100% on save
- Grades: **Exams** = average of exam grades the teacher enters, **Assignments** = average of graded submissions, **Participation** = a grade the teacher sets, shown next to each student's Mashov tally (e.g. 14 on time, 5 late, 1 absent)
- Students see the Mashov status of each lesson (on time / late / absent / equipment / disruption / commendation) on their schedule and Grades page – but not a participation grade – and get notified of new marks and grades
- Mashov: teachers click a lesson in the schedule to mark each student – absence, tardiness, disruption, commendation, missing equipment, present – saved per lesson date
- Schedule week picker: This week / Last week / 2 weeks ago (and arrows for any week of the school year) – each lesson block shows that week's date and that lesson's Mashov
- Justification requests: a student clicks a Late or Absent mark to explain why (reason, explanation, optional document such as a doctor's note). The teacher is notified and sees an alert at the top of Home; they open the request (lesson details + explanation) and approve or decline it with a reply. Approved lessons count as justified, and the student is told the outcome
- Students see all their tasks in one place – what is still due, what is awaiting a grade, and completed work with the teacher's grade and feedback
- Students hand in work, build and share personal learning paths in the library
- Works on phones, tablets and desktops
- Collapsible sections (Settings): automatic by default – drop-downs on phones (always starting closed), everything open on computers – or always collapsible / always open

## Landing page (switched off)

A marketing landing page with 3D scrolling is kept in `_drafts/landing.html`. GitHub Pages does not publish folders that start with `_`, so it is not online. To switch it back on, copy `_drafts/landing.html` over `index.html`.

## Note

This is a front-end prototype: all data (accounts, grades, files, timetable) is stored in the browser's `localStorage` on each device. A real deployment needs a backend for accounts, storage and notifications.
