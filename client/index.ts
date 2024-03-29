import {DiscordSDK} from '@discord/embedded-app-sdk';
import type {MessageData} from './utils/types';

window.addEventListener('DOMContentLoaded', onContentLoaded);

let discordSdk: DiscordSDK;
let access_token: string;
let token: string;
let profile: any;

async function onContentLoaded() {
  if (typeof process.env.CLIENT_ID !== 'string') {
    throw new Error("Must specify 'CLIENT_ID");
  }

  discordSdk = new DiscordSDK(process.env.CLIENT_ID);
  await discordSdk.ready();

  try
  {
    // Pop open the OAuth permission modal and request for access to scopes listed in scope array below
    const {code} = await discordSdk.commands.authorize({
      client_id: process.env.CLIENT_ID,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify', 'rpc.activities.write', 'rpc.voice.read'],
    });

    // Retrieve an access_token from your embedded app's server
    const response = await fetch('/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
      }),
    });

    const data = await response.json();

    token = data.token;
    profile = data.profile;
    access_token = data.access_token;

    // Authenticate with Discord client (using the access_token)
    await discordSdk.commands.authenticate({
      access_token,
    });

    console.log(`Authenticated as ${profile.username}`);
  
    window.addEventListener('message', handleMessage);
    notifyChildParentIsReady({
      token, 
      profile
    });
  }
  catch(exception)
  {
    console.log(`Authentication failed ${exception}`);
  }
}

async function handleMessage({data: messageData}: MessageEvent<MessageData>) {
  // Bail out if messageData is not an "{}" object
  if (typeof messageData !== 'object' || Array.isArray(messageData) || messageData === null) {
    return;
  }
  const {nonce, event, command, data, args} = messageData;

  function handleSubscribeEvent(eventData) {
    getChildIframe().contentWindow?.postMessage(
      {
        event,
        command: 'DISPATCH',
        data: eventData,
      },
      '*'
    );
  }

  switch (command) {
    case 'NOTIFY_CHILD_IFRAME_IS_READY': {
      notifyChildParentIsReady({
        token, 
        profile
      });
      break;
    }
    case 'SUBSCRIBE': {
      if (event == null) {
        throw new Error('SUBSCRIBE event is undefined');
      }

      discordSdk.subscribe(event, handleSubscribeEvent, args);
      break;
    }
    case 'UNSUBSCRIBE': {
      if (event == null) {
        throw new Error('UNSUBSCRIBE event is undefined');
      }
      discordSdk.unsubscribe(event, handleSubscribeEvent);
      break;
    }
    case 'SET_ACTIVITY': {
      const reply = await discordSdk.commands.setActivity(data as any);
      getChildIframe().contentWindow?.postMessage({nonce, event, command, data: reply}, '*');
      break;
    }
  }
}

function getChildIframe(): HTMLIFrameElement {
  const iframe = document.getElementById('child-iframe') as HTMLIFrameElement | null;
  if (iframe == null) {
    throw new Error('Child iframe not found');
  }
  return iframe;
}

function notifyChildParentIsReady(data: any) {
  const iframe = getChildIframe();
  iframe.contentWindow?.postMessage(
    {
      event: 'READY',
      command: 'DISPATCH',
      data
    },
    '*'
  );
}
