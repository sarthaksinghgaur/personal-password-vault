const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const Credential = require('./models/Credential');
const verifyToken = require('./middleware/verifyToken');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGO_URI;
const jwtSecret = process.env.JWT_SECRET;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/auth/login',
  message: { message: 'Too many requests. Please try again later.' },
});

app.use(helmet());
app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);
app.use(cookieParser());
app.use(express.json());
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, vaultKeySalt, keyCheckValue, keyCheckIv } = req.body;

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof vaultKeySalt !== 'string' ||
    typeof keyCheckValue !== 'string' ||
    typeof keyCheckIv !== 'string'
  ) {
    return res.status(400).json({ message: 'Registration data is incomplete' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  try {
    const user = await User.create({
      email,
      passwordHash: password,
      vaultKeySalt,
      keyCheckValue,
      keyCheckIv,
    });

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        vaultKeySalt: user.vaultKeySalt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Unable to register user' });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
      '+passwordHash'
    );

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id.toString() }, jwtSecret, {
      expiresIn: '1h',
    });

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000,
    });

    res.json({
      user: {
        email: user.email,
        vaultKeySalt: user.vaultKeySalt,
        keyCheckValue: user.keyCheckValue,
        keyCheckIv: user.keyCheckIv,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to log in' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/protected', verifyToken, (req, res) => {
  res.json({ userId: req.userId });
});

app.post('/api/credentials', verifyToken, async (req, res) => {
  const {
    website,
    username,
    encryptedPassword,
    iv,
    authTag,
    category,
  } = req.body;

  if (typeof website !== 'string' || !website.trim()) {
    return res.status(400).json({ message: 'Website is required' });
  }

  if (typeof encryptedPassword !== 'string' || !encryptedPassword.trim()) {
    return res.status(400).json({ message: 'Encrypted password is required' });
  }

  try {
    const credential = await Credential.create({
      userId: req.userId,
      website,
      username,
      encryptedPassword,
      iv,
      authTag,
      category,
    });

    res.status(201).json({ credential });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Unable to save credential' });
  }
});

app.get('/api/credentials', verifyToken, async (req, res) => {
  const { archived } = req.query;
  const filter = { userId: req.userId };

  if (archived !== undefined) {
    if (archived !== 'true' && archived !== 'false') {
      return res.status(400).json({ message: 'Archived must be true or false' });
    }

    filter.isArchived = archived === 'true';
  }

  try {
    const credentials = await Credential.find(filter).sort({ createdAt: -1 });
    res.json({ credentials });
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch credentials' });
  }
});

app.patch('/api/credentials/:id/archive', verifyToken, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid credential ID' });
  }

  try {
    const credential = await Credential.findOne({ _id: id, userId: req.userId });

    if (!credential) {
      return res.status(404).json({ message: 'Credential not found' });
    }

    credential.isArchived = !credential.isArchived;
    await credential.save();

    res.json({ credential });
  } catch (error) {
    res.status(500).json({ message: 'Unable to update credential' });
  }
});

app.use((error, req, res, next) => {
  console.error('Unhandled request error:', error);

  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof SyntaxError && error.status === 400 && error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON request body' });
  }

  res.status(500).json({ message: 'An unexpected server error occurred' });
});

async function startServer() {
  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined in the .env file');
  }

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined in the .env file');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});