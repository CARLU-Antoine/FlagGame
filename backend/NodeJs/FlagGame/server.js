const mqtt = require('mqtt');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Configuration du serveur Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Servir les fichiers statiques depuis le dossier 'public'
app.use(express.static('public'));

// URL du broker MQTT
const brokerUrl = 'mqtt://test.mosquitto.org';
const drapeauxTopicPublish = 'drapeaux/commande';
const drapeauxTopicSubscribe = 'drapeaux/etat';

// Se connecter au broker MQTT
const mqttClient = mqtt.connect(brokerUrl);

// État des drapeaux
let etatsDrapeaux = {};

// Connexion au broker MQTT
mqttClient.on('connect', () => {
  console.log('Connecté au broker MQTT');
  
  // S'abonner au topic des drapeaux
  mqttClient.subscribe(drapeauxTopicSubscribe, (err) => {
    if (!err) {
      console.log(`Abonné au sujet "${drapeauxTopicSubscribe}"`);
    } else {
      console.error('Erreur d\'abonnement:', err);
    }
  });
});

// Réception des messages MQTT
mqttClient.on('message', (topic, message) => {
  const messageStr = message.toString();
  console.log(`Message reçu sur ${topic}: ${messageStr}`);
  
  // Si le message concerne l'état d'un drapeau
  if (topic === drapeauxTopicSubscribe) {
    // On pourrait avoir un identifiant pour chaque ESP32/drapeau
    // Pour l'exemple, on utilise juste un "drapeau1"
    etatsDrapeaux["drapeau1"] = messageStr;
    
    // Transmettre aux clients web via Socket.IO
    io.emit('etat-drapeau', { id: "drapeau1", etat: messageStr });
  }
});

// Gérer les erreurs MQTT
mqttClient.on('error', (err) => {
  console.error('Erreur de connexion MQTT:', err);
});

// Connexion Socket.IO avec les clients web
io.on('connection', (socket) => {
  console.log('Nouveau client web connecté');
  
  // Envoyer l'état actuel des drapeaux au nouveau client
  socket.emit('etats-drapeaux', etatsDrapeaux);
  
  // Écouter les commandes du client web
  socket.on('commande-drapeau', (data) => {
    console.log('Commande reçue du client web:', data);
    
    // Publier la commande sur MQTT
    mqttClient.publish(drapeauxTopicPublish, data.commande);
  });
    // Ajouter dans votre code serveur, dans la section "Écouter les commandes du client web"
  socket.on('commande-couleur', (data) => {
    console.log('Commande couleur reçue du client web:', data);
    // Publier la commande sur MQTT avec un format spécifique
    // On utilise un format JSON pour distinguer les commandes de couleur des autres commandes
    const colorCommand = JSON.stringify({
        type: 'color',
        value: data.couleur
    });
    mqttClient.publish(drapeauxTopicPublish, colorCommand);
  });

  socket.on('disconnect', () => {
    console.log('Client web déconnecté');
  });
});


// Démarrer le serveur HTTP
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});