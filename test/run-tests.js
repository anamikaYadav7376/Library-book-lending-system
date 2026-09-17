require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const User = require('../models/User');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Payment = require('../models/Payment');
const app = require('../app');

const TEST_PORT = 3124;
let server;

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
      redirect: 'manual'
    };

    const response = await fetch(url, fetchOptions);

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
  console.log('  STARTING COMPREHENSIVE INTEGRATION TEST SUITE');
  console.log('==================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`Test server running on port ${TEST_PORT}`);

  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const memberClient = new HttpClient(baseUrl);
    const testEmail = `tester_${Date.now()}@library.com`;

    // 1. Register and Login
    console.log('\n--- Test 1: User Registration & Session Auth ---');
    const regRes = await memberClient.post('/auth/register', {
      name: 'Workflow Tester',
      email: testEmail,
      password: 'Password@123',
      confirmPassword: 'Password@123'
    });
    assert(regRes.status === 302, 'Member registered and redirected to dashboard');

    // 2. Test Normal On-Time Return
    console.log('\n--- Test 2: Normal On-Time Return (₹0 Fine, No Payment Required) ---');
    const normalBook = await Book.findOne({ availableCopies: { $gt: 1 } });
    const prevNormalCopies = normalBook.availableCopies;
    await memberClient.post(`/books/${normalBook._id}/issue`);

    const normalLoan = await Loan.findOne({
      book: normalBook._id,
      status: 'issued'
    }).sort({ issueDate: -1 });

    assert(!!normalLoan, 'On-time loan created');
    const returnOnTimeRes = await memberClient.post(`/loans/${normalLoan._id}/return`);
    assert(returnOnTimeRes.status === 302, 'On-time return processed immediately without payment');

    const bookAfterNormalReturn = await Book.findById(normalBook._id);
    assert(bookAfterNormalReturn.availableCopies === prevNormalCopies, 'Available copies restored on return');

    // 3. Test Overdue Return Blocked when Unpaid
    console.log('\n--- Test 3: Overdue Book Return Blocked without Fine Payment ---');
    const overdueBook = await Book.findOne({ availableCopies: { $gt: 1 }, _id: { $ne: normalBook._id } });
    const prevOverdueCopies = overdueBook.availableCopies;

    // Issue book
    await memberClient.post(`/books/${overdueBook._id}/issue`);
    const overdueLoan = await Loan.findOne({
      book: overdueBook._id,
      status: 'issued'
    }).sort({ issueDate: -1 });

    // Manually backdate dueDate to simulate exactly 6 days overdue (fine = ₹30)
    const now = new Date();
    const sixDaysMs = 6 * 24 * 60 * 60 * 1000 - 60000; // 5 days 23 hours 59 mins ago -> ceil is 6
    overdueLoan.issueDate = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
    overdueLoan.dueDate = new Date(now.getTime() - sixDaysMs);
    overdueLoan.finePaid = false;
    await overdueLoan.save();

    // Attempt return directly -> MUST BE BLOCKED!
    const blockedReturnRes = await memberClient.post(`/loans/${overdueLoan._id}/return`);
    assert(blockedReturnRes.status === 302, 'Attempted return redirects');
    assert(
      blockedReturnRes.headers.get('location').includes('/pay'),
      'Redirects to fine payment page when fine is unpaid'
    );

    // Verify book is NOT returned and copies NOT incremented
    const stillOverdueLoan = await Loan.findById(overdueLoan._id);
    assert(stillOverdueLoan.status !== 'returned', 'Loan status remains not returned');
    const bookAfterBlockedReturn = await Book.findById(overdueBook._id);
    assert(
      bookAfterBlockedReturn.availableCopies === prevOverdueCopies - 1,
      'Book copies remain decremented while loan is unreturned'
    );

    // 4. Test Pay Fine Flow
    console.log('\n--- Test 4: Mock Fine Payment Gateway Flow ---');
    const payPageRes = await memberClient.get(`/loans/${overdueLoan._id}/pay`);
    assert(payPageRes.status === 200, 'Payment checkout page loaded');
    const payPageHtml = await payPageRes.text();
    assert(payPageHtml.includes('Library Fine Payment'), 'Checkout page renders payment title');
    assert(payPageHtml.includes('6 days') || payPageHtml.includes('6 Day'), 'Identifies 6 overdue days');
    assert(payPageHtml.includes('₹30'), 'Displays ₹30 fine amount');

    // Submit payment
    const paySubmitRes = await memberClient.post(`/loans/${overdueLoan._id}/pay`, {
      paymentMethod: 'UPI'
    });
    assert(paySubmitRes.status === 302, 'Payment submission redirects to My Loans');

    // Verify Payment record was created in MongoDB
    const paymentRecord = await Payment.findOne({ loan: overdueLoan._id });
    assert(!!paymentRecord, 'Payment record saved in MongoDB');
    assert(paymentRecord.amount === 30, 'Payment amount recorded as ₹30');
    assert(paymentRecord.status === 'paid', 'Payment status is "paid"');
    assert(paymentRecord.paymentMethod === 'UPI', 'Payment method is "UPI"');
    assert(paymentRecord.transactionId.startsWith('LIB-'), 'Valid transaction ID generated (LIB-XXXXXX)');

    // Verify Loan updated
    const loanAfterPay = await Loan.findById(overdueLoan._id);
    assert(loanAfterPay.finePaid === true, 'Loan finePaid flag marked true');
    assert(loanAfterPay.fine === 30, 'Loan fine amount preserved as ₹30');
    assert(loanAfterPay.status !== 'returned', 'Loan is NOT returned yet (pending return action)');

    // 5. Test Return After Payment
    console.log('\n--- Test 5: Return Allowed After Fine Payment ---');
    const allowedReturnRes = await memberClient.post(`/loans/${overdueLoan._id}/return`);
    assert(allowedReturnRes.status === 302, 'Return successfully processed after fine paid');

    const closedOverdueLoan = await Loan.findById(overdueLoan._id);
    assert(closedOverdueLoan.status === 'returned', 'Loan status marked returned');
    assert(closedOverdueLoan.fine === 30, 'Original fine amount preserved in history');
    assert(closedOverdueLoan.finePaid === true, 'Fine marked as paid');

    const bookAfterAllowedReturn = await Book.findById(overdueBook._id);
    assert(
      bookAfterAllowedReturn.availableCopies === prevOverdueCopies,
      'Book copies incremented upon successful return'
    );

    // 6. Test User Account Page & Payment History
    console.log('\n--- Test 6: Member Account Page & Payment History Table ---');
    const accountRes = await memberClient.get('/account');
    assert(accountRes.status === 200, 'Member account page loaded');
    const accountHtml = await accountRes.text();
    assert(accountHtml.includes('Member Profile'), 'Account page displays profile');
    assert(accountHtml.includes(paymentRecord.transactionId), 'Account page displays recent payment transaction ID');
    assert(accountHtml.includes('Paid Fines'), 'Account page displays fine summary');
    assert(accountHtml.includes('₹30'), 'Account page displays paid fine amount ₹30');

    // 7. Test Fallback Book Cover
    console.log('\n--- Test 7: Fallback Book Cover Image ---');
    const imgRes = await fetch(`${baseUrl}/images/default-book-cover.png`);
    assert(imgRes.status === 200, 'default-book-cover.png is served successfully');
    assert(imgRes.headers.get('content-type').includes('image/png'), 'Fallback cover is valid PNG format');

    // 8. Test Librarian Payments Audit & Access Control
    console.log('\n--- Test 8: Librarian Payments Audit & Role Authorization ---');
    // Member should be blocked from /loans/payments
    const memberPaymentsRes = await memberClient.get('/loans/payments');
    assert(memberPaymentsRes.status === 403, 'Member is blocked from /loans/payments (403 Forbidden)');

    // Login as librarian
    const librarianClient = new HttpClient(baseUrl);
    await librarianClient.post('/auth/login', {
      email: 'admin@library.com',
      password: 'Admin@123'
    });

    const libPaymentsRes = await librarianClient.get('/loans/payments');
    assert(libPaymentsRes.status === 200, 'Librarian can view /loans/payments');
    const libPaymentsHtml = await libPaymentsRes.text();
    assert(libPaymentsHtml.includes('Fine Payments & Transactions'), 'Librarian payments page renders');
    assert(libPaymentsHtml.includes(paymentRecord.transactionId), 'Audit log displays transaction ID');

    // Check Librarian Dashboard fine overview
    const libDashRes = await librarianClient.get('/dashboard');
    assert(libDashRes.status === 200, 'Librarian dashboard loaded');
    const libDashHtml = await libDashRes.text();
    assert(libDashHtml.includes('Fine & Payment Overview'), 'Librarian dashboard contains Fine & Payment Overview');
    assert(libDashHtml.includes('Total Fines Collected'), 'Librarian dashboard displays Total Fines Collected');

    console.log('\n==================================================');
    console.log('  ALL NEW AND EXISTING TESTS PASSED SUCCESSFULLY!');
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

runTestSuite();
