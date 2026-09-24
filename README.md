Classora 🎓

Student Management & Online Quiz Platform

Classora is a full-stack student management platform designed to simplify the way educational institutions manage students, quizzes, assessments, results, and academic performance.

The platform provides role-based experiences for students, teachers, and administrators, combining learning tools with administrative and performance-management features in one application.

---

🚀 Live Demo

Live Application:
https://crud-website-4.onrender.com/

---

✨ Features

👨‍🎓 Student Portal

Students can:

- Create an account and securely log in
- Access available quizzes
- Complete online assessments
- View their quiz results
- Track pass/fail outcomes
- View academic rankings
- Manage their profile

👨‍🏫 Teacher Portal

Teachers can:

- View registered students
- View student performance
- Access passed and failed student lists
- View quiz and assessment information
- Monitor overall academic performance
- Access analytics

👨‍💼 Admin Portal

Administrators have extended management capabilities, including:

- User management
- Student management
- Quiz management
- Create and manage quizzes
- View student marks
- Modify and delete student records
- Monitor academic performance
- Access administrative analytics

---

📝 Quiz & Assessment System

Classora includes a complete quiz workflow supporting:

- Quiz creation
- Multiple-choice questions
- Multiple answer options
- Correct-answer configuration
- Time limits
- Attempt limits
- Quiz publishing
- Start and closing dates
- Automatic result calculation
- Pass/fail determination
- Student result history
- Quiz previews

The system is designed to provide a structured assessment experience while giving staff the tools needed to manage academic content.

---

📊 Results & Performance

Classora provides different levels of performance visibility depending on the user's role.

Students can view their own results and ranking information, while teachers and administrators have access to broader student-performance information.

The platform supports:

- Quiz scores
- Percentages
- Pass/fail status
- Student rankings
- Performance analytics
- Highest and lowest performers

---

🔐 Authentication & Role-Based Access

Classora uses authentication and role-based authorization to separate access between:

- Students
- Teachers
- Administrators

Protected API routes require authentication, while administrative functionality is restricted according to the authenticated user's role.

Passwords are securely hashed before being stored in the database.

---

🛠️ Technology Stack

Frontend

- HTML5
- CSS3
- JavaScript
- Responsive UI
- Mobile-friendly navigation

Backend

- Node.js
- Express.js
- REST API architecture

Database

- PostgreSQL
- Relational data modelling
- SQL queries

Authentication & Security

- JSON Web Tokens (JWT)
- bcryptjs
- Environment variables
- Role-based authorization

Deployment

- Render
- GitHub

---

🏗️ Project Structure

CRUD-website/
│
├── public/
│   ├── index.html
│   ├── script.js
│   └── style.css
│
├── create-user.js
├── server.js
├── package.json
├── package-lock.json
├── .gitignore
└── README.md

---

⚙️ Running Locally

1. Clone the repository

git clone git@github.com:DenzelM15/CRUD-website.git

Or:

git clone https://github.com/DenzelM15/CRUD-website.git

2. Enter the project directory

cd CRUD-website

3. Install dependencies

npm install

4. Configure environment variables

Create a ".env" file:

DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secret_key

Do not commit your ".env" file to GitHub.

5. Start the application

npm start

The application will run on:

http://localhost:3000

---

🗄️ Database

Classora uses PostgreSQL for persistent application data.

The backend initializes the required database structures for:

- Users
- Students
- Quizzes
- Questions
- Options
- Quiz attempts
- Answers

Database configuration is supplied through environment variables rather than being stored directly in the source code.

---

📱 Responsive Design

Classora is designed to work across:

- Desktop computers
- Laptops
- Tablets
- Mobile devices

The interface includes responsive navigation and mobile-specific layouts to provide a consistent experience across different screen sizes.

---

🎯 Project Goals

Classora was built to demonstrate the practical development of a complete full-stack application rather than a collection of isolated frontend pages.

The project focuses on:

- Full-stack application development
- REST API development
- Database design
- Authentication
- Authorization
- CRUD operations
- Role-based interfaces
- Form handling
- Assessment workflows
- Responsive UI/UX
- Deployment
- Production-oriented development practices

---

🔮 Future Improvements

Potential future improvements include:

- Email notifications
- Advanced reporting
- PDF report generation
- More detailed analytics
- Question banks
- Bulk student imports
- Institution-level management
- Improved accessibility
- Automated testing
- Expanded audit logging

---

📸 Screenshots

Screenshots of the Classora interface can be added here to showcase:

- Login / registration
- Student dashboard
- Teacher dashboard
- Admin dashboard
- Quiz creation
- Quiz preview
- Quiz completion
- Results
- Analytics

---

👨‍💻 Developer

Denzel M.

Software Developer focused on building practical full-stack web applications and technology-driven solutions.

GitHub:
https://github.com/DenzelM15

---

📄 License

This project is currently intended as a portfolio and demonstration project.
