
function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const API = "/api";

window.addEventListener("error", event => {
    document.body.innerHTML = `
        <div style="
            padding:30px;
            font-family:Arial,sans-serif;
            background:#fff;
            color:#111;
            min-height:100vh;
        ">
            <h2>Classora JavaScript Error</h2>
            <pre style="
                white-space:pre-wrap;
                background:#f5f5f5;
                padding:15px;
                border-radius:10px;
            ">${event.error?.stack || event.message || "Unknown error"}</pre>
        </div>
    `;
});

window.addEventListener("unhandledrejection", event => {
    document.body.innerHTML = `
        <div style="
            padding:30px;
            font-family:Arial,sans-serif;
            background:#fff;
            color:#111;
            min-height:100vh;
        ">
            <h2>Classora Promise Error</h2>
            <pre style="
                white-space:pre-wrap;
                background:#f5f5f5;
                padding:15px;
                border-radius:10px;
            ">${event.reason?.stack || event.reason || "Unknown promise error"}</pre>
        </div>
    `;
});


let token = localStorage.getItem("edutrack_token");
let currentUser = null;
let currentPage = "dashboard";
let currentQuiz = null;

const authScreen = document.getElementById("authScreen");
const app = document.getElementById("app");

const loginView = document.getElementById("loginView");
const registerView = document.getElementById("registerView");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");

const registerName = document.getElementById("registerName");
const registerSurname = document.getElementById("registerSurname");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");

const loginButton = document.getElementById("loginButton");
const registerButton = document.getElementById("registerButton");

const loginMessage = document.getElementById("loginMessage");
const registerMessage = document.getElementById("registerMessage");

const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");

const pageContent = document.getElementById("pageContent");
const pageTitle = document.getElementById("pageTitle");
const pageEyebrow = document.getElementById("pageEyebrow");
const backToDashboardButton = document.getElementById(
    "backToDashboardButton"
);

const toast = document.getElementById("toast");

const currentUserName =
    document.getElementById("sidebarUserName");

const currentUserRole =
    document.getElementById("sidebarUserRole");

const logoutButton = document.getElementById("logoutButton");

const mobileMenuButton = document.getElementById("mobileMenuButton");
const sidebar = document.getElementById("sidebar");


// =========================================================
// HELPERS
// =========================================================

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function showToast(message, type = "success") {
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}


function showMessage(element, message, type = "error") {
    if (!element) return;

    element.textContent = message;
    element.className = `form-message ${type}`;
}


function clearMessage(element) {
    if (!element) return;

    element.textContent = "";
    element.className = "form-message";
}


function setLoading(button, loading, originalText) {
    if (!button) return;

    if (loading) {
        button.disabled = true;
        button.dataset.originalText =
            button.textContent || originalText || "Continue";
        button.textContent = "Please wait...";
    } else {
        button.disabled = false;
        button.textContent =
            button.dataset.originalText || originalText || "Continue";
    }
}


function formatDate(dateValue) {
    if (!dateValue) return "—";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


function percentage(value) {
    const number = Number(value);

    if (Number.isNaN(number)) {
        return "0%";
    }

    return `${number.toFixed(1)}%`;
}


function roleLabel(role) {
    if (!role) return "User";

    return role.charAt(0).toUpperCase() + role.slice(1);
}


async function apiRequest(endpoint, options = {}) {
    const config = {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    };

    const savedToken = localStorage.getItem("edutrack_token");

    if (savedToken) {
        token = savedToken;
        config.headers.Authorization = `Bearer ${savedToken}`;
    }

    let response;

    try {
        response = await fetch(`${API}${endpoint}`, config);
    } catch (error) {
        throw new Error(
            "Unable to connect to the server. Make sure the backend is running."
        );
    }

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (response.status === 401) {
        logout(false);

        throw new Error(
            data.error || "Your session has expired. Please log in again."
        );
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            data.message ||
            `Request failed with status ${response.status}`
        );
    }

    return data;
}


// =========================================================
// AUTH VIEW
// =========================================================

function showLoginView() {
    if (loginView) {
        loginView.classList.remove("hidden");
    }

    if (registerView) {
        registerView.classList.add("hidden");
    }

    clearMessage(loginMessage);
    clearMessage(registerMessage);
}


function showRegisterView() {
    if (loginView) {
        loginView.classList.add("hidden");
    }

    if (registerView) {
        registerView.classList.remove("hidden");
    }

    clearMessage(loginMessage);
    clearMessage(registerMessage);
}

showRegister?.addEventListener("click", event => {
    event.preventDefault();
    showRegisterView();
});


showLogin?.addEventListener("click", event => {
    event.preventDefault();
    showLoginView();
});


// =========================================================
// LOGIN
// =========================================================

async function handleLogin() {
    const email = loginEmail?.value.trim();
    const password = loginPassword?.value;

    clearMessage(loginMessage);

    if (!email || !password) {
        showMessage(
            loginMessage,
            "Please enter your email and password."
        );
        return;
    }

    setLoading(loginButton, true, "Sign In");

    try {
        const data = await apiRequest("/login", {
            method: "POST",
            body: JSON.stringify({
                email,
                password
            })
        });

        token = data.token;

        localStorage.setItem(
            "edutrack_token",
            token
        );

        currentUser = data.user || data;

        showApp();

        showToast("Login successful!");

        await updateUserInterface();

        await navigateTo("dashboard");

    } catch (error) {
        showMessage(
            loginMessage,
            error.message || "Login failed."
        );
    } finally {
        setLoading(
            loginButton,
            false,
            "Sign In"
        );
    }
}


loginForm?.addEventListener(
    "submit",
    event => {
        event.preventDefault();
        handleLogin();
    }
);


// =========================================================
// REGISTER
// =========================================================

async function handleRegister() {
    const name = registerName?.value.trim();
    const surname = registerSurname?.value.trim();
    const email = registerEmail?.value.trim();
    const password = registerPassword?.value;

    clearMessage(registerMessage);

    if (!name || !surname || !email || !password) {
        showMessage(
            registerMessage,
            "Please complete all fields."
        );
        return;
    }

    if (password.length < 6) {
        showMessage(
            registerMessage,
            "Password must be at least 6 characters."
        );
        return;
    }

    setLoading(
        registerButton,
        true,
        "Create Student Account"
    );

    try {
        await apiRequest("/register", {
            method: "POST",
            body: JSON.stringify({
                name,
                surname,
                email,
                password
            })
        });

        showMessage(
            registerMessage,
            "Registration successful. You can now log in.",
            "success"
        );

        registerName.value = "";
        registerSurname.value = "";
        registerEmail.value = "";
        registerPassword.value = "";

        setTimeout(() => {
            showLoginView();

            if (loginEmail) {
                loginEmail.value = email;
            }
        }, 900);

    } catch (error) {
        showMessage(
            registerMessage,
            error.message || "Registration failed."
        );
    } finally {
        setLoading(
            registerButton,
            false,
            "Create Student Account"
        );
    }
}


registerForm?.addEventListener(
    "submit",
    event => {
        event.preventDefault();
        handleRegister();
    }
);


// =========================================================
// SESSION
// =========================================================

async function restoreSession() {
    if (!token) {
        showAuth();
        return;
    }

    // First verify that the saved JWT is still valid.
    let data;

    try {
        console.log("Classora: checking saved session...");

        data = await apiRequest("/me");

        console.log("Classora: saved session is valid.");

    } catch (error) {
        console.error(
            "Classora: saved session is invalid:",
            error?.message
        );

        localStorage.removeItem("edutrack_token");

        token = null;
        currentUser = null;

        showAuth();
        return;
    }

    // Authentication succeeded, so keep the session.
    currentUser = data.user || data;

    showApp();

    // UI updates should NOT destroy a valid session.
    try {
        await updateUserInterface();
    } catch (error) {
        console.error(
            "Classora: UI update failed:",
            error
        );
    }

    // Load the dashboard separately.
    try {
        await navigateTo("dashboard");
    } catch (error) {
        console.error(
            "Classora: dashboard navigation failed:",
            error
        );
    }
}

function showAuth() {
    if (authScreen) {
        authScreen.style.display = "flex";
    }

    if (app) {
        app.style.display = "none";
    }

    showLoginView();
}


function showApp() {
    if (authScreen) {
        authScreen.style.display = "none";
    }

    if (app) {
        app.style.display = "flex";
    }
}


// =========================================================
// USER INTERFACE
// =========================================================

async function updateUserInterface() {
    if (!currentUser) return;
    const email = currentUser.email || "";
    const displayName =
        (currentUser.name || currentUser.surname)
            ? `${currentUser.name || ""} ${currentUser.surname || ""}`.trim()
            : email.split("@")[0];
    const initials = displayName.split(/\s+/).filter(Boolean).map(p => p[0]).join("").slice(0, 2).toUpperCase() || "U";
    if (currentUserName) currentUserName.textContent = displayName;
    if (currentUserRole) currentUserRole.textContent = roleLabel(currentUser.role);
    const topbarUserName = document.getElementById("topbarUserName");
    const topbarUserEmail = document.getElementById("topbarUserEmail");
    const topbarAvatar = document.getElementById("topbarAvatar");
    const userAvatar = document.getElementById("userAvatar");
    if (topbarUserName) topbarUserName.textContent = displayName;
    if (topbarUserEmail) topbarUserEmail.textContent = email;
    if (topbarAvatar) topbarAvatar.textContent = initials;
    if (userAvatar) userAvatar.textContent = initials;
    document.querySelectorAll("[data-role]").forEach(element => {
        const roles = element.dataset.role.split(",").map(r => r.trim());
        element.style.display = roles.includes(currentUser.role) ? "" : "none";
    });
    buildNavigation();
}

