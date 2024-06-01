import express from "express"; //Para la creación de la aplicación web
import http from 'http';//Para la creación del servidor HTTP
import { Server as SocketServer } from "socket.io";// Para la comunicación en tiempo real
import cors from 'cors';//Middleware para manejar la conecciónentre diferentes dispositivos
import crypto from 'crypto';//Para encriptar los  mensajes

//Creación de una instancia de express
const app = express();

// Configurar CORS para permitir solicitudes desde cualquier origen
app.use(cors({
  origin: '*'
}));

//Creación del servidor HTTP
const server = http.createServer(app);

/* Se configura el servidor de Socket.io para que funcione con el servidor HTTP
 y se permite el acceso desde cualquier origen y con métodos HTTP GET y POST. */
const io = new SocketServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

//Se genera un par de claves Diffie-Hellman. La clave pública del servidor se genera y se almacena.
const dh = crypto.createECDH('prime256v1');
dh.generateKeys();
const serverPublicKey = dh.getPublicKey().toString('base64');

//Se maneja el evento de conexión de un nuevo cliente
io.on('connection', (socket) => {
  console.log(socket.id);

  // Enviar la clave pública del servidor al cliente
  socket.emit('public-key', serverPublicKey);

  // Recibir la clave pública del clienty se calcula la clave secreta compartida usando Diffie-Hellman
  socket.on('client-public-key', (clientPublicKeyBase64) => {
    const clientPublicKey = Buffer.from(clientPublicKeyBase64, 'base64');
    const sharedSecret = dh.computeSecret(clientPublicKey).toString('base64');
    socket.sharedSecret = sharedSecret;
    console.log(`Shared secret with ${socket.id}: ${sharedSecret}`);
  });

  //se recibe y envía el mensaje encriptado, además se incluye el id del cliente que envió el mensaje
  socket.on('message', (encryptedMessage) => {
    console.log(encryptedMessage);
    socket.broadcast.emit('message', {
      body: encryptedMessage.body,
      from: socket.id.slice(6)
    });
  });
});

//Se especifica el uso del puerto 4000
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
