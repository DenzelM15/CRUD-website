require("dotenv").config();

const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// DATABASE
// ==========================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json());

app.use((req, res, next) => {
    console.log(
        "REQUEST:",
        req.method,
        req.originalUrl,
        "| AUTH:",
        req.headers.authorization ? "PRESENT" : "MISSING"
    );
    next();
});
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS people (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            surname TEXT NOT NULL
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'student',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student'
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS students (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL
                REFERENCES users(id)
                ON DELETE CASCADE,
            name TEXT NOT NULL,
            surname TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS quizzes (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS questions (
            id SERIAL PRIMARY KEY,
            quiz_id INTEGER NOT NULL
                REFERENCES quizzes(id)
                ON DELETE CASCADE,
            question TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS options (
            id SERIAL PRIMARY KEY,
            question_id INTEGER NOT NULL
                REFERENCES questions(id)
                ON DELETE CASCADE,
            option_text TEXT NOT NULL,
            is_correct BOOLEAN DEFAULT FALSE
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id SERIAL PRIMARY KEY,
            quiz_id INTEGER NOT NULL
                REFERENCES quizzes(id)
                ON DELETE CASCADE,
            student_id INTEGER NOT NULL
                REFERENCES students(id)
                ON DELETE CASCADE,
            score INTEGER NOT NULL DEFAULT 0,
            total_questions INTEGER NOT NULL DEFAULT 0,
            percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
            passed BOOLEAN NOT NULL DEFAULT FALSE,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS answers (
            id SERIAL PRIMARY KEY,
            attempt_id INTEGER NOT NULL
                REFERENCES quiz_attempts(id)
                ON DELETE CASCADE,
            question_id INTEGER NOT NULL
                REFERENCES questions(id)
                ON DELETE CASCADE,
            selected_option_id INTEGER
                REFERENCES options(id)
                ON DELETE SET NULL,
            is_correct BOOLEAN NOT NULL DEFAULT FALSE
        )
    `);

    console.log("PostgreSQL database connected!");
}

// ==========================================
// AUTHENTICATION
// ==========================================

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    const token =
        authHeader && authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;

    if (!token) {
        return res.status(401).json({
            error: "Access token required"
        });
    }

    jwt.verify(
        token,
        process.env.JWT_SECRET,
        (error, user) => {
            if (error) {
                return res.status(403).json({
                    error: "Invalid or expired token"
                });
            }

            req.user = user;

            console.log(
                "JWT VERIFIED:",
                JSON.stringify(req.user)
            );

            next();
        }
    );
}

// ==========================================
// ROLE AUTHORIZATION
// ==========================================

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: "Authentication required"
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        next();
    };
}

// ==========================================
// REGISTER
// ==========================================

app.post("/api/register", async (req, res) => {
    const client = await pool.connect();

    try {
        const { email, password, name, surname } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: "Password must be at least 6 characters"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await client.query(
            "SELECT id FROM users WHERE email = $1",
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: "User already exists"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await client.query("BEGIN");

        const userResult = await client.query(
            `INSERT INTO users
             (email, password_hash, role)
             VALUES ($1, $2, 'student')
             RETURNING id, email, role`,
            [normalizedEmail, passwordHash]
        );

        const user = userResult.rows[0];

        // Create a student profile automatically.
        // Temporary names are used if the frontend does not
        // send name/surname yet.
        await client.query(
            `INSERT INTO students
             (user_id, name, surname)
             VALUES ($1, $2, $3)`,
            [
                user.id,
                name?.trim() || "Student",
                surname?.trim() || "User"
            ]
        );

        await client.query("COMMIT");

        res.status(201).json({
            message: "Student registered successfully",
            user
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Registration error:", error);

        res.status(500).json({
            error: "Registration failed"
        });

    } finally {
        client.release();
    }
});

// ==========================================
// LOGIN
// ==========================================

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        const profileResult = await pool.query(
    `SELECT name, surname
     FROM students
     WHERE user_id = $1`,
    [user.id]
);

const studentProfile = profileResult.rows[0] || {};
console.log("LOGIN USER:", {
    id: user.id,
    email: user.email,
    role: user.role,
    name: studentProfile.name,
    surname: studentProfile.surname
});
res.json({
    message: "Login successful",
    token,
    user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: studentProfile.name || "",
        surname: studentProfile.surname || ""
    }
});

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            error: "Login failed"
        });
    }
});

// ==========================================
// CURRENT USER
// ==========================================

app.get(
    "/api/me",
    authenticateToken,
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT
                    u.id,
                    u.email,
                    u.role,
                    s.id AS student_id,
                    s.name,
                    s.surname
                 FROM users u
                 LEFT JOIN students s
                    ON s.user_id = u.id
                 WHERE u.id = $1`,
                [req.user.userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "User not found"
                });
            }

            res.json(result.rows[0]);

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Failed to retrieve user"
            });
        }
    }
);

// ==========================================
// UPDATE STUDENT PROFILE
// ==========================================

app.put(
    "/api/student/profile",
    authenticateToken,
    requireRole("student"),
    async (req, res) => {
        try {
            const { name, surname } = req.body;

            if (!name || !surname) {
                return res.status(400).json({
                    error: "Name and surname are required"
                });
            }

            const result = await pool.query(
                `UPDATE students
                 SET name = $1,
                     surname = $2
                 WHERE user_id = $3
                 RETURNING *`,
                [
                    name.trim(),
                    surname.trim(),
                    req.user.userId
                ]
            );

            res.json({
                message: "Profile updated",
                student: result.rows[0]
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Failed to update profile"
            });
        }
    }
);