function buildNavigation() {
    const nav = document.getElementById("navigation");
    if (!nav || !currentUser) return;
    const role = currentUser.role;
    const isStaff = role === "teacher" || role === "admin";
    const isAdmin = role === "admin";
    let html = `<div class="nav-section"><div class="nav-section-label">Main</div>
        <button type="button" class="nav-button" data-page="dashboard"><span class="nav-icon">🏠</span><span class="nav-label">Dashboard</span></button></div>`;
    if (!isStaff) {
        html += `<div class="nav-section"><div class="nav-section-label">Quick Start</div>
            <button type="button" class="nav-button" data-page="quizzes"><span class="nav-icon">📝</span><span class="nav-label">Take a Quiz</span></button>
            <button type="button" class="nav-button" data-page="results"><span class="nav-icon">📈</span><span class="nav-label">My Results</span></button>
            <button type="button" class="nav-button" data-page="ranking"><span class="nav-icon">🏆</span><span class="nav-label">Ranking</span></button>
            <button type="button" class="nav-button" data-page="profile"><span class="nav-icon">👤</span><span class="nav-label">My Profile</span></button></div>`;
    } else {
        html += `<div class="nav-section"><div class="nav-section-label">Students</div>
            <button type="button" class="nav-button" data-page="students"><span class="nav-icon">👨‍🎓</span><span class="nav-label">All Students</span></button>
            <button type="button" class="nav-button" data-page="passed"><span class="nav-icon">✅</span><span class="nav-label">Passed</span></button>
            <button type="button" class="nav-button" data-page="failed"><span class="nav-icon">❌</span><span class="nav-label">Failed</span></button>
            <button type="button" class="nav-button" data-page="analytics"><span class="nav-icon">📊</span><span class="nav-label">Analytics</span></button></div>
            <div class="nav-section"><div class="nav-section-label">Quizzes</div>
            <button type="button" class="nav-button" data-page="quizzes"><span class="nav-icon">📝</span><span class="nav-label">Quizzes</span></button>
            <button type="button" class="nav-button" data-page="create-quiz"><span class="nav-icon">➕</span><span class="nav-label">Create Quiz</span></button></div>`;
        if (isAdmin) html += `<div class="nav-section"><div class="nav-section-label">Admin</div>
            <button type="button" class="nav-button" data-page="users"><span class="nav-icon">👥</span><span class="nav-label">User Management</span></button></div>`;
        html += `<div class="nav-section"><div class="nav-section-label">Account</div>
            <button type="button" class="nav-button" data-page="profile"><span class="nav-icon">👤</span><span class="nav-label">My Profile</span></button></div>`;
    }
    nav.innerHTML = html;
    nav.querySelectorAll("[data-page]").forEach(item => {
        item.addEventListener("click", e => { e.preventDefault(); if (item.dataset.page) navigateTo(item.dataset.page); });
    });
    updateActiveNavigation(currentPage);
}


// =========================================================
// LOGOUT
// =========================================================

function logout(showMessageAfter = true) {
    token = null;
    currentUser = null;
    currentQuiz = null;

    localStorage.removeItem(
        "edutrack_token"
    );

    showAuth();

    if (loginEmail) {
        loginEmail.value = "";
    }

    if (loginPassword) {
        loginPassword.value = "";
    }

    if (showMessageAfter) {
        showToast(
            "You have been logged out."
        );
    }
}


logoutButton?.addEventListener(
    "click",
    () => {
        logout(true);
    }
);

backToDashboardButton?.addEventListener(
    "click",
    () => {
        navigateTo("dashboard");
    }
);
// =========================================================
// NAVIGATION
// =========================================================

const navigationItems =
    document.querySelectorAll(
        "[data-page]"
    );


navigationItems.forEach(item => {

    item.addEventListener(
        "click",
        event => {

            event.preventDefault();

            const page =
                item.dataset.page;

            if (page) {
                navigateTo(page);
            }
        }
    );
});


function updateActiveNavigation(page) {
    document
        .querySelectorAll("[data-page]")
        .forEach(item => {

            item.classList.toggle(
                "active",
                item.dataset.page === page
            );
        });
}


function ensureSidebarOverlay() {
    let overlay = document.getElementById("sidebarOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "sidebarOverlay";
        overlay.className = "sidebar-overlay";
        document.body.appendChild(overlay);
        overlay.addEventListener("click", closeMobileSidebar);
    }
    return overlay;
}
function closeMobileSidebar() {
    sidebar?.classList.remove("mobile-open");
    document.getElementById("sidebarOverlay")?.classList.remove("visible");
}
function openMobileSidebar() {
    if (!sidebar) return;
    ensureSidebarOverlay();
    sidebar.classList.add("mobile-open");
    document.getElementById("sidebarOverlay")?.classList.add("visible");
}
mobileMenuButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!sidebar) return;
    if (sidebar.classList.contains("mobile-open")) closeMobileSidebar();
    else openMobileSidebar();
});

