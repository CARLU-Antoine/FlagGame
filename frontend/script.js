document.addEventListener("DOMContentLoaded", function () {
    function build(select) {
        let listItems = "";
        select.querySelectorAll("option").forEach(option => {
            listItems += `
                <li style="background:${option.value}" data-colorval="${option.value}">
                    <span>${option.textContent}</span>
                </li>
            `;
        });
        // Sélection de la première valeur par défaut
        let firstOption = select.querySelector("option");
        let firstColor = firstOption.value;
        let firstText = firstOption.textContent;
        return `
            <div class="color-select">
                <span class="selected-value">${firstText} <span style="background:${firstColor};"></span></span>
                <ul>${listItems}</ul>
            </div>
        `;
    }
    
    document.querySelectorAll("[data-colorselect]").forEach(select => {
        select.style.display = "none"; // Cache le <select>
        select.insertAdjacentHTML("afterend", build(select));
    });
    
    document.addEventListener("click", function (event) {
        let target = event.target;
        // Ouvrir / fermer la liste
        if (target.matches(".color-select > .selected-value")) {
            let ul = target.nextElementSibling;
            document.querySelectorAll(".color-select ul").forEach(list => {
                if (list !== ul) list.style.display = "none"; // Cache les autres listes ouvertes
            });
            ul.style.display = ul.style.display === "block" ? "none" : "block";
        }
        
        // Sélectionner une couleur
        if (target.closest(".color-select li")) {
            let li = target.closest(".color-select li");
            let color = li.getAttribute("data-colorval");
            let colorText = li.querySelector("span").textContent;
            let container = li.closest(".color-select");
            let valueSpan = container.querySelector(".selected-value");
            let select = container.previousElementSibling;
            
            valueSpan.innerHTML = `${colorText} <span style="background:${color};"></span>`;
            container.querySelector("ul").style.display = "none"; // Ferme la liste après sélection
            
            // Mise à jour de la valeur du select
            select.value = color;
            
            // NOUVEAU: Déclencher manuellement l'envoi de la couleur
            envoyerCommandeCouleur(color);
            console.log('Couleur sélectionnée et envoyée:', color);
        }
    });
    
    // Fermer la liste si on clique en dehors
    document.addEventListener("click", function (event) {
        if (!event.target.closest(".color-select")) {
            document.querySelectorAll(".color-select ul").forEach(ul => ul.style.display = "none");
        }
    });
});

// Fonction pour envoyer une commande de couleur personnalisée
function envoyerCommandeCouleur(couleur) {
    // Côté serveur Node.js, dans la section Socket.IO
    socket.on('commande-couleur', (data) => {
        console.log('Commande couleur reçue du client web:', data);
        // Publier la commande sur MQTT
        const colorCommand = JSON.stringify({
            type: 'color',
            value: data.couleur
        });
        mqttClient.publish(drapeauxTopicPublish, colorCommand);
    });
}