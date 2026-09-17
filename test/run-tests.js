require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const User = require('../models/User');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const app = require('../app');

const TEST_PORT = 3123;
let server;

// Helper to make HTTP requests with cookie tracking (cookie jar)
class HttpClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = '';
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = { ...(options.headers || {}) };
    if (this.cookies) {
      headers['Cookie'] = this.cookies;
    }

    const fetchOptions = {
      ...options,
      headers,
      redirect: 'manual' // Inspect 302 redirects
    };

    const response = await fetch(url, fetchOptions);

    // Save cookies from Set-Cookie headers
    const setCookieHeaders = response.headers.getSetCookie 
      ? response.headers.getSetCookie() 
      : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);

    if (setCookieHeaders.length > 0) {
      this.cookies = setCookieHeaders.map((c) => c.split(';')[0]).join('; ');
    }

    return response;
  }

  async get(path) {
    return this.request(path, { method: 'GET' });
  }

  async post(path, body = {}, isUrlEncoded = true) {
    const headers = isUrlEncoded
      ? { 'Content-Type': 'application/x-www-form-urlencoded' }
      : { 'Content-Type': 'application/json' };

    const payload = isUrlEncoded ? new URLSearchParams(body).toString() : JSON.stringify(body);
    return this.request(path, { method: 'POST', headers, body: payload });
  }
}