// ==========================================
// STUDENT DASHBOARD
// ==========================================

app.get(
    "/api/student/dashboard",
    (req, res, next) => {
        console.log("=== STUDENT DASHBOARD REQUEST ===");
        console.log("Authorization header:", req.headers.authorization || "MISSING");
        next();
    },
    authenticateToken,
    requireRole("student"),
    async (req, res) => {
        try {
            const studentResult = await pool.query(
                `SELECT id, name, surname
                 FROM students
                 WHERE user_id = $1`,
                [req.user.userId]
            );

            if (studentResult.rows.length === 0) {
                return res.status(404).json({
                    error: "Student profile not found"
                });
            }

            console.log(
                "STUDENT PROFILE RESULT:",
                JSON.stringify(studentResult.rows)
            );

            const student = studentResult.rows[0];

            const attempts = await pool.query(
    `SELECT
        (SELECT COUNT(*)::int
         FROM quizzes) AS total_quizzes,

        COUNT(*)::int AS attempts,

        COALESCE(
            AVG(percentage),
            0
        )::numeric(5,2) AS average_percentage,

        COALESCE(
            SUM(
                CASE
                    WHEN passed = TRUE THEN 1
                    ELSE 0
                END
            ),
            0
        )::int AS passed,

        COALESCE(
            SUM(
                CASE
                    WHEN passed = FALSE THEN 1
                    ELSE 0
                END
            ),
            0
        )::int AS failed

     FROM quiz_attempts
     WHERE student_id = $1`,
    [student.id]
);
            console.log(
                "DASHBOARD STATISTICS:",
                JSON.stringify(attempts.rows)
            );

            res.json({
                student,
                statistics: attempts.rows[0]
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Failed to load dashboard"
            });
        }
    }
);

// ==========================================
// GET AVAILABLE QUIZZES
// ==========================================

app.get(
    "/api/quizzes",
    authenticateToken,
    async (req, res) => {
        try {
            let query;
            let params = [];

            if (req.user.role === "student") {
                query = `
                    SELECT
                        q.id,
                        q.title,
                        q.description,
                        q.created_at,
                        q.time_limit,
                        q.attempts_allowed,
                        q.start_at,
                        q.end_at,
                        q.published,
                        COUNT(DISTINCT qu.id)::int AS question_count,
                        COUNT(DISTINCT qa.id) FILTER (
                            WHERE qa.completed_at IS NOT NULL
                        )::int AS attempts_used,
                        COUNT(DISTINCT qa.id) FILTER (
                            WHERE qa.completed_at IS NULL
                        )::int AS unfinished_attempts
                    FROM quizzes q
                    LEFT JOIN questions qu
                        ON qu.quiz_id = q.id
                    LEFT JOIN students s
                        ON s.user_id = $1
                    LEFT JOIN quiz_attempts qa
                        ON qa.quiz_id = q.id
                       AND qa.student_id = s.id
                    WHERE q.published = TRUE
                    GROUP BY q.id
                    ORDER BY q.id DESC
                `;

                params = [req.user.userId];

            } else {
                query = `
                    SELECT
                        q.id,
                        q.title,
                        q.description,
                        q.created_at,
                        q.time_limit,
                        q.attempts_allowed,
                        q.start_at,
                        q.end_at,
                        q.published,
                        COUNT(DISTINCT qu.id)::int AS question_count
                    FROM quizzes q
                    LEFT JOIN questions qu
                        ON qu.quiz_id = q.id
                    GROUP BY q.id
                    ORDER BY q.id DESC
                `;
            }

            const result = await pool.query(query, params);

            res.json(result.rows);

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Failed to retrieve quizzes"
            });
        }
    }
);

// ==========================================
// GET SINGLE QUIZ
// ==========================================

// ==========================================

