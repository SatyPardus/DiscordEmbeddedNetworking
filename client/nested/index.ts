import {MessageInterface} from '../utils/MessageInterface';

const messageInterface = new MessageInterface();

window.addEventListener('DOMContentLoaded', async () => {
    const reloadButton = document.getElementById('reload');
    const joinGameButton = document.getElementById('joingame');

    reloadButton?.addEventListener('click', () => {
        console.log('reloading');
        window.location.reload();
    });

    const {token, profile} = await messageInterface.ready();

    messageInterface.sendMessage({
    command: 'SET_ACTIVITY',
    data: {
        activity: {
        details: 'Set Activity from nested iframe',
        type: 0,
        state: 'Playing',
        },
    },
    });

    const parentQueryParams = new URLSearchParams(window.parent.location.search);
    const channelId = parentQueryParams.get('channel_id');
    const instanceId = parentQueryParams.get('frame_id');

    messageInterface.subscribe(
        'SPEAKING_START',
        ({user_id}) => {
            console.log(`"${user_id}" Just started talking`);
        },
        {channel_id: channelId}
    );

    messageInterface.subscribe(
        'SPEAKING_STOP',
        ({user_id}) => {
            console.log(`"${user_id}" Just stopped talking`);
        },
        {channel_id: channelId}
    );

    const socket = new WebSocket(`wss://${process.env.CLIENT_ID}.discordsays.com/discord/ws`, ["Authorization", token]);

    function sendData(data: any) {
        socket.send(JSON.stringify(data));
    }

    joinGameButton?.addEventListener('click', () => {
        console.log(`Joining game ${instanceId}`);
        sendData({
            type: "joingame",
            instance_id: instanceId
        })
    });

    // Connection opened
    socket.addEventListener("open", (event) => { 
        console.log("Connected to server");
    });

    // Listen for messages
    socket.addEventListener("message", async (event) => {
        console.log(event);
        try {
            var data = JSON.parse(event.data);
            if(data.type === "ping") {
                sendData({
                    type: "pong"
                });
            }
        }
        catch
        {
            console.log(`Received invalid data from server: ${event.data}`);
        }
    });
});