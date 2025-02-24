type RoomInfoType = {
  status: "lobby" | "playing" | "ended";
  admin: WebSocket;
  joinedClients: WebSocket[];
  createdAt?: Date;
};

export type RoomsType = Record<string, RoomInfoType>;

export type UsernamesType = Record<WebSocket, string>;