app.get(
    "/api/quizzes/:id",
    authenticateToken,
    async (req, res) => {
        try {
            const quizId = Number(req.params.id);

            if (!Number.isInteger(quizId)) {
                return res.status(400).json({
                    error: "Invalid quiz ID"
                });
            }

            const quizResult = await pool.query(
                `SELECT
                    id,
                    title,
                    description,
                    created_at,
                    time_limit,
                    attempts_allowed,
                    start_at,
                    end_at,
                    published
                 FROM quizzes
                 WHERE id = $1`,
                [quizId]
            );

            if (quizResult.rows.length === 0) {
                return res.status(404).json({
                    error: "Quiz not found"
                });
            }

            const quiz = quizResult.rows[0];

            if (req.user.role === "student") {
                if (!quiz.published) {
                    return res.status(403).json({
                        error: "This quiz is not currently available."
                    });
                }

                const now = new Date();

                if (
                    quiz.start_at &&
                    now < new Date(quiz.start_at)
                ) {
                    return res.status(403).json({
                        error: `This quiz becomes available on ${new Date(
                            quiz.start_at
                        ).toLocaleString()}.`
                    });
                }

                if (
                    quiz.end_at &&
                    now > new Date(quiz.end_at)
                ) {
                    return res.status(403).json({
                        error: "This quiz is no longer available."
                    });
                }

                const studentResult = await pool.query(
                    `SELECT id
                     FROM students
                     WHERE user_id = $1`,
                    [req.user.userId]
                );

                if (studentResult.rows.length === 0) {
                    return res.status(404).json({
                        error: "Student profile not found"
                    });
                }

                const studentId = studentResult.rows[0].id;

                const attemptsResult = await pool.query(
                    `SELECT COUNT(*)::int AS attempts_used
                     FROM quiz_attempts
                     WHERE quiz_id = $1
                       AND student_id = $2
                       AND completed_at IS NOT NULL`,
                    [quizId, studentId]
                );

                const attemptsUsed =
                    Number(
                        attemptsResult.rows[0].attempts_used
                    );

                if (
                    attemptsUsed >=
                    Number(quiz.attempts_allowed || 1)
                ) {
                    return res.status(403).json({
                        error: "You have used all attempts allowed for this quiz."
                    });
                }
            }

            const questionsResult = await pool.query(
                `SELECT
                    q.id,
                    q.question
                 FROM questions q
                 WHERE q.quiz_id = $1
                 ORDER BY q.id`,
                [quizId]
            );

            const questions = [];

            for (const question of questionsResult.rows) {
                const optionsResult = await pool.query(
                    `SELECT
                        id,
                        option_text
                     FROM options
                     WHERE question_id = $1
                     ORDER BY id`,
                    [question.id]
                );

                questions.push({
                    id: question.id,
                    question: question.question,
                    options: optionsResult.rows
                });
            }

            res.json({
                quiz,
                questions
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Failed to retrieve quiz"
            });
        }
    }
);

// ==========================================
// START / RESUME QUIZ
// ==========================================

app.post(
    "/api/quizzes/:id/start",
    authenticateToken,
    requireRole("student"),
    async (req, res) => {
        const client = await pool.connect();

        try {
            const quizId = Number(req.params.id);

            if (!Number.isInteger(quizId)) {
                return res.status(400).json({
                    error: "Invalid quiz ID"
                });
            }

            const quizResult = await client.query(
                `SELECT
                    id,
                    title,
                    description,
                    created_at,
                    time_limit,
                    attempts_allowed,
                    start_at,
                    end_at,
                    published
                 FROM quizzes
                 WHERE id = $1`,
                [quizId]
            );

            if (quizResult.rows.length === 0) {
                return res.status(404).json({
                    error: "Quiz not found"
                });
            }

            const quiz = quizResult.rows[0];

            if (!quiz.published) {
                return res.status(403).json({
                    error: "This quiz is not currently available."
                });
            }

            const now = new Date();

            if (
                quiz.start_at &&
                now < new Date(quiz.start_at)
            ) {
                return res.status(403).json({
                    error: `This quiz becomes available on ${new Date(
                        quiz.start_at
                    ).toLocaleString()}.`
                });
            }

            if (
                quiz.end_at &&
                now > new Date(quiz.end_at)
            ) {
                return res.status(403).json({
                    error: "This quiz is no longer available."
                });
            }

            const studentResult = await client.query(
                `SELECT id
                 FROM students
                 WHERE user_id = $1`,
                [req.user.userId]
            );

            if (studentResult.rows.length === 0) {
                return res.status(404).json({
                    error: "Student profile not found"
                });
            }

            const studentId = studentResult.rows[0].id;

            // --------------------------------------------------
            // RESUME EXISTING UNFINISHED ATTEMPT
            // --------------------------------------------------

            const unfinishedResult = await client.query(
                `SELECT
                    id,
                    started_at,
                    EXTRACT(EPOCH FROM started_at) * 1000 AS started_at_ms
                 FROM quiz_attempts
                 WHERE quiz_id = $1
                   AND student_id = $2
                   AND completed_at IS NULL
                 ORDER BY started_at DESC
                 LIMIT 1`,
                [
                    quizId,
                    studentId
                ]
            );

            let attemptId;
            let startedAt;
            let startedAtMs;

            if (unfinishedResult.rows.length > 0) {

                attemptId =
                    unfinishedResult.rows[0].id;

                startedAt =
                    unfinishedResult.rows[0].started_at;

                startedAtMs =
                    Number(
                        unfinishedResult.rows[0].started_at_ms
                    );

            } else {

                // --------------------------------------------------
                // ONLY COMPLETED ATTEMPTS COUNT
                // --------------------------------------------------

                const attemptsResult = await client.query(
                    `SELECT COUNT(*)::int AS attempts_used
                     FROM quiz_attempts
                     WHERE quiz_id = $1
                       AND student_id = $2
                       AND completed_at IS NOT NULL`,
                    [
                        quizId,
                        studentId
                    ]
                );

                const attemptsUsed =
                    Number(
                        attemptsResult.rows[0].attempts_used
                    );

                if (
                    attemptsUsed >=
                    Number(quiz.attempts_allowed || 1)
                ) {
                    return res.status(403).json({
                        error:
                            "You have used all attempts allowed for this quiz."
                    });
                }

                const questionsCountResult =
                    await client.query(
                        `SELECT COUNT(*)::int AS total
                         FROM questions
                         WHERE quiz_id = $1`,
                        [quizId]
                    );

                const totalQuestions =
                    Number(
                        questionsCountResult.rows[0].total
                    );

                if (totalQuestions === 0) {
                    return res.status(400).json({
                        error: "This quiz has no questions."
                    });
                }

                const attemptResult =
                    await client.query(
                        `INSERT INTO quiz_attempts
                         (
                            quiz_id,
                            student_id,
                            score,
                            total_questions,
                            percentage,
                            passed,
                            started_at,
                            completed_at
                         )
                         VALUES
                         (
                            $1,
                            $2,
                            0,
                            $3,
                            0,
                            FALSE,
                            CURRENT_TIMESTAMP,
                            NULL
                         )
                         RETURNING
                            id,
                            started_at,
                            EXTRACT(EPOCH FROM started_at) * 1000 AS started_at_ms`,
                        [
                            quizId,
                            studentId,
                            totalQuestions
                        ]
                    );

                attemptId =
                    attemptResult.rows[0].id;

                startedAt =
                    attemptResult.rows[0].started_at;

                startedAtMs =
                    Number(
                        attemptResult.rows[0].started_at_ms
                    );
            }

            // --------------------------------------------------
            // LOAD QUESTIONS
            // --------------------------------------------------

            const questionsResult =
                await client.query(
                    `SELECT
                        q.id,
                        q.question
                     FROM questions q
                     WHERE q.quiz_id = $1
                     ORDER BY q.id`,
                    [quizId]
                );

            if (questionsResult.rows.length === 0) {
                return res.status(400).json({
                    error: "This quiz has no questions."
                });
            }

            const questions = [];

            for (const question of questionsResult.rows) {

                const optionsResult =
                    await client.query(
                        `SELECT
                            id,
                            option_text
                         FROM options
                         WHERE question_id = $1
                         ORDER BY id`,
                        [question.id]
                    );

                questions.push({
                    id: question.id,
                    question: question.question,
                    options: optionsResult.rows
                });
            }

            // --------------------------------------------------
            // RETURN ISO TIMESTAMP
            // --------------------------------------------------

            const startedAtISO =
                new Date(startedAtMs).toISOString();

            res.status(201).json({
                attemptId,
                startedAt: startedAtISO,
                startedAtMs,
                quiz,
                questions
            });

        } catch (error) {

            console.error(
                "Quiz start/resume error:",
                error
            );

            res.status(500).json({
                error: "Failed to start quiz"
            });

        } finally {
            client.release();
        }
    }
);


