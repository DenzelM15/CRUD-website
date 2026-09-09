const express = require("express");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const app = express();
const PORT = process.env.PORT || 3000;

// Database
const db = new DatabaseSync("test.db");

// Create table if it doesn't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        surname TEXT NOT NULL
    )
`);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Save person
app.post("/api/people", (req, res) => {
    const { name, surname } = req.body;

    if (!name || !surname) {
        return res.status(400).json({
            error: "Name and surname are required"
        });
    }

    const statement = db.prepare(
        "INSERT INTO people (name, surname) VALUES (?, ?)"
    );

    statement.run(name, surname);

    res.json({
        message: "Person saved successfully"
    });
});

// Get people
app.get("/api/people", (req, res) => {
    const statement = db.prepare(
        "SELECT * FROM people ORDER BY id DESC"
    );

    const people = statement.all();

    res.json(people);
});

app.delete("/api/people/:id", (req, res) => {
    const id = req.params.id;

    const statement = db.prepare(
        "DELETE FROM people WHERE id = ?"
    );

    statement.run(id);

    res.json({
        message: "Person deleted successfully"
    });
});

app.put("/api/people/:id", (req, res) => {
    const id = req.params.id;
    const { name, surname } = req.body;

    if (!name || !surname) {
        return res.status(400).json({
            error: "Name and surname are required"
        });
    }

    const statement = db.prepare(
        "UPDATE people SET name = ?, surname = ? WHERE id = ?"
    );

    statement.run(name, surname, id);

    res.json({
        message: "Person updated successfully"
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

