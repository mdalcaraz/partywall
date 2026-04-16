import { io } from 'socket.io-client'

// Singleton — one connection shared across all pages
const socket = io()

export default socket