// ==========================================
// SUBMIT QUIZ
// ==========================================

app.post(
    "/api/quizzes/:id/submit",
    authenticateToken,
    requireRole("student"),
    async (req, res) => {

        const client = await pool.connect();

        try {

            const quizId =
                Number(req.params.id);

            const submittedAnswers =
                req.body.answers;

            const attemptId =
                Number(req.body.attemptId);

            if (!Number.isInteger(quizId)) {
                return res.status(400).json({
                    error: "Invalid quiz ID"
                });
            }

            if (!Number.isInteger(attemptId)) {
                return res.status(400).json({
                    error: "Invalid quiz attempt"
                });
            }

            if (!Array.isArray(submittedAnswers)) {
                return res.status(400).json({
                    error: "Answers must be an array"
                });
            }

            const studentResult =
                await client.query(
                    `SELECT id
                     FROM students
                     WHERE user_id = $1`,
                    [req.user.userId]
                );

            if (studentResult.rows.length === 0) {
                return res.status(404).json({
                    error: "Student profile not found"
                });
            }

            const studentId =
                studentResult.rows[0].id;

            const attemptResult =
                await client.query(
                    `SELECT
                        qa.id,
                        qa.started_at,
                        EXTRACT(EPOCH FROM qa.started_at) * 1000 AS started_at_ms,
                        qa.completed_at,
                        q.time_limit,
                        q.end_at,
                        q.published
                     FROM quiz_attempts qa
                     JOIN quizzes q
                       ON q.id = qa.quiz_id
                     WHERE qa.id = $1
                       AND qa.quiz_id = $2
                       AND qa.student_id = $3`,
                    [
                        attemptId,
                        quizId,
                        studentId
                    ]
                );

            if (attemptResult.rows.length === 0) {
                return res.status(404).json({
                    error: "Quiz attempt not found"
                });
            }

            const attempt =
                attemptResult.rows[0];

            if (attempt.completed_at) {
                return res.status(409).json({
                    error:
                        "This quiz attempt has already been submitted."
                });
            }

            if (!attempt.published) {
                return res.status(403).json({
                    error:
                        "This quiz is no longer available."
                });
            }

            // --------------------------------------------------
            // SERVER-AUTHORITATIVE TIME CHECK
            // --------------------------------------------------

            const startedAtMs =
                Number(attempt.started_at_ms);

            if (
                !Number.isFinite(startedAtMs) ||
                startedAtMs <= 0
            ) {
                return res.status(500).json({
                    error:
                        "Unable to determine quiz start time."
                });
            }

            const elapsedSeconds =
                (Date.now() -
                 startedAtMs) / 1000;

            const allowedSeconds =
                Number(attempt.time_limit || 30) * 60;

            const now = new Date();

            // --------------------------------------------------
            // LOAD QUESTIONS BEFORE FINALIZING
            // --------------------------------------------------

            const questionsResult =
                await client.query(
                    `SELECT
                        q.id AS question_id,
                        o.id AS correct_option_id
                     FROM questions q
                     LEFT JOIN options o
                        ON o.question_id = q.id
                       AND o.is_correct = TRUE
                     WHERE q.quiz_id = $1
                     ORDER BY q.id`,
                    [quizId]
                );

            const questions =
                questionsResult.rows;

            if (questions.length === 0) {
                return res.status(400).json({
                    error: "This quiz has no questions"
                });
            }

            // --------------------------------------------------
            // PROCESS ANSWERS
            // --------------------------------------------------

            const answerMap =
                new Map();

            for (const answer of submittedAnswers) {

                answerMap.set(
                    Number(answer.questionId),
                    Number(answer.selectedOptionId)
                );
            }

            let score = 0;

            const processedAnswers =
                questions.map(question => {

                    const selectedOptionId =
                        answerMap.get(
                            Number(question.question_id)
                        ) || null;

                    const isCorrect =
                        selectedOptionId !== null &&
                        Number(selectedOptionId) ===
                        Number(question.correct_option_id);

                    if (isCorrect) {
                        score++;
                    }

                    return {
                        questionId:
                            question.question_id,

                        selectedOptionId,

                        isCorrect
                    };
                });

            const totalQuestions =
                questions.length;

            const percentage =
                (score / totalQuestions) * 100;

            const passed =
                percentage >= 50;

            // --------------------------------------------------
            // HANDLE TIME EXPIRY
            // --------------------------------------------------

            if (elapsedSeconds > allowedSeconds) {

                await client.query("BEGIN");

                await client.query(
                    `UPDATE quiz_attempts
                     SET
                        score = $1,
                        total_questions = $2,
                        percentage = $3,
                        passed = $4,
                        completed_at = CURRENT_TIMESTAMP
                     WHERE id = $5`,
                    [
                        score,
                        totalQuestions,
                        percentage.toFixed(2),
                        passed,
                        attemptId
                    ]
                );

                await client.query(
                    `DELETE FROM answers
                     WHERE attempt_id = $1`,
                    [attemptId]
                );

                for (const answer of processedAnswers) {

                    await client.query(
                        `INSERT INTO answers
                         (
                            attempt_id,
                            question_id,
                            selected_option_id,
                            is_correct
                         )
                         VALUES ($1, $2, $3, $4)`,
                        [
                            attemptId,
                            answer.questionId,
                            answer.selectedOptionId,
                            answer.isCorrect
                        ]
                    );
                }

                await client.query("COMMIT");

                return res.status(201).json({
                    message:
                        "Time expired. Your answers were submitted automatically.",
                    result: {
                        attemptId,
                        score,
                        totalQuestions,
                        percentage:
                            Number(
                                percentage.toFixed(2)
                            ),
                        passed
                    }
                });
            }

            if (
                attempt.end_at &&
                now > new Date(attempt.end_at)
            ) {
                return res.status(403).json({
                    error:
                        "The quiz availability period has ended."
                });
            }

            // --------------------------------------------------
            // SAVE NORMAL SUBMISSION
            // --------------------------------------------------

            await client.query("BEGIN");

            await client.query(
                `UPDATE quiz_attempts
                 SET
                    score = $1,
                    total_questions = $2,
                    percentage = $3,
                    passed = $4,
                    completed_at = CURRENT_TIMESTAMP
                 WHERE id = $5`,
                [
                    score,
                    totalQuestions,
                    percentage.toFixed(2),
                    passed,
                    attemptId
                ]
            );

            await client.query(
                `DELETE FROM answers
                 WHERE attempt_id = $1`,
                [attemptId]
            );

            for (const answer of processedAnswers) {

                await client.query(
                    `INSERT INTO answers
                     (
                        attempt_id,
                        question_id,
                        selected_option_id,
                        is_correct
                     )
                     VALUES ($1, $2, $3, $4)`,
                    [
                        attemptId,
                        answer.questionId,
                        answer.selectedOptionId,
                        answer.isCorrect
                    ]
                );
            }

            await client.query("COMMIT");

            res.status(201).json({
                message:
                    "Quiz submitted successfully",

                result: {
                    attemptId,
                    score,
                    totalQuestions,
                    percentage:
                        Number(
                            percentage.toFixed(2)
                        ),
                    passed
                }
            });

        } catch (error) {

            try {
                await client.query("ROLLBACK");
            } catch (_) {}

            console.error(
                "Quiz submission error:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to submit quiz"
            });

        } finally {
            client.release();
        }
    }
);