async function navigateTo(page) {

    if (!currentUser) {
        showAuth();
        return;
    }

    currentPage = page;

    updateActiveNavigation(page);

    closeMobileSidebar();

    if (!pageContent) return;

    pageContent.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading...</p>
        </div>
    `;

    try {

        switch (page) {

            case "dashboard":

                if (
                    currentUser.role === "teacher" ||
                    currentUser.role === "admin"
                ) {
                    await renderStaffDashboard();
                } else {
                    await renderStudentDashboard();
                }

                break;


            case "quizzes":
                await renderQuizzes();
                break;


            case "results":
                await renderResults();
                break;


            case "ranking":
                await renderRanking();
                break;


            case "profile":
                await renderProfile();
                break;


            case "students":
                await renderStudents();
                break;


            case "passed":
                await renderPassedStudents();
                break;


            case "failed":
                await renderFailedStudents();
                break;


            case "analytics":
                await renderAnalytics();
                break;


            case "create-quiz":
                renderCreateQuiz();
                break;


            case "users":
                await renderUsers();
                break;


            default:

                if (
                    currentUser.role === "teacher" ||
                    currentUser.role === "admin"
                ) {
                    await renderStaffDashboard();
                } else {
                    await renderStudentDashboard();
                }
        }

        updatePageHeading(page);

    } catch (error) {

        pageContent.innerHTML = `
            <div class="empty-state">

                <h3>Something went wrong</h3>

                <p>
                    ${escapeHTML(
                        error.message
                    )}
                </p>

                <button
                    class="primary-button"
                    onclick="navigateTo('${escapeHTML(page)}')"
                >
                    Try Again
                </button>

            </div>
        `;
    }
}






function updatePageHeading(page) {

    const titles = {

        dashboard: [
            "Overview",
            "Dashboard"
        ],

        quizzes: [
            "Learning",
            "Quizzes"
        ],

        results: [
            "Performance",
            "My Results"
        ],

        ranking: [
            "Performance",
            "Ranking"
        ],

        profile: [
            "Account",
            "My Profile"
        ],

        students: [
            "Management",
            "Students"
        ],

        passed: [
            "Performance",
            "Passed Students"
        ],

        failed: [
            "Performance",
            "Failed Students"
        ],

        analytics: [
            "Insights",
            "Analytics"
        ],

        "create-quiz": [
            "Management",
            "Create Quiz"
        ],

        users: [
            "Administration",
            "User Management"
        ]
    };

    const selected =
        titles[page] ||
        ["Classora", "Dashboard"];

    if (pageEyebrow) {
        pageEyebrow.textContent =
            selected[0];
    }

    if (pageTitle) {
        pageTitle.textContent =
            selected[1];
    }

    // Show the Back to Dashboard button
    // on every page except Dashboard.
    if (backToDashboardButton) {

        backToDashboardButton.style.display =
            page === "dashboard"
                ? "none"
                : "inline-flex";
    }
}

// =========================================================
// STUDENT DASHBOARD
// =========================================================

async function renderStudentDashboard() {

    const data = await apiRequest("/student/dashboard");

    const statistics = data.statistics || {};

    const totalQuizzes =
        statistics.total_quizzes ??
        statistics.totalQuizzes ??
        0;

    const completed =
        statistics.attempts ??
        statistics.completed_quizzes ??
        statistics.completedQuizzes ??
        0;

    const passed =
        statistics.passed ??
        statistics.passed_quizzes ??
        statistics.passedQuizzes ??
        0;

    const failed =
        statistics.failed ??
        statistics.failed_quizzes ??
        statistics.failedQuizzes ??
        0;

    const average =
        statistics.average_percentage ??
        statistics.averagePercentage ??
        statistics.average ??
        0;

    pageContent.innerHTML = `
        <div class="dashboard-header"><div>
            <h2>Welcome back, ${escapeHTML(currentUser.name || currentUser.email)}! 👋</h2>
            <p>Track your learning progress. Use the sidebar Quick Start menu for quizzes, results, ranking or profile.</p>
        </div></div>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon">📝</div><div><span class="stat-label">Available Quizzes</span><strong>${totalQuizzes}</strong></div></div>
            <div class="stat-card"><div class="stat-icon">✅</div><div><span class="stat-label">Completed</span><strong>${completed}</strong></div></div>
            <div class="stat-card"><div class="stat-icon">🏆</div><div><span class="stat-label">Passed</span><strong>${passed}</strong></div></div>
            <div class="stat-card"><div class="stat-icon">📊</div><div><span class="stat-label">Average</span><strong>${percentage(average)}</strong></div></div>
        </div>
        <div class="card" style="max-width:520px;">
            <div class="card-header"><div><h3>Performance</h3><p>Your current progress at a glance.</p></div></div>
            <div class="performance-summary">
                <div class="performance-row"><span>Passed quizzes</span><strong>${passed}</strong></div>
                <div class="performance-row"><span>Failed quizzes</span><strong>${failed}</strong></div>
                <div class="performance-row"><span>Average score</span><strong>${percentage(average)}</strong></div>
            </div>
        </div>
    `;

}


// =========================================================
// STAFF DASHBOARD
// =========================================================

async function renderStaffDashboard() {

    const data =
        await apiRequest(
            "/teacher/analytics"
        );

    const analytics =
        data.analytics ||
        data ||
        {};

    const total =
        analytics.total_students ??
        analytics.totalStudents ??
        0;

    const passed =
        analytics.passed_students ??
        analytics.passedStudents ??
        analytics.passed ??
        0;

    const failed =
        analytics.failed_students ??
        analytics.failedStudents ??
        analytics.failed ??
        0;

    const highest =
        analytics.highest_percentage ??
        analytics.highestPercentage ??
        0;

    const lowest =
        analytics.lowest_percentage ??
        analytics.lowestPercentage ??
        0;

    pageContent.innerHTML = `

        <div class="dashboard-header">

            <h2>
                Welcome,
                ${escapeHTML(
                    currentUser.name ||
                    roleLabel(currentUser.role)
                )}
            </h2>

            <p>
                Monitor student performance
                and manage quizzes.
            </p>

        </div>


        <div class="stats-grid">

            <div class="stat-card">

                <div class="stat-icon">
                    👨‍🎓
                </div>

                <div>

                    <span class="stat-label">
                        Students
                    </span>

                    <strong>
                        ${total}
                    </strong>

                </div>

            </div>


            <div class="stat-card">

                <div class="stat-icon">
                    ✅
                </div>

                <div>

                    <span class="stat-label">
                        Passed
                    </span>

                    <strong>
                        ${passed}
                    </strong>

                </div>

            </div>


            <div class="stat-card">

                <div class="stat-icon">
                    ❌
                </div>

                <div>

                    <span class="stat-label">
                        Failed
                    </span>

                    <strong>
                        ${failed}
                    </strong>

                </div>

            </div>


            <div class="stat-card">

                <div class="stat-icon">
                    🏆
                </div>

                <div>

                    <span class="stat-label">
                        Highest
                    </span>

                    <strong>
                        ${percentage(highest)}
                    </strong>

                </div>

            </div>

        </div>


        <div class="content-grid">

            <div class="card">

                <div class="card-header">

                    <div>

                        <h3>
                            Student Management
                        </h3>

                        <p>
                            Review student performance.
                        </p>

                    </div>

                </div>


                <div class="action-grid">

                    <button
                        class="action-card"
                        onclick="navigateTo('students')"
                    >
                        <span>👨‍🎓</span>
                        <strong>
                            All Students
                        </strong>
                        <small>
                            View student performance
                        </small>
                    </button>


                    <button
                        class="action-card"
                        onclick="navigateTo('passed')"
                    >
                        <span>✅</span>
                        <strong>
                            Passed
                        </strong>
                        <small>
                            View successful students
                        </small>
                    </button>


                    <button
                        class="action-card"
                        onclick="navigateTo('failed')"
                    >
                        <span>❌</span>
                        <strong>
                            Failed
                        </strong>
                        <small>
                            View students needing support
                        </small>
                    </button>


                    <button
                        class="action-card"
                        onclick="navigateTo('analytics')"
                    >
                        <span>📊</span>
                        <strong>
                            Analytics
                        </strong>
                        <small>
                            View performance insights
                        </small>
                    </button>

                </div>

            </div>


            <div class="card">

                <div class="card-header">

                    <div>

                        <h3>
                            Quiz Management
                        </h3>

                        <p>
                            Create and manage assessments.
                        </p>

                    </div>

                </div>


                <div class="action-grid">

                    <button
                        class="action-card"
                        onclick="navigateTo('quizzes')"
                    >
                        <span>📝</span>
                        <strong>
                            Quizzes
                        </strong>
                        <small>
                            View available quizzes
                        </small>
                    </button>


                    <button
                        class="action-card"
                        onclick="navigateTo('create-quiz')"
                    >
                        <span>➕</span>
                        <strong>
                            Create Quiz
                        </strong>
                        <small>
                            Add a new assessment
                        </small>
                    </button>

                </div>

            </div>

        </div>


        <div class="card">

            <div class="card-header">

                <div>

                    <h3>
                        Performance Range
                    </h3>

                    <p>
                        Current recorded student scores.
                    </p>

                </div>

            </div>


            <div class="performance-summary">

                <div class="performance-row">

                    <span>
                        Highest performer
                    </span>

                    <strong>
                        ${percentage(highest)}
                    </strong>

                </div>


                <div class="performance-row">

                    <span>
                        Lowest performer
                    </span>

                    <strong>
                        ${percentage(lowest)}
                    </strong>

                </div>

            </div>

        </div>
    `;
}


// =========================================================
// QUIZ LIST
// =========================================================

async function renderQuizzes() {

    const data =
        await apiRequest("/quizzes");

    const quizzes =
        data.quizzes ||
        data ||
        [];

    const canManage =
        currentUser.role === "teacher" ||
        currentUser.role === "admin";

    pageContent.innerHTML = `

        <div class="dashboard-header">

            <div>

                <h2>Quizzes</h2>

                <p>
                    ${
                        currentUser.role === "student"
                            ? "Choose a quiz and test your knowledge."
                            : "Create, publish and manage quizzes."
                    }
                </p>

            </div>

            ${
                canManage
                    ? `
                        <button
                            class="primary-button"
                            onclick="navigateTo('create-quiz')"
                        >
                            + Create Quiz
                        </button>
                    `
                    : ""
            }

        </div>

        ${
            quizzes.length
                ? `

                    <div class="quiz-grid">

                        ${quizzes.map(quiz => {

                            const questionCount =
                                Number(
                                    quiz.question_count ??
                                    quiz.questionCount ??
                                    0
                                );

                            const attemptsUsed =
                                Number(
                                    quiz.attempts_used ??
                                    quiz.attemptsUsed ??
                                    0
                                );

                            const attemptsAllowed =
                                Number(
                                    quiz.attempts_allowed ??
                                    quiz.attemptsAllowed ??
                                    1
                                );

                            const unfinishedAttempts =
                                Number(
                                    quiz.unfinished_attempts ??
                                    quiz.unfinishedAttempts ??
                                    0
                                );

                            const hasUnfinishedAttempt =
                                unfinishedAttempts > 0;

                            const published =
                                quiz.published === true ||
                                quiz.published === "true";

                            const now =
                                new Date();

                            const startAt =
                                quiz.start_at ||
                                quiz.startAt;

                            const endAt =
                                quiz.end_at ||
                                quiz.endAt;

                            let availability =
                                "";

                            if (!published) {
                                availability =
                                    "Draft / Disabled";

                            } else if (
                                startAt &&
                                now < new Date(startAt)
                            ) {
                                availability =
                                    "Scheduled";

                            } else if (
                                endAt &&
                                now > new Date(endAt)
                            ) {
                                availability =
                                    "Closed";

                            } else {
                                availability =
                                    "Available";
                            }

                            const attemptsFinished =
                                currentUser.role === "student" &&
                                !hasUnfinishedAttempt &&
                                attemptsUsed >= attemptsAllowed;

                            return `

                                <div class="quiz-card">

                                    <div class="quiz-card-icon">
                                        📝
                                    </div>

                                    <div class="quiz-card-content">

                                        <h3>
                                            ${escapeHTML(
                                                quiz.title
                                            )}
                                        </h3>

                                        <p>
                                            ${escapeHTML(
                                                quiz.description ||
                                                "Test your knowledge."
                                            )}
                                        </p>

                                        <div class="quiz-meta">

                                            <span>
                                                ${questionCount}
                                                question${questionCount === 1 ? "" : "s"}
                                            </span>

                                            <span>
                                                ${Number(
                                                    quiz.time_limit ??
                                                    quiz.timeLimit ??
                                                    30
                                                )} min
                                            </span>

                                            <span>
                                                ${attemptsAllowed}
                                                attempt${attemptsAllowed === 1 ? "" : "s"}
                                            </span>

                                        </div>

                                        <div
                                            style="
                                                margin-top:10px;
                                                font-size:0.9rem;
                                            "
                                        >
                                            <strong>
                                                Status:
                                            </strong>

                                            ${escapeHTML(
                                                availability
                                            )}
                                        </div>

                                        ${canManage ? `

                                            <div
                                                class="quiz-management-actions"
                                                style="
                                                    display:flex;
                                                    flex-wrap:wrap;
                                                    gap:8px;
                                                    margin-top:15px;
                                                "
                                            >

                                                <button
                                                    type="button"
                                                    class="secondary-button"
                                                    onclick="previewExistingQuiz(${Number(quiz.id)})"
                                                >
                                                    Preview
                                                </button>

                                                <button
                                                    type="button"
                                                    class="secondary-button"
                                                    onclick="toggleQuizStatus(${Number(quiz.id)})"
                                                >
                                                    ${published
                                                        ? "Disable"
                                                        : "Publish"}
                                                </button>

                                                <button
                                                    type="button"
                                                    class="danger-button"
                                                    onclick="deleteQuiz(${Number(quiz.id)})"
                                                >
                                                    Delete
                                                </button>

                                            </div>

                                        ` : ""}

                                    </div>

                                    ${
                                        currentUser.role === "student"
                                            ? `
                                                <button
                                                    class="primary-button"
                                                    ${
                                                        attemptsFinished
                                                            ? "disabled"
                                                            : ""
                                                    }
                                                    onclick="startQuiz(${Number(quiz.id)})"
                                                >
                                                    ${
                                                        attemptsFinished
                                                            ? "No Attempts Left"
                                                            : hasUnfinishedAttempt
                                                                ? "Resume Quiz"
                                                                : "Start Quiz"
                                                    }
                                                </button>
                                            `
                                            : ""
                                    }

                                </div>

                            `;

                        }).join("")}

                    </div>

                `
                : `

                    <div class="empty-state">

                        <div class="empty-icon">
                            📝
                        </div>

                        <h3>
                            No quizzes available
                        </h3>

                        <p>
                            ${
                                canManage
                                    ? "Create your first quiz to get started."
                                    : "There are currently no quizzes available."
                            }
                        </p>

                    </div>

                `
        }

    `;
}


// =========================================================
// START QUIZ
// =========================================================

async function startQuiz(quizId) {

    try {

        const data =
            await apiRequest(
                `/quizzes/${Number(quizId)}/start`,
                {
                    method: "POST"
                }
            );

        const rawStartedAtMs =
            data.startedAtMs;

        const parsedStartedAtMs =
            Number(rawStartedAtMs);

        const fallbackStartedAtMs =
            data.startedAt
                ? new Date(data.startedAt).getTime()
                : NaN;

        const startedAtMs =
            Number.isFinite(parsedStartedAtMs) &&
            parsedStartedAtMs > 0
                ? parsedStartedAtMs
                : fallbackStartedAtMs;

        currentQuiz = {
            ...(data.quiz || {}),

            questions:
                data.questions ||
                [],

            attemptId:
                Number(data.attemptId),

            startedAt:
                data.startedAt,

            startedAtMs
        };

        renderQuizTaking();

    } catch (error) {

        showToast(
            error.message ||
            "Unable to start quiz.",
            "error"
        );

        await renderQuizzes();
    }
}


// =========================================================
// QUIZ TAKING
// =========================================================

function renderQuizTaking() {
    if (!currentQuiz) { navigateTo("quizzes"); return; }
    const questions = currentQuiz.questions || [];
    const timeLimit = Number(currentQuiz.time_limit ?? currentQuiz.timeLimit ?? 30);
    const totalQuestions = questions.length;
    pageContent.innerHTML = `
        <div class="quiz-taking-shell">
            <div class="quiz-taking-topbar">
                <button type="button" class="secondary-button quiz-back-btn" onclick="navigateTo('quizzes')">← Quizzes</button>
                <div class="quiz-taking-meta">
                    <h2 class="quiz-taking-title">${escapeHTML(currentQuiz.title || "Quiz")}</h2>
                    ${currentQuiz.description ? `<p class="quiz-taking-desc">${escapeHTML(currentQuiz.description)}</p>` : ""}
                </div>
                <div class="quiz-timer-pill" id="quizTimer">
                    <span class="quiz-timer-icon">⏱</span>
                    <span class="quiz-timer-text">--:--</span>
                </div>
            </div>
            <div class="quiz-progress-wrap">
                <div class="quiz-progress-info">
                    <span id="quizProgressLabel">0 of ${totalQuestions} answered</span>
                    <span>${totalQuestions} question${totalQuestions === 1 ? "" : "s"}</span>
                </div>
                <div class="quiz-progress-bar"><div class="quiz-progress-fill" id="quizProgressFill" style="width:0%"></div></div>
            </div>
            ${questions.length ? `<form id="quizForm" class="quiz-taking-form">
                ${questions.map((question, index) => {
                    const options = question.options || [];
                    const letters = ["A","B","C","D","E","F"];
                    return `<div class="quiz-question-card">
                        <div class="quiz-question-badge">Question ${index + 1}<span class="quiz-q-of"> / ${totalQuestions}</span></div>
                        <h3 class="quiz-question-text">${escapeHTML(question.question)}</h3>
                        <div class="options-list">
                            ${options.map((option, optIndex) => `
                                <label class="quiz-option">
                                    <input type="radio" name="question-${Number(question.id)}" value="${Number(option.id)}" required>
                                    <span class="quiz-option-letter">${letters[optIndex] || (optIndex + 1)}</span>
                                    <span class="quiz-option-text">${escapeHTML(option.option_text ?? option.text ?? "")}</span>
                                </label>`).join("")}
                        </div>
                    </div>`;
                }).join("")}
                <div class="quiz-submit-bar">
                    <p class="quiz-submit-hint">Review your answers before submitting.</p>
                    <button type="submit" class="primary-button quiz-submit-btn">Submit Quiz</button>
                </div>
            </form>` : `<div class="empty-state"><div class="empty-icon">📝</div><h3>This quiz has no questions.</h3>
                <button class="primary-button" onclick="navigateTo('quizzes')">Back to Quizzes</button></div>`}
        </div>`;
    const quizForm = document.getElementById("quizForm");
    quizForm?.addEventListener("submit", handleQuizSubmit);
    const updateProgress = () => {
        const answered = (quizForm?.querySelectorAll('input[type="radio"]:checked') || []).length;
        const pct = totalQuestions ? Math.round((answered / totalQuestions) * 100) : 0;
        const fill = document.getElementById("quizProgressFill");
        const label = document.getElementById("quizProgressLabel");
        if (fill) fill.style.width = pct + "%";
        if (label) label.textContent = answered + " of " + totalQuestions + " answered";
    };
    quizForm?.querySelectorAll('input[type="radio"]').forEach(input => {
        input.addEventListener("change", () => {
            const card = input.closest(".quiz-question-card");
            card?.querySelectorAll(".quiz-option").forEach(opt => {
                opt.classList.toggle("selected", !!opt.querySelector("input")?.checked);
            });
            updateProgress();
        });
    });
    startQuizTimer(timeLimit, currentQuiz.startedAtMs);
}


// =========================================================
// QUIZ TIMER
// =========================================================

let quizTimerInterval = null;

function startQuizTimer(
    timeLimitMinutes,
    startedAtMs
) {

    if (quizTimerInterval) {
        clearInterval(
            quizTimerInterval
        );

        quizTimerInterval = null;
    }

    const timerElement =
        document.getElementById(
            "quizTimer"
        );

    if (!timerElement) {
        return;
    }

    const startTime =
        Number(startedAtMs);

    const minutes =
        Number(timeLimitMinutes);

    const duration =
        minutes * 60 * 1000;

    if (
        !Number.isFinite(startTime) ||
        startTime <= 0
    ) {
        const textElFail = timerElement.querySelector(".quiz-timer-text");
        if (textElFail) textElFail.textContent = "No timer";
        else timerElement.textContent = "Unable to start timer.";

        console.error(
            "Invalid quiz start timestamp:",
            startedAtMs
        );

        return;
    }

    if (
        !Number.isFinite(minutes) ||
        minutes <= 0
    ) {
        const textElFail = timerElement.querySelector(".quiz-timer-text");
        if (textElFail) textElFail.textContent = "No timer";
        else timerElement.textContent = "Unable to start timer.";

        console.error(
            "Invalid quiz time limit:",
            timeLimitMinutes
        );

        return;
    }

    const endTime =
        startTime + duration;

    let hasAutoSubmitted = false;

    const updateTimer = () => {

        const remaining =
            endTime - Date.now();

        const safeRemaining =
            Math.max(
                0,
                remaining
            );

        const totalSeconds =
            Math.ceil(
                safeRemaining / 1000
            );

        const displayMinutes =
            Math.floor(
                totalSeconds / 60
            );

        const displaySeconds =
            totalSeconds % 60;

        const timeStr = `${String(displayMinutes).padStart(2, "0")}:${String(displaySeconds).padStart(2, "0")}`;
        const textEl = timerElement.querySelector(".quiz-timer-text");
        if (textEl) textEl.textContent = timeStr;
        else timerElement.textContent = `Time remaining: ${timeStr}`;
        timerElement.classList.toggle("urgent", remaining > 0 && remaining <= 60000);
        if (remaining <= 0 && !hasAutoSubmitted) {
            hasAutoSubmitted = true;
            clearInterval(quizTimerInterval);
            quizTimerInterval = null;
            if (textEl) textEl.textContent = "Submitting...";
            else timerElement.textContent = "Time is up — submitting...";
            timerElement.classList.add("urgent");
            autoSubmitQuiz();
        }
    };

    updateTimer();

    quizTimerInterval =
        setInterval(
            updateTimer,
            1000
        );
}


// =========================================================
// AUTO SUBMIT
// =========================================================

async function autoSubmitQuiz() {

    const form =
        document.getElementById(
            "quizForm"
        );

    if (!form || !currentQuiz) {
        return;
    }

    const questions =
        currentQuiz.questions ||
        [];

    const answers = [];

    for (const question of questions) {

        const selected =
            form.querySelector(
                `input[name="question-${Number(
                    question.id
                )}"]:checked`
            );

        answers.push({

            questionId:
                Number(question.id),

            selectedOptionId:
                selected
                    ? Number(selected.value)
                    : null

        });
    }

    const submitButton =
        form.querySelector(
            "button[type='submit']"
        );

    if (submitButton) {
        submitButton.disabled = true;
    }

    try {

        const data =
            await apiRequest(
                `/quizzes/${Number(
                    currentQuiz.id
                )}/submit`,
                {
                    method: "POST",

                    body: JSON.stringify({
                        attemptId:
                            Number(
                                currentQuiz.attemptId
                            ),
                        answers
                    })
                }
            );

        if (quizTimerInterval) {
            clearInterval(
                quizTimerInterval
            );
        }

        renderQuizResult(
            data.result ||
            data
        );

        showToast(
            "Quiz submitted successfully!"
        );

    } catch (error) {

        showToast(
            error.message ||
            "Time expired and the quiz could not be submitted.",
            "error"
        );

        if (submitButton) {
            submitButton.disabled = false;
        }
    }
}


