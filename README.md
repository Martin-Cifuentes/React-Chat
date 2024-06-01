# Secure Chat Application

## Description
Secure Chat is a real-time chat application that employs AES encryption for message security and utilizes the Diffie-Hellman algorithm for secure key exchange between clients. The application is built with React for the front end and uses Node.js and Socket.IO for the server-side communication.

## Prerequisites
Before you begin, ensure you have met the following requirements:

- Node.js: Ensure you have Node.js installed. You can download it from Node.js official website.
- npm: Node Package Manager is included with Node.js. Ensure it is installed and updated.

## Installation
Follow these steps to set up and run the project:

### 1. Clone the Repository

```git clone https://github.com/yourusername/React-chat.git```

### 2. Set Up the Server
Navigate to the server directory and install dependencies:

```cd React-chat```

```npm install```

### 3. Set Up the Client
Navigate to the client directory and install dependencies:

```cd ../front-secureChat```

```npm install```

Create a .env file in the front-secureChat directory and add your server IP and port:

```VITE_REACT_APP_SERVER_IP=[your.server.ip.address]```

```VITE_REACT_APP_SERVER_PORT=4000```

### 4. Run the Server
Navigate to the server directory and start the server:

```cd React-chat```

```npm run dev```

### 5. Run the Client
Open a new terminal window, navigate to the front-secureChat directory, and start the client:

```cd ../front-secureChat```

```npm run dev```

### 6. Access the Application
Open your web browser and navigate to the address provided by the React development server, typically http://localhost:5173.

## Usage

- Enter your message in the input field at the bottom of the chat window.
- Press Enter or click the submit button to send your message.
- Messages will be encrypted using AES and sent through the server.
- The server will broadcast the message to all connected clients after decrypting it using the negotiated key via Diffie-Hellman.

## Security

- AES Encryption: Messages are encrypted using AES before being sent to the server.
- Diffie-Hellman Key Exchange: The encryption key is negotiated securely between clients using the Diffie-Hellman algorithm.
