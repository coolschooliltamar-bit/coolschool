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
| Classwork: assignments to hand in + learning paths (Duolingo-style player for students) | `path.html` | Teachers, students |
| School achievement (students, classes, teachers by subject) | `achievements.html` | Principals |
| Library | `library.html` | Students, teachers |
| Classes & schedules (grades 7–12, bells, breaks, generator) | `classes.html` | Academic coordinators, principals |
| Live lesson (Jitsi) with automatic attendance | `live.html` | Teachers, students |
| Settings | `settings.html` | Everyone |

## Demo accounts

Password for all: `demo1234`

| Role | Email |
|---|---|
| Principal | principal@coolschool.demo |
| Academic coordinator | coordinator@coolschool.demo |
| Teacher | levi@coolschool.demo |
| Student | noa@coolschool.demo |
| Teacher (awaiting approval) | shapiro@coolschool.demo |

## Highlights

- Hebrew / English / Arabic with right-to-left layout, light and dark themes, three font sizes
- Teachers who register must be approved by a principal (the principal is notified)
- Teachers grade submissions and view student files; grade weights (per class) can be typed freely and are scaled to exactly 100% on save
- Grades (in this order): **Exams** = average of exam grades the teacher enters, **Assignments** = average of graded submissions, **Conduct & Engagement (תלמידאות)** = a grade the teacher sets, shown next to each student's Mashov tally (e.g. 14 on time, 5 late, 1 absent)
- Students see the Mashov status of each lesson (on time / late / absent / equipment / disruption / commendation) on their schedule and Grades page – but not the conduct & engagement grade – and get notified of new marks and grades
- Mashov: teachers click a lesson in the schedule to mark each student – absence, excused absence, tardiness, excused lateness, skipped class (הברזה), disruption, commendation, missing equipment, present – saved per lesson date
- Schedule week picker: the week on screen is named – Current week / Last week / Two weeks ago / 3 weeks ago… (arrows reach any week of the school year); the Grades attendance list is grouped the same way – each lesson block shows that week's date and that lesson's Mashov
- Grade review requests: next to each exam and graded assignment (Grades and Tasks pages) a student can click **Request review**, say what is wrong, suggest a grade and attach a file. The teacher gets a notification and the request appears in **Student requests** on their Home page, below the live-lesson bar; approving sets the new grade (which updates the student's average), declining keeps it, and the student is notified either way. Students follow their requests under **My requests** on Home
- Justification requests: a student clicks a Late or Absent mark to explain why (reason, explanation, optional document such as a doctor's note). The teacher is notified and sees an alert at the top of Home; they open the request (lesson details + explanation) and approve or decline it with a reply. Approving turns the mark into an excused absence / excused lateness, and the student is told the outcome; students see their approved requests right under the live-lesson bar on Home
- Students see all their tasks in one place – what is still due, what is awaiting a grade, and completed work with the teacher's grade and feedback
- Students hand in work, build and share personal learning paths in the library
- Works on phones, tablets and desktops
- **Student feedback**: students can send the academic coordinator a complaint about where a lesson is or an idea for a swap (to the principal if the school has no coordinator), and can contact the principal about a teacher – limited to 3 times in 30 days; only the principal sees those. Both answer and set a status, and the student is notified
- **School achievement** (principal): average, pass rate and students at risk; averages by class and by teacher, the grade distribution, and every student's grades – for all subjects or one subject
- **Classwork** (teachers): **assignments to hand in**, like Google Classroom – title, class, type, due date and time, points, instructions and attached material, and whether students answer in writing and/or with files; the teacher sees how many handed in, what is waiting to be graded and who is missing, and grades on the Grades page (written answers open in the viewer). Students open each assignment on their Tasks page, read the instructions, download the material, write an answer and/or attach files, hand in, update or unsubmit until it is graded
- **Learning paths** (Classwork → Learning paths): Duolingo-style paths of units, lessons, practice rounds, checkpoints and a final challenge. By default the **teacher builds the path**: add units and steps, write explanations and questions (multiple choice, true/false, fill-in), reorder, and publish once nothing is missing. Optionally a draft can be made **from a document** (PDF, Word, PowerPoint or text): the built-in generator (no AI, the default) finds definitions and facts in the document and asks real questions about them – "What is osmosis?", "How does this sentence end?", true/false with genuinely false statements, numbers – or **Claude AI** through the school's AI server ([ai-proxy/README.md](ai-proxy/README.md)) or a teacher's own key. Difficulty and estimated time set the number of lessons and questions; students play it from their Tasks page and earn XP
- **Classes & schedules** (academic coordinator; the principal can open it too): grades 7–12 with as many parallel classes as needed (11-1, 11-2 …); click a class to see and edit its weekly timetable; a bell schedule per grade – lesson length and breaks from–to, to the minute (e.g. 9:30–9:45), with a warning when a lesson length leaves dead time before a break – and each class's start and end time for every day; an automatic generator takes the chosen classes, their subjects and weekly hours (and optional teachers), and preferences – subjects taught at the same time across the whole grade (Math and English by default), group similar subjects together, double lessons, a daily cap per subject. It never puts a lesson outside a class's hours or in a break, never puts a teacher in two classes at once, and never runs the same lesson in two classes at once unless different teachers are named
- **Live lessons** (Jitsi): the teacher opens a live lesson and students join from their own device. The teacher's page follows the call: joining marks a student present in Mashov, leaving for longer than the set time (5 minutes by default) marks **הברזה** (skipped class) and notifies the student, and at the end students who never joined are marked absent. The video server is one line in [`site-config.js`](site-config.js) – meet.jit.si (Jitsi's demo server) makes whoever opens a lesson sign in with Google/GitHub/Facebook and cuts embedded calls after 5 minutes; on the school's own Jitsi server nobody signs in and there is no limit. See [video-server/README.md](video-server/README.md) for setting one up
- Every class shows a subject icon next to its name (🧬 Biology, 🧪 Chemistry, ➗ Math, 🏛️ History, 📖 English)
- Clicking a day in the calendar (or the Upcoming button) opens the upcoming-events list from that date
- Students pick a class at the top of their Grades page
- Teachers post **Messages for students** that appear on the students' Home page
- Notifications: opening the bell clears the count; a notification you have opened disappears from the list the next day (a teacher sign-up waiting for approval stays until the principal decides)
- Collapsible sections (Settings): automatic by default – drop-downs on phones (always starting closed), everything open on computers – or always collapsible / always open

## Landing page (switched off)

A marketing landing page with 3D scrolling is kept in `_drafts/landing.html`. GitHub Pages does not publish folders that start with `_`, so it is not online. To switch it back on, copy `_drafts/landing.html` over `index.html`.

## Note

This is a front-end prototype: all data (accounts, grades, files, timetable) is stored in the browser's `localStorage` on each device. A real deployment needs a backend for accounts, storage and notifications.
