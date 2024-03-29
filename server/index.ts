import path from 'path';
import crossfetch from 'cross-fetch';
import express from "express";
import dotenv from "dotenv";
import { WebSocketServer } from 'ws';
import http from 'http';
import jwt, { Secret } from 'jsonwebtoken';
import { UserIncomingMessage } from '../types';

dotenv.config();
const app = express();

app.use(express.static(path.join(__dirname, '../client')));
app.use(express.json());

// Fetch token from developer portal and return to the embedded app
app.post('/api/token', async (req, res) => {
  const searchParams: Record<string,any> = {
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    grant_type: 'authorization_code',
    code: req.body.code,
  };
  const response = await fetch(`https://discord.com/api/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(searchParams),
  });

  var jsonResponse = await response.json();
  const {access_token} = jsonResponse;

  const profile = await (await crossfetch(`https://discord.com/api/users/@me`, {
          method: "GET",
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${access_token}`,
          }
        })).json();

  console.log(`${profile.username} logged in.`);
  var token = jwt.sign(profile, process.env.JWT_SECRET as Secret);

  res.send({access_token, token, profile});
  return;
});

function onSocketError(err: Error) {
  console.error(err);
}

//
// Create an HTTP server.
//
const server = http.createServer(app);

//
// Create a WebSocket server completely detached from the HTTP server.
//
const wss = new WebSocketServer({ clientTracking: false, noServer: true });

server.on('upgrade', function (request: UserIncomingMessage, socket, head) {
  socket.on('error', onSocketError);

  const { pathname } = new URL(request.url!, `wss://${request.headers.host}`);
  console.log(`Authenticate connection request... ${pathname}`);

  if(pathname === '/discord/ws') {
    var token = "";
    var protocolData = request.headers['sec-websocket-protocol']!.split(', ');
    for(var i = 0; i < protocolData.length; i++) {
      var currentData = protocolData[i];
      if(currentData === "Authorization" && i + 1 < protocolData.length) {
        token = protocolData[i + 1];
        break;
      }
    }
    jwt.verify(token, process.env.JWT_SECRET as Secret, { algorithms: ['HS256'] }, function (err, payload) {
      if(err) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        console.log(`Invalid token`);
        return;
      }

      request.user = payload;

      socket.removeListener('error', onSocketError);

      wss.handleUpgrade(request, socket, head, function (ws) {
        wss.emit('connection', ws, request);
      });
    });
  }
  else {
    socket.destroy();
  }
});

wss.on('connection', function (ws, request: UserIncomingMessage) {
  const user = request.user;
  console.log(`${user.username} connected`);

  ws.on('error', console.error);

  ws.on('message', function (message) {
    const data = JSON.parse(message.toString());
    console.log(`Received message ${message} from user ${user.username}`);
    ws.send(message);
  });

  ws.on('close', function () {
    console.log(`${user.username} disconnected`); 
  });
});

//
// Start the server.
//
server.listen(3000, function () {
  console.log('Listening on http://localhost:3000');
});
