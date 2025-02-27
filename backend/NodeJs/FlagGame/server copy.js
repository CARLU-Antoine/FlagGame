const mqtt = require('mqtt');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const path = require('path');

// Configuration du serveur Express
const app = express();
const server = http.createServer(app);

// Création du serveur WebSocket
const wss = new WebSocket.Server({ server });

// Middleware pour parser le JSON dans les requêtes
app.use(bodyParser.json());

// Servir les fichiers statiques depuis le dossier 'public'
app.use(express.static(path.resolve('/Users/antoinecarlu/Desktop/MASTER/internet of things/projet/frontend/views')));


// URL du broker MQTT
const brokerUrl = 'mqtt://test.mosquitto.org';
const drapeauxTopicPublish = 'drapeaux/commande';
const drapeauxTopicSubscribe = 'drapeaux/etat';
const drapeauxTopicJoueurs = 'drapeaux/joueurs'; // Nouveau topic pour les infos des joueurs

// Se connecter au broker MQTT
const mqttClient = mqtt.connect(brokerUrl);

// État des drapeaux et des joueurs
let etatsDrapeaux = {};
let infoJoueurs = {
  joueur1: {
    nom: "Joueur 1",
    r: 255,
    g: 0,
    b: 0
  },
  joueur2: {
    nom: "Joueur 2",
    r: 0,
    g: 0,
    b: 255
  }
};

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
  envoyerInfosJoueurs();
});

// Réception des messages MQTT
mqttClient.on('message', (topic, message) => {
  try {
    const messageStr = message.toString();
    console.log(`Message reçu sur ${topic}: ${messageStr}`);
    
    // Si le message concerne l'état d'un drapeau
    if (topic === drapeauxTopicSubscribe) {
      try {
        // Essayer de parser le message JSON
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
        // Essayer de traiter comme une chaîne simple pour rétrocompatibilité
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
function envoyerInfosJoueurs() {
  const message = JSON.stringify(infoJoueurs);
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
    
    // Envoyer les nouvelles informations au broker MQTT
    envoyerInfosJoueurs();
    
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


app.post('/api/reset', (req, res) => {
  // Réinitialiser les informations des joueurs
  infoJoueurs = {
    joueur1: {
      nom: "Joueur 1",
      r: 255,
      g: 0,
      b: 0
    },
    joueur2: {
      nom: "Joueur 2",
      r: 0,
      g: 0,
      b: 255
    }
  };

  // Réinitialiser l'état des drapeaux
  etatsDrapeaux = {};

  // Envoyer les nouvelles informations aux clients WebSocket
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'reset',
        infoJoueurs,
        etatsDrapeaux
      }));
    }
  });

  // Envoyer les nouvelles informations via MQTT
  envoyerInfosJoueurs();

  res.status(200).json({
    success: true,
    message: 'Partie réinitialisée',
    data: { infoJoueurs, etatsDrapeaux }
  });
});

// Connexion WebSocket avec les clients
wss.on('connection', (ws) => {
  console.log('Nouveau client WebSocket connecté');
  
  // Envoyer l'état actuel des drapeaux au nouveau client
  ws.send(JSON.stringify({
    type: 'etats-drapeaux',
    data: etatsDrapeaux
  }));
  
  // Envoyer les informations des joueurs au nouveau client
  ws.send(JSON.stringify({
    type: 'info-joueurs',
    data: infoJoueurs
  }));
  
  // Écouter les commandes du client WebSocket
  ws.on('message', (data) => {
    const parsedData = JSON.parse(data);
    if (parsedData.type === 'commande-drapeau') {
      console.log('Commande reçue du client WebSocket:', parsedData);
      // Publier la commande sur MQTT
      mqttClient.publish(drapeauxTopicPublish, parsedData.commande);
    }
    
    if (parsedData.type === 'update-joueur') {
      console.log('Mise à jour joueur reçue:', parsedData);
      
      if (parsedData.joueur === 'joueur1' || parsedData.joueur === 'joueur2') {
        // Mettre à jour les informations du joueur
        infoJoueurs[parsedData.joueur] = {...infoJoueurs[parsedData.joueur], ...parsedData.info};
        
        // Envoyer les nouvelles informations au broker MQTT
        envoyerInfosJoueurs();
        
        // Informer tous les clients
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'info-joueurs',
              data: infoJoueurs
            }));
          }
        });
      }
    }
  });

  ws.on('close', () => {
    console.log('Client WebSocket déconnecté');
  });
});

// Démarrer le serveur HTTP
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
