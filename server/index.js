import express from "express";
import http from 'http';
import { Server as SockerServer } from "socket.io";

const app = express()
const server =  http.createServer(app)
const io = new SockerServer(server)

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

server.listen(4000)

console.log('Server on port', 4000)