// // ==========================================
// QUIZ MANAGEMENT
// ==========================================

// Publish / disable quiz
app.patch(
    "/api/quizzes/:id/status",
    authenticateToken,
    (req, res, next) => {
        if (
            req.user.role !== "teacher" &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                error: "Access denied"
            });
        }
        next();
    },
    async (req, res) => {
        try {
            const quizId = Number(req.params.id);

            if (!Number.isInteger(quizId)) {
                return res.status(400).json({
                    error: "Invalid quiz ID"
                });
            }

            const result = await pool.query(
                `UPDATE quizzes
                 SET published = NOT published
                 WHERE id = $1
                 RETURNING id, title, published`,
                [quizId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Quiz not found"
                });
            }

            res.json({
                message: result.rows[0].published
                    ? "Quiz published successfully."
                    : "Quiz disabled successfully.",
                quiz: result.rows[0]
            });

        } catch (error) {
            console.error(
                "Quiz status error:",
                error
            );

            res.status(500).json({
                error: "Failed to update quiz status"
            });
        }
    }
);

// Delete quiz
app.delete(
    "/api/quizzes/:id",
    authenticateToken,
    (req, res, next) => {
        if (
            req.user.role !== "teacher" &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                error: "Access denied"
            });
        }
        next();
    },
    async (req, res) => {
        try {
            const quizId = Number(req.params.id);

            if (!Number.isInteger(quizId)) {
                return res.status(400).json({
                    error: "Invalid quiz ID"
                });
            }

            const result = await pool.query(
                `DELETE FROM quizzes
                 WHERE id = $1
                 RETURNING id, title`,
                [quizId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Quiz not found"
                });
            }

            res.json({
                message: "Quiz deleted successfully.",
                quiz: result.rows[0]
            });

        } catch (error) {
            console.error(
                "Quiz deletion error:",
                error
            );

            res.status(500).json({
                error: "Failed to delete quiz"
            });
        }
    }
);

