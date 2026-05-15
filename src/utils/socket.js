import { io } from 'socket.io-client';

const socket = io('http://75.119.130.59', {
  path: '/socket.io',
  transports: ['websocket'],
  autoConnect: true,
  withCredentials: true
});

export default socket;
