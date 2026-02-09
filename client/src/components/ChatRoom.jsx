
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import axios from 'axios';
import { Send, LogOut, User as UserIcon, Hash, Search } from 'lucide-react';

const ChatRoom = () => {
    const { user, logout } = useAuth();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [socket, setSocket] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
                // Filter out current user
                setUsers(res.data.filter(u => (u._id || u.id) !== (user._id || user.id)));
            } catch (err) {
                console.error('Error fetching users:', err);
            }
        };
        fetchUsers();

        newSocket.on('receive_message', (message) => {
            setMessages((prev) => [...prev, message]);
        });

        return () => newSocket.close();
    }, [user]);

    useEffect(() => {
        if (selectedUser) {
            const fetchMessages = async () => {
                try {
                    const res = await axios.get(`http://localhost:5005/api/messages/${user._id || user.id}/${selectedUser._id || selectedUser.id}`);
                    setMessages(res.data);
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

    // Filter messages for current conversation
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
                                    return (
                                        <div key={index} style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                                            maxWidth: '70%',
                                            gap: '4px'
                                        }}>
                                            <div style={{
                                                padding: '10px 16px',
                                                borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                                background: isMe ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                                                border: isMe ? 'none' : '1px solid var(--glass-border)',
                                                color: 'white',
                                                fontSize: '0.9rem',
                                                boxShadow: isMe ? '0 4px 15px -3px rgba(99, 102, 241, 0.4)' : 'none'
                                            }}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <form onSubmit={handleSendMessage} style={{
                                padding: '24px 30px',
                                borderTop: '1px solid var(--glass-border)',
                                background: 'rgba(255, 255, 255, 0.02)',
                                display: 'flex',
                                gap: '12px'
                            }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder={`Message ${selectedUser.username}...`}
                                    style={{ background: 'rgba(0,0,0,0.2)' }}
                                />
                                <button type="submit" className="auth-button" style={{
                                    width: 'auto',
                                    padding: '0 20px',
                                    marginTop: '0'
                                }}>
                                    <Send size={20} />
                                </button>
                            </form>
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
        </div>
    );
};

export default ChatRoom;
