import { io } from 'socket.io-client';

const isBrowser = typeof window !== 'undefined';
const protocol = isBrowser ? window.location.protocol : 'http:';
const hostname = isBrowser ? window.location.hostname : '75.119.130.59';
const port = isBrowser && window.location.port ? `:${window.location.port}` : '';

const socket = io(`${protocol}//${hostname}${port}`, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  autoConnect: true,
  withCredentials: true
});

export default socket;
