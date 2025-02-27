const timerElement = document.getElementById("timer"); //Lien avec la div concerné dans l'HTML, timerElement y sera affiché
const FirstSquad = document.getElementById("FirstSquad");
const SecondSquad = document.getElementById("SecondSquad");

let temps = 5, settingMinutes = 0 ; //à combien de minute le timer commence initialement, et à combien de minutes commence la valeur parametré en option
let visibility = "visible"; //Le minuteur est en visible par défaut
let manualFlashing = false, stopped = false, manualColoring = false; //Déterminera si l'utilisateur à activer l'option de clignotement, et déterminera si l'utilisateur met le minuteur en stop
const timerModif = document.getElementById("minute");
let firstSquadScore = 0;
let secondSquadScore = 0;


setInterval(() => {
  let resultTemps = temps + (settingMinutes*60); //Additionne le temps initial découlé par le Timer avec le temps modifié par l'utilisateur
  let minutes = parseInt(resultTemps / 60, 10), secondes = parseInt(resultTemps % 60, 10); //Passage d'une chaîne de caractère à un entier (+ ajout/retrait du temps paramètré en option)
  minutes = minutes < 10 && resultTemps >= 0 ? "0" + minutes : resultTemps >= -59 && minutes <= 0 ? "-" + minutes : minutes;  //Met un 0 devant les minutes si elle ne sont pas des dizaines/nombres
  secondes = resultTemps >= 0 ? secondes < 10 ? "0" + secondes : secondes : secondes*(-1) < 10 ? "0" + secondes*(-1) : secondes*(-1) //Met un 0 devant les secondes si elle ne sont pas des dizaines/nombres & permet que les secondes ne soit pas affiché en négatif si le temps est négatif
  timerElement.innerText = `${(minutes)}:${secondes}`;
  FirstSquad.innerText = `${firstSquadScore}`;
  SecondSquad.innerText = `${secondSquadScore}`;

  temps = stopped ? temps : temps - 1; //Si l'utilisateur affecte la valeur stopped à true, le temps reste là où il en est, sinn il prend +1
  //timerModif.innerText = `${settingMinutes}`; //Passage du type number à string pour l'affichage dans la div HTML

  if(resultTemps <= 0){ stopped = true,  timerElement.innerHTML = "<div>Résultat:</div><div><button type='submit' class='button-6' id='quitButton'>Recommencer</button></div>",
    document.getElementById("quitButton").addEventListener("click", function() {
      temps = 5; //Le temps repart à zéro & les minutes
      stopped = false;
    });
  }
  if(resultTemps == 41*60+2 && manualColoring == true || manualFlashing == true/*40x60sec pour 40 min (+1 car il y a un retard d'une ou deux seconde à rattraper) */) visibility = "hidden";
  document.getElementById("timer").style.visibility = visibility; //Rend le text invisible si la variable "visibility" a été mis en hidden par l'utilisateur OU par le second échelon automatique
  setTimeout((()=>document.getElementById("timer").style.visibility = "visible"),500); //Rend le texte visible une demi-seconde après avoir été rendu invisible, ce qui donne un effet de clignotement
}, 1000)