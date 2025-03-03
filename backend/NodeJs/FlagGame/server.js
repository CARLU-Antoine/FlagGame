const mqtt = require('mqtt');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

// Configuration du serveur Express
const app = express();
const server = http.createServer(app);

// Middleware CORS pour autoriser les requêtes provenant de votre frontend
app.use(cors({
  origin: 'http://127.0.0.1:5500', // Frontend URL
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Création du serveur WebSocket
const wss = new WebSocket.Server({ server });

// Middleware pour parser le JSON dans les requêtes
app.use(bodyParser.json());

// Servir les fichiers statiques depuis le dossier 'public'
app.use(express.static(path.resolve('/Users/antoinecarlu/Desktop/MASTER/internet of things/projet/frontend/views')));

// URL du broker MQTT
const brokerUrl = 'mqtt://test.mosquitto.org';
const drapeauxTopicPublish = 'drapeaux/commande';
const drapeauxTopicJoueurs = 'drapeaux/joueurs'; 
// Missing topic definition - adding it here
const drapeauxTopicSubscribe = 'drapeaux/etat';

// Se connecter au broker MQTT
const mqttClient = mqtt.connect(brokerUrl);

// État des drapeaux et des joueurs
let etatsDrapeaux = {};
let infoJoueurs = {}; // Object pour garder les infos des joueurs connectés
let joueursConnectes = 0; // Compteur des joueurs connectés

// Connexion au broker MQTT
mqttClient.on('connect', () => {
  console.log('Connecté au broker MQTT');
  
  // S'abonner aux topics
  mqttClient.subscribe(drapeauxTopicSubscribe, (err) => {
    if (!err) {
      console.log(`Abonné au sujet "${drapeauxTopicSubscribe}"`);
    } else {
      console.error('Erreur d\'abonnement:', err);
    }
  });
  
  // Envoyer les infos des joueurs au démarrage
  // Only send if there's actual data
  if (Object.keys(infoJoueurs).length > 0) {
    envoyerInfosJoueurs(infoJoueurs);
  }
});

// Réception des messages MQTT
mqttClient.on('message', (topic, message) => {
  try {
    const messageStr = message.toString();
    console.log(`Message reçu sur ${topic}: ${messageStr}`);
    
    // Si le message concerne l'état d'un drapeau
    if (topic === drapeauxTopicSubscribe) {
      try {
        const etatData = JSON.parse(messageStr);
        etatsDrapeaux["drapeau1"] = etatData;
        
        // Transmettre aux clients WebSocket
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'etat-drapeau',
              id: "drapeau1",
              etat: etatData.etat,
              nom: etatData.nom || "",
              couleur: etatData.etat !== "inactif" ? {
                r: etatData.r,
                g: etatData.g,
                b: etatData.b
              } : null
            }));
          }
        });
      } catch (e) {
        console.error('Erreur lors du parsing du message:', e);
        etatsDrapeaux["drapeau1"] = messageStr;
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'etat-drapeau',
              id: "drapeau1",
              etat: messageStr
            }));
          }
        });
      }
    }
  } catch (err) {
    console.error('Erreur lors du traitement du message MQTT:', err);
  }
});

// Fonction pour envoyer les informations des joueurs via MQTT
function envoyerInfosJoueurs(infoJoueursData) {
  if (!infoJoueursData) {
    console.error('Aucune donnée de joueurs à envoyer');
    return;
  }
  
  const message = JSON.stringify(infoJoueursData);
  console.log('envoyer InfosJoueurs via MQTT', message);
  mqttClient.publish(drapeauxTopicJoueurs, message);
  console.log('Informations des joueurs envoyées:', message);
}

// Gérer les erreurs MQTT
mqttClient.on('error', (err) => {
  console.error('Erreur de connexion MQTT:', err);
});

// Routes API pour mettre à jour les informations des joueurs
app.post('/api/joueurs', (req, res) => {
  try {
    const nouvellesInfos = req.body;
    
    // Mettre à jour les informations des joueurs
    if (nouvellesInfos.joueur1) {
      infoJoueurs.joueur1 = {...infoJoueurs.joueur1, ...nouvellesInfos.joueur1};
    }
    
    if (nouvellesInfos.joueur2) {
      infoJoueurs.joueur2 = {...infoJoueurs.joueur2, ...nouvellesInfos.joueur2};
    }
    
    // Publish the updated player info to MQTT
    envoyerInfosJoueurs(infoJoueurs);
    
    // Informer tous les clients WebSocket des changements
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'info-joueurs',
          data: infoJoueurs
        }));
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Informations des joueurs mises à jour',
      data: infoJoueurs
    });
  } catch (err) {
    console.error('Erreur lors de la mise à jour des joueurs:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des joueurs',
      error: err.message
    });
  }
});

// Route pour obtenir les informations actuelles des joueurs
app.get('/api/joueurs', (req, res) => {
  res.status(200).json(infoJoueurs);
});

// Connexion WebSocket avec les clients
wss.on('connection', (ws) => {
  console.log('Nouveau client WebSocket connecté');
  
  ws.on('message', (data) => {
    try {
      const parsedData = JSON.parse(data);

      // Lorsque le joueur se connecte
      if (parsedData.type === 'nouveau-joueur') {
        const { nom, couleur } = parsedData;
        
        // Ajouter les informations du joueur
        if (joueursConnectes === 0) {
          infoJoueurs.joueur1 = { nom, couleur };
          console.log('le joueur 1 est connecté');
        } else if (joueursConnectes === 1) {
          infoJoueurs.joueur2 = { nom, couleur };
          console.log('le joueur 2 est connecté');
        }
        
        joueursConnectes++;

        // Publish updated player info to MQTT
        envoyerInfosJoueurs(infoJoueurs);

        // Vérifier si les deux joueurs sont connectés
        if (joueursConnectes === 2) {
          // Envoyer une confirmation aux deux joueurs
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'deux-joueurs-connectes'
              }));
            }
          });
        }
      }
    } catch (err) {
      console.error('Erreur lors du traitement du message WebSocket:', err);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log('Client WebSocket déconnecté');
    joueursConnectes = Math.max(0, joueursConnectes - 1);
  });
});

// Démarrer le serveur HTTP
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});