// ==========================================
// STUDENT RESULTS
// ==========================================

app.get(
    "/api/student/results",
    authenticateToken,
    requireRole("student"),
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT
                    qa.id,
                    q.title,
                    qa.score,
                    qa.total_questions,
                    qa.percentage,
                    qa.passed,
                    qa.completed_at
                 FROM quiz_attempts qa
                 JOIN quizzes q
                    ON q.id = qa.quiz_id
                 JOIN students s
                    ON s.id = qa.student_id
                 WHERE s.user_id = $1
                 ORDER BY qa.completed_at DESC`,
                [req.user.userId]
            );

            res.json(result.rows);

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Failed to retrieve results"
            });
        }
    }
);

// ==========================================
// STUDENT RANKING
// ==========================================
//
// Students can see:
// - ranking
// - name
// - pass/fail
//
// They cannot see another student's actual mark.

app.get(
    "/api/student/ranking",
    authenticateToken,
    requireRole("student"),
    async (req, res) => {
        try {
            const result = await pool.query(
                `WITH student_scores AS (
                    SELECT
                        s.id,
                        s.name,
                        s.surname,
                        COALESCE(
                            AVG(qa.percentage),
                            0
                        ) AS average_percentage,
                        CASE
                            WHEN COALESCE(
                                AVG(qa.percentage), 0
                            ) >= 50
                            THEN TRUE
                            ELSE FALSE
                        END AS passed
                    FROM students s
                    LEFT JOIN quiz_attempts qa
                        ON qa.student_id = s.id
                    GROUP BY
                        s.id,
                        s.name,
                        s.surname
                )
                SELECT
                    RANK() OVER (
                        ORDER BY average_percentage DESC
                    )::int AS rank,
                    id,
                    name,
                    surname,
                    passed
                FROM student_scores
                ORDER BY rank, name`
            );

            res.json(result.rows);

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Failed to retrieve ranking"
            });
        }
    }
);

// ==========================================
// TEACHER - ALL STUDENTS
// ==========================================

app.get(
    "/api/teacher/students",
    authenticateToken,
    (req, res, next) => {
        if (
            req.user.role !== "teacher" &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                error: "Access denied"
            });
        }
        next();
    },
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT
                    s.id,
                    s.user_id,
                    s.name,
                    s.surname,
                    u.email,
                    COALESCE(
                        COUNT(qa.id), 0
                    )::int AS attempts,
                    COALESCE(
                        ROUND(AVG(qa.percentage), 2),
                        0
                    ) AS average_percentage,
                    COALESCE(
                        MAX(qa.percentage),
                        0
                    ) AS highest_percentage
                 FROM students s
                 JOIN users u
                    ON u.id = s.user_id
                 LEFT JOIN quiz_attempts qa
                    ON qa.student_id = s.id
                 GROUP BY
                    s.id,
                    s.user_id,
                    s.name,
                    s.surname,
                    u.email
                 ORDER BY average_percentage DESC`
            );

            res.json(result.rows);

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Failed to retrieve students"
            });
        }
    }
);

// ==========================================
// TEACHER - PASSED STUDENTS
// ==========================================

app.get(
    "/api/teacher/students/passed",
    authenticateToken,
    (req, res, next) => {
        if (
            req.user.role !== "teacher" &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                error: "Access denied"
            });
        }
        next();
    },
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT
                    s.id,
                    s.name,
                    s.surname,
                    u.email,
                    COUNT(qa.id)::int AS attempts,
                    ROUND(AVG(qa.percentage), 2) AS average_percentage,
                    MAX(qa.percentage) AS highest_percentage
                 FROM students s
                 JOIN users u
                    ON u.id = s.user_id
                 JOIN quiz_attempts qa
                    ON qa.student_id = s.id
                 GROUP BY
                    s.id,
                    s.name,
                    s.surname,
                    u.email
                 HAVING AVG(qa.percentage) >= 50
                 ORDER BY average_percentage DESC`
            );

            res.json(result.rows);

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Failed to retrieve passed students"
            });
        }
    }
);


// ==========================================
// TEACHER - FAILED STUDENTS
// ==========================================

app.get(
    "/api/teacher/students/failed",
    authenticateToken,
    (req, res, next) => {
        if (
            req.user.role !== "teacher" &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                error: "Access denied"
            });
        }
        next();
    },
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT
                    s.id,
                    s.name,
                    s.surname,
                    u.email,
                    COUNT(qa.id)::int AS attempts,
                    ROUND(AVG(qa.percentage), 2) AS average_percentage,
                    MAX(qa.percentage) AS highest_percentage
                 FROM students s
                 JOIN users u
                    ON u.id = s.user_id
                 JOIN quiz_attempts qa
                    ON qa.student_id = s.id
                 GROUP BY
                    s.id,
                    s.name,
                    s.surname,
                    u.email
                 HAVING AVG(qa.percentage) < 50
                 ORDER BY average_percentage DESC`
            );

            res.json(result.rows);

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Failed to retrieve failed students"
            });
        }
    }
);

