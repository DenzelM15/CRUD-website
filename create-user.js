require("dotenv").config();

const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function createUser() {
    try {
        const email = process.argv[2];
        const password = process.argv[3];
        const role = process.argv[4];

        const allowedRoles = ["student", "teacher", "admin"];

        if (!email || !password || !role) {
            console.log(`
Usage:

node create-user.js <email> <password> <role>

Example:

node create-user.js teacher@example.com MyPassword123 teacher
node create-user.js admin@example.com MyPassword123 admin

Allowed roles:
- student
- teacher
- admin
            `);

            process.exit(1);
        }

        if (!allowedRoles.includes(role)) {
            console.error(
                `❌ Invalid role. Use: ${allowedRoles.join(", ")}`
            );
            process.exit(1);
        }

        if (password.length < 6) {
            console.error(
                "❌ Password must be at least 6 characters."
            );
            process.exit(1);
        }

        const existingUser = await pool.query(
            "SELECT id, email, role FROM users WHERE email = $1",
            [email]
        );

        const passwordHash = await bcrypt.hash(password, 12);

        if (existingUser.rows.length > 0) {
            const user = existingUser.rows[0];

            await pool.query(
                `UPDATE users
                 SET password_hash = $1,
                     role = $2
                 WHERE id = $3`,
                [passwordHash, role, user.id]
            );

            console.log(`
✅ USER UPDATED

ID:    ${user.id}
Email: ${email}
Role:  ${role}
            `);
        } else {
            const result = await pool.query(
                `INSERT INTO users
                 (email, password_hash, role)
                 VALUES ($1, $2, $3)
                 RETURNING id, email, role`,
                [email, passwordHash, role]
            );

            const user = result.rows[0];

            console.log(`
✅ USER CREATED

ID:    ${user.id}
Email: ${user.email}
Role:  ${user.role}
            `);
        }

    } catch (error) {
        console.error("❌ Failed to create/update user:", error.message);
    } finally {
        await pool.end();
    }
}

createUser();
