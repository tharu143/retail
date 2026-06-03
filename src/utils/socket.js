import { io } from 'socket.io-client';

const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const hostname = typeof window !== 'undefined' ? window.location.hostname : '75.119.130.59';

const socket = io(`${protocol}//${hostname}`, {
  path: '/socket.io',
  transports: ['websocket'],
  autoConnect: true,
  withCredentials: true
});

export default socket;