// ==========================================
// TEACHER - PERFORMANCE SUMMARY
// ==========================================

app.get(
    "/api/teacher/analytics",
    authenticateToken,
    (req, res, next) => {
        if (
            req.user.role !== "teacher" &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                error: "Access denied"
            });
        }
        next();
    },
    async (req, res) => {
        try {

            // ------------------------------------------
            // TOTAL STUDENTS
            // ------------------------------------------

            const totalStudents = await pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM students`
            );


            // ------------------------------------------
            // PASSED STUDENTS
            // Based on overall student average
            // ------------------------------------------

            const passedStudents = await pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM (
                    SELECT
                        student_id,
                        AVG(percentage) AS average_percentage
                    FROM quiz_attempts
                    GROUP BY student_id
                    HAVING AVG(percentage) >= 50
                 ) results`
            );


            // ------------------------------------------
            // FAILED STUDENTS
            // Based on overall student average
            // ------------------------------------------

            const failedStudents = await pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM (
                    SELECT
                        student_id,
                        AVG(percentage) AS average_percentage
                    FROM quiz_attempts
                    GROUP BY student_id
                    HAVING AVG(percentage) < 50
                 ) results`
            );


            // ------------------------------------------
            // HIGHEST OVERALL PERFORMANCE
            // Highest student average
            // ------------------------------------------

            const highest = await pool.query(
                `SELECT
                    s.name,
                    s.surname,
                    ROUND(AVG(qa.percentage), 2) AS percentage
                 FROM students s
                 JOIN quiz_attempts qa
                    ON qa.student_id = s.id
                 GROUP BY
                    s.id,
                    s.name,
                    s.surname
                 ORDER BY AVG(qa.percentage) DESC
                 LIMIT 1`
            );


            // ------------------------------------------
            // LOWEST OVERALL PERFORMANCE
            // Lowest student average
            // ------------------------------------------

            const lowest = await pool.query(
                `SELECT
                    s.name,
                    s.surname,
                    ROUND(AVG(qa.percentage), 2) AS percentage
                 FROM students s
                 JOIN quiz_attempts qa
                    ON qa.student_id = s.id
                 GROUP BY
                    s.id,
                    s.name,
                    s.surname
                 ORDER BY AVG(qa.percentage) ASC
                 LIMIT 1`
            );


            // ------------------------------------------
            // RESPONSE
            // ------------------------------------------

            res.json({

                totalStudents:
                    totalStudents.rows[0].count,

                passedStudents:
                    passedStudents.rows[0].count,

                failedStudents:
                    failedStudents.rows[0].count,

                highest_percentage:
                    highest.rows.length > 0
                        ? Number(highest.rows[0].percentage)
                        : 0,

                lowest_percentage:
                    lowest.rows.length > 0
                        ? Number(lowest.rows[0].percentage)
                        : 0,

                highestPerformer:
                    highest.rows[0] || null,

                lowestPerformer:
                    lowest.rows[0] || null

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error: "Failed to retrieve analytics"
            });
        }
    }
);

// ==========================================
// TEACHER - CREATE QUIZ
// ==========================================

app.post(
    "/api/quizzes",
    authenticateToken,
    (req, res, next) => {
        if (
            req.user.role !== "teacher" &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                error: "Access denied"
            });
        }
        next();
    },
    async (req, res) => {

        const client = await pool.connect();

        try {

            const {
                title,
                description,
                timeLimit,
                attemptsAllowed,
                startAt,
                endAt,
                published,
                questions
            } = req.body;


            if (
                !title ||
                !Array.isArray(questions)
            ) {

                return res.status(400).json({
                    error:
                        "Title and questions are required"
                });
            }


            if (questions.length === 0) {

                return res.status(400).json({
                    error:
                        "Quiz must contain at least one question"
                });
            }


            const parsedTimeLimit =
                Number(timeLimit);


            const parsedAttemptsAllowed =
                Number(attemptsAllowed);


            if (
                !Number.isInteger(parsedTimeLimit) ||
                parsedTimeLimit < 1
            ) {

                return res.status(400).json({
                    error:
                        "Time limit must be at least 1 minute"
                });
            }


            if (
                !Number.isInteger(parsedAttemptsAllowed) ||
                parsedAttemptsAllowed < 1
            ) {

                return res.status(400).json({
                    error:
                        "Attempts allowed must be at least 1"
                });
            }


            if (
                startAt &&
                endAt &&
                new Date(startAt) >= new Date(endAt)
            ) {

                return res.status(400).json({
                    error:
                        "End date and time must be after the start date and time"
                });
            }


            await client.query("BEGIN");


            const quizResult =
                await client.query(
                    `INSERT INTO quizzes
                     (
                        title,
                        description,
                        time_limit,
                        attempts_allowed,
                        start_at,
                        end_at,
                        published
                     )
                     VALUES
                     (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7
                     )
                     RETURNING *`,
                    [
                        title.trim(),
                        description?.trim() || "",
                        parsedTimeLimit,
                        parsedAttemptsAllowed,
                        startAt || null,
                        endAt || null,
                        published === true
                    ]
                );


            const quiz =
                quizResult.rows[0];


            for (const item of questions) {

                if (
                    !item.question ||
                    !Array.isArray(item.options) ||
                    item.options.length < 2
                ) {

                    throw new Error(
                        "Each question needs at least two options"
                    );
                }


                const questionResult =
                    await client.query(
                        `INSERT INTO questions
                         (quiz_id, question)
                         VALUES ($1, $2)
                         RETURNING id`,
                        [
                            quiz.id,
                            item.question.trim()
                        ]
                    );


                const questionId =
                    questionResult.rows[0].id;


                let correctCount = 0;


                for (const option of item.options) {

                    if (!option.text) {

                        throw new Error(
                            "Every option needs text"
                        );
                    }


                    if (
                        option.isCorrect === true
                    ) {
                        correctCount++;
                    }


                    await client.query(
                        `INSERT INTO options
                         (
                            question_id,
                            option_text,
                            is_correct
                         )
                         VALUES ($1, $2, $3)`,
                        [
                            questionId,
                            option.text.trim(),
                            option.isCorrect === true
                        ]
                    );
                }


                if (correctCount !== 1) {

                    throw new Error(
                        "Each question must have exactly one correct option"
                    );
                }
            }


            await client.query("COMMIT");


            res.status(201).json({
                message:
                    "Quiz created successfully",
                quiz
            });


        } catch (error) {

            await client.query("ROLLBACK");


            console.error(
                "Quiz creation error:",
                error.message
            );


            res.status(400).json({
                error: error.message
            });


        } finally {

            client.release();
        }
    }
);

// ==========================================
// ADMIN - ALL USERS
// ==========================================

app.get(
    "/api/admin/users",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT
                    u.id,
                    u.email,
                    u.role,
                    u.created_at,
                    s.name,
                    s.surname
                 FROM users u
                 LEFT JOIN students s
                    ON s.user_id = u.id
                 ORDER BY u.id`
            );

            res.json(result.rows);

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Failed to retrieve users"
            });
        }
    }
);

