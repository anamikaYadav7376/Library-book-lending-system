# Athenaeum - Full-Stack Library Management & Book Lending System

A complete, production-grade **Library Management and Book Lending System** built with Node.js, Express.js, MongoDB (Mongoose), and Server-Side Rendered (SSR) EJS views. Designed with an academic, university-grade aesthetic, robust session authentication, role-based authorization, strict circulation business rules, mock fine payments, user account history, and light/dark mode.

---

## 📖 Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
  - [Member Capabilities](#member-capabilities)
  - [Librarian & Admin Capabilities](#librarian--admin-capabilities)
- [Fine Payment & Return Workflow](#fine-payment--return-workflow)
- [Light / Dark Mode Design System](#light--dark-mode-design-system)
- [Book Cover Resiliency & Presentation](#book-cover-resiliency--presentation)
- [Technology Stack](#technology-stack)
- [Project Architecture (MVC)](#project-architecture-mvc)
- [Database Models](#database-models)
- [Installation & Local Setup](#installation--local-setup)
- [Database Seeding](#database-seeding)
- [Running Automated Tests](#running-automated-tests)
- [Deployment Guide](#deployment-guide)
- [Demo Credentials](#demo-credentials)

---

## 🌟 Project Overview

Athenaeum Library System provides educational institutions and public libraries with a full-lifecycle book circulation platform. Rather than a static prototype, this system manages authentic database transactions in MongoDB Atlas: tracking book stock, checking out books, enforcing patron loan limits, detecting overdue materials automatically, calculating late fines in real-time, executing mock fine payments, logging transaction histories, and aggregating circulation statistics dynamically.

---

## ✨ Key Features

### Member Capabilities
- **Account Registration & Session Login**: Secure registration and bcrypt password hashing.
- **Book Catalogue Exploration**: Browse all library titles with real-time stock indicators and 2:3 aspect ratio book covers.
- **Advanced Search & Category Filtering**: Combined search by Title, Author, Category, or ISBN with category pill filters.
- **Book Request & Checkout**: One-click book borrowing with an automatic 14-day loan window (max 5 active loans).
- **Strict Fine Payment & Return Workflow**:
  - On-time books can be returned immediately.
  - Overdue books **require fine payment** before returning (`Pay Fine: ₹XX` button).
  - Realistic mock payment gateway (UPI, Card, Cash) generating unique `LIB-XXXXXXXX` transaction IDs.
  - Returns are strictly gated: return is unlocked only once the fine is paid (`Fine Paid ✓`).
- **User Account Page (`/account`)**:
  - Patron profile details and membership duration.
  - Active checkout and overdue counts.
  - Dynamic financial summary: Total Fines, Paid Fines, Outstanding Fines.
  - Full tabular **Payment History** sourced from the `Payment` collection.
- **Theme Switcher**: One-click toggle between **Light Mode** and **Dark Mode** with zero-flicker reload and `localStorage` persistence.

### Librarian & Admin Capabilities
- **Administrative Dashboard**:
  - **Dynamic Operations**: Total Titles, Total Copies, Available Copies, Issued Books, Overdue Books, and Total Members.
  - **Fine & Payment Overview**: Total Outstanding Fines, Total Fines Collected, Number of Paid Fines, and Number of Unpaid Overdue Loans.
  - **Most Borrowed Titles**: Real-time MongoDB aggregation ranking titles by total loans.
  - **Live Audit Feeds**: Recent issues, recent returns, and new member registrations.
- **All Payments Audit Log (`/loans/payments`)**:
  - Searchable log of every fine payment transaction with date, member name, email, book, fine amount, amount paid, payment method, and transaction ID.
- **Catalogue CRUD Management**:
  - Add new books (available copies automatically synchronize with total copies).
  - Edit book metadata and safely adjust copy counts without breaking existing loans.
  - Delete books with safety checks (books on active loan cannot be deleted).
- **Loan Circulation Management (`/loans`)**:
  - Filter by Active Checkouts, Overdue Only, or Returned Only.
  - Process patron returns and collect penalties.
- **Member Directory (`/members`)**:
  - Member management with active loan counts, overdue infraction badges, and search.

---

## 💳 Fine Payment & Return Workflow

1. **On-time Return**:
   - If `currentDate <= dueDate`: Loan status is active, fine is ₹0.
   - Member clicks **Return Book** $\rightarrow$ book copies incremented by 1, loan marked `returned`.
2. **Overdue Return Blocked**:
   - If `currentDate > dueDate` and fine is unpaid:
   - Direct return is **blocked** by backend controller with alert: `Please pay the outstanding fine of ₹XX before returning this book.`
   - UI shows **Pay Fine: ₹XX** button with `UNPAID` badge.
3. **Mock Payment**:
   - Patron clicks **Pay Fine** $\rightarrow$ opens mock checkout showing book, overdue days, fine calculation, and payment method options (UPI, Card, Cash).
   - Patron clicks **Pay ₹XX** $\rightarrow$ server creates `Payment` record with unique transaction ID (`LIB-XXXXXX`), marks `loan.finePaid = true`, and preserves original fine amount.
4. **Return After Payment**:
   - UI shows **Fine Paid ✓** badge and unlocks **Return Book** button.
   - Patron clicks **Return Book** $\rightarrow$ loan marked `returned`, returnDate saved, stock incremented, payment stays in history.

---

## 🌓 Light / Dark Mode Design System

- Built with semantic CSS custom properties in `:root` and `[data-theme="dark"]`.
- Colors:
  - **Light Mode**: Academic Oxford Navy headers, crisp white cards, slate borders, light parchment backgrounds.
  - **Dark Mode**: Deep navy/slate background (`#0b0f19`), elevated card surfaces (`#131b2e`), high-contrast text (`#f8fafc`), soft glowing status badges.
- **Zero-Flicker Persistence**: An inline script inside `<head>` reads `localStorage.getItem('theme')` before stylesheets render, preventing white-flash on page reloads or navigations.

---

## 🖼️ Book Cover Resiliency & Presentation

- Every seeded book uses verified, high-quality cover art.
- Standalone local fallback image: `public/images/default-book-cover.png` (a 400x600 gold/teal framed academic cover).
- Every cover `<img>` tag is safeguarded with:
  ```html
  <img src="..." onerror="this.onerror=null;this.src='/images/default-book-cover.png';" />
  ```
- Consistent book aspect ratio enforced via CSS: `aspect-ratio: 2 / 3; object-fit: cover;`.

---

## 📁 Project Architecture (MVC)

```text
library-management-system/
│
├── app.js                   # Express application setup, sessions, middleware & routes
├── package.json             # Project dependencies and npm scripts
├── .env                     # Local environment secrets
├── .env.example             # Example configuration template
├── .gitignore               # Ignored files
├── seed.js                  # Database seed script (librarian, 5 members, 16 books, loans, payments)
│
├── config/
│   └── db.js                # MongoDB Mongoose connection handler
│
├── models/
│   ├── User.js              # User schema with bcrypt password hashing
│   ├── Book.js              # Book schema with stock constraints and text search index
│   ├── Loan.js              # Loan schema with finePaid flag and dynamic fine calculator
│   └── Payment.js           # Payment schema with transactionId, amount, method, status
│
├── controllers/
│   ├── authController.js    # Login, registration, session management, logout
│   ├── bookController.js    # Catalogue, search/filter, book CRUD, issue workflow
│   ├── loanController.js    # Member & librarian loans, mock payments, return workflow
│   └── dashboardController.js # Dynamic stats, account page, member directory
│
├── routes/
│   ├── authRoutes.js        # /auth/register, /auth/login, /auth/logout
│   ├── bookRoutes.js        # /books (catalogue, CRUD, issue)
│   ├── loanRoutes.js        # /loans (all loans, my loans, /:id/pay, /payments)
│   └── dashboardRoutes.js   # /, /dashboard, /account, /members
│
├── middleware/
│   ├── authMiddleware.js    # requireAuth & requireGuest guards
│   ├── roleMiddleware.js    # Role-based authorization (requireRole('librarian'))
│   └── errorMiddleware.js   # 404 Not Found & 500 Server Error handlers
│
├── views/
│   ├── layouts/
│   │   ├── header.ejs       # Head with zero-flicker theme script, Bootstrap 5, navbar
│   │   └── footer.ejs       # Scripts & footer partial
│   ├── partials/
│   │   ├── navbar.ejs       # Role-aware navbar with Account link and theme toggle
│   │   ├── sidebar.ejs      # Librarian admin sidebar with Payments link
│   │   ├── alerts.ejs       # Dismissible flash notification banners
│   │   └── footer.ejs       # Academic brand footer
│   ├── auth/
│   │   ├── login.ejs        # Login view
│   │   └── register.ejs     # Registration view
│   ├── dashboard/
│   │   ├── dashboard.ejs    # Role dispatcher
│   │   ├── memberDashboard.ejs # Member stats, active checkouts, overdue payments
│   │   ├── librarianDashboard.ejs # Admin metrics, fine & payment overview, activity
│   │   ├── account.ejs      # Member account profile, fine summary & payment history
│   │   └── members.ejs      # Librarian member management directory
│   ├── books/
│   │   ├── index.ejs        # Catalogue with search, category filters & image fallbacks
│   │   ├── show.ejs         # Detailed book view with actions
│   │   ├── create.ejs       # Add new book form
│   │   └── edit.ejs         # Edit book form
│   ├── loans/
│   │   ├── myLoans.ejs      # Member loans, pay fine triggers, return controls
│   │   ├── payFine.ejs      # Mock fine payment checkout page
│   │   └── allPayments.ejs  # Librarian payments audit log table
│   └── errors/
│       ├── 404.ejs          # 404 Not Found page
│       └── 500.ejs          # 500 Internal Error page
│
├── public/
│   ├── css/
│   │   └── style.css        # Academic light/dark design system & 2:3 aspect ratios
│   ├── js/
│   │   └── main.js          # Theme toggle, alert dismissal, confirmation dialogs
│   └── images/
│       └── default-book-cover.png # Local generic fallback book cover
│
├── test/
│   └── run-tests.js         # Integration test suite verifying all circulation & payment workflows
│
└── README.md
```

---

## 🗄️ Database Models

### 1. User Model (`models/User.js`)
- `name`: String, required
- `email`: String, required, unique, lowercase
- `password`: String, hashed with bcrypt
- `role`: `'member'` | `'librarian'`, default: `'member'`
- `createdAt`: Date

### 2. Book Model (`models/Book.js`)
- `title`, `author`, `isbn` (unique), `category`, `description`
- `totalCopies`: Number, min 1
- `availableCopies`: Number, min 0, cannot exceed totalCopies
- `coverImage`: String with fallback handling
- Text index on title, author, isbn, category

### 3. Loan Model (`models/Loan.js`)
- `user`: ObjectId (ref: User)
- `book`: ObjectId (ref: Book)
- `issueDate`: Date
- `dueDate`: Date (default: issueDate + 14 days)
- `returnDate`: Date
- `status`: `'requested'` | `'issued'` | `'returned'` | `'overdue'`
- `fine`: Number (₹5 / day overdue)
- `finePaid`: Boolean, default: false
- `payment`: ObjectId (ref: Payment)

### 4. Payment Model (`models/Payment.js`)
- `user`: ObjectId (ref: User)
- `loan`: ObjectId (ref: Loan)
- `amount`: Number, required
- `paymentDate`: Date, default Date.now
- `status`: `'pending'` | `'paid'` | `'failed'`, default: `'paid'`
- `paymentMethod`: `'UPI'` | `'Card'` | `'Cash'` | `'Mock Payment'`
- `transactionId`: String, required, unique (e.g. `LIB-A8F92K`)

---

## 🚀 Installation & Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure .env file
cp .env.example .env

# 3. Seed database
npm run seed

# 4. Run automated test suite
npm test

# 5. Start application
npm run dev
# or
npm start
```

Access the system at: `http://localhost:3000`

---

## 🧪 Running Automated Tests

```bash
npm test
```

Verified Test Scenarios:
1. User registration & session login.
2. Normal on-time return (₹0 fine, no payment needed, stock incremented).
3. Overdue return strictly blocked when fine is unpaid.
4. Mock fine payment creates `Payment` record with unique transaction ID and marks `finePaid: true`.
5. Return succeeds once fine is paid; original fine amount preserved in history.
6. Member account page displays fine summary and payment history table.
7. Fallback book cover is served successfully in valid PNG format.
8. Librarian payments audit log is accessible by admin and forbidden for members (403).

---

## 🔑 Demo Credentials

| Role | Email | Password | Pre-seeded Activity |
| :--- | :--- | :--- | :--- |
| **Librarian (Admin)** | `admin@library.com` | `Admin@123` | Full administrative control, Payments overview, All Loans, Member Directory |
| **Member 1 (Anamika)** | `anamika@library.com` | `Member@123` | **1 active on-time loan**, **1 overdue loan with UNPAID fine (₹25)** (test pay fine flow!), **1 overdue loan with PAID fine (₹30)** (test return after pay!) |
| **Member 2 (Aarav)** | `aarav@library.com` | `Member@123` | 1 returned late loan with settled payment of ₹15 |
| **Member 3 (Priya)** | `priya@library.com` | `Member@123` | 1 active on-time loan, 1 returned on-time loan |
| **Member 4 (Rohan)** | `rohan@library.com` | `Member@123` | Clean member account |
| **Member 5 (Sneha)** | `sneha@library.com` | `Member@123` | Clean member account |

---

## 📜 License

This project is licensed under the MIT License.
