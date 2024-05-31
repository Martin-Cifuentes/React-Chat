import io from 'socket.io-client';
import { useState, useEffect, useRef } from 'react';
import CryptoJS from 'crypto-js';

const SERVER_IP = import.meta.env.VITE_REACT_APP_SERVER_IP;
const SERVER_PORT = import.meta.env.VITE_REACT_APP_SERVER_PORT;

const socket = io(`http://${SERVER_IP}:${SERVER_PORT}`);

async function generateKeyPair() {
  return await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    ["deriveKey", "deriveBits"]
  );
}

async function exportKey(key) {
  return window.crypto.subtle.exportKey("raw", key);
}

async function importKey(keyData) {
  return window.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

function App() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [sharedSecret, setSharedSecret] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let clientPublicKey, clientPrivateKey, clientKeyPair;
    let serverPublicKey;

    async function negotiateKeys() {
      clientKeyPair = await generateKeyPair();
      clientPublicKey = await exportKey(clientKeyPair.publicKey);
      socket.emit('client-public-key', clientPublicKey);
    }

    socket.on('connect', negotiateKeys);

    socket.on('public-key', async (serverPublicKeyBase64) => {
      serverPublicKey = await importKey(Uint8Array.from(atob(serverPublicKeyBase64), c => c.charCodeAt(0)));
      const sharedSecretBits = await window.crypto.subtle.deriveBits(
        {
          name: "ECDH",
          public: serverPublicKey
        },
        clientKeyPair.privateKey,
        256
      );
      
      const sharedSecret = CryptoJS.enc.Hex.parse(Buffer.from(sharedSecretBits).toString('hex')).toString(CryptoJS.enc.Base64);

      setSharedSecret(sharedSecret);
      console.log(`Shared secret: ${sharedSecret}`);
    });

    socket.on('message', receiveMessage);

    return () => {
      socket.off('public-key');
      socket.off('message', receiveMessage);
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();

    let messageToSend = '';
    if (message === '') {
      messageToSend = '( ⚆ _ ⚆ )';
    } else if (message === 'Lenny') {
      messageToSend = '( ͡° ͜ʖ ͡°)';
    } else if (message === 'Madrid') {
      messageToSend = 'ヾ(o◕ω ◕)ﾉ';
    } else {
      messageToSend = message;
    }

    const encryptedMessage = CryptoJS.AES.encrypt(messageToSend, sharedSecret).toString();

    const newMessage = {
      body: messageToSend,
      from: "Me"
    };

    setMessages([...messages, newMessage]);
    socket.emit('message', { body: encryptedMessage });
    setMessage('');
  }

  const receiveMessage = (encryptedMessage) => {
    const decryptedMessage = CryptoJS.AES.decrypt(encryptedMessage.body, sharedSecret).toString(CryptoJS.enc.Utf8);
    const nMss = {
      body: decryptedMessage,
      from: encryptedMessage.from
    };
    setMessages((state) => [...state, nMss]);
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="h-screen bg-zinc-800 text-white flex items-center justify-center">
      <form onSubmit={handleSubmit} className='bg-zinc-900 p-10 max-w-lg w-full'>
        <h1 className='text-2xl font-bold my-2'>Secure Chat</h1>
        <div className='flex flex-col h-96'>
          <ul className='flex-grow overflow-y-auto'>
            {
              messages.map((message, i) => (
                <li
                  key={i}
                  className={`my-2 p-2 table text-sm rounded-md ${message.from === 'Me' ? 'bg-sky-700 ml-auto' : 'bg-black'}`}>
                  <span className='text-xs text-slate-300 block'>
                    {message.from}
                  </span>
                  <span className='text-md'>
                    {message.body}
                  </span>
                </li>
              ))
            }
            <div ref={messagesEndRef} />
          </ul>
          <div className='mt-4 justify-center'>
            <input type="text" placeholder='write your message'
              className='border-2 border-zinc-500 p-2 w-full text-black'
              onChange={(e) => setMessage(e.target.value)}
              value={message}
            />
          </div>
        </div>
      </form>
    </div>
  )
}

export default App;
