const socket = new WebSocket('ws://localhost:3000'); // Assurez-vous que votre serveur écoute bien sur ce port
const urlParams = new URLSearchParams(window.location.search);
const nameValue = urlParams.get('nameValue');
const colorValue = urlParams.get('colorValue');
let scoreJour1 = 0;
let scoreJour2 = 0;

// Fonction pour récupérer les informations des joueurs
function getJoueurs() {
    fetch('http://localhost:3000/api/joueurs')
      .then(response => response.json())
      .then(data => {
        console.log("Informations des joueurs:", data);
  
        // Traitez les informations des joueurs
        if (data.joueur1) {
          document.querySelector("#pseudo-equipe1").textContent = data.joueur1.nom;
        }
        if (data.joueur2) {
            document.querySelector("#pseudo-equipe2").textContent = data.joueur2.nom;
        }
      })
      .catch(error => {
        console.error("Erreur lors de la récupération des informations des joueurs:", error);
      });
  }
  
// Appeler la fonction pour récupérer les informations des joueurs
getJoueurs();

// Événements WebSocket
socket.addEventListener("open", () => {
    console.log("Connecté au serveur WebSocket");
  });
  
  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);


    if(data.etat === "joueur1"){
        scoreJour1 +=1;

        document.querySelector('#scoreFirstSquad').textContent =scoreJour1;
    }

    if(data.etat === "joueur2"){
      scoreJour2 +=1;

      document.querySelector('#scoreSecondSquad').textContent =scoreJour2;
    }
    

  });
  
  // Gestion des erreurs WebSocket
  socket.addEventListener("error", (error) => {
    console.error("Erreur WebSocket :", error);
  });
  
  socket.addEventListener("close", () => {
    console.log("Connexion WebSocket fermée.");
  });


    
  document.querySelector("#btn-quitter").addEventListener("click", () => {
    // Fermer la connexion WebSocket proprement
    socket.close();
    console.log("Connexion WebSocket fermée.");
  
    // Envoyer une requête pour réinitialiser la partie
    fetch('http://localhost:3000/api/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then(data => {
      console.log("Partie réinitialisée :", data);
    })
    .catch(error => {
      console.error("Erreur lors de la réinitialisation :", error);
    });


    window.location.href = `./lobby.html`;
  });
  