// =========================================================
// QUIZ SUBMIT
// =========================================================

async function handleQuizSubmit(event) {

    event.preventDefault();

    if (!currentQuiz) {
        return;
    }

    const form =
        event.target;

    const answers = [];

    const questions =
        currentQuiz.questions ||
        [];

    for (const question of questions) {

        const selected =
            form.querySelector(
                `input[name="question-${Number(
                    question.id
                )}"]:checked`
            );

        if (!selected) {

            showToast(
                "Please answer every question.",
                "error"
            );

            startQuizTimer(
                Number(
                    currentQuiz.time_limit ??
                    currentQuiz.timeLimit ??
                    30
                ),
                currentQuiz.startedAtMs
            );

            return;
        }

        answers.push({

            questionId:
                Number(question.id),

            selectedOptionId:
                Number(selected.value)

        });

    }

    const submitButton =
        form.querySelector(
            "button[type='submit']"
        );

    setLoading(
        submitButton,
        true,
        "Submit Quiz"
    );

    try {

        const data =
            await apiRequest(
                `/quizzes/${Number(
                    currentQuiz.id
                )}/submit`,
                {
                    method: "POST",

                    body: JSON.stringify({

                        attemptId:
                            Number(
                                currentQuiz.attemptId
                            ),

                        answers

                    })
                }
            );

        renderQuizResult(
            data.result ||
            data
        );

        showToast(
            "Quiz submitted successfully!"
        );

    } catch (error) {

        showToast(
            error.message ||
            "Could not submit quiz.",
            "error"
        );

        setLoading(
            submitButton,
            false,
            "Submit Quiz"
        );


    }
}


// =========================================================
// QUIZ MANAGEMENT
// =========================================================

async function toggleQuizStatus(quizId) {

    try {

        const data =
            await apiRequest(
                `/quizzes/${Number(
                    quizId
                )}/status`,
                {
                    method: "PATCH"
                }
            );

        showToast(
            data.message ||
            "Quiz status updated."
        );

        await renderQuizzes();

    } catch (error) {

        showToast(
            error.message ||
            "Could not update quiz status.",
            "error"
        );
    }
}


async function deleteQuiz(quizId) {

    const confirmed =
        confirm(
            "Delete this quiz permanently? This will also remove its questions, answers and attempts."
        );

    if (!confirmed) {
        return;
    }

    try {

        const data =
            await apiRequest(
                `/quizzes/${Number(
                    quizId
                )}`,
                {
                    method: "DELETE"
                }
            );

        showToast(
            data.message ||
            "Quiz deleted successfully."
        );

        await renderQuizzes();

    } catch (error) {

        showToast(
            error.message ||
            "Could not delete quiz.",
            "error"
        );
    }
}


