import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { parse } from "url";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: Date;
}

interface User {
  id: string;
  username: string;
}

interface Room {
  id: string;
  users: Map<string, User>;
  messages: Message[];
}

const normalizeRoomId = (roomId: string) => roomId.trim().toUpperCase();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
  });

  const rooms = new Map<string, Room>();

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join-room", ({ roomId, username }: { roomId: string; username: string }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedUsername = username.trim();
      if (!normalizedRoomId || !normalizedUsername) {
        return;
      }

      socket.join(normalizedRoomId);
      
      if (!rooms.has(normalizedRoomId)) {
        rooms.set(normalizedRoomId, { id: normalizedRoomId, users: new Map(), messages: [] });
      }
      
      const room = rooms.get(normalizedRoomId)!;
      room.users.set(socket.id, { id: socket.id, username: normalizedUsername });

      socket.emit("previous-messages", room.messages);
      socket.emit("room-joined", { roomId: normalizedRoomId, users: Array.from(room.users.values()) });
      socket.to(normalizedRoomId).emit("user-joined", {
        username: normalizedUsername,
        users: Array.from(room.users.values()),
      });
    });

    socket.on("send-message", (message: Omit<Message, "id" | "timestamp">) => {
      const fullMessage: Message = {
        ...message,
        id: `${Date.now()}-${socket.id}`,
        timestamp: new Date(),
      };

      const room = rooms.get(message.roomId);
      if (room) {
        room.messages.push(fullMessage);
        if (room.messages.length > 100) {
          room.messages = room.messages.slice(-100);
        }
      }

      io.to(message.roomId).emit("new-message", fullMessage);
    });

    socket.on("leave-room", ({ roomId }: { roomId: string }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (room) {
        const user = room.users.get(socket.id);
        room.users.delete(socket.id);
        socket.leave(normalizedRoomId);
        socket.to(normalizedRoomId).emit("user-left", { 
          username: user?.username || "Unknown",
          users: Array.from(room.users.values())
        });
        if (room.users.size === 0) {
          rooms.delete(normalizedRoomId);
        }
      }
    });

    socket.on("disconnect", () => {
      rooms.forEach((room, roomId) => {
        if (room.users.has(socket.id)) {
          const user = room.users.get(socket.id);
          room.users.delete(socket.id);
          socket.to(roomId).emit("user-left", { 
            username: user?.username || "Unknown",
            users: Array.from(room.users.values())
          });
          if (room.users.size === 0) {
            rooms.delete(roomId);
          }
        }
      });
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
