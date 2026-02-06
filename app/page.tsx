'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSocket } from '@/context/SocketContext';
import { Message, User } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';
import { useRouter, useSearchParams } from 'next/navigation';

type View = 'landing' | 'create' | 'join' | 'chat';

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { socket, isConnected } = useSocket();
  
  const [view, setView] = useState<View>('landing');
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [createdRoomId, setCreatedRoomId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam) {
      setRoomId(roomParam);
      setView('join');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!socket) return;

    socket.on('connect', () => {
      console.log('Connected:', socket.id);
    });

    socket.on('room-joined', ({ users: roomUsers }: { users: User[] }) => {
      setUsers(roomUsers);
      setView('chat');
    });

    socket.on('previous-messages', (prevMessages: Message[]) => {
      setMessages(prevMessages);
    });

    socket.on('new-message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('user-joined', ({ users: roomUsers }: { users: User[] }) => {
      setUsers(roomUsers);
    });

    socket.on('user-left', ({ users: roomUsers }: { users: User[] }) => {
      setUsers(roomUsers);
    });

    return () => {
      socket.off('connect');
      socket.off('room-joined');
      socket.off('previous-messages');
      socket.off('new-message');
      socket.off('user-joined');
      socket.off('user-left');
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateRoomCode = () => {
    return uuidv4().substring(0, 8).toUpperCase();
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!socket || !isConnected) {
      setError('Not connected to server');
      return;
    }
    setError('');
    const newRoomId = generateRoomCode();
    setCreatedRoomId(newRoomId);
    socket.emit('join-room', { roomId: newRoomId, username: username.trim() });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomId.trim()) {
      setError('Please enter your name and room code');
      return;
    }
    if (!socket || !isConnected) {
      setError('Not connected to server');
      return;
    }
    setError('');
    socket.emit('join-room', { roomId: roomId.toUpperCase(), username: username.trim() });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;
    
    const activeRoomId = createdRoomId || roomId;
    socket.emit('send-message', {
      roomId: activeRoomId.toUpperCase(),
      userId: socket.id,
      username,
      text: newMessage.trim(),
    });
    setNewMessage('');
  };

  const copyRoomLink = () => {
    const activeRoomId = createdRoomId || roomId;
    const link = `${window.location.origin}?room=${activeRoomId.toUpperCase()}`;
    navigator.clipboard.writeText(link);
    alert('Room link copied to clipboard!');
  };

  const copyRoomCode = () => {
    const activeRoomId = createdRoomId || roomId;
    navigator.clipboard.writeText(activeRoomId);
    alert('Room code copied to clipboard!');
  };

  const leaveRoom = () => {
    const activeRoomId = createdRoomId || roomId;
    if (socket) {
      socket.emit('leave-room', { roomId: activeRoomId });
    }
    setView('landing');
    setRoomId('');
    setCreatedRoomId('');
    setMessages([]);
    setUsers([]);
    setUsername('');
    router.push('/');
  };

  // Landing Page
  if (view === 'landing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">💬 Chat Rooms</h1>
            <p className="text-gray-500">Real-time messaging made simple</p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={() => setView('create')}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:opacity-90 transition shadow-lg transform hover:scale-105"
            >
              <span className="text-xl">🎉</span> Create New Room
            </button>
            
            <button
              onClick={() => setView('join')}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-500 text-white font-bold rounded-xl hover:opacity-90 transition shadow-lg transform hover:scale-105"
            >
              <span className="text-xl">🔗</span> Join Existing Room
            </button>
          </div>
          
          <p className="text-center text-sm text-gray-400 mt-6">
            {isConnected ? '🟢 Connected to server' : '🔴 Connecting...'}
          </p>
        </div>
      </div>
    );
  }

  // Create Room Page
  if (view === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <button
            onClick={() => setView('landing')}
            className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-2"
          >
            ← Back
          </button>
          
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">🎉</div>
            <h1 className="text-2xl font-bold text-gray-800">Create New Room</h1>
            <p className="text-gray-500">Start a new chat room and invite friends</p>
          </div>
          
          <form onSubmit={handleCreateRoom}>
            <input
              type="text"
              placeholder="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
              autoFocus
            />
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={!isConnected}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              Create Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Join Room Page
  if (view === 'join') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <button
            onClick={() => setView('landing')}
            className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-2"
          >
            ← Back
          </button>
          
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">🔗</div>
            <h1 className="text-2xl font-bold text-gray-800">Join Existing Room</h1>
            <p className="text-gray-500">Enter a room code to join</p>
          </div>
          
          <form onSubmit={handleJoinRoom}>
            <input
              type="text"
              placeholder="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
              autoFocus
            />
            
            <input
              type="text"
              placeholder="Room code (e.g., ABCD1234)"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4 uppercase tracking-wider font-mono"
              maxLength={8}
            />
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={!isConnected}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-500 text-white font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              Join Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Chat Room View
  const activeRoomId = createdRoomId || roomId;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-blue-500 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">💬 Room: {activeRoomId}</h1>
            <p className="text-sm opacity-80">{username}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyRoomCode}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition text-sm"
              title="Copy room code"
            >
              📋 Code
            </button>
            <button
              onClick={copyRoomLink}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition text-sm"
            >
              🔗 Link
            </button>
            <button
              onClick={leaveRoom}
              className="px-4 py-2 bg-red-500 rounded-lg hover:bg-red-600 transition text-sm"
            >
              Leave
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-6xl mx-auto w-full p-4 gap-4">
        {/* Sidebar - Users */}
        <aside className="w-48 bg-white rounded-lg shadow-md p-4 hidden md:block">
          <h2 className="font-bold text-gray-700 mb-3">👥 Online ({users.length})</h2>
          <ul className="space-y-2">
            {users.map((user) => (
              <li
                key={user.id}
                className={`px-3 py-2 rounded-lg ${
                  user.id === socket?.id ? 'bg-purple-100' : 'bg-gray-50'
                }`}
              >
                <span className="font-medium">{user.username}</span>
                {user.id === socket?.id && (
                  <span className="text-xs text-purple-600 ml-2">(you)</span>
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col bg-white rounded-lg shadow-md">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 mt-10">
                <p className="text-4xl mb-2">💬</p>
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.userId === socket?.id ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-gray-700">
                      {msg.username}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div
                    className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${
                      msg.userId === socket?.id
                        ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <form
            onSubmit={handleSendMessage}
            className="border-t p-4 flex gap-2"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-full hover:opacity-90 transition disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <p className="text-xl">Loading...</p>
        </div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
