require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Book = require('./models/Book');
const Loan = require('./models/Loan');
const Payment = require('./models/Payment');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/library_management';

const seedDatabase = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully. Purging existing collections...');

    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      Loan.deleteMany({}),
      Payment.deleteMany({})
    ]);

    console.log('Creating Librarian and 5 Member accounts...');

    // 1. Librarian
    const librarian = new User({
      name: 'Library Admin',
      email: 'admin@library.com',
      password: 'Admin@123',
      role: 'librarian'
    });
    await librarian.save();

    // 2. Five Members
    const memberData = [
      { name: 'Anamika Yadav', email: 'anamika@library.com', password: 'Member@123', role: 'member' },
      { name: 'Aarav Sharma', email: 'aarav@library.com', password: 'Member@123', role: 'member' },
      { name: 'Priya Patel', email: 'priya@library.com', password: 'Member@123', role: 'member' },
      { name: 'Rohan Mehta', email: 'rohan@library.com', password: 'Member@123', role: 'member' },
      { name: 'Sneha Kapoor', email: 'sneha@library.com', password: 'Member@123', role: 'member' }
    ];

    const members = [];
    for (const data of memberData) {
      const member = new User(data);
      await member.save();
      members.push(member);
    }
    console.log(`Created 1 librarian and ${members.length} members.`);

    // 3. Books Catalogue (16 realistic books across 6 categories with reliable, tested cover URLs)
    console.log('Populating book catalogue with verified cover art...');
    const booksData = [
      // Computer Science
      {
        title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
        author: 'Robert C. Martin',
        isbn: '978-0132350884',
        category: 'Computer Science',
        description: 'Even bad code can function. But if code isn’t clean, it can bring a development organization to its knees. Every year, countless hours and significant resources are lost due to poorly written code.',
        totalCopies: 5,
        availableCopies: 5,
        coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e37273?auto=format&fit=crop&w=600&q=80'
      },
      {
        title: 'Designing Data-Intensive Applications',
        author: 'Martin Kleppmann',
        isbn: '978-1449373320',
        category: 'Computer Science',
        description: 'Data is at the center of many challenges in system design today. Difficult issues need to be figured out, such as scalability, consistency, reliability, efficiency, and maintainability.',
        totalCopies: 4,
        availableCopies: 4,
        coverImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80'
      },
      {
        title: 'Structure and Interpretation of Computer Programs',
        author: 'Harold Abelson, Gerald Jay Sussman',
        isbn: '978-0262510875',
        category: 'Computer Science',
        description: 'A legendary textbook introducing computer science principles using Scheme/Lisp, emphasizing abstraction and metalinguistic programming.',
        totalCopies: 3,
        availableCopies: 3,
        coverImage: 'https://images.unsplash.com/photo-1516259762381-22954d7d3ad2?auto=format&fit=crop&w=600&q=80'
      },
      {
        title: 'Introduction to Algorithms (CLRS)',
        author: 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein',
        isbn: '978-0262033848',
        category: 'Computer Science',
        description: 'Comprehensive and rigorously detailed, this standard algorithm textbook covers sorting, graph algorithms, dynamic programming, and computational complexity.',
        totalCopies: 6,
        availableCopies: 6,
        coverImage: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=600&q=80'
      },

      // Mathematics
      {
        title: 'Linear Algebra Done Right',
        author: 'Sheldon Axler',
        isbn: '978-3319110790',
        category: 'Mathematics',
        description: 'This best-selling textbook for a second course in linear algebra is aimed at undergrad math majors, focusing on linear operators on finite-dimensional vector spaces without relying primarily on determinants.',
        totalCopies: 4,
        availableCopies: 4,
        coverImage: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=600&q=80'
      },
      {
        title: 'Calculus: Early Transcendentals',
        author: 'James Stewart',
        isbn: '978-1285741550',
        category: 'Mathematics',
        description: 'Success in your calculus course starts here! Renowned for its mathematical precision and accuracy, Stewart provides clear explanations and real-world examples.',
        totalCopies: 5,
        availableCopies: 5,
        coverImage: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?auto=format&fit=crop&w=600&q=80'
      },
      {
        title: 'Concrete Mathematics: A Foundation for Computer Science',
        author: 'Ronald L. Graham, Donald E. Knuth, Oren Patashnik',
        isbn: '978-0201558029',
        category: 'Mathematics',
        description: 'A blend of CONtinuous and disCRETE mathematics that provides indispensable mathematical foundations for analyzing algorithms.',
        totalCopies: 3,
        availableCopies: 3,
        coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80'
      },

      // Physics
      {
        title: 'The Feynman Lectures on Physics (Vol 1)',
        author: 'Richard P. Feynman, Robert B. Leighton, Matthew Sands',
        isbn: '978-0465024933',
        category: 'Physics',
        description: 'Classic physics lectures delivering unparalleled intuition into classical mechanics, thermodynamics, and the fundamental laws of nature.',
        totalCopies: 4,
        availableCopies: 4,
        coverImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80'
      },
      {
        title: 'Principles of Quantum Mechanics',
        author: 'R. Shankar',
        isbn: '978-0306447907',
        category: 'Physics',
        description: 'An exceptionally lucid, self-contained graduate text covering linear algebra foundations through Dirac notation and quantum state vectors.',
        totalCopies: 2,
        availableCopies: 2,
        coverImage: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&w=600&q=80'
      },

      // Literature
      {
        title: '1984',
        author: 'George Orwell',
        isbn: '978-0451524935',
        category: 'Literature',
        description: 'A dystopian social science fiction masterpiece introducing Big Brother, thoughtcrime, the Ministry of Truth, and pervasive psychological manipulation.',
        totalCopies: 7,
        availableCopies: 7,
        coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80'
      },
      {
        title: 'To Kill a Mockingbird',
        author: 'Harper Lee',
        isbn: '978-0061120084',
        category: 'Literature',
        description: 'The Pulitzer Prize-winning classic portraying racial injustice and the destruction of innocence in the American South.',
        totalCopies: 5,
        availableCopies: 5,
        coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80'
      },
      {
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        isbn: '978-0141439518',
        category: 'Literature',
        description: 'Romantic novel following Elizabeth Bennet and Mr. Darcy through complex matters of class, morality, and matrimony in 19th-century England.',
        totalCopies: 4,
        availableCopies: 4,
        coverImage: 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&w=600&q=80'
      },

      // History
      {
        title: 'Sapiens: A Brief History of Humankind',
        author: 'Yuval Noah Harari',
        isbn: '978-0062316097',
        category: 'History',
        description: 'Surveying human history from the Stone Age to modern global empires through Cognitive, Agricultural, and Scientific revolutions.',
        totalCopies: 6,
        availableCopies: 6,
        coverImage: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=600&q=80'
      },
      {
        title: 'Guns, Germs, and Steel: The Fates of Human Societies',
        author: 'Jared Diamond',
        isbn: '978-0393354324',
        category: 'History',
        description: 'A Pulitzer Prize-winning exploration of why human history unfolded so differently on different continents due to geographical and environmental determinism.',
        totalCopies: 4,
        availableCopies: 4,
        coverImage: 'https://images.unsplash.com/photo-1447069387593-a5de07644a04?auto=format&fit=crop&w=600&q=80'
      },

      // Self Development
      {
        title: 'Atomic Habits: An Easy & Proven Way to Build Good Habits & Break Bad Ones',
        author: 'James Clear',
        isbn: '978-0735211292',
        category: 'Self Development',
        description: 'No matter your goals, Atomic Habits offers a proven framework for improving every day through the power of 1% incremental compounding habits.',
        totalCopies: 8,
        availableCopies: 8,
        coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80'
      },
      {
        title: 'Deep Work: Rules for Focused Success in a Distracted World',
        author: 'Cal Newport',
        isbn: '978-1455586691',
        category: 'Self Development',
        description: 'Mastering the ability to focus without distraction on a cognitively demanding task—a superpower in our increasingly competitive knowledge economy.',
        totalCopies: 5,
        availableCopies: 5,
        coverImage: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80'
      }
    ];

    const savedBooks = await Book.insertMany(booksData);
    console.log(`Inserted ${savedBooks.length} books into database.`);

    // 4. Seeding Loans & Payments to demonstrate:
    // - Anamika: 1 active on-time loan
    // - Anamika: 1 active OVERDUE loan with UNPAID fine (₹25) -> return is blocked until paid
    // - Anamika: 1 active OVERDUE loan with PAID fine (₹30) -> finePaid: true, Payment record LIB-ANM4910 exists -> return is unlocked
    // - Aarav: 1 returned late loan with settled payment
    // - Priya: 1 returned on-time loan (no fine)
    console.log('Seeding loan circulation and payment history records...');
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    const anamika = members[0];
    const aarav = members[1];
    const priya = members[2];

    const cleanCode = savedBooks[0];
    const dataIntensive = savedBooks[1];
    const linearAlgebra = savedBooks[4];
    const sapiens = savedBooks[12];
    const atomicHabits = savedBooks[14];

    // Loan 1: Anamika active on-time loan (issued 3 days ago, due in 11 days)
    const loan1 = new Loan({
      user: anamika._id,
      book: cleanCode._id,
      issueDate: new Date(now.getTime() - 3 * dayMs),
      dueDate: new Date(now.getTime() + 11 * dayMs),
      status: 'issued',
      fine: 0,
      finePaid: false
    });
    cleanCode.availableCopies -= 1;
    await cleanCode.save();
    await loan1.save();

    // Loan 2: Anamika OVERDUE loan with UNPAID fine (issued 19 days ago, due 5 days ago -> 5 days overdue -> ₹25 unpaid fine)
    const loan2 = new Loan({
      user: anamika._id,
      book: dataIntensive._id,
      issueDate: new Date(now.getTime() - 19 * dayMs),
      dueDate: new Date(now.getTime() - 5 * dayMs),
      status: 'overdue',
      fine: 25,
      finePaid: false
    });
    dataIntensive.availableCopies -= 1;
    await dataIntensive.save();
    await loan2.save();

    // Loan 3: Anamika OVERDUE loan with PAID fine (issued 20 days ago, due 6 days ago -> ₹30 fine, PAID via mock UPI)
    const paymentAnamika = new Payment({
      user: anamika._id,
      amount: 30,
      paymentMethod: 'UPI',
      status: 'paid',
      transactionId: 'LIB-ANM4910',
      paymentDate: new Date(now.getTime() - 1 * dayMs)
    });

    const loan3 = new Loan({
      user: anamika._id,
      book: linearAlgebra._id,
      issueDate: new Date(now.getTime() - 20 * dayMs),
      dueDate: new Date(now.getTime() - 6 * dayMs),
      status: 'overdue',
      fine: 30,
      finePaid: true,
      payment: paymentAnamika._id
    });
    linearAlgebra.availableCopies -= 1;
    await linearAlgebra.save();
    await loan3.save();

    paymentAnamika.loan = loan3._id;
    await paymentAnamika.save();

    // Loan 4: Aarav past returned late loan with paid fine (3 days overdue -> ₹15 paid)
    const paymentAarav = new Payment({
      user: aarav._id,
      amount: 15,
      paymentMethod: 'Card',
      status: 'paid',
      transactionId: 'LIB-ARV9823',
      paymentDate: new Date(now.getTime() - 18 * dayMs)
    });

    const loan4 = new Loan({
      user: aarav._id,
      book: atomicHabits._id,
      issueDate: new Date(now.getTime() - 35 * dayMs),
      dueDate: new Date(now.getTime() - 21 * dayMs),
      returnDate: new Date(now.getTime() - 18 * dayMs),
      status: 'returned',
      fine: 15,
      finePaid: true,
      payment: paymentAarav._id
    });
    await loan4.save();

    paymentAarav.loan = loan4._id;
    await paymentAarav.save();

    // Loan 5: Priya returned on-time loan for Clean Code (no fine)
    const loan5 = new Loan({
      user: priya._id,
      book: cleanCode._id,
      issueDate: new Date(now.getTime() - 25 * dayMs),
      dueDate: new Date(now.getTime() - 11 * dayMs),
      returnDate: new Date(now.getTime() - 12 * dayMs),
      status: 'returned',
      fine: 0,
      finePaid: false
    });
    await loan5.save();

    // Loan 6: Priya active on-time loan for Sapiens
    const loan6 = new Loan({
      user: priya._id,
      book: sapiens._id,
      issueDate: new Date(now.getTime() - 2 * dayMs),
      dueDate: new Date(now.getTime() + 12 * dayMs),
      status: 'issued',
      fine: 0,
      finePaid: false
    });
    sapiens.availableCopies -= 1;
    await sapiens.save();
    await loan6.save();

    console.log('Database seeded successfully with loans and payments!');
    console.log('------------------------------------------------------------------');
    console.log('Librarian: admin@library.com   | Password: Admin@123');
    console.log('Member:    anamika@library.com | Password: Member@123');
    console.log('           (Has 1 active loan, 1 overdue unpaid, 1 overdue paid)');
    console.log('------------------------------------------------------------------');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