// ==========================================
// ADMIN - CHANGE USER ROLE
// ==========================================

app.put(
    "/api/admin/users/:id/role",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {
        try {
            const userId = Number(req.params.id);
            const { role } = req.body;

            const allowedRoles = [
                "student",
                "teacher",
                "admin"
            ];

            if (!allowedRoles.includes(role)) {
                return res.status(400).json({
                    error: "Invalid role"
                });
            }

            if (userId === req.user.userId) {
                return res.status(400).json({
                    error:
                        "You cannot change your own role"
                });
            }

            const result = await pool.query(
                `UPDATE users
                 SET role = $1
                 WHERE id = $2
                 RETURNING id, email, role`,
                [role, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "User not found"
                });
            }

            // If an existing user becomes a student,
            // make sure they have a student profile.
            if (role === "student") {
                await pool.query(
                    `INSERT INTO students
                     (user_id, name, surname)
                     VALUES ($1, 'Student', 'User')
                     ON CONFLICT (user_id)
                     DO NOTHING`,
                    [userId]
                );
            }

            res.json({
                message: "User role updated",
                user: result.rows[0]
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Failed to update role"
            });
        }
    }
);

// ==========================================
// ADMIN - DELETE USER
// ==========================================

app.delete(
    "/api/admin/users/:id",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {
        try {
            const userId = Number(req.params.id);

            if (userId === req.user.userId) {
                return res.status(400).json({
                    error:
                        "You cannot delete your own account"
                });
            }

            const result = await pool.query(
                `DELETE FROM users
                 WHERE id = $1
                 RETURNING id, email, role`,
                [userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "User not found"
                });
            }

            res.json({
                message: "User deleted successfully",
                user: result.rows[0]
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Failed to delete user"
            });
        }
    }
);

// ==========================================
// ORIGINAL CRUD - SAVE PERSON
// ==========================================

app.post(
    "/api/people",
    authenticateToken,
    async (req, res) => {
        try {
            const { name, surname } = req.body;

            if (!name || !surname) {
                return res.status(400).json({
                    error:
                        "Name and surname are required"
                });
            }

            const result = await pool.query(
                `INSERT INTO people
                 (name, surname)
                 VALUES ($1, $2)
                 RETURNING *`,
                [name, surname]
            );

            res.status(201).json({
                message:
                    "Person saved successfully",
                person: result.rows[0]
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error:
                    "Failed to save person"
            });
        }
    }
);

// ==========================================
// ORIGINAL CRUD - GET PEOPLE
// ==========================================

app.get(
    "/api/people",
    authenticateToken,
    async (req, res) => {
        try {
            const { search } = req.query;

            let result;

            if (search) {
                result = await pool.query(
                    `SELECT *
                     FROM people
                     WHERE name ILIKE $1
                        OR surname ILIKE $1
                     ORDER BY id DESC`,
                    [`%${search}%`]
                );
            } else {
                result = await pool.query(
                    `SELECT *
                     FROM people
                     ORDER BY id DESC`
                );
            }

            res.json(result.rows);

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error:
                    "Failed to retrieve people"
            });
        }
    }
);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        message: "Full-stack application API is running"
    });
});

// ==========================================
// START SERVER
// ==========================================

async function startServer() {
    try {
        await initializeDatabase();

        app.listen(PORT, () => {
            console.log(
                `Server running on port ${PORT}`
            );
        });

    } catch (error) {
        console.error(
            "Failed to start server:",
            error
        );

        process.exit(1);
    }
}

startServer();
