export interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: Date;
}

export interface User {
  id: string;
  username: string;
}

export interface Room {
  id: string;
  users: User[];
}
