import { io } from 'socket.io-client';
import { getToken } from './api';

let _socket = null;
let _eventId = null;

export function getSocket(eventId) {
  if (_socket && _eventId === eventId) return _socket;

  if (_socket) { _socket.disconnect(); _socket = null; }

  _eventId = eventId;
  _socket  = io();

  const join = () => _socket.emit('join_event', { eventId, token: getToken() });
  _socket.on('connect',   join);
  _socket.on('reconnect', join);

  return _socket;
}

export function disconnectSocket() {
  if (_socket) { _socket.disconnect(); _socket = null; _eventId = null; }
}
