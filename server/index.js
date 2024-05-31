import express from "express";
import http from 'http';
import { Server as SocketServer } from "socket.io";
import cors from 'cors';
import crypto from 'crypto';

const app = express();

// Configurar CORS para permitir solicitudes desde cualquier origen
app.use(cors({
  origin: '*'
}));

const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: "*", // Permitir todas las conexiones
    methods: ["GET", "POST"]
  }
});

const dh = crypto.createECDH('prime256v1');
dh.generateKeys();
const serverPublicKey = dh.getPublicKey().toString('base64');

io.on('connection', (socket) => {
  console.log(socket.id);

  // Enviar la clave pública del servidor al cliente
  socket.emit('public-key', serverPublicKey);

  // Recibir la clave pública del cliente
  socket.on('client-public-key', (clientPublicKeyBase64) => {
    const clientPublicKey = Buffer.from(clientPublicKeyBase64, 'base64');
    const sharedSecret = dh.computeSecret(clientPublicKey).toString('base64');
    socket.sharedSecret = sharedSecret;
    console.log(`Shared secret with ${socket.id}: ${sharedSecret}`);
  });

  socket.on('message', (encryptedMessage) => {
    console.log(encryptedMessage);
    socket.broadcast.emit('message', {
      body: encryptedMessage.body,
      from: socket.id.slice(6)
    });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