async function previewExistingQuiz(quizId) {

    try {

        const data =
            await apiRequest(
                `/quizzes/${Number(
                    quizId
                )}`
            );

        const quiz =
            data.quiz ||
            data;

        const questions =
            data.questions ||
            [];

        pageContent.innerHTML = `

            <div class="admin-quiz-preview">

                <div class="dashboard-header">

                    <button
                        class="secondary-button"
                        onclick="navigateTo('quizzes')"
                    >
                        ← Back to Quizzes
                    </button>

                    <div>

                        <h2>
                            Quiz Preview
                        </h2>

                        <p>
                            ${escapeHTML(
                                quiz.title ||
                                ""
                            )}
                        </p>

                    </div>

                </div>


                <div class="card admin-quiz-preview-summary">

                    <div class="admin-quiz-preview-title-row">

                        <div>

                            <span class="admin-quiz-preview-eyebrow">
                                QUIZ PREVIEW
                            </span>

                            <h2>
                                ${escapeHTML(
                                    quiz.title ||
                                    ""
                                )}
                            </h2>

                            <p>
                                ${escapeHTML(
                                    quiz.description ||
                                    "No description."
                                )}
                            </p>

                        </div>

                        <span class="admin-quiz-preview-status ${
                            quiz.published
                                ? "published"
                                : "draft"
                        }">
                            <span class="admin-quiz-preview-status-dot"></span>
                            ${
                                quiz.published
                                    ? "Published"
                                    : "Draft / Disabled"
                            }
                        </span>

                    </div>


                    <div class="admin-quiz-preview-meta">

                        <div class="admin-quiz-preview-meta-item">
                            <span class="admin-quiz-preview-meta-icon">⏱</span>
                            <div>
                                <small>Time Limit</small>
                                <strong>
                                    ${Number(
                                        quiz.time_limit ??
                                        quiz.timeLimit ??
                                        30
                                    )} minutes
                                </strong>
                            </div>
                        </div>

                        <div class="admin-quiz-preview-meta-item">
                            <span class="admin-quiz-preview-meta-icon">↻</span>
                            <div>
                                <small>Attempts</small>
                                <strong>
                                    ${Number(
                                        quiz.attempts_allowed ??
                                        quiz.attemptsAllowed ??
                                        1
                                    )}
                                </strong>
                            </div>
                        </div>

                        <div class="admin-quiz-preview-meta-item">
                            <span class="admin-quiz-preview-meta-icon">📝</span>
                            <div>
                                <small>Questions</small>
                                <strong>
                                    ${questions.length}
                                </strong>
                            </div>
                        </div>

                    </div>

                </div>


                <div class="admin-quiz-preview-section-heading">

                    <div>
                        <span>QUIZ CONTENT</span>
                        <h3>Questions & Answers</h3>
                    </div>

                    <span class="admin-quiz-preview-count">
                        ${questions.length}
                        ${
                            questions.length === 1
                                ? "Question"
                                : "Questions"
                        }
                    </span>

                </div>


                <div class="admin-quiz-preview-questions">

                    ${
                        questions.length
                            ? questions.map(
                                (question, index) => `

                                    <div class="card admin-quiz-preview-question">

                                        <div class="admin-quiz-preview-question-heading">

                                            <span class="admin-quiz-preview-number">
                                                ${index + 1}
                                            </span>

                                            <span>
                                                Question ${index + 1}
                                            </span>

                                        </div>

                                        <h3>
                                            ${escapeHTML(
                                                question.question
                                            )}
                                        </h3>

                                        <div class="admin-quiz-preview-options">

                                            ${(
                                                question.options ||
                                                []
                                            ).map(
                                                (option, optionIndex) => {

                                                    const optionText =
                                                        option.option_text ??
                                                        option.text ??
                                                        "";

                                                    const isCorrect =
                                                        !!(
                                                            option.isCorrect ??
                                                            option.is_correct ??
                                                            false
                                                        );

                                                    return `

                                                        <div class="admin-quiz-preview-option ${
                                                            isCorrect
                                                                ? "correct"
                                                                : ""
                                                        }">

                                                            <span class="admin-quiz-preview-option-letter">
                                                                ${String.fromCharCode(
                                                                    65 +
                                                                    optionIndex
                                                                )}
                                                            </span>

                                                            <span class="admin-quiz-preview-option-text">
                                                                ${escapeHTML(
                                                                    optionText
                                                                )}
                                                            </span>

                                                            ${
                                                                isCorrect
                                                                    ? `
                                                                        <span class="admin-quiz-preview-correct">
                                                                            ✓ Correct
                                                                        </span>
                                                                      `
                                                                    : ""
                                                            }

                                                        </div>

                                                    `;

                                                }
                                            ).join("")}

                                        </div>

                                    </div>

                                `
                            ).join("")
                            : `

                                <div class="card admin-quiz-preview-empty">

                                    <div class="admin-quiz-preview-empty-icon">
                                        📝
                                    </div>

                                    <h3>
                                        No questions yet
                                    </h3>

                                    <p>
                                        This quiz does not contain any questions.
                                    </p>

                                </div>

                            `
                    }

                </div>

            </div>

        `;

    } catch (error) {

        showToast(
            error.message ||
            "Could not preview quiz.",
            "error"
        );
    }
}
// =========================================================
// QUIZ RESULT
// =========================================================

function renderQuizResult(result) {

    const score =
        result.score ??
        0;

    const total =
        result.total_questions ??
        result.totalQuestions ??
        0;

    const percentageValue =
        result.percentage ??
        (
            total
                ? (score / total) * 100
                : 0
        );

    const passed =
        result.passed ??
        percentageValue >= 50;


    pageContent.innerHTML = `
    <div class="result-card card">
        <div class="result-icon ${passed ? "result-success" : "result-failed"}">
            ${passed ? "🎉" : "📚"}
        </div>

        <span class="result-label">
            ${passed ? "Quiz Completed" : "Quiz Attempt Completed"}
        </span>

        <h2>
            ${passed ? "Congratulations!" : "Keep Practising!"}
        </h2>

        <p class="result-message">
            You completed
            <strong>${escapeHTML(currentQuiz?.title || "the quiz")}</strong>
        </p>

        <div class="result-score-box">
            <div class="result-score">${score} <span>/ ${total}</span></div>
            <div class="result-percentage">
                ${percentage(percentageValue)}
            </div>
        </div>

        <div class="result-status-row">
            <span class="status-badge ${passed ? "badge-success" : "badge-danger"}">
                ${passed ? "PASSED" : "FAILED"}
            </span>
        </div>

        <button
            class="primary-button result-action"
            onclick="navigateTo('results')"
        >
            View My Results
            <span>→</span>
        </button>
    </div>
`;
}


// =========================================================
// STUDENT RESULTS
// =========================================================

async function renderResults() {

    const data =
        await apiRequest(
            "/student/results"
        );

    const results =
        data.results ||
        data ||
        [];


    pageContent.innerHTML = `

        <div class="dashboard-header">

            <h2>
                My Results
            </h2>

            <p>
                Review your completed quiz attempts.
            </p>

        </div>


        ${
            results.length
                ? `

                    <div class="card">

                        <div class="table-wrapper">

                            <table class="data-table">

                                <thead>

                                    <tr>
                                        <th>Quiz</th>
                                        <th>Score</th>
                                        <th>Percentage</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                    </tr>

                                </thead>


                                <tbody>

                                    ${results.map(
                                        result => {

                                            const title =
                                                result.title ||
                                                result.quiz_title ||
                                                "Quiz";

                                            const score =
                                                result.score ??
                                                0;

                                            const total =
                                                result.total_questions ??
                                                result.totalQuestions ??
                                                0;

                                            const pct =
                                                result.percentage ??
                                                0;

                                            const passed =
                                                result.passed === true ||
                                                result.passed === "true";


                                            return `

                                                <tr>

                                                    <td>
                                                        ${escapeHTML(
                                                            title
                                                        )}
                                                    </td>

                                                    <td>
                                                        ${score} / ${total}
                                                    </td>

                                                    <td>
                                                        ${percentage(pct)}
                                                    </td>

                                                    <td>

                                                        <span class="
                                                            status-badge
                                                            ${
                                                                passed
                                                                    ? "badge-success"
                                                                    : "badge-danger"
                                                            }
                                                        ">

                                                            ${
                                                                passed
                                                                    ? "PASSED"
                                                                    : "FAILED"
                                                            }

                                                        </span>

                                                    </td>

                                                    <td>
                                                        ${formatDate(
                                                            result.completed_at ||
                                                            result.completedAt
                                                        )}
                                                    </td>

                                                </tr>
                                            `;
                                        }
                                    ).join("")}

                                </tbody>

                            </table>

                        </div>

                    </div>

                `
                : `

                    <div class="empty-state">

                        <div class="empty-icon">
                            📊
                        </div>

                        <h3>
                            No results yet
                        </h3>

                        <p>
                            Complete a quiz and your result
                            will appear here.
                        </p>

                        <button
                            class="primary-button"
                            onclick="navigateTo('quizzes')"
                        >
                            Take a Quiz
                        </button>

                    </div>
                `
        }
    `;
}


// =========================================================
// STUDENT RANKING
// =========================================================

async function renderRanking() {

    const data =
        await apiRequest(
            "/student/ranking"
        );

    const ranking =
        data.ranking ||
        data.students ||
        data ||
        [];


    pageContent.innerHTML = `

        <div class="dashboard-header">

            <h2>
                Student Ranking
            </h2>

            <p>
                See how you compare with other students.
                Other students' exact marks are not displayed.
            </p>

        </div>


        ${
            ranking.length
                ? `

                    <div class="card">

                        <div class="table-wrapper">

                            <table class="data-table">

                                <thead>

                                    <tr>
                                        <th>Rank</th>
                                        <th>Student</th>
                                        <th>Status</th>
                                    </tr>

                                </thead>


                                <tbody>

                                    ${ranking.map(
                                        (student, index) => {

                                            const rank =
                                                student.rank ??
                                                index + 1;

                                            const name =
                                                `${student.name || ""} ${
                                                    student.surname || ""
                                                }`.trim() ||
                                                "Student";

                                            const passed =
                                                student.passed === true ||
                                                student.passed === "true";

                                            const isCurrentUser =
                                                Number(student.id) ===
                                                Number(
                                                    currentUser.student_id ||
                                                    currentUser.studentId
                                                );


                                            return `

                                                <tr
                                                    ${
                                                        isCurrentUser
                                                            ? 'class="current-user-row"'
                                                            : ""
                                                    }
                                                >

                                                    <td>
                                                        <strong>
                                                            #${rank}
                                                        </strong>
                                                    </td>


                                                    <td>

                                                        ${escapeHTML(
                                                            name
                                                        )}

                                                        ${
                                                            isCurrentUser
                                                                ? `
                                                                    <small>
                                                                        You
                                                                    </small>
                                                                `
                                                                : ""
                                                        }

                                                    </td>


                                                    <td>

                                                        <span class="
                                                            status-badge
                                                            ${
                                                                passed
                                                                    ? "badge-success"
                                                                    : "badge-danger"
                                                            }
                                                        ">

                                                            ${
                                                                passed
                                                                    ? "PASSED"
                                                                    : "FAILED"
                                                            }

                                                        </span>

                                                    </td>

                                                </tr>
                                            `;
                                        }
                                    ).join("")}

                                </tbody>

                            </table>

                        </div>

                    </div>

                `
                : `

                    <div class="empty-state">

                        <div class="empty-icon">
                            🏆
                        </div>

                        <h3>
                            No ranking available
                        </h3>

                        <p>
                            Ranking information will appear after
                            students complete quizzes.
                        </p>

                    </div>
                `
        }
    `;
}


