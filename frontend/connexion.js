 // Connexion à Socket.IO
 const socket = io();
        
 // Fonction pour mettre à jour l'affichage de l'état d'un drapeau
 function mettreAJourEtat(id, etat) {
     const etatElement = document.getElementById(`etat-${id}`);
     const texteEtatElement = document.getElementById(`texte-etat-${id}`);
     
     // Supprimer toutes les classes d'état
     etatElement.classList.remove('rouge', 'bleu', 'inactif');
     
     // Ajouter la classe appropriée
     etatElement.classList.add(etat);
     
     // Mettre à jour le texte
     texteEtatElement.textContent = etat.charAt(0).toUpperCase() + etat.slice(1);
     
     // Ajouter un message dans l'historique
     ajouterLog(`Drapeau ${id} est maintenant ${etat}`);
 }
 
 // Fonction pour envoyer une commande
 function envoyerCommande(commande) {
     socket.emit('commande-drapeau', { commande: commande });
     ajouterLog(`Commande envoyée: ${commande}`);
 }

 // Fonction pour envoyer une commande de couleur personnalisée
 function envoyerCommandeCouleur(couleur) {
     socket.emit('commande-couleur', { couleur: couleur });
     ajouterLog(`Commande couleur envoyée: ${couleur}`);
 }

 
 // Fonction pour ajouter un message à l'historique
 function ajouterLog(message) {
     const log = document.getElementById('log');
     const entry = document.createElement('div');
     entry.className = 'log-entry';
     
     const timestamp = new Date().toLocaleTimeString();
     entry.textContent = `[${timestamp}] ${message}`;
     
     log.prepend(entry);
 }
 
 // Écouter les mises à jour d'état
 socket.on('etat-drapeau', (data) => {
     mettreAJourEtat(data.id, data.etat);
 });
 
 // Écouter les états initiaux
 socket.on('etats-drapeaux', (etats) => {
     for (const [id, etat] of Object.entries(etats)) {
         mettreAJourEtat(id, etat);
     }
 });
 
 // Se connecter au serveur
 socket.on('connect', () => {
     ajouterLog('Connecté au serveur');
 });
 
 // Déconnexion
 socket.on('disconnect', () => {
     ajouterLog('Déconnecté du serveur');
 });