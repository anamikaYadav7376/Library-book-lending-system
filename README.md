# Athenaeum - Full-Stack Library Management & Book Lending System

A complete, production-grade **Library Management and Book Lending System** built with Node.js, Express.js, MongoDB (Mongoose), and Server-Side Rendered (SSR) EJS views. Designed with an academic, university-grade aesthetic, robust session authentication, role-based authorization, and strict circulation business rules.

---

## 📖 Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
  - [Member Capabilities](#member-capabilities)
  - [Librarian & Admin Capabilities](#librarian--admin-capabilities)
- [Core Business Rules & Circulation Logic](#core-business-rules--circulation-logic)
- [Technology Stack](#technology-stack)
- [Project Architecture (MVC)](#project-architecture-mvc)
- [Installation & Local Setup](#installation--local-setup)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Database Seeding](#database-seeding)
- [Running Automated Tests](#running-automated-tests)
- [Deployment Guide](#deployment-guide)
  - [Deploying to Render](#deploying-to-render)
  - [Deploying to AWS / VPS](#deploying-to-aws--vps)
- [Demo Credentials](#demo-credentials)

---

## 🌟 Project Overview

Athenaeum Library System provides educational institutions and public libraries with a full-lifecycle book circulation platform. Rather than a static prototype, this system manages authentic database transactions in MongoDB Atlas: tracking book stock, checking out books, enforcing patron loan limits, detecting overdue materials automatically, calculating late fines in real-time, and aggregating circulation statistics dynamically.

---

## ✨ Key Features

### Member Capabilities
- **Account Registration & Session Login**: Secure registration and bcrypt password hashing.
- **Book Catalogue Exploration**: Browse all library titles with real-time stock indicators.
- **Advanced Search & Category Filtering**: Combined search by Title, Author, Category, or ISBN with category pill filters.
- **Book Details**: Comprehensive view of abstracts, ISBNs, and stock availability.
- **Book Request & Checkout**: One-click book borrowing with an automatic 14-day loan window.
- **Member Dashboard**:
  - Live counts: Currently Borrowed, Books Returned, Overdue Books, and Total Fines.
  - Active loans with due-date indicators and days remaining / overdue alerts.
  - Return books directly with instant inventory updates.
  - Personal borrowing history.
- **Transparent Overdue Fines**: Real-time server-side fine tracking at ₹5 per overdue day.

### Librarian & Admin Capabilities
- **Administrative Dashboard**:
  - **Dynamic Statistics**: Total Titles, Total Copies, Available Copies, Issued Books, Overdue Books, and Total Registered Members.
  - **Most Borrowed Titles**: Real-time MongoDB aggregation ranking titles by total loans.
  - **Recent Activity Streams**: Live audit feeds of recent issues, recent returns, and new member registrations.
- **Catalogue CRUD Management**:
  - Add new books (available copies automatically synchronize with total copies).
  - Edit book metadata and safely adjust copy counts without breaking existing loans.
  - Delete books with safety checks (books on active loan cannot be deleted).
- **Loan Circulation Management**:
  - Centralized table of all library loans.
  - Status filters: Active Checkouts, Overdue Only, Returned Only.
  - Search by patron name, email, book title, or ISBN.
  - Process patron returns and calculate final late penalties.
- **Member Directory**:
  - Inspect all registered members, registration dates, active checkouts, and overdue infractions.
  - Search members by name or email.

---

## ⚖️ Core Business Rules & Circulation Logic

1. **Borrowing Limit**: Members are restricted to a maximum of **5 active loans** concurrently. Sixth borrowing requests are strictly blocked.
2. **Duplicate Loan Prevention**: A member cannot borrow the same book if they already have an active or overdue loan for that book.
3. **Zero Stock Prevention**: Books with `availableCopies === 0` cannot be issued; the button is disabled with a "Currently Unavailable" badge.
4. **Loan Duration & Due Dates**: Default loan duration is **14 days** (`issueDate + 14 days`).
5. **Overdue Status**: If `currentDate > dueDate` and the loan has not been returned, the loan dynamically enters `overdue` status.
6. **Automatic Fine Calculation**:
   - Rate: **₹5 per overdue day** ($overdueDays \times 5$).
   - For active loans: $overdueDays = \lceil(now - dueDate) / 86400000\rceil$.
   - For returned loans: $overdueDays = \lceil(returnDate - dueDate) / 86400000\rceil$ if returned late, or ₹0 if returned on or before the due date.
   - Fines are calculated on the server and are strictly non-negative.
7. **Inventory Integrity**:
   - Issuing a book decrements `availableCopies` by 1.
   - Returning a book increments `availableCopies` by 1.
   - `availableCopies` can never become negative or exceed `totalCopies`.
8. **Deletion Protection**: Librarians cannot delete a book if any copies are currently issued or overdue.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v18+)
- **Backend Framework**: Express.js
- **Database**: MongoDB (Atlas or Local) via Mongoose ODM
- **Session Storage**: `express-session` with `connect-mongo`
- **Security**: `bcryptjs` password hashing, sanitized HTTP headers, role-based route middleware
- **Template Engine**: EJS (Server-Side Rendering)
- **CSS / UI**: Bootstrap 5.3, Bootstrap Icons, Custom Academic CSS Design System
- **Client Scripting**: Vanilla JavaScript (no React/Next.js)

---

## 📁 Project Architecture (MVC)

```text
library-management-system/
│
├── app.js                   # Express application setup, sessions, middleware & routes
├── package.json             # Project dependencies and npm scripts
├── .env                     # Local environment secrets (not committed)
├── .env.example             # Example configuration template
├── .gitignore               # Ignored files (node_modules, .env, logs)
├── seed.js                  # Database seed script for initial testing
│
├── config/
│   └── db.js                # MongoDB Mongoose connection handler
│
├── models/
│   ├── User.js              # User schema with bcrypt password hashing
│   ├── Book.js              # Book schema with stock constraints and text index
│   └── Loan.js              # Loan schema with dynamic overdue & fine calculator
│
├── controllers/
│   ├── authController.js    # Login, registration, session management, logout
│   ├── bookController.js    # Catalogue, search/filter, book CRUD, issue workflow
│   ├── loanController.js    # Member & librarian loan management, book return
│   └── dashboardController.js # Dynamic statistics, aggregations, member directory
│
├── routes/
│   ├── authRoutes.js        # /auth/register, /auth/login, /auth/logout
│   ├── bookRoutes.js        # /books (catalogue, CRUD, issue)
│   ├── loanRoutes.js        # /loans (circulation, my loans, returns)
│   └── dashboardRoutes.js   # /, /dashboard, /members
│
├── middleware/
│   ├── authMiddleware.js    # requireAuth & requireGuest guards
│   ├── roleMiddleware.js    # requireRole('librarian') role authorization
│   └── errorMiddleware.js   # 404 Not Found & 500 Server Error handlers
│
├── views/
│   ├── layouts/
│   │   ├── header.ejs       # Head, stylesheets, navbar & alerts
│   │   └── footer.ejs       # Scripts & footer partial
│   ├── partials/
│   │   ├── navbar.ejs       # Role-aware responsive navigation bar
│   │   ├── sidebar.ejs      # Librarian admin sidebar
│   │   ├── alerts.ejs       # Dismissible flash notification banners
│   │   └── footer.ejs       # Academic brand footer
│   ├── auth/
│   │   ├── login.ejs        # Login view
│   │   └── register.ejs     # Registration view
│   ├── dashboard/
│   │   ├── dashboard.ejs    # Role dispatcher
│   │   ├── memberDashboard.ejs # Member stats, active checkouts, history
│   │   ├── librarianDashboard.ejs # Admin metrics, top titles, activity feeds
│   │   └── members.ejs      # Librarian member management directory
│   ├── books/
│   │   ├── index.ejs        # Catalogue with search & category filters
│   │   ├── show.ejs         # Detailed book view with actions
│   │   ├── create.ejs       # Add new book form
│   │   └── edit.ejs         # Edit book form
│   ├── loans/
│   │   ├── myLoans.ejs      # Member loans & return controls
│   │   └── allLoans.ejs     # Librarian circulation management table
│   └── errors/
│       ├── 404.ejs          # 404 Not Found page
│       └── 500.ejs          # 500 Internal Error page
│
├── public/
│   ├── css/
│   │   └── style.css        # Custom academic design system & responsive tables
│   └── js/
│       └── main.js          # Auto-dismiss alerts, confirmation dialogs
│
├── test/
│   └── run-tests.js         # End-to-end integration test suite (all 8 workflows)
│
└── README.md
```

---

## 🚀 Installation & Local Setup

### 1. Clone the repository
```bash
git clone <repository-url>
cd antiTesting
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory (or copy from `.env.example`):
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/library_management
SESSION_SECRET=your_super_secret_session_key_here
```

---

## 🗄️ Database Setup

### Option A: Local MongoDB
Ensure your local MongoDB daemon is running:
```bash
brew services start mongodb-community
# or:
mongod --dbpath /usr/local/var/mongodb
```

### Option B: MongoDB Atlas (Cloud)
1. Sign up at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free M0 cluster.
3. Under **Database Access**, create a database user and password.
4. Under **Network Access**, whitelist your IP or add `0.0.0.0/0` (allow access from anywhere).
5. In your cluster dashboard, click **Connect** $\rightarrow$ **Drivers** $\rightarrow$ copy the connection string:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/library_management?retryWrites=true&w=majority
   ```

---

## 🌱 Database Seeding

Run the seed script to populate the database with 1 librarian, 5 members, 16 realistic books across 6 categories, and sample active/overdue loans demonstrating fines:

```bash
npm run seed
```

Output:
```text
Connecting to MongoDB...
Connected successfully. Purging existing collections...
Creating Librarian and 5 Member accounts...
Created 1 librarian and 5 members.
Populating book catalogue...
Inserted 16 books into database.
Seeding initial loan activity & fine demonstrations...
Database seeded successfully!
--------------------------------------------------
Librarian: admin@library.com | Password: Admin@123
Member:    anamika@library.com | Password: Member@123
--------------------------------------------------
```

---

## 🧪 Running Automated Tests

A comprehensive integration test script validates all 8 key application workflows against the actual database and HTTP server:

```bash
npm test
```

### Workflows Verified:
- **Workflow 1**: Register $\rightarrow$ Login $\rightarrow$ Browse books $\rightarrow$ Issue book $\rightarrow$ Member dashboard reflects loan.
- **Workflow 2**: Issue book $\rightarrow$ `availableCopies` decrements $\rightarrow$ Return book $\rightarrow$ `availableCopies` increments.
- **Workflow 3**: Member reaches 5 active loans $\rightarrow$ 6th issue is blocked.
- **Workflow 4**: Book has 0 available copies $\rightarrow$ issue is blocked.
- **Workflow 5**: Book becomes overdue $\rightarrow$ overdue status & ₹5/day fine are accurately calculated.
- **Workflow 6**: Librarian adds, edits, attempts deletion with active loans (blocked), and deletes after return.
- **Workflow 7**: Member attempting to access librarian routes (`/books/new`, `/members`) $\rightarrow$ 403 Forbidden.
- **Workflow 8**: Librarian dashboard statistics accurately reflect MongoDB aggregation and counts.

---

## ▶️ Running the Server

Start in development mode with auto-reloading:
```bash
npm run dev
```

Or start in standard production mode:
```bash
npm start
```

Open your browser and navigate to:
```text
http://localhost:3000
```

---

## 🌐 Deployment Guide

### Deploying to Render
1. Push your code to a GitHub repository.
2. Sign in to [Render](https://render.com) and click **New Web Service**.
3. Connect your repository.
4. Configure the settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `MONGODB_URI`: `<your MongoDB Atlas connection string>`
   - `SESSION_SECRET`: `<a secure random 32-character string>`
6. Click **Deploy Web Service**. Render will build and deploy your application.

---

## 🔑 Demo Credentials

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Librarian (Admin)** | `admin@library.com` | `Admin@123` | Full CRUD, Member Management, Circulation, Admin Analytics |
| **Member 1** | `anamika@library.com` | `Member@123` | Borrowing, Returns, Personal Dashboard, Fines |
| **Member 2** | `aarav@library.com` | `Member@123` | Borrowing, Returns, Personal Dashboard, Fines |
| **Member 3** | `priya@library.com` | `Member@123` | Borrowing, Returns, Personal Dashboard, Fines |
| **Member 4** | `rohan@library.com` | `Member@123` | Borrowing, Returns, Personal Dashboard, Fines |
| **Member 5** | `sneha@library.com` | `Member@123` | Borrowing, Returns, Personal Dashboard, Fines |

---

## 📜 License

This project is licensed under the MIT License.