// =========================================================
// STUDENT PROFILE
// =========================================================

async function renderProfile() {

    const data =
        await apiRequest(
            "/me"
        );

    const user =
        data.user ||
        currentUser ||
        {};

    const student =
        data.student ||
        user.student ||
        {};


    pageContent.innerHTML = `

        <div class="dashboard-header">

            <h2>
                My Profile
            </h2>

            <p>
                Update your student information.
            </p>

        </div>


        <div class="card profile-card">

            <form id="profileForm">

                <div class="form-grid">

                    <div class="form-group">

                        <label for="profileName">
                            First Name
                        </label>

                        <input
                            id="profileName"
                            type="text"
                            value="${escapeHTML(
                                student.name ||
                                user.name ||
                                ""
                            )}"
                            required
                        >

                    </div>


                    <div class="form-group">

                        <label for="profileSurname">
                            Surname
                        </label>

                        <input
                            id="profileSurname"
                            type="text"
                            value="${escapeHTML(
                                student.surname ||
                                user.surname ||
                                ""
                            )}"
                            required
                        >

                    </div>


                    <div class="form-group">

                        <label>
                            Email
                        </label>

                        <input
                            type="email"
                            value="${escapeHTML(
                                user.email ||
                                ""
                            )}"
                            disabled
                        >

                    </div>


                    <div class="form-group">

                        <label>
                            Role
                        </label>

                        <input
                            type="text"
                            value="${escapeHTML(
                                roleLabel(
                                    user.role
                                )
                            )}"
                            disabled
                        >

                    </div>

                </div>


                <button
                    type="submit"
                    class="primary-button"
                >
                    Save Changes
                </button>

            </form>

        </div>
    `;


    const profileForm =
        document.getElementById(
            "profileForm"
        );


    profileForm?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const name =
                document
                    .getElementById(
                        "profileName"
                    )
                    .value
                    .trim();

            const surname =
                document
                    .getElementById(
                        "profileSurname"
                    )
                    .value
                    .trim();


            if (!name || !surname) {

                showToast(
                    "Name and surname are required.",
                    "error"
                );

                return;
            }


            const button =
                profileForm.querySelector(
                    "button[type='submit']"
                );


            setLoading(
                button,
                true,
                "Save Changes"
            );


            try {

                const result =
                    await apiRequest(
                        "/student/profile",
                        {
                            method: "PUT",

                            body: JSON.stringify({
                                name,
                                surname
                            })
                        }
                    );


                if (result.user) {

                    currentUser = {
                        ...currentUser,
                        ...result.user
                    };
                }


                currentUser.name =
                    name;

                currentUser.surname =
                    surname;


                await updateUserInterface();


                showToast(
                    "Profile updated successfully."
                );

            } catch (error) {

                showToast(
                    error.message ||
                    "Could not update profile.",
                    "error"
                );

            } finally {

                setLoading(
                    button,
                    false,
                    "Save Changes"
                );
            }
        }
    );
}


// =========================================================
// TEACHER / ADMIN STUDENTS
// =========================================================

async function getStudents() {

    const data =
        await apiRequest(
            "/teacher/students"
        );

    return data.students ||
        data ||
        [];
}


async function renderStudents() {

    const students =
        await getStudents();

    renderStudentTable(
        students,
        "All Students",
        "View student performance."
    );
}


function renderStudentTable(
    students,
    title,
    description
) {

    pageContent.innerHTML = `

        <div class="dashboard-header">

            <div>

                <h2>
                    ${escapeHTML(title)}
                </h2>

                <p>
                    ${escapeHTML(
                        description
                    )}
                </p>

            </div>

        </div>


        ${
            students.length
                ? `

                    <div class="card">

                        <div class="table-wrapper">

                            <table class="data-table">

                                <thead>

                                    <tr>
                                        <th>Student</th>
                                        <th>Email</th>
                                        <th>Attempts</th>
                                        <th>Average</th>
                                        <th>Highest</th>
                                    </tr>

                                </thead>


                                <tbody>

                                    ${students.map(
                                        student => {

                                            const name =
                                                `${student.name || ""} ${
                                                    student.surname || ""
                                                }`.trim() ||
                                                "Student";

                                            const attempts =
                                                student.attempts ??
                                                student.total_attempts ??
                                                0;

                                            const average =
                                                student.average_percentage ??
                                                student.averagePercentage ??
                                                student.average ??
                                                0;

                                            const highest =
                                                student.highest_percentage ??
                                                student.highestPercentage ??
                                                student.highest ??
                                                0;


                                            return `

                                                <tr>

                                                    <td>
                                                        <strong>
                                                            ${escapeHTML(
                                                                name
                                                            )}
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        ${escapeHTML(
                                                            student.email ||
                                                            "—"
                                                        )}
                                                    </td>

                                                    <td>
                                                        ${attempts}
                                                    </td>

                                                    <td>
                                                        ${percentage(
                                                            average
                                                        )}
                                                    </td>

                                                    <td>
                                                        ${percentage(
                                                            highest
                                                        )}
                                                    </td>

                                                </tr>
                                            `;
                                        }
                                    ).join("")}

                                </tbody>

                            </table>

                        </div>

                    </div>

                `
                : `

                    <div class="empty-state">

                        <div class="empty-icon">
                            👨‍🎓
                        </div>

                        <h3>
                            No students found
                        </h3>

                        <p>
                            Student records will appear here.
                        </p>

                    </div>
                `
        }
    `;
}


// =========================================================
// PASSED STUDENTS
// =========================================================

async function renderPassedStudents() {

    const data =
        await apiRequest(
            "/teacher/students/passed"
        );

    const students =
        data.students ||
        data ||
        [];

    renderStudentTable(
        students,
        "Passed Students",
        "Students who have achieved a passing result."
    );
}


// =========================================================
// FAILED STUDENTS
// =========================================================

async function renderFailedStudents() {

    const data =
        await apiRequest(
            "/teacher/students/failed"
        );

    const students =
        data.students ||
        data ||
        [];

    renderStudentTable(
        students,
        "Failed Students",
        "Students who may need additional support."
    );
}


// =========================================================
// ANALYTICS
// =========================================================

async function renderAnalytics() {

    const data =
        await apiRequest(
            "/teacher/analytics"
        );

    const analytics =
        data.analytics ||
        data ||
        {};

    const total =
        analytics.total_students ??
        analytics.totalStudents ??
        0;

    const passed =
        analytics.passed_students ??
        analytics.passedStudents ??
        analytics.passed ??
        0;

    const failed =
        analytics.failed_students ??
        analytics.failedStudents ??
        analytics.failed ??
        0;

    const highest =
        analytics.highest_percentage ??
        analytics.highestPercentage ??
        0;

    const lowest =
        analytics.lowest_percentage ??
        analytics.lowestPercentage ??
        0;


    pageContent.innerHTML = `

        <div class="dashboard-header">

            <h2>
                Analytics
            </h2>

            <p>
                Overview of student performance.
            </p>

        </div>


        <div class="stats-grid">

            <div class="stat-card">

                <div class="stat-icon">
                    👨‍🎓
                </div>

                <div>

                    <span class="stat-label">
                        Total Students
                    </span>

                    <strong>
                        ${total}
                    </strong>

                </div>

            </div>


            <div class="stat-card">

                <div class="stat-icon">
                    ✅
                </div>

                <div>

                    <span class="stat-label">
                        Passed
                    </span>

                    <strong>
                        ${passed}
                    </strong>

                </div>

            </div>


            <div class="stat-card">

                <div class="stat-icon">
                    ❌
                </div>

                <div>

                    <span class="stat-label">
                        Failed
                    </span>

                    <strong>
                        ${failed}
                    </strong>

                </div>

            </div>


            <div class="stat-card">

                <div class="stat-icon">
                    🏆
                </div>

                <div>

                    <span class="stat-label">
                        Highest Score
                    </span>

                    <strong>
                        ${percentage(highest)}
                    </strong>

                </div>

            </div>

        </div>


        <div class="card">

            <div class="card-header">

                <div>

                    <h3>
                        Performance Range
                    </h3>

                    <p>
                        Highest and lowest recorded
                        student performance.
                    </p>

                </div>

            </div>


            <div class="performance-summary">

                <div class="performance-row">

                    <span>
                        Highest percentage
                    </span>

                    <strong>
                        ${percentage(highest)}
                    </strong>

                </div>


                <div class="performance-row">

                    <span>
                        Lowest percentage
                    </span>

                    <strong>
                        ${percentage(lowest)}
                    </strong>

                </div>


                <div class="performance-row">

                    <span>
                        Students passed
                    </span>

                    <strong>
                        ${passed}
                    </strong>

                </div>


                <div class="performance-row">

                    <span>
                        Students failed
                    </span>

                    <strong>
                        ${failed}
                    </strong>

                </div>

            </div>

        </div>
    `;
}


// =========================================================
// CREATE QUIZ
// =========================================================

let quizQuestionCounter = 0;


