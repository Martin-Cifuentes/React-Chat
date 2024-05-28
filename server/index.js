import express from "express";
import http from 'http';
import { Server as SockerServer } from "socket.io";
import cors from 'cors';

const app = express();

// Configurar CORS para permitir solicitudes desde cualquier origen
app.use(cors({
  origin: '*'
}));

const server =  http.createServer(app)
const io = new SockerServer(server, {
    cors: {
      origin: "*", // Permitir todas las conexiones
      methods: ["GET", "POST"]
    }
  });

io.on('connection', socket => {
    console.log(socket.id)

    socket.on('message', (body) => {
        console.log(body)
        socket.broadcast.emit('message', {
            body,
            from: socket.id.slice(6)
        })
    })
})

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
