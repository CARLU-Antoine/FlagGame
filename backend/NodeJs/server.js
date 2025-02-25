// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuration
const PORT = process.env.PORT || 3000;
const THINGSPEAK_CHANNEL_ID = '2855292'; // À compléter
const THINGSPEAK_READ_API_KEY = 'ANGEVJVWNCIHLX7Y'; // À compléter
const UPDATE_INTERVAL = 5000;

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Route principale
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Route API pour obtenir les dernières données
app.get('/api/led-data', async (req, res) => {
  try {
    const data = await fetchThingSpeakData();
    res.json(data);
  } catch (error) {
    console.error('Erreur lors de la récupération des données:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des données' });
  }
});

// Fonction pour récupérer les données de ThingSpeak
async function fetchThingSpeakData() {
  try {
    const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds/last.json?api_key=${THINGSPEAK_READ_API_KEY}`;
    const response = await axios.get(url);
    
    if (response.status === 200) {
      // Traitement des données ThingSpeak
      const data = response.data;
      return {
        timestamp: data.created_at,
        leds: [
          { name: 'LED 1', color: { r: parseInt(data.field1) || 0, g: 0, b: 0 } },
          { name: 'LED 2', color: { r: 0, g: parseInt(data.field2) || 0, b: 0 } },
          { name: 'LED 3', color: { r: 0, g: 0, b: parseInt(data.field3) || 0 } },
          { name: 'LED 4', color: { r: parseInt(data.field4) || 0, g: parseInt(data.field4) || 0, b: 0 } }
        ]
      };
    } else {
      throw new Error('Erreur lors de la récupération des données ThingSpeak');
    }
  } catch (error) {
    console.error('Erreur lors de la communication avec ThingSpeak:', error);
    throw error;
  }
}

// Mettre en place la connexion WebSocket
io.on('connection', (socket) => {
  console.log('Nouvelle connexion WebSocket établie');
  
  // Envoyer les données initiales au client
  fetchThingSpeakData()
    .then(data => socket.emit('led-data-update', data))
    .catch(err => console.error('Erreur initiale:', err));
  
  socket.on('disconnect', () => {
    console.log('Client déconnecté');
  });
});

// Fonction pour mettre à jour et diffuser périodiquement les données
function startDataUpdates() {
  setInterval(async () => {
    try {
      const data = await fetchThingSpeakData();
      io.emit('led-data-update', data);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des données:', error);
    }
  }, UPDATE_INTERVAL);
}

// Démarrer le serveur
server.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  startDataUpdates();
});