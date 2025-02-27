// Connexion à WebSocket
const socket = new WebSocket('ws://localhost:3000'); // Assurez-vous que votre serveur écoute bien sur ce port
let nameValue;
let colorValue;

document.getElementById("myForm").addEventListener("submit", function (event) {
  event.preventDefault(); // Empêche l'envoi par défaut du formulaire

  nameValue = document.getElementById("name").value.trim();
  colorValue = document.getElementById("data-colorselect").value;

  if (nameValue === "") {
    alert("Veuillez entrer un pseudo.");
    return;
  }

  console.log("Nom saisi :", JSON.stringify({
    type: "nouveau-joueur",
    nom: nameValue,
    couleur: colorValue,
  }));

  // Envoi des données via WebSocket
  socket.send(
    JSON.stringify({
      type: "nouveau-joueur",
      nom: nameValue,
      couleur: colorValue,
    })
  );

  document.querySelector("#btn-validation-connexion").style.display = "none";
  document.querySelector("#loader").style.display = "block";
});

// Événements WebSocket
socket.addEventListener("open", () => {
  console.log("Connecté au serveur WebSocket");
});

socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  console.log("Données reçues:", data);

  if (data.type === "confirmation") {
    alert(`Bienvenue ${data.nom}, votre couleur a bien été enregistrée !`);
  }

  // Si les deux joueurs sont connectés
  if (data.type === "deux-joueurs-connectes") {
    console.log("Les deux joueurs sont connectés");

    // Rediriger vers la page du jeu
    window.location.href = `./game.html?nameValue=${encodeURIComponent(nameValue)}&colorValue=${encodeURIComponent(colorValue)}`;
  }
});

// Gestion des erreurs WebSocket
socket.addEventListener("error", (error) => {
  console.error("Erreur WebSocket :", error);
});

socket.addEventListener("close", () => {
  console.log("Connexion WebSocket fermée.");
});