function renderCreateQuiz() {

    quizQuestionCounter = 0;

    pageContent.innerHTML = `

        <div class="quiz-builder-shell">

        <div class="dashboard-header">
            <div>
                <span class="quiz-builder-step">Step 1 · Build</span>
                <h2>Create Quiz</h2>
                <p>Design a polished multiple-choice assessment for your class.</p>
            </div>
        </div>

        <form id="createQuizForm">

            <div class="card">
                <div class="card-header">
                    <div>
                        <h3>Quiz Information</h3>
                        <p>Title and short description students will see.</p>
                    </div>
                </div>


                <div class="form-grid">

                    <div class="form-group">

                        <label for="quizTitle">
                            Quiz Title
                        </label>

                        <input
                            id="quizTitle"
                            type="text"
                            placeholder="e.g. Mathematics Test 1"
                            required
                        >

                    </div>


                    <div class="form-group">

                        <label for="quizDescription">
                            Description
                        </label>

                        <input
                            id="quizDescription"
                            type="text"
                            placeholder="Brief description"
                        >

                    </div>

                </div>

            </div>


            <!-- QUIZ SETTINGS -->

            <div class="card">

                <div class="card-header">

                    <div>

                        <h3>
                            Quiz Settings
                        </h3>

                        <p>
                            Control how students will access and complete this quiz.
                        </p>

                    </div>

                </div>


                <div class="form-grid">

                    <div class="form-group">

                        <label for="quizTimeLimit">
                            Time Limit (minutes)
                        </label>

                        <input
                            id="quizTimeLimit"
                            type="number"
                            min="1"
                            value="30"
                            required
                        >

                        <small>
                            How long a student has to complete the quiz.
                        </small>

                    </div>


                    <div class="form-group">

                        <label for="quizAttemptsAllowed">
                            Attempts Allowed
                        </label>

                        <input
                            id="quizAttemptsAllowed"
                            type="number"
                            min="1"
                            value="1"
                            required
                        >

                        <small>
                            Maximum number of times a student may attempt this quiz.
                        </small>

                    </div>


                    <div class="form-group">

                        <label for="quizStartAt">
                            Start Date & Time
                        </label>

                        <input
                            id="quizStartAt"
                            type="datetime-local"
                        >

                        <small>
                            Leave empty to make the quiz available immediately.
                        </small>

                    </div>


                    <div class="form-group">

                        <label for="quizEndAt">
                            End Date & Time
                        </label>

                        <input
                            id="quizEndAt"
                            type="datetime-local"
                        >

                        <small>
                            Leave empty for no closing date.
                        </small>

                    </div>


                    <div class="form-group">

                        <label for="quizPublished">
                            Publication Status
                        </label>

                        <select id="quizPublished">

                            <option value="false" selected>
                                Draft
                            </option>

                            <option value="true">
                                Published
                            </option>

                        </select>

                        <small>
                            Draft quizzes are saved but hidden from students.
                        </small>

                    </div>

                </div>

            </div>


            <!-- QUESTIONS -->

            <div class="card">

                <div class="card-header">

                    <div>

                        <h3>
                            Questions
                        </h3>

                        <p>
                            Add your questions and select the correct answer for each one.
                        </p>

                    </div>

                </div>

                <div id="quizQuestions"></div>

            </div>


            <!-- ACTIONS -->

            <div class="quiz-builder-actions">
                <button type="button" class="secondary-button" id="addQuestionButton">+ Add Question</button>
                <button type="button" class="secondary-button" id="previewQuizButton">👁 Preview</button>
                <button type="submit" class="primary-button">Create Quiz</button>
            </div>

        </form>
        </div>
    `;


    addQuizQuestion();


    document
        .getElementById("addQuestionButton")
        ?.addEventListener(
            "click",
            addQuizQuestion
        );


    document
        .getElementById("previewQuizButton")
        ?.addEventListener(
            "click",
            previewQuiz
        );


    document
        .getElementById("createQuizForm")
        ?.addEventListener(
            "submit",
            handleCreateQuiz
        );
}


function addQuizQuestion() {

    quizQuestionCounter++;

    const questionNumber =
        quizQuestionCounter;


    const questionsContainer =
        document.getElementById(
            "quizQuestions"
        );


    if (!questionsContainer) {
        return;
    }


    const questionCard =
        document.createElement(
            "div"
        );


    questionCard.className =
        "quiz-builder-question card";


    questionCard.dataset.questionNumber =
        questionNumber;


    questionCard.innerHTML = `

        <div class="quiz-question-header">

            <div>

                <h3>
                    Question ${questionNumber}
                </h3>

                <p>
                    Add the question and its answer choices.
                </p>

            </div>


            <button
                type="button"
                class="danger-button remove-question"
            >
                Remove
            </button>

        </div>


        <div class="form-group">

            <label>
                Question
            </label>

            <input
                type="text"
                class="question-text"
                placeholder="Enter your question"
                required
            >

        </div>


        <div class="form-group">

            <label>
                Answer Options
            </label>

            <div class="options-builder"></div>

        </div>


        <div class="quiz-question-actions">

            <button
                type="button"
                class="secondary-button add-option"
            >
                + Add Option
            </button>

        </div>

    `;


    questionsContainer.appendChild(
        questionCard
    );


    const addOptionButton =
        questionCard.querySelector(
            ".add-option"
        );


    addOptionButton?.addEventListener(
        "click",
        () => {
            addQuizOption(
                questionCard
            );
        }
    );


    questionCard
        .querySelector(
            ".remove-question"
        )
        ?.addEventListener(
            "click",
            () => {

                questionCard.remove();

                renumberQuestions();
            }
        );


    addQuizOption(
        questionCard
    );

    addQuizOption(
        questionCard
    );
}


function renumberQuestions() {

    const questions =
        document.querySelectorAll(
            ".quiz-builder-question"
        );


    questions.forEach(
        (questionCard, index) => {

            const number =
                index + 1;


            questionCard.dataset.questionNumber =
                number;


            const heading =
                questionCard.querySelector(
                    "h3"
                );


            if (heading) {
                heading.textContent =
                    `Question ${number}`;
            }


            const rows =
                questionCard.querySelectorAll(
                    ".option-row"
                );


            rows.forEach(
                (row, optionIndex) => {

                    const radio =
                        row.querySelector(
                            "input[type='radio']"
                        );


                    if (radio) {

                        radio.name =
                            `correct-${number}`;

                        radio.value =
                            optionIndex;
                    }
                }
            );
        }
    );


    quizQuestionCounter =
        questions.length;
}


function addQuizOption(questionCard) {

    const optionsBuilder =
        questionCard.querySelector(
            ".options-builder"
        );

    const questionNumber =
        questionCard.dataset.questionNumber;

    const optionIndex =
        optionsBuilder.querySelectorAll(
            ".option-row"
        ).length;


    const row =
        document.createElement(
            "div"
        );

    row.className =
        "option-row";


    row.innerHTML = `

        <input
            type="radio"
            name="correct-${questionNumber}"
            value="${optionIndex}"
        >


        <input
            type="text"
            class="option-text"
            placeholder="Option ${optionIndex + 1}"
            required
        >


        <button
            type="button"
            class="danger-button remove-option"
        >
            ×
        </button>
    `;


    optionsBuilder.appendChild(
        row
    );


    row
        .querySelector(
            ".remove-option"
        )
        ?.addEventListener(
            "click",
            () => {

                if (
                    optionsBuilder.querySelectorAll(
                        ".option-row"
                    ).length <= 2
                ) {

                    showToast(
                        "A question needs at least two options.",
                        "error"
                    );

                    return;
                }

                row.remove();

                renumberOptions(
                    questionCard
                );
            }
        );
}


function renumberOptions(questionCard) {

    const questionNumber =
        questionCard.dataset.questionNumber;

    const rows =
        questionCard.querySelectorAll(
            ".option-row"
        );


    rows.forEach(
        (row, index) => {

            const radio =
                row.querySelector(
                    "input[type='radio']"
                );

            const text =
                row.querySelector(
                    ".option-text"
                );


            radio.name =
                `correct-${questionNumber}`;

            radio.value =
                index;


            if (
                text &&
                !text.value
            ) {
                text.placeholder =
                    `Option ${index + 1}`;
            }
        }
    );
}


function renumberQuizQuestions() {

    const cards =
        document.querySelectorAll(
            ".quiz-builder-question"
        );


    cards.forEach(
        (card, index) => {

            const number =
                index + 1;

            card.dataset.questionNumber =
                number;


            const heading =
                card.querySelector(
                    ".card-header h3"
                );


            if (heading) {
                heading.textContent =
                    `Question ${number}`;
            }


            const radios =
                card.querySelectorAll(
                    "input[type='radio']"
                );


            radios.forEach(
                (radio, radioIndex) => {

                    radio.name =
                        `correct-${number}`;

                    radio.value =
                        radioIndex;
                }
            );
        }
    );


    quizQuestionCounter =
        cards.length;
}