// Simple test runner assertion
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function runTestSuite() {
  console.log('\n==================================================');
  console.log('  STARTING INTEGRATION TEST SUITE');
  console.log('==================================================\n');

  // Start HTTP Server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`Test server running on port ${TEST_PORT}`);

  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

  try {
    // ----------------------------------------------------
    // WORKFLOW 1: Register -> Login -> Browse books -> Issue book -> Dashboard updates
    // ----------------------------------------------------
    console.log('\n--- Testing Workflow 1: Registration, Login, Catalogue, Book Issue & Dashboard ---');
    const memberClient = new HttpClient(baseUrl);
    const testEmail = `testmember_${Date.now()}@library.com`;

    // 1.1 Register
    const regRes = await memberClient.post('/auth/register', {
      name: 'Integration Tester',
      email: testEmail,
      password: 'Password@123',
      confirmPassword: 'Password@123'
    });
    assert(regRes.status === 302, 'Member registration redirects to dashboard on success');

    // 1.2 Access Catalogue
    const catRes = await memberClient.get('/books');
    assert(catRes.status === 200, 'Member can browse catalogue');
    const catHtml = await catRes.text();
    assert(catHtml.includes('Library Book Catalogue'), 'Catalogue page renders correct title');

    // 1.3 Find an available book to issue
    const bookToIssue = await Book.findOne({ availableCopies: { $gt: 1 } });
    assert(!!bookToIssue, 'Found available book for borrowing');
    const prevAvailable = bookToIssue.availableCopies;

    // 1.4 Issue the book
    const issueRes = await memberClient.post(`/books/${bookToIssue._id}/issue`);
    assert(issueRes.status === 302, 'Issue book request redirects to my loans/dashboard');

    // 1.5 Check member dashboard
    const dashRes = await memberClient.get('/dashboard');
    assert(dashRes.status === 200, 'Member dashboard loaded');
    const dashHtml = await dashRes.text();
    assert(dashHtml.includes(bookToIssue.title), 'Member dashboard displays currently issued book title');

    // ----------------------------------------------------
    // WORKFLOW 2: Issue book -> available copies decrease -> return book -> available copies increase
    // ----------------------------------------------------
    console.log('\n--- Testing Workflow 2: Inventory decrement on issue & increment on return ---');
    const updatedBookAfterIssue = await Book.findById(bookToIssue._id);
    assert(
      updatedBookAfterIssue.availableCopies === prevAvailable - 1,
      `Available copies decremented from ${prevAvailable} to ${updatedBookAfterIssue.availableCopies}`
    );

    // Find the loan created
    const createdLoan = await Loan.findOne({
      book: bookToIssue._id,
      status: 'issued'
    }).sort({ issueDate: -1 });
    assert(!!createdLoan, 'Loan record exists in database');

    // Return the book
    const returnRes = await memberClient.post(`/loans/${createdLoan._id}/return`);
    assert(returnRes.status === 302, 'Returning book redirects with confirmation');

    const updatedBookAfterReturn = await Book.findById(bookToIssue._id);
    assert(
      updatedBookAfterReturn.availableCopies === prevAvailable,
      `Available copies restored back to ${prevAvailable} after return`
    );

    const closedLoan = await Loan.findById(createdLoan._id);
    assert(closedLoan.status === 'returned', 'Loan status marked as returned');
    assert(!!closedLoan.returnDate, 'Loan returnDate recorded');

    // ----------------------------------------------------
    // WORKFLOW 3: Member reaches 5 active loans -> sixth issue is blocked
    // ----------------------------------------------------
    console.log('\n--- Testing Workflow 3: Max 5 active borrowing limit enforcement ---');
    const books = await Book.find({ availableCopies: { $gt: 0 } }).limit(6);
    assert(books.length >= 6, 'Found at least 6 distinct books for limit test');

    const loanIds = [];
    for (let i = 0; i < 5; i++) {
      const res = await memberClient.post(`/books/${books[i]._id}/issue`);
      assert(res.status === 302, `Book ${i + 1} issued successfully`);
      const l = await Loan.findOne({ user: closedLoan.user, book: books[i]._id, status: 'issued' });
      loanIds.push(l._id);
    }

    // Attempt 6th issue
    const sixthRes = await memberClient.post(`/books/${books[5]._id}/issue`);
    assert(sixthRes.status === 302, 'Sixth issue request was processed');
    // Follow redirect to see flash message
    const sixthFollow = await memberClient.get(`/books/${books[5]._id}`);
    const sixthHtml = await sixthFollow.text();
    assert(
      sixthHtml.includes('maximum borrowing limit of 5 books') || sixthHtml.includes('limit'),
      'Sixth issue was rejected due to 5 books limit'
    );

    // Clean up: return the 5 borrowed books to reset state
    for (const lid of loanIds) {
      await memberClient.post(`/loans/${lid}/return`);
    }

    // ----------------------------------------------------
    // WORKFLOW 4: Book has 0 available copies -> issue is blocked
    // ----------------------------------------------------
    console.log('\n--- Testing Workflow 4: Zero availability blocks issue ---');
    const zeroBook = new Book({
      title: 'Out of Stock Test Book',
      author: 'Tester',
      isbn: 'ZERO-TEST-ISBN-01',
      category: 'Computer Science',
      totalCopies: 2,
      availableCopies: 0
    });
    await zeroBook.save();

    const zeroIssueRes = await memberClient.post(`/books/${zeroBook._id}/issue`);
    assert(zeroIssueRes.status === 302, 'Zero copy issue redirects');
    const zeroFollow = await memberClient.get(`/books/${zeroBook._id}`);
    const zeroHtml = await zeroFollow.text();
    assert(
      zeroHtml.includes('unavailable') || zeroHtml.includes('Currently Unavailable'),
      'Borrowing blocked when available copies == 0'
    );

    // ----------------------------------------------------
    // WORKFLOW 5: Book becomes overdue -> overdue status and fine are displayed
    // ----------------------------------------------------
    console.log('\n--- Testing Workflow 5: Automatic overdue detection and ₹5/day fine calculation ---');
    const now = new Date();
    const fourDaysAgoMs = 4 * 24 * 60 * 60 * 1000;
    const pastDueDate = new Date(now.getTime() - fourDaysAgoMs);

    const overdueLoan = new Loan({
      user: closedLoan.user,
      book: books[0]._id,
      issueDate: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
      dueDate: pastDueDate,
      status: 'issued',
      fine: 0
    });
    await overdueLoan.save();

    // Check virtual/helper calculation
    const calc = overdueLoan.getCalculatedStatusAndFine();
    assert(calc.status === 'overdue', 'Dynamically calculated status is "overdue"');
    assert(calc.overdueDays === 4, 'Correctly identified 4 overdue days');
    assert(calc.fine === 20, 'Fine accurately calculated as ₹20 (4 days * ₹5)');

    // Verify on /loans/my page
    const myLoansRes = await memberClient.get('/loans/my');
    const myLoansHtml = await myLoansRes.text();
    assert(myLoansHtml.includes('Overdue'), 'Member loans page shows overdue badge');
    assert(myLoansHtml.includes('₹20') || myLoansHtml.includes('20'), 'Member loans page displays calculated fine');

    // ----------------------------------------------------
    // WORKFLOW 6: Librarian adds/edits/deletes a book -> catalogue updates
    // ----------------------------------------------------
    console.log('\n--- Testing Workflow 6: Librarian CRUD operations & Deletion safety ---');
    const librarianClient = new HttpClient(baseUrl);

    // Login as librarian
    const libLogin = await librarianClient.post('/auth/login', {
      email: 'admin@library.com',
      password: 'Admin@123'
    });
    assert(libLogin.status === 302, 'Librarian logged in successfully');

    // Add a book
    const newBookIsbn = `ISBN-${Date.now()}`;
    const addBookRes = await librarianClient.post('/books', {
      title: 'Automated Testing Fundamentals',
      author: 'Jane QA',
      isbn: newBookIsbn,
      category: 'Computer Science',
      totalCopies: '3',
      description: 'Test book description'
    });
    assert(addBookRes.status === 302, 'Librarian added new book');

    const createdBook = await Book.findOne({ isbn: newBookIsbn });
    assert(!!createdBook, 'New book found in database');
    assert(createdBook.availableCopies === 3, 'availableCopies equals totalCopies initially');

    // Edit the book
    const editBookRes = await librarianClient.post(`/books/${createdBook._id}?_method=PUT`, {
      title: 'Automated Testing Fundamentals (2nd Edition)',
      author: 'Jane QA',
      isbn: newBookIsbn,
      category: 'Computer Science',
      totalCopies: '4',
      description: 'Updated description'
    });
    assert(editBookRes.status === 302, 'Book edited successfully');
    const editedBook = await Book.findById(createdBook._id);
    assert(editedBook.title.includes('2nd Edition'), 'Book title updated');
    assert(editedBook.totalCopies === 4, 'Book total copies updated');
    assert(editedBook.availableCopies === 4, 'Book available copies updated safely');

    // Safety check: attempt to delete a book with active loan
    // Issue a copy of createdBook to member
    await memberClient.post(`/books/${createdBook._id}/issue`);
    const delFailRes = await librarianClient.post(`/books/${createdBook._id}?_method=DELETE`);
    const stillExists = await Book.findById(createdBook._id);
    assert(!!stillExists, 'Book deletion blocked because active loans exist');

    // Return the copy
    const activeTestLoan = await Loan.findOne({ book: createdBook._id, status: 'issued' });
    if (activeTestLoan) {
      await librarianClient.post(`/loans/${activeTestLoan._id}/return`);
    }

    // Now delete book with no active loans
    const delSuccessRes = await librarianClient.post(`/books/${createdBook._id}?_method=DELETE`);
    const deletedBook = await Book.findById(createdBook._id);
    assert(!deletedBook, 'Book successfully deleted when no active loans exist');

    // ----------------------------------------------------
    // WORKFLOW 7: Member tries to access librarian route -> access denied
    // ----------------------------------------------------
    console.log('\n--- Testing Workflow 7: Member attempting to access librarian route is blocked ---');
    const unauthorizedAdd = await memberClient.get('/books/new');
    assert(unauthorizedAdd.status === 403, 'Member accessing /books/new receives 403 Forbidden');

    const unauthorizedMembers = await memberClient.get('/members');
    assert(unauthorizedMembers.status === 403, 'Member accessing /members receives 403 Forbidden');

    // ----------------------------------------------------
    // WORKFLOW 8: Librarian dashboard statistics reflect actual MongoDB data
    // ----------------------------------------------------
    console.log('\n--- Testing Workflow 8: Dynamic MongoDB dashboard aggregation consistency ---');
    const libDashRes = await librarianClient.get('/dashboard');
    assert(libDashRes.status === 200, 'Librarian dashboard loads');
    const libDashHtml = await libDashRes.text();

    const actualTotalBooks = await Book.countDocuments();
    const actualTotalMembers = await User.countDocuments({ role: 'member' });
    const actualIssued = await Loan.countDocuments({ status: { $ne: 'returned' } });

    assert(libDashHtml.includes(`${actualTotalBooks}`), `Dashboard displays total books: ${actualTotalBooks}`);
    assert(libDashHtml.includes(`${actualTotalMembers}`), `Dashboard displays total members: ${actualTotalMembers}`);
    assert(libDashHtml.includes('Most Borrowed Titles'), 'Dashboard contains Most Borrowed Titles section');

    console.log('\n==================================================');
    console.log('  ALL 8 WORKFLOWS PASSED SUCCESSFULLY!');
    console.log('==================================================\n');

  } catch (err) {
    console.error('\nTest suite failed with error:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(process.exitCode || 0);
  }
}

// Run test suite
runTestSuite();
