import io from 'socket.io-client'
import { useState, useEffect, useRef } from 'react'
import CryptoJS from 'crypto-js';

const socket = io("server_ip");

function App() {

  const [message, setMessage] = useState('')
  const[messages, setMessages] = useState([])
  const messagesEndRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault();

    let messageToSend = ''
    if(message === ''){
      messageToSend = '( ͡° ͜ʖ ͡°)'
    }else if(message === 'Lenny'){
      messageToSend = '( ⚆ _ ⚆ )'
    }else if(message === 'Madrid'){
      messageToSend = 'ヾ(o◕ω ◕)ﾉ'
    }

    const encryptedMessage = CryptoJS.AES.encrypt(messageToSend, 'your-secret-key').toString();

    const newMessage = {
      body: messageToSend,
      from: "Me"
    }

    setMessages([... messages, newMessage])
    socket.emit('message', encryptedMessage)
    setMessage('')
  }

  useEffect(() => {
    socket.on('message', reciveMessage);
    
    return() => {
      socket.off('message', reciveMessage);
    }
  }, []);

  const reciveMessage = (message) => {
    console.log(message)

    const decryptedMessage = CryptoJS.AES.decrypt(message.body, 'your-secret-key').toString(CryptoJS.enc.Utf8);
    const nMss = {
      body: decryptedMessage,
      from: message.from
    }
    setMessages((state) => [...state, nMss])
    
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
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
                  className={`my-2 p-2 table text-sm rounded-md ${message.from == 'Me' ? 'bg-sky-700 ml-auto' : 'bg-black'}`}>
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

export default App
