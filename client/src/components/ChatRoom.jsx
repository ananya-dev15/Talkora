
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import axios from 'axios';
import { Send, LogOut, User as UserIcon, Hash, Search, Paperclip, Image as ImageIcon, Trash2, FileText, File as FileIcon, Music, Video, Download, Mic, Square, X, Camera, Check, CheckCheck } from 'lucide-react';

const ChatRoom = () => {
    const { user, logout } = useAuth();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [socket, setSocket] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [hoveredMessageId, setHoveredMessageId] = useState(null);

    // Voice Recording States
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // Camera States
    const [showCamera, setShowCamera] = useState(false);
    const [cameraStream, setCameraStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [isRecordingVideo, setIsRecordingVideo] = useState(false);
    const [videoBlob, setVideoBlob] = useState(null);
    const [cameraMode, setCameraMode] = useState('photo'); // 'photo' or 'video'
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const videoRecorderRef = useRef(null);
    const videoChunksRef = useRef([]);

    // Delete Modal State
    const [messageToDelete, setMessageToDelete] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const newSocket = io('http://localhost:5005');
        setSocket(newSocket);

        if (user) {
            newSocket.emit('join_user', user._id || user.id);
        }

        // Fetch users list
        const fetchUsers = async () => {
            try {
                const res = await axios.get('http://localhost:5005/api/users');
                setUsers(res.data.filter(u => (u._id || u.id) !== (user._id || user.id)));
            } catch (err) {
                console.error('Error fetching users:', err);
            }
        };
        fetchUsers();

        newSocket.on('receive_message', (message) => {
            setMessages((prev) => {
                // If the message is from the currently selected user, mark it as read immediately
                if (selectedUser && (message.sender === (selectedUser._id || selectedUser.id) || message.sender._id === (selectedUser._id || selectedUser.id))) {
                    newSocket.emit('mark_messages_read', {
                        senderId: selectedUser._id || selectedUser.id,
                        recipientId: user._id || user.id
                    });
                }
                return [...prev, message];
            });
        });

        newSocket.on('messages_read', ({ recipientId }) => {
            setMessages(prev => prev.map(msg => {
                if ((msg.recipient === recipientId || msg.recipient?._id === recipientId) && msg.status !== 'read') {
                    return { ...msg, status: 'read' };
                }
                return msg;
            }));
        });

        newSocket.on('message_deleted', ({ messageId }) => {
            setMessages((prev) => prev.filter(msg => (msg._id || msg.id) !== messageId));
        });

        return () => {
            newSocket.close();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [user]);

    useEffect(() => {
        if (selectedUser) {
            const fetchMessages = async () => {
                try {
                    const res = await axios.get(`http://localhost:5005/api/messages/${user._id || user.id}/${selectedUser._id || selectedUser.id}`);
                    setMessages(res.data);

                    // Mark messages as read when opening chat
                    const unreadMessages = res.data.filter(msg =>
                        (msg.sender === (selectedUser._id || selectedUser.id) || msg.sender._id === (selectedUser._id || selectedUser.id)) &&
                        msg.status !== 'read'
                    );

                    if (unreadMessages.length > 0) {
                        newSocket.emit('mark_messages_read', {
                            senderId: selectedUser._id || selectedUser.id,
                            recipientId: user._id || user.id
                        });
                    }
                } catch (err) {
                    console.error('Error fetching history:', err);
                }
            };
            fetchMessages();
        } else {
            setMessages([]);
        }
    }, [selectedUser, user]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const getSupportedMimeType = () => {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg',
            'audio/wav'
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return '';
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = getSupportedMimeType();

            if (!mimeType) {
                alert('No supported audio MIME type found in this browser.');
                return;
            }

            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                await sendVoiceMessage(audioBlob, mimeType);

                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingDuration(0);

            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Cannot access microphone. Please check permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            // Prevent onstop from sending the message
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();

            // Release microphone
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());

            setIsRecording(false);
            setRecordingDuration(0);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    const sendVoiceMessage = async (audioBlob, mimeType) => {
        if (!selectedUser) return;

        if (audioBlob.size === 0) {
            console.error('Audio blob is empty');
            alert('Recording failed: Audio is empty.');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            // Determine extension based on mimeType
            const extension = mimeType.split('/')[1]?.split(';')[0] || 'webm';
            // Create a file from the blob
            const file = new File([audioBlob], `voice-message-${Date.now()}.${extension}`, { type: mimeType });
            formData.append('file', file);

            const uploadRes = await axios.post('http://localhost:5005/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Send message with media
            socket.emit('send_message', {
                senderId: user._id || user.id,
                recipientId: selectedUser._id || selectedUser.id,
                text: '',
                mediaUrl: uploadRes.data.url,
                mediaType: 'audio', // Explicitly set as audio
                fileName: 'Voice Message',
                fileSize: file.size
            });
        } catch (err) {
            console.error('Error uploading voice message:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
            alert(`Failed to send voice message: ${errorMessage}`);
        } finally {
            setUploading(false);
            setRecordingDuration(0);
        }
    };

    // Camera Logic
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            setCameraStream(stream);
            setShowCamera(true);
            setCapturedImage(null);
            setVideoBlob(null);
            setIsRecordingVideo(false);

            // Wait for video element to be ready
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            }, 100);
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Cannot access camera. Please check permissions.');
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setShowCamera(false);
        setCapturedImage(null);
        setVideoBlob(null);
        setIsRecordingVideo(false);
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                setCapturedImage(blob);
            }, 'image/jpeg', 0.95);
        }
    };

    const startVideoRecording = () => {
        if (!cameraStream) return;

        videoChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(cameraStream, {
            mimeType: 'video/webm;codecs=vp8,opus'
        }); // Use standard webm for video

        videoRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                videoChunksRef.current.push(event.data);
            }
        };

        videoRecorder.onstop = () => {
            const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
            setVideoBlob(blob);
        };

        videoRecorder.start();
        videoRecorderRef.current = mediaRecorder;
        setIsRecordingVideo(true);
    };

    const stopVideoRecording = () => {
        if (videoRecorderRef.current && isRecordingVideo) {
            videoRecorderRef.current.stop();
            setIsRecordingVideo(false);
        }
    };

    const handleUploadCaptured = async () => {
        if (!selectedUser) return;

        // Determine what to upload
        let blobToUpload = null;
        let mimeType = '';
        let fileName = '';

        if (cameraMode === 'photo' && capturedImage) {
            blobToUpload = capturedImage;
            mimeType = 'image/jpeg';
            fileName = `photo-${Date.now()}.jpg`;
        } else if (cameraMode === 'video' && videoBlob) {
            blobToUpload = videoBlob;
            mimeType = 'video/webm';
            fileName = `video-${Date.now()}.webm`;
        }

        if (!blobToUpload) return;

        setUploading(true);
        try {
            const formData = new FormData();
            const file = new File([blobToUpload], fileName, { type: mimeType });
            formData.append('file', file);

            const uploadRes = await axios.post('http://localhost:5005/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            socket.emit('send_message', {
                senderId: user._id || user.id,
                recipientId: selectedUser._id || selectedUser.id,
                text: '',
                mediaUrl: uploadRes.data.url,
                mediaType: cameraMode === 'photo' ? 'image' : 'video',
                fileName: fileName,
                fileSize: file.size
            });

            stopCamera();
        } catch (err) {
            console.error('Error uploading captured media:', err);
            alert('Failed to send media.');
        } finally {
            setUploading(false);
        }
    };
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedUser) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await axios.post('http://localhost:5005/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Send message with media
            socket.emit('send_message', {
                senderId: user._id || user.id,
                recipientId: selectedUser._id || selectedUser.id,
                text: '',
                mediaUrl: uploadRes.data.url,
                mediaType: uploadRes.data.mediaType,
                fileName: uploadRes.data.fileName,
                fileSize: uploadRes.data.fileSize
            });

            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (err) {
            console.error('Error uploading file:', err);
            alert('Failed to upload file. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() && socket && selectedUser) {
            socket.emit('send_message', {
                senderId: user._id || user.id,
                recipientId: selectedUser._id || selectedUser.id,
                text: newMessage
            });
            setNewMessage('');
        }
    };

    const handleDeleteClick = (message) => {
        setMessageToDelete(message);
        setShowDeleteModal(true);
    };

    const confirmDelete = async (type) => {
        if (!messageToDelete) return;

        try {
            const token = localStorage.getItem('token');
            const messageId = messageToDelete._id || messageToDelete.id;

            await axios.delete(`http://localhost:5005/api/messages/${messageId}?type=${type}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // If deleted for everyone, emit socket event
            if (type === 'everyone') {
                socket.emit('delete_message', {
                    messageId,
                    senderId: user._id || user.id,
                    recipientId: selectedUser._id || selectedUser.id
                });
            } else {
                // If deleted for me, just remove from local state
                setMessages((prev) => prev.filter(msg => (msg._id || msg.id) !== messageId));
            }

            setShowDeleteModal(false);
            setMessageToDelete(null);
        } catch (err) {
            console.error('Error deleting message:', err);
            alert('Failed to delete message. Please try again.');
        }
    };

    const renderFileContent = (msg, isMe) => {
        const baseUrl = 'http://localhost:5005';

        if (!msg.mediaUrl) {
            return <div>{msg.text}</div>;
        }

        const fileUrl = `${baseUrl}${msg.mediaUrl}`;

        switch (msg.mediaType) {
            case 'image':
                return (
                    <>
                        <img
                            src={fileUrl}
                            alt={msg.fileName || "Shared image"}
                            style={{
                                maxWidth: '100%',
                                borderRadius: '12px',
                                display: 'block'
                            }}
                        />
                        {msg.text && <div style={{ marginTop: '8px' }}>{msg.text}</div>}
                    </>
                );

            case 'video':
                return (
                    <>
                        <video
                            src={fileUrl}
                            controls
                            style={{
                                maxWidth: '100%',
                                borderRadius: '12px',
                                display: 'block'
                            }}
                        />
                        {msg.text && <div style={{ marginTop: '8px' }}>{msg.text}</div>}
                    </>
                );

            case 'audio':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '250px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                padding: '8px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.1)'
                            }}>
                                <Mic size={16} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{msg.fileName || 'Voice Message'}</span>
                        </div>
                        <audio
                            src={fileUrl}
                            controls
                            style={{ width: '100%', height: '32px' }}
                        />
                        {msg.fileSize && <div style={{ fontSize: '0.75rem', opacity: 0.7, marginLeft: '4px' }}>{formatFileSize(msg.fileSize)}</div>}
                        {msg.text && <div style={{ marginTop: '4px' }}>{msg.text}</div>}
                    </div>
                );

            case 'pdf':
                return (
                    <a
                        href={fileUrl}
                        download={msg.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            background: isMe ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.05)',
                            borderRadius: '10px',
                            textDecoration: 'none',
                            color: 'white',
                            minWidth: '250px'
                        }}
                    >
                        <FileText size={32} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{msg.fileName || 'Document.pdf'}</div>
                            {msg.fileSize && <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{formatFileSize(msg.fileSize)}</div>}
                        </div>
                        <Download size={20} />
                    </a>
                );

            case 'document':
            case 'other':
                return (
                    <a
                        href={fileUrl}
                        download={msg.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            background: isMe ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.05)',
                            borderRadius: '10px',
                            textDecoration: 'none',
                            color: 'white',
                            minWidth: '250px'
                        }}
                    >
                        <FileIcon size={32} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{msg.fileName || 'File'}</div>
                            {msg.fileSize && <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{formatFileSize(msg.fileSize)}</div>}
                        </div>
                        <Download size={20} />
                    </a>
                );

            default:
                return <div>{msg.text}</div>;
        }
    };

    const filteredMessages = messages.filter(msg => {
        if (!selectedUser) return false;
        const currentUserId = user._id || user.id;
        const selectedUserId = selectedUser._id || selectedUser.id;
        const msgSenderId = msg.sender?._id || msg.sender;
        const msgRecipientId = msg.recipient?._id || msg.recipient;

        return (
            (msgSenderId === currentUserId && msgRecipientId === selectedUserId) ||
            (msgSenderId === selectedUserId && msgRecipientId === currentUserId)
        );
    });

    return (
        <div className="auth-container" style={{ padding: '0', background: 'transparent' }}>
            <div className="glass-card" style={{
                maxWidth: '1200px',
                height: '85vh',
                display: 'flex',
                flexDirection: 'row',
                padding: '0',
                overflow: 'hidden'
            }}>
                {/* Sidebar */}
                <div style={{
                    width: '320px',
                    borderRight: '1px solid var(--glass-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'rgba(255, 255, 255, 0.03)'
                }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{
                                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                padding: '8px',
                                borderRadius: '10px'
                            }}>
                                <Hash size={18} color="white" />
                            </div>
                            <h2 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '700' }}>Messages</h2>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                placeholder="Search users..."
                                style={{
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '10px',
                                    padding: '8px 12px 8px 36px',
                                    fontSize: '0.85rem',
                                    color: 'white'
                                }}
                            />
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                        {users.map(u => (
                            <div
                                key={u._id || u.id}
                                onClick={() => setSelectedUser(u)}
                                style={{
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    marginBottom: '4px',
                                    transition: 'all 0.2s ease',
                                    background: selectedUser?._id === u._id ? 'rgba(255,255,255,0.08)' : 'transparent',
                                    border: selectedUser?._id === u._id ? '1px solid var(--glass-border)' : '1px solid transparent'
                                }}
                            >
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)'
                                }}>
                                    <UserIcon size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{u.username}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Click to chat</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ padding: '20px', borderTop: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                        }}>
                            {user?.username[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.username}</div>
                            <div style={{ fontSize: '0.7rem', color: '#10b981' }}>Online</div>
                        </div>
                        <button onClick={logout} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>

                {/* Chat Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {selectedUser ? (
                        <>
                            {/* Header */}
                            <div style={{
                                padding: '20px 30px',
                                borderBottom: '1px solid var(--glass-border)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: 'rgba(255, 255, 255, 0.02)'
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--glass-border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)'
                                }}>
                                    <UserIcon size={20} />
                                </div>
                                <h2 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '700' }}>{selectedUser.username}</h2>
                            </div>

                            {/* Messages Area */}
                            <div style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: '30px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                {filteredMessages.map((msg, index) => {
                                    const currentUserId = user._id || user.id;
                                    const msgSenderId = msg.sender?._id || msg.sender;
                                    const isMe = msgSenderId === currentUserId;
                                    const messageId = msg._id || msg.id;

                                    return (
                                        <div
                                            key={index}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignSelf: isMe ? 'flex-end' : 'flex-start',
                                                maxWidth: msg.mediaUrl ? '80%' : '70%',
                                                gap: '4px',
                                                position: 'relative'
                                            }}
                                            onMouseEnter={() => setHoveredMessageId(messageId)}
                                            onMouseLeave={() => setHoveredMessageId(null)}
                                        >
                                            <div style={{
                                                padding: msg.mediaUrl && (msg.mediaType === 'image' || msg.mediaType === 'video') ? '8px' : '10px 16px',
                                                borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                                background: isMe ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                                                border: isMe ? 'none' : '1px solid var(--glass-border)',
                                                color: 'white',
                                                fontSize: '0.9rem',
                                                boxShadow: isMe ? '0 4px 15px -3px rgba(99, 102, 241, 0.4)' : 'none',
                                                overflow: 'hidden',
                                                position: 'relative'
                                            }}>
                                                {renderFileContent(msg, isMe)}

                                                {/* Read Receipts */}
                                                {isMe && (
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'flex-end',
                                                        marginTop: '2px',
                                                        opacity: 0.8
                                                    }}>
                                                        {msg.status === 'read' ? (
                                                            <CheckCheck size={14} color="#4ade80" /> // Double green tick
                                                        ) : (
                                                            <Check size={14} color="white" /> // Single white tick
                                                        )}
                                                    </div>
                                                )}

                                                {/* Delete button */}
                                                {isMe && hoveredMessageId === messageId && (
                                                    <button
                                                        onClick={() => handleDeleteClick(msg)}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '4px',
                                                            right: '4px',
                                                            background: 'rgba(0,0,0,0.3)',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            padding: '6px',
                                                            cursor: 'pointer',
                                                            color: '#f87171',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'rgba(0,0,0,0.5)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <div style={{
                                padding: '24px 30px',
                                borderTop: '1px solid var(--glass-border)',
                                background: 'rgba(255, 255, 255, 0.02)',
                                display: 'flex',
                                gap: '12px',
                                alignItems: 'center'
                            }}>
                                {isRecording ? (
                                    <div style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                        borderRadius: '12px',
                                        padding: '10px 20px',
                                        height: '46px'
                                    }}>
                                        <div style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            background: '#ef4444',
                                            animation: 'pulse 1s infinite'
                                        }} />
                                        <div style={{ color: '#ef4444', fontWeight: '600' }}>
                                            Recording {formatDuration(recordingDuration)}...
                                        </div>
                                        <div style={{ flex: 1 }} />
                                        <button
                                            onClick={cancelRecording}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: 'var(--text-secondary)',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                            title="Cancel"
                                        >
                                            <X size={20} />
                                        </button>
                                        <button
                                            onClick={stopRecording}
                                            style={{
                                                background: '#ef4444',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                color: 'white',
                                                padding: '6px',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                            title="Send"
                                        >
                                            <Send size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px', width: '100%', alignItems: 'center' }}>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileSelect}
                                            accept="*/*"
                                            style={{ display: 'none' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '12px',
                                                padding: '10px 12px',
                                                cursor: uploading ? 'not-allowed' : 'pointer',
                                                color: 'var(--text-secondary)',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!uploading) {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                                    e.currentTarget.style.color = 'white';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                e.currentTarget.style.color = 'var(--text-secondary)';
                                            }}
                                        >
                                            {uploading ? <ImageIcon size={20} className="spin" /> : <Paperclip size={20} />}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={startCamera}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '12px',
                                                padding: '10px 12px',
                                                cursor: 'pointer',
                                                color: 'var(--text-secondary)',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                                e.currentTarget.style.color = 'white';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                e.currentTarget.style.color = 'var(--text-secondary)';
                                            }}
                                            title="Camera"
                                        >
                                            <Camera size={20} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={startRecording}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '12px',
                                                padding: '10px 12px',
                                                cursor: 'pointer',
                                                color: 'var(--text-secondary)',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                                e.currentTarget.style.color = 'white';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                e.currentTarget.style.color = 'var(--text-secondary)';
                                            }}
                                        >
                                            <Mic size={20} />
                                        </button>

                                        <input
                                            type="text"
                                            className="form-input"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder={`Message ${selectedUser.username}...`}
                                            style={{ background: 'rgba(0,0,0,0.2)', flex: 1 }}
                                        />
                                        <button type="submit" className="auth-button" style={{
                                            width: 'auto',
                                            padding: '0 20px',
                                            marginTop: '0'
                                        }}>
                                            <Send size={20} />
                                        </button>
                                    </form>
                                )}
                            </div>
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '16px' }}>
                            <div style={{ padding: '20px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                                <Hash size={48} />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ color: 'white', margin: '0 0 8px 0' }}>Welcome to Talkora</h3>
                                <p style={{ margin: 0, fontSize: '0.9rem' }}>Select a user from the sidebar to start chatting</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Delete Modal */}
            {showDeleteModal && messageToDelete && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    zIndex: 1100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div className="glass-card" style={{
                        width: '90%',
                        maxWidth: '400px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        background: '#1e1e1e',
                        border: '1px solid var(--glass-border)'
                    }}>
                        <h3 style={{ margin: 0, color: 'white', textAlign: 'center' }}>Delete Message?</h3>
                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem' }}>
                            Choose how you want to delete this message.
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Only show delete for everybody if I am the sender */}
                            {(messageToDelete.sender._id || messageToDelete.sender) === (user._id || user.id) && (
                                <button
                                    onClick={() => confirmDelete('everyone')}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        color: '#ef4444',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                >
                                    <Trash2 size={18} /> Delete for Everyone
                                </button>
                            )}

                            <button
                                onClick={() => confirmDelete('me')}
                                style={{
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--glass-border)',
                                    background: 'transparent',
                                    color: 'white',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                Delete for Me
                            </button>

                            <button
                                onClick={() => setShowDeleteModal(false)}
                                style={{
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--text-secondary)',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Camera Modal */}
            {showCamera && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.9)',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: '800px',
                        height: '80vh',
                        background: '#000',
                        borderRadius: '20px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* Camera Header */}
                        <div style={{
                            padding: '20px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            zIndex: 10
                        }}>
                            <div style={{ color: 'white', fontWeight: '600' }}>
                                {capturedImage || videoBlob ? 'Preview' : (cameraMode === 'photo' ? 'Take Photo' : 'Record Video')}
                            </div>
                            <button
                                onClick={stopCamera}
                                style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    color: 'white',
                                    display: 'flex'
                                }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Camera/Preview Area */}
                        <div style={{
                            flex: 1,
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#000',
                            overflow: 'hidden'
                        }}>
                            {!capturedImage && !videoBlob ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                                </>
                            ) : (
                                capturedImage ? (
                                    <img
                                        src={URL.createObjectURL(capturedImage)}
                                        alt="Captured"
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                    />
                                ) : (
                                    <video
                                        src={URL.createObjectURL(videoBlob)}
                                        controls
                                        style={{ maxWidth: '100%', maxHeight: '100%' }}
                                    />
                                )
                            )}
                        </div>

                        {/* Controls */}
                        <div style={{
                            padding: '30px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '20px',
                            background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)'
                        }}>
                            {!capturedImage && !videoBlob ? (
                                <>
                                    {/* Mode Switcher */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '100px',
                                        background: 'rgba(0,0,0,0.5)',
                                        padding: '4px',
                                        borderRadius: '20px',
                                        display: 'flex',
                                        gap: '4px'
                                    }}>
                                        <button
                                            onClick={() => setCameraMode('photo')}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '16px',
                                                border: 'none',
                                                background: cameraMode === 'photo' ? 'white' : 'transparent',
                                                color: cameraMode === 'photo' ? 'black' : 'white',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            Photo
                                        </button>
                                        <button
                                            onClick={() => setCameraMode('video')}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '16px',
                                                border: 'none',
                                                background: cameraMode === 'video' ? 'white' : 'transparent',
                                                color: cameraMode === 'video' ? 'black' : 'white',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            Video
                                        </button>
                                    </div>

                                    {/* Capture Button */}
                                    <button
                                        onClick={cameraMode === 'photo' ? takePhoto : (isRecordingVideo ? stopVideoRecording : startVideoRecording)}
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            border: '4px solid white',
                                            background: isRecordingVideo ? '#ef4444' : 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{
                                            width: isRecordingVideo ? '30px' : '64px',
                                            height: isRecordingVideo ? '30px' : '64px',
                                            borderRadius: isRecordingVideo ? '4px' : '50%',
                                            background: 'white',
                                            transition: 'all 0.2s'
                                        }} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => {
                                            setCapturedImage(null);
                                            setVideoBlob(null);
                                            setIsRecordingVideo(false);
                                        }}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255,255,255,0.3)',
                                            background: 'rgba(255,255,255,0.1)',
                                            color: 'white',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Retake
                                    </button>
                                    <button
                                        onClick={handleUploadCaptured}
                                        disabled={uploading}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '12px',
                                            border: 'none',
                                            background: '#6366f1',
                                            color: 'white',
                                            fontWeight: '600',
                                            cursor: uploading ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        {uploading ? 'Sending...' : (
                                            <>
                                                Send <Send size={16} />
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <style jsx>{`
                @keyframes pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.1); }
                    100% { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default ChatRoom;
