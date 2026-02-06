import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { parse } from "url";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
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
      socket.join(roomId);
      
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { id: roomId, users: new Map(), messages: [] });
      }
      
      const room = rooms.get(roomId)!;
      room.users.set(socket.id, { id: socket.id, username });

      socket.emit("previous-messages", room.messages);
      socket.emit("room-joined", { roomId, users: Array.from(room.users.values()) });
      socket.to(roomId).emit("user-joined", { username, users: Array.from(room.users.values()) });
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
      const room = rooms.get(roomId);
      if (room) {
        const user = room.users.get(socket.id);
        room.users.delete(socket.id);
        socket.leave(roomId);
        socket.to(roomId).emit("user-left", { 
          username: user?.username || "Unknown",
          users: Array.from(room.users.values())
        });
        if (room.users.size === 0) {
          rooms.delete(roomId);
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
