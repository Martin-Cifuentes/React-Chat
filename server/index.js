import express from "express"; //Para la creación de la aplicación web
import http from 'http';//Para la creación del servidor HTTP
import { Server as SocketServer } from "socket.io";// Para la comunicación en tiempo real
import cors from 'cors';//Middleware para manejar la conecciónentre diferentes dispositivos
import crypto from 'crypto';//Para encriptar los  mensajes
import promClient from 'prom-client';

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

// === Prometheus instrumentation ===
const { Registry, collectDefaultMetrics, Counter, Histogram } = promClient;
const register = new Registry();
collectDefaultMetrics({ register, prefix: 'securechat_' });

const connectionsCounter = new Counter({
  name: 'securechat_connections_total',
  help: 'Total socket connections',
  registers: [register]
});
const keyExchangeCounter = new Counter({
  name: 'securechat_key_exchanges_total',
  help: 'Total Diffie-Hellman key exchanges',
  registers: [register]
});
const messagesCounter = new Counter({
  name: 'securechat_messages_total',
  help: 'Total messages processed',
  registers: [register]
});
const messageSizeHistogram = new Histogram({
  name: 'securechat_message_size_bytes',
  help: 'Histogram of encrypted message sizes (bytes)',
  buckets: [64, 256, 1024, 4096, 16384],
  registers: [register]
});
// === end instrumentation ===

// Exponer endpoint /metrics
app.get('/metrics', async (req, res) => {
  try {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex.message);
  }
});

//Se maneja el evento de conexión de un nuevo cliente
io.on('connection', (socket) => {
  console.log(socket.id);
  connectionsCounter.inc();

  // Enviar la clave pública del servidor al cliente
  socket.emit('public-key', serverPublicKey);

  // Recibir la clave pública del clienty se calcula la clave secreta compartida usando Diffie-Hellman
  socket.on('client-public-key', (clientPublicKeyBase64) => {
    const clientPublicKey = Buffer.from(clientPublicKeyBase64, 'base64');
    const sharedSecret = dh.computeSecret(clientPublicKey).toString('base64');
    socket.sharedSecret = sharedSecret;
    keyExchangeCounter.inc();
    console.log(`Shared secret with ${socket.id}: ${sharedSecret}`);
  });

  //se recibe y envía el mensaje encriptado, además se incluye el id del cliente que envió el mensaje
  socket.on('message', (encryptedMessage) => {
    messagesCounter.inc();
    const size = encryptedMessage && encryptedMessage.body
      ? Buffer.byteLength(encryptedMessage.body, 'utf8')
      : 0;
    messageSizeHistogram.observe(size);

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
