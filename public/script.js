const form = document.getElementById("personForm");
const peopleList = document.getElementById("peopleList");

let editingId = null;

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("name").value;
    const surname = document.getElementById("surname").value;

    // UPDATE
    if (editingId !== null) {
        const response = await fetch(`/api/people/${editingId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                surname
            })
        });

        const data = await response.json();

        alert(data.message || data.error);

        if (response.ok) {
            editingId = null;
            form.reset();
            loadPeople();
        }

        return;
    }

    // CREATE
    const response = await fetch("/api/people", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name,
            surname
        })
    });

    const data = await response.json();

    alert(data.message || data.error);

    if (response.ok) {
        form.reset();
        loadPeople();
    }
});

async function loadPeople() {
    const response = await fetch("/api/people");
    const people = await response.json();

    peopleList.innerHTML = "";

    people.forEach((person) => {
        const div = document.createElement("div");

        div.className = "person";

        div.innerHTML = `
            <strong>${person.name} ${person.surname}</strong>

            <button onclick="editPerson(${person.id}, '${person.name}', '${person.surname}')">
                Edit
            </button>

            <button onclick="deletePerson(${person.id})">
                Delete
            </button>
        `;

        peopleList.appendChild(div);
    });
}

function editPerson(id, name, surname) {
    editingId = id;

    document.getElementById("name").value = name;
    document.getElementById("surname").value = surname;

    document.querySelector("#personForm button").textContent = "Update Person";
}

async function deletePerson(id) {
    const response = await fetch(`/api/people/${id}`, {
        method: "DELETE"
    });

    const data = await response.json();

    alert(data.message);

    loadPeople();
}

loadPeople();
