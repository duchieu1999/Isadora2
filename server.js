const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const keep_alive = require('./keep_alive.js')

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGO_URI = 'mongodb+srv://duchieufaryoung0:80E9gUahdOXmGKuy@cluster0.6nlv1cv.mongodb.net/telegram_bot_db?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Models
const plantSchema = new mongoose.Schema({
  type: String,
  stage: Number,
  plantedTime: Date,
  position: {
    x: Number,
    y: Number
  }
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  gold: { type: Number, default: 100 },
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },
  seeds: {
    carrot: { type: Number, default: 5 },
    tomato: { type: Number, default: 3 },
    potato: { type: Number, default: 2 }
  },
  plants: [plantSchema],
  lastLogin: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Authentication Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const newUser = new User({
      username,
      password: hashedPassword
    });
    
    await newUser.save();
    
    // Generate JWT token
    const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        gold: newUser.gold,
        level: newUser.level,
        experience: newUser.experience,
        seeds: newUser.seeds
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }
    
    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }
    
    // Update last login
    user.lastLogin = Date.now();
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        gold: user.gold,
        level: user.level,
        experience: user.experience,
        seeds: user.seeds,
        plants: user.plants
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Middleware to verify token
const auth = async (req, res, next) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Game Routes
app.get('/api/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('User fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/plant', auth, async (req, res) => {
  try {
    const { seedType, position } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user has the seed
    if (!user.seeds[seedType] || user.seeds[seedType] <= 0) {
      return res.status(400).json({ message: 'Not enough seeds' });
    }
    
    // Check if position is already occupied
    const isOccupied = user.plants.some(plant => 
      plant.position.x === position.x && plant.position.y === position.y
    );
    
    if (isOccupied) {
      return res.status(400).json({ message: 'Position already occupied' });
    }
    
    // Plant the seed
    user.seeds[seedType] -= 1;
    user.plants.push({
      type: seedType,
      stage: 0,
      plantedTime: Date.now(),
      position
    });
    
    await user.save();
    
    res.json({
      seeds: user.seeds,
      plants: user.plants
    });
  } catch (error) {
    console.error('Planting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/water', auth, async (req, res) => {
  try {
    const { plantId } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const plantIndex = user.plants.findIndex(plant => plant._id.toString() === plantId);
    
    if (plantIndex === -1) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    // Water the plant (advance stage if conditions are met)
    const plant = user.plants[plantIndex];
    const hoursSincePlanted = (Date.now() - new Date(plant.plantedTime)) / (1000 * 60 * 60);
    
    if (plant.stage < 3 && hoursSincePlanted >= plant.stage + 1) {
      plant.stage += 1;
      await user.save();
    }
    
    res.json({
      plants: user.plants
    });
  } catch (error) {
    console.error('Watering error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/harvest', auth, async (req, res) => {
  try {
    const { plantId } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const plantIndex = user.plants.findIndex(plant => plant._id.toString() === plantId);
    
    if (plantIndex === -1) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    const plant = user.plants[plantIndex];
    
    // Check if plant is ready to harvest
    if (plant.stage < 3) {
      return res.status(400).json({ message: 'Plant not ready for harvest' });
    }
    
    // Calculate reward
    let goldReward = 0;
    let expReward = 0;
    
    switch (plant.type) {
      case 'carrot':
        goldReward = 10;
        expReward = 5;
        break;
      case 'tomato':
        goldReward = 15;
        expReward = 7;
        break;
      case 'potato':
        goldReward = 20;
        expReward = 10;
        break;
      default:
        goldReward = 5;
        expReward = 3;
    }
    
    // Add rewards
    user.gold += goldReward;
    user.experience += expReward;
    
    // Level up if enough experience
    if (user.experience >= user.level * 50) {
      user.level += 1;
      // Bonus for level up
      user.gold += 50;
      user.seeds.carrot += 2;
      user.seeds.tomato += 1;
      user.seeds.potato += 1;
    }
    
    // Remove harvested plant
    user.plants.splice(plantIndex, 1);
    
    await user.save();
    
    res.json({
      gold: user.gold,
      level: user.level,
      experience: user.experience,
      plants: user.plants,
      seeds: user.seeds,
      reward: {
        gold: goldReward,
        experience: expReward
      }
    });
  } catch (error) {
    console.error('Harvest error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/buy-seeds', auth, async (req, res) => {
  try {
    const { seedType, quantity } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Seed prices
    const prices = {
      carrot: 5,
      tomato: 10,
      potato: 15
    };
    
    if (!prices[seedType]) {
      return res.status(400).json({ message: 'Invalid seed type' });
    }
    
    const totalCost = prices[seedType] * quantity;
    
    // Check if user has enough gold
    if (user.gold < totalCost) {
      return res.status(400).json({ message: 'Not enough gold' });
    }
    
    // Buy seeds
    user.gold -= totalCost;
    user.seeds[seedType] += quantity;
    
    await user.save();
    
    res.json({
      gold: user.gold,
      seeds: user.seeds
    });
  } catch (error) {
    console.error('Buy seeds error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/sync', auth, async (req, res) => {
  try {
    const { plants } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update plant stages based on time elapsed
    if (plants && plants.length > 0) {
      user.plants = plants;
    }
    
    await user.save();
    
    res.json({
      plants: user.plants
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// For Vercel
app.get('/', (req, res) => {
  res.send('Farm Game API is running');
});

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
