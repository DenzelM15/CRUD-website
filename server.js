
require("dotenv").config();
const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Create table if it doesn't exist
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log("PostgreSQL database connected!");
}

initializeDatabase().catch((error) => {
    console.error("Database initialization failed:", error);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Register a new user
app.post("/api/register", async (req, res) => {
    try {
        const { email, password } = req.body;

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

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: "User already exists"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await pool.query(
            "INSERT INTO users (email, password_hash) VALUES ($1, $2)",
            [email, passwordHash]
        );

        res.status(201).json({
            message: "User registered successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Registration failed"
        });
    }
});
// Login
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
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
                email: user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        res.json({
            message: "Login successful",
            token
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Login failed"
        });
    }
});

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];

    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            error: "Access token required"
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (error, user) => {
        if (error) {
            return res.status(403).json({
                error: "Invalid or expired token"
            });
        }

        req.user = user;
        next();
    });
}


// Save person
app.post("/api/people", authenticateToken, async (req, res) => {
    try {
        const { name, surname } = req.body;

        if (!name || !surname) {
            return res.status(400).json({
                error: "Name and surname are required"
            });
        }

        await pool.query(
            "INSERT INTO people (name, surname) VALUES ($1, $2)",
            [name, surname]
        );

        res.json({
            message: "Person saved successfully"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Failed to save person"
        });
    }
});

// Get people
app.get("/api/people",authenticateToken, async (req, res) => {
    try {
        const { search } = req.query;

        let result;

        if (search) {
            result = await pool.query(
                `SELECT * FROM people
                 WHERE name ILIKE $1 OR surname ILIKE $1
                 ORDER BY id DESC`,
                [`%${search}%`]
            );
        } else {
            result = await pool.query(
                "SELECT * FROM people ORDER BY id DESC"
            );
        }

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Failed to retrieve people"
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
