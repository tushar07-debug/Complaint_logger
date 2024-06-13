require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { MongoClient } = require('mongodb');
const saltRounds = 10;

// Connection URL
const url = '';
const client = new MongoClient(url);
const dbName = 'mriirs';
let db;

// Middleware
app.use('/uploads', express.static('uploads'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.set("view engine", "ejs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniquePrefix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Connect to MongoDB
async function connectDB() {
  try {
    await client.connect();
    db = client.db(dbName);
    console.log('Connected successfully to server');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}
connectDB();

// Routes
app.get('/', (req, res) => {
  res.render('home', { isAuthenticated: false });
});

app.get('/admin', async (req, res) => {
  try {
    const collection = db.collection('complaints');
    const findResult = await collection.find({}).toArray();
    res.render('admin', { complaints: findResult });
  } catch (e) {
    console.error(e);
    res.send("Error fetching complaints");
  }
});

app.post('/', upload.single('uploaded_file'), async (req, res) => {
  let { user_email, user_name, user_location, user_message } = req.body;
  let img_path = req.file ? req.file.path : null;

  try {
    const collection = db.collection('complaints');
    await collection.insertOne({ email: user_email, name: user_name, location: user_location, message: user_message, img_path });
    res.redirect('/');
  } catch (e) {
    console.error(e);
    res.send("Error saving complaint");
  }
});

app.post('/signup', async (req, res) => {
  let { user_email, user_pwd1, user_pwd2 } = req.body;

  if (user_pwd1 !== user_pwd2) return res.send("Passwords don't match!");

  try {
    const collection = db.collection('users');
    const user = await collection.findOne({ email: user_email });

    if (user) return res.send('User already exists');

    const hashedPassword = await bcrypt.hash(user_pwd1, saltRounds);
    await collection.insertOne({ email: user_email, password: hashedPassword });
    res.redirect('/');
  } catch (e) {
    console.error(e);
    res.send("There was an error!");
  }
});

app.get('/signup', (req, res) => {
  res.sendFile(__dirname + '/views/signup.html');
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/views/login.html');
});

app.post('/login', async (req, res) => {
  let { user_email, user_pwd } = req.body;

  console.log(`Attempting to log in user with email: ${user_email}`);

  try {
    const collection = db.collection('users');
    const user = await collection.findOne({ email: user_email });

    if (!user) {
      console.log(`User not found: ${user_email}`);
      return res.send("User not found");
    }

    console.log(`Found user: ${JSON.stringify(user)}`);

    const isPasswordValid = await bcrypt.compare(user_pwd, user.password);
    if (!isPasswordValid) {
      console.log(`Invalid password for user: ${user_email}`);
      return res.send("Invalid password");
    }

    const token = jwt.sign({ email: user_email }, 'shhhhh');
    res.cookie("auth_token", token);
    res.render('home', { isAuthenticated: true });
  } catch (e) {
    console.error(e);
    res.send("Error during login");
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/login');
});

app.get('/', (req, res) => {
  console.log('Cookies: ', req.cookies);
  console.log('Signed Cookies: ', req.signedCookies);
});

// Start server
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
