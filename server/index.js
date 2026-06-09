
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('./models/User');
const Message = require('./models/Message');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // Allow same-origin (origin is undefined), configured CLIENT_URL, local dev, or any origin in production if CLIENT_URL is not set
            if (!origin || 
                origin === CLIENT_URL || 
                origin.startsWith('http://localhost:') || 
                origin.startsWith('http://127.0.0.1:') || 
                !process.env.CLIENT_URL) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5005;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatapp';

app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for all file types
    fileFilter: (req, file, cb) => {
        // Accept all file types
        cb(null, true);
    }
});

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// MongoDB Connection
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

// Routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ username, password: hashedPassword });
        await user.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error('Registration Error:', err);
        res.status(500).json({ message: 'Server error during registration: ' + err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: { id: user._id, username: user.username } });
    } catch (err) {
        res.status(500).json({ message: 'Server error during login' });
    }
});

app.get('/api/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ user });
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
});

// Upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        const mimetype = req.file.mimetype;

        // Determine file type based on MIME type
        let mediaType = 'other';
        if (mimetype.startsWith('image/')) {
            mediaType = 'image';
        } else if (mimetype.startsWith('video/')) {
            mediaType = 'video';
        } else if (mimetype.startsWith('audio/')) {
            mediaType = 'audio';
        } else if (mimetype === 'application/pdf') {
            mediaType = 'pdf';
        } else if (
            mimetype.includes('document') ||
            mimetype.includes('word') ||
            mimetype.includes('excel') ||
            mimetype.includes('powerpoint') ||
            mimetype.includes('spreadsheet') ||
            mimetype.includes('presentation') ||
            mimetype.includes('text/')
        ) {
            mediaType = 'document';
        }

        res.json({
            url: fileUrl,
            mediaType: mediaType,
            fileName: req.file.originalname,
            fileSize: req.file.size
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ message: 'Error uploading file' });
    }
});

// Users list route
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching users' });
    }
});

// Private message history route
app.get('/api/messages/:userId/:recipientId', async (req, res) => {
    try {
        const { userId, recipientId } = req.params;
        const messages = await Message.find({
            $or: [
                { sender: userId, recipient: recipientId },
                { sender: recipientId, recipient: userId }
            ],
            deletedFor: { $ne: userId }
        }).sort({ createdAt: 1 }).limit(100);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching messages' });
    }
});

// Delete message endpoint
app.delete('/api/messages/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const { type } = req.query;

        // different logic based on deletion type
        if (type === 'everyone') {
            // Verify the user owns this message
            if (message.sender.toString() !== decoded.id) {
                return res.status(403).json({ message: 'Not authorized to delete this message for everyone' });
            }
            await Message.findByIdAndDelete(messageId);
            res.json({ message: 'Message deleted for everyone', type: 'everyone' });
        } else {
            // Delete for me
            if (!message.deletedFor.includes(decoded.id)) {
                message.deletedFor.push(decoded.id);
                await message.save();
            }
            res.json({ message: 'Message deleted for you', type: 'me' });
        }
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ message: 'Error deleting message' });
    }
});

// Socket.io Logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join a personal room for private messaging
    socket.on('join_user', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their personal room`);
    });

    socket.on('send_message', async (data) => {
        try {
            const { senderId, recipientId, text, mediaUrl, mediaType, fileName, fileSize } = data;
            const newMessage = new Message({
                sender: senderId,
                recipient: recipientId,
                text: text || '',
                mediaUrl,
                mediaType,
                fileName,
                fileSize
            });
            await newMessage.save();

            // Emit to both sender and recipient rooms
            io.to(senderId).emit('receive_message', newMessage);
            io.to(recipientId).emit('receive_message', newMessage);
        } catch (err) {
            console.error('Socket Error:', err);
        }
    });

    socket.on('mark_messages_read', async ({ senderId, recipientId }) => {
        try {
            await Message.updateMany(
                { sender: senderId, recipient: recipientId, status: { $ne: 'read' } },
                { $set: { status: 'read' } }
            );

            // Notify the sender that their messages have been read
            io.to(senderId).emit('messages_read', { recipientId });
        } catch (err) {
            console.error('Mark Read Error:', err);
        }
    });

    socket.on('delete_message', async (data) => {
        try {
            const { messageId, senderId, recipientId } = data;

            // Notify both users about the deletion
            io.to(senderId).emit('message_deleted', { messageId });
            io.to(recipientId).emit('message_deleted', { messageId });
        } catch (err) {
            console.error('Delete Socket Error:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Serve static client files in production
if (process.env.NODE_ENV === 'production') {
    const clientBuildPath = path.join(__dirname, '../client/dist');
    app.use(express.static(clientBuildPath));
    
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
            return next();
        }
        res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