async function handleCreateQuiz(event) {

    event.preventDefault();

    const title =
        document
            .getElementById("quizTitle")
            .value
            .trim();

    const description =
        document
            .getElementById("quizDescription")
            .value
            .trim();

    const timeLimit =
        Number(
            document
                .getElementById("quizTimeLimit")
                .value
        );

    const attemptsAllowed =
        Number(
            document
                .getElementById("quizAttemptsAllowed")
                .value
        );

    const startAt =
        document
            .getElementById("quizStartAt")
            .value || null;

    const endAt =
        document
            .getElementById("quizEndAt")
            .value || null;

    const published =
        document
            .getElementById("quizPublished")
            .value === "true";

    const cards =
        document.querySelectorAll(
            ".quiz-builder-question"
        );


    if (!title) {

        showToast(
            "Please enter a quiz title.",
            "error"
        );

        return;
    }


    if (!Number.isInteger(timeLimit) || timeLimit < 1) {

        showToast(
            "Time limit must be at least 1 minute.",
            "error"
        );

        return;
    }


    if (
        !Number.isInteger(attemptsAllowed) ||
        attemptsAllowed < 1
    ) {

        showToast(
            "Attempts allowed must be at least 1.",
            "error"
        );

        return;
    }


    if (
        startAt &&
        endAt &&
        new Date(startAt) >= new Date(endAt)
    ) {

        showToast(
            "End date and time must be after the start date and time.",
            "error"
        );

        return;
    }


    if (!cards.length) {

        showToast(
            "Add at least one question.",
            "error"
        );

        return;
    }


    const questions = [];


    for (const card of cards) {

        const questionText =
            card
                .querySelector(".question-text")
                .value
                .trim();


        const optionRows =
            card.querySelectorAll(
                ".option-row"
            );


        const options = [];

        let correctCount = 0;


        optionRows.forEach(row => {

            const text =
                row
                    .querySelector(".option-text")
                    .value
                    .trim();


            const radio =
                row.querySelector(
                    "input[type='radio']"
                );


            const isCorrect =
                radio.checked;


            if (isCorrect) {
                correctCount++;
            }


            options.push({
                text,
                isCorrect
            });

        });


        if (!questionText) {

            showToast(
                "Every question needs text.",
                "error"
            );

            return;
        }


        if (options.length < 2) {

            showToast(
                "Every question needs at least two options.",
                "error"
            );

            return;
        }


        if (
            options.some(
                option => !option.text
            )
        ) {

            showToast(
                "Every option needs text.",
                "error"
            );

            return;
        }


        if (correctCount !== 1) {

            showToast(
                "Each question must have exactly one correct option.",
                "error"
            );

            return;
        }


        questions.push({
            question: questionText,
            options
        });
    }


    const form =
        document.getElementById(
            "createQuizForm"
        );


    const submitButton =
        form.querySelector(
            "button[type='submit']"
        );


    setLoading(
        submitButton,
        true,
        "Create Quiz"
    );


    try {

        await apiRequest(
            "/quizzes",
            {
                method: "POST",

                body: JSON.stringify({
                    title,
                    description,
                    timeLimit,
                    attemptsAllowed,
                    startAt,
                    endAt,
                    published,
                    questions
                })
            }
        );


        showToast(
            published
                ? "Quiz created and published successfully!"
                : "Quiz saved as draft successfully!"
        );


        setTimeout(
            () => {
                navigateTo("quizzes");
            },
            700
        );

    } catch (error) {

        showToast(
            error.message ||
            "Could not create quiz.",
            "error"
        );


        setLoading(
            submitButton,
            false,
            "Create Quiz"
        );
    }
}

function previewQuiz() {

    const title =
        document
            .getElementById("quizTitle")
            .value
            .trim() ||
        "Untitled Quiz";

    const description =
        document
            .getElementById("quizDescription")
            .value
            .trim();

    const timeLimit =
        document
            .getElementById("quizTimeLimit")
            .value;

    const attemptsAllowed =
        document
            .getElementById("quizAttemptsAllowed")
            .value;

    const startAt =
        document
            .getElementById("quizStartAt")
            .value;

    const endAt =
        document
            .getElementById("quizEndAt")
            .value;

    const published =
        document
            .getElementById("quizPublished")
            .value === "true";


    const cards =
        document.querySelectorAll(
            ".quiz-builder-question"
        );


    if (!cards.length) {

        showToast(
            "Add at least one question before previewing.",
            "error"
        );

        return;
    }


    const questions = [];


    for (const card of cards) {

        const questionText =
            card
                .querySelector(".question-text")
                .value
                .trim();


        const optionRows =
            card.querySelectorAll(
                ".option-row"
            );


        const options = [];


        optionRows.forEach(row => {

            const text =
                row
                    .querySelector(".option-text")
                    .value
                    .trim();


            const radio =
                row.querySelector(
                    "input[type='radio']"
                );


            options.push({
                text,
                isCorrect: radio.checked
            });

        });


        questions.push({
            question: questionText || "Untitled question",
            options
        });
    }


    const startText =
        startAt
            ? new Date(startAt).toLocaleString()
            : "Available immediately";


    const endText =
        endAt
            ? new Date(endAt).toLocaleString()
            : "No closing date";


    const previewHTML = `
        <div class="quiz-preview-hero">
            <span class="status-badge">${published ? "Published" : "Draft"}</span>
            <h2>${escapeHtml(title)}</h2>
            ${description ? `<p>${escapeHtml(description)}</p>` : ""}
            <div class="quiz-preview-meta">
                <div class="quiz-preview-meta-item"><strong>Time limit</strong><p>${timeLimit} min</p></div>
                <div class="quiz-preview-meta-item"><strong>Attempts</strong><p>${attemptsAllowed}</p></div>
                <div class="quiz-preview-meta-item"><strong>Starts</strong><p>${escapeHtml(startText)}</p></div>
                <div class="quiz-preview-meta-item"><strong>Ends</strong><p>${escapeHtml(endText)}</p></div>
            </div>
        </div>
        ${questions.map((item, index) => `
            <div class="quiz-preview-q">
                <div class="quiz-preview-q-num">Question ${index + 1}</div>
                <h3>${escapeHtml(item.question)}</h3>
                <div class="preview-options">
                    ${item.options.map((option, optionIndex) => `
                        <div class="preview-option ${option.isCorrect ? "correct" : ""}">
                            <span class="preview-option-letter">${String.fromCharCode(65 + optionIndex)}</span>
                            <span class="preview-option-text">${escapeHtml(option.text || `Option ${optionIndex + 1}`)}</span>
                            ${option.isCorrect ? `<span class="preview-correct-tag">✓ Correct</span>` : ""}
                        </div>
                    `).join("")}
                </div>
            </div>
        `).join("")}
    `;


    pageContent.innerHTML = `
        <div class="quiz-preview-shell">
            <div class="dashboard-header">
                <div>
                    <span class="quiz-builder-step">Preview</span>
                    <h2>Quiz Preview</h2>
                    <p>This is how the quiz will look before students take it.</p>
                </div>
                <button type="button" class="secondary-button" id="backToQuizBuilderButton">
                    ← Back to Builder
                </button>
            </div>
            ${previewHTML}
        </div>
    `;


    document
        .getElementById(
            "backToQuizBuilderButton"
        )
        ?.addEventListener(
            "click",
            renderCreateQuiz
        );
}


// =========================================================
// ADMIN USER MANAGEMENT
// =========================================================

async function renderUsers() {

    const data =
        await apiRequest(
            "/admin/users"
        );

    const users =
        data.users ||
        data ||
        [];


    pageContent.innerHTML = `

        <div class="dashboard-header">

            <div>

                <h2>
                    User Management
                </h2>

                <p>
                    Manage platform users and their roles.
                </p>

            </div>

        </div>


        ${
            users.length
                ? `

                    <div class="card">

                        <div class="table-wrapper">

                            <table class="data-table">

                                <thead>

                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>

                                </thead>


                                <tbody>

                                    ${users.map(
                                        user => {

                                            const student =
                                                user.student ||
                                                {};


                                            const name =
                                                `${student.name || user.name || ""} ${
                                                    student.surname ||
                                                    user.surname ||
                                                    ""
                                                }`.trim() ||
                                                "—";


                                            const isCurrentUser =
                                                Number(user.id) ===
                                                Number(
                                                    currentUser.id ||
                                                    currentUser.userId
                                                );


                                            return `

                                                <tr>

                                                    <td>
                                                        ${escapeHTML(
                                                            name
                                                        )}
                                                    </td>


                                                    <td>
                                                        ${escapeHTML(
                                                            user.email ||
                                                            ""
                                                        )}
                                                    </td>


                                                    <td>

                                                        <select
                                                            class="role-select"
                                                            data-user-id="${Number(
                                                                user.id
                                                            )}"
                                                            ${
                                                                isCurrentUser
                                                                    ? "disabled"
                                                                    : ""
                                                            }
                                                        >

                                                            <option
                                                                value="student"
                                                                ${
                                                                    user.role ===
                                                                    "student"
                                                                        ? "selected"
                                                                        : ""
                                                                }
                                                            >
                                                                Student
                                                            </option>


                                                            <option
                                                                value="teacher"
                                                                ${
                                                                    user.role ===
                                                                    "teacher"
                                                                        ? "selected"
                                                                        : ""
                                                                }
                                                            >
                                                                Teacher
                                                            </option>


                                                            <option
                                                                value="admin"
                                                                ${
                                                                    user.role ===
                                                                    "admin"
                                                                        ? "selected"
                                                                        : ""
                                                                }
                                                            >
                                                                Admin
                                                            </option>

                                                        </select>

                                                    </td>


                                                    <td>
                                                        ${formatDate(
                                                            user.created_at ||
                                                            user.createdAt
                                                        )}
                                                    </td>


                                                    <td>

                                                        ${
                                                            isCurrentUser
                                                                ? `
                                                                    <span>
                                                                        Current user
                                                                    </span>
                                                                `
                                                                : `
                                                                    <button
                                                                        class="danger-button delete-user-button"
                                                                        data-user-id="${Number(
                                                                            user.id
                                                                        )}"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                `
                                                        }

                                                    </td>

                                                </tr>
                                            `;
                                        }
                                    ).join("")}

                                </tbody>

                            </table>

                        </div>

                    </div>

                `
                : `

                    <div class="empty-state">

                        <div class="empty-icon">
                            👥
                        </div>

                        <h3>
                            No users found
                        </h3>

                    </div>
                `
        }
    `;


    document
        .querySelectorAll(
            ".role-select"
        )
        .forEach(
            select => {

                select.addEventListener(
                    "change",
                    () => {

                        updateUserRole(
                            Number(
                                select.dataset.userId
                            ),
                            select.value
                        );
                    }
                );
            }
        );


    document
        .querySelectorAll(
            ".delete-user-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        deleteUser(
                            Number(
                                button.dataset.userId
                            )
                        );
                    }
                );
            }
        );
}


async function updateUserRole(
    userId,
    role
) {

    try {

        await apiRequest(
            `/admin/users/${userId}/role`,
            {
                method: "PATCH",

                body: JSON.stringify({
                    role
                })
            }
        );


        showToast(
            "User role updated successfully."
        );

    } catch (error) {

        showToast(
            error.message ||
            "Could not update user role.",
            "error"
        );

        await renderUsers();
    }
}


async function deleteUser(userId) {

    if (
        !confirm(
            "Are you sure you want to delete this user? This cannot be undone."
        )
    ) {
        return;
    }


    try {

        await apiRequest(
            `/admin/users/${userId}`,
            {
                method: "DELETE"
            }
        );


        showToast(
            "User deleted successfully."
        );


        await renderUsers();

    } catch (error) {

        showToast(
            error.message ||
            "Could not delete user.",
            "error"
        );
    }
}


// =========================================================
// GLOBAL FUNCTIONS
// =========================================================

window.navigateTo =
    navigateTo;

window.startQuiz =
    startQuiz;

window.deleteUser =
    deleteUser;


// =========================================================
// INITIALIZE
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {
        restoreSession();
    }
);
