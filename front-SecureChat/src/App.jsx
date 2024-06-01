import io from 'socket.io-client'; // Importa la biblioteca para la conexión con el servidor Socket.io
import { useState, useEffect, useRef } from 'react'; // Importa hooks de React
import CryptoJS from 'crypto-js'; // Importa la biblioteca CryptoJS para cifrado

//Se obtienen ip y puerto del servidor del .env
const SERVER_IP = import.meta.env.VITE_REACT_APP_SERVER_IP;
const SERVER_PORT = import.meta.env.VITE_REACT_APP_SERVER_PORT;

//Inicializa la conexión Socket.io con el servidor
const socket = io(`http://${SERVER_IP}:${SERVER_PORT}`);

//Se genera un par de claves, se usa el algoritmo de Diffie-Hellman de curva elíptica P-256
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

//Exporta la clave del cliente
async function exportKey(key) {
  return window.crypto.subtle.exportKey("raw", key);
}

//Importa la clave del servidor
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
  const [message, setMessage] = useState(''); //Mensaje actual en el input
  const [messages, setMessages] = useState([]); //Lista de mensajes en la conversación
  const [sharedSecret, setSharedSecret] = useState(''); //Clave secreta compartida
  const messagesEndRef = useRef(null); //Referencia para el final de la lista de mensajes

  useEffect(() => {
    let clientPublicKey, clientPrivateKey, clientKeyPair;
    let serverPublicKey;


    async function negotiateKeys() {
      clientKeyPair = await generateKeyPair(); //Genera un par de claves ECDH
      clientPublicKey = await exportKey(clientKeyPair.publicKey); //Exporta la clave pública
      socket.emit('client-public-key', clientPublicKey); //Envía la clave pública al servidor
    }

    //Cuando el cliente se conecta, negocia las claves
    socket.on('connect', negotiateKeys);

    // Importa la clave pública del servidor y la almacena
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

  // Maneja el envío de mensajes
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

  // Maneja la recepción de mensajes
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
