#include <WiFi.h>
#include <PubSubClient.h> // Bibliothèque MQTT pour ESP32
#include <FastLED.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> // Ajouté pour gérer les données JSON

// Configuration Wi-Fi
const char *ssid = "CFAINSTA_STUDENTS";
const char *password = "Cf@InSt@-$tUd3nT";

// Configuration MQTT
const char* mqtt_server = "test.mosquitto.org"; // Broker MQTT public
const int mqtt_port = 1883;
const char* mqtt_topic_publish = "drapeaux/etat";
const char* mqtt_topic_subscribe = "drapeaux/commande";
const char* mqtt_topic_joueurs = "drapeaux/joueurs"; // Topic pour les informations des joueurs

// Configuration ThingSpeak
const char *writeAPIKey = "2NMQ56VK7L5MN48P";
const char *server = "http://api.thingspeak.com/update";

// Configuration des LEDs
#define LED_PIN 2 // Broche connectée à Data In
#define NUM_LEDS 2 // Nombre de LEDs
#define BRIGHTNESS 50 // Luminosité (0-255)
CRGB leds[NUM_LEDS];

// Définition des boutons
const int bouton1 = 0; // Bouton BOOT
const int bouton2 = 4; // Deuxième bouton

// Variables d'état
String etatDrapeau = "inactif"; // inactif, joueur1, joueur2
unsigned long dernierEnvoi = 0;
const long intervalle = 5000; // Intervalle d'envoi en ms


unsigned long debutAppuiBouton1 = 0;
unsigned long debutAppuiBouton2 = 0;
bool bouton1Maintenu = false;
bool bouton2Maintenu = false;
const unsigned long dureePression = 3000;


// Informations des joueurs
struct Joueur {
  String nom;
  uint8_t couleurR;
  uint8_t couleurG;
  uint8_t couleurB;
};

Joueur joueur1 = {"Joueur1", 255, 0, 0}; // Rouge par défaut
Joueur joueur2 = {"Joueur2", 0, 0, 255}; // Bleu par défaut

// Clients WiFi et MQTT
WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  pinMode(bouton1, INPUT_PULLUP);
  pinMode(bouton2, INPUT_PULLUP);
  
  Serial.println("\n\n=== DÉMARRAGE DU PROGRAMME ===");
  
  // Configuration des LEDs
  FastLED.addLeds<WS2812B, LED_PIN, RGB>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
  
  // Connexion WiFi
  connecterWiFi();
  
  // Configuration MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Connexion WiFi perdue, tentative de reconnexion...");
    connecterWiFi();
  }

  if (!client.connected()) {
    reconnecterMQTT();
  }
  client.loop();

  unsigned long maintenant = millis();

  // Vérification du bouton 1
  if (digitalRead(bouton1) == LOW) {
    if (debutAppuiBouton1 == 0) {
      debutAppuiBouton1 = maintenant; // Enregistrer le temps du premier appui
    } else if (maintenant - debutAppuiBouton1 >= dureePression && !bouton1Maintenu) {
      Serial.println("Bouton 1 maintenu 5 secondes, point accordé !");
      etatDrapeau = "joueur1";
      allumerLEDs(CRGB(joueur1.couleurR, joueur1.couleurG, joueur1.couleurB));
      publierEtat();
      bouton1Maintenu = true;
    }
  } else {
    debutAppuiBouton1 = 0;
    bouton1Maintenu = false;
  }

  // Vérification du bouton 2
  if (digitalRead(bouton2) == LOW) {
    if (debutAppuiBouton2 == 0) {
      debutAppuiBouton2 = maintenant;
    } else if (maintenant - debutAppuiBouton2 >= dureePression && !bouton2Maintenu) {
      Serial.println("Bouton 2 maintenu 5 secondes, point accordé !");
      etatDrapeau = "joueur2";
      allumerLEDs(CRGB(joueur2.couleurR, joueur2.couleurG, joueur2.couleurB));
      publierEtat();
      bouton2Maintenu = true;
    }
  } else {
    debutAppuiBouton2 = 0;
    bouton2Maintenu = false;
  }
}



// Fonction de rappel pour les messages MQTT reçus
void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.print("Message reçu [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(message);
  
  // Vérifier le topic
  if (String(topic) == mqtt_topic_joueurs) {
    // Traitement des informations des joueurs
    traiterInfosJoueurs(message);
  } else if (String(topic) == mqtt_topic_subscribe) {
    // Traitement des commandes reçues
    if (message == "joueur1") {
      etatDrapeau = "joueur1";
      allumerLEDs(CRGB(joueur1.couleurR, joueur1.couleurG, joueur1.couleurB));
    } else if (message == "joueur2") {
      etatDrapeau = "joueur2";
      allumerLEDs(CRGB(joueur2.couleurR, joueur2.couleurG, joueur2.couleurB));
    } else if (message == "inactif" || message == "off") {
      etatDrapeau = "inactif";
      eteindreLEDs();
    }
  }
}

void traiterInfosJoueurs(String message) {
  // Allocation de la mémoire pour le document JSON
  StaticJsonDocument<256> doc;
  
  // Désérialiser le JSON
  DeserializationError error = deserializeJson(doc, message);
  
  // Vérifier s'il y a une erreur
  if (error) {
    Serial.print("Erreur de décodage JSON: ");
    Serial.println(error.c_str());
    return;
  }
  
  // Mise à jour des informations des joueurs
  if (doc.containsKey("joueur1")) {
    JsonObject j1 = doc["joueur1"];
    if (j1.containsKey("nom")) joueur1.nom = j1["nom"].as<String>();
    
    // Vérifier si le format est avec "couleur" (format hexadécimal)
    if (j1.containsKey("couleur")) {
      String couleurHex = j1["couleur"].as<String>();
      // Convertir couleur hex en RGB
      uint32_t couleur = strtol(couleurHex.substring(1).c_str(), NULL, 16);
      joueur1.couleurR = (couleur >> 16) & 0xFF;
      joueur1.couleurG = (couleur >> 8) & 0xFF;
      joueur1.couleurB = couleur & 0xFF;
    } 
    // Format avec r, g, b séparés (conserver pour la compatibilité)
    else {
      if (j1.containsKey("r")) joueur1.couleurR = j1["r"];
      if (j1.containsKey("g")) joueur1.couleurG = j1["g"];
      if (j1.containsKey("b")) joueur1.couleurB = j1["b"];
    }
    
    Serial.println("Joueur 1 mis à jour: " + joueur1.nom + 
                  " (R:" + String(joueur1.couleurR) + 
                  ", G:" + String(joueur1.couleurG) + 
                  ", B:" + String(joueur1.couleurB) + ")");
  }
  
  if (doc.containsKey("joueur2")) {
    JsonObject j2 = doc["joueur2"];
    if (j2.containsKey("nom")) joueur2.nom = j2["nom"].as<String>();
    
    // Vérifier si le format est avec "couleur" (format hexadécimal)
    if (j2.containsKey("couleur")) {
      String couleurHex = j2["couleur"].as<String>();
      // Convertir couleur hex en RGB
      uint32_t couleur = strtol(couleurHex.substring(1).c_str(), NULL, 16);
      joueur2.couleurR = (couleur >> 16) & 0xFF;
      joueur2.couleurG = (couleur >> 8) & 0xFF;
      joueur2.couleurB = couleur & 0xFF;
    } 
    // Format avec r, g, b séparés (conserver pour la compatibilité)
    else {
      if (j2.containsKey("r")) joueur2.couleurR = j2["r"];
      if (j2.containsKey("g")) joueur2.couleurG = j2["g"];
      if (j2.containsKey("b")) joueur2.couleurB = j2["b"];
    }
    
    Serial.println("Joueur 2 mis à jour: " + joueur2.nom + 
                  " (R:" + String(joueur2.couleurR) + 
                  ", G:" + String(joueur2.couleurG) + 
                  ", B:" + String(joueur2.couleurB) + ")");
  }
}

void publierEtat() {
  // Création d'un document JSON pour l'état
  StaticJsonDocument<128> doc;
  
  doc["etat"] = etatDrapeau;
  if (etatDrapeau == "joueur1") {
    doc["nom"] = joueur1.nom;
    doc["r"] = joueur1.couleurR;
    doc["g"] = joueur1.couleurG;
    doc["b"] = joueur1.couleurB;
  } else if (etatDrapeau == "joueur2") {
    doc["nom"] = joueur2.nom;
    doc["r"] = joueur2.couleurR;
    doc["g"] = joueur2.couleurG;
    doc["b"] = joueur2.couleurB;
  }
  
  // Sérialiser en chaîne JSON
  char buffer[128];
  serializeJson(doc, buffer);
  
  // Publier l'état
  client.publish(mqtt_topic_publish, buffer);
  Serial.print("État publié: ");
  Serial.println(buffer);
}

void allumerLEDs(CRGB couleur) {
  for (int i = 0; i < NUM_LEDS; i++) {
    leds[i] = couleur;
  }
  FastLED.show();
}

void eteindreLEDs() {
  for (int i = 0; i < NUM_LEDS; i++) {
    leds[i] = CRGB(0, 0, 0);
  }
  FastLED.show();
}

void connecterWiFi() {
  Serial.print("Connexion à ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  
  int tentatives = 0;
  while (WiFi.status() != WL_CONNECTED && tentatives < 20) {
    delay(1000);
    Serial.print(".");
    tentatives++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnecté au Wi-Fi!");
    Serial.print("Adresse IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nÉchec de connexion au Wi-Fi");
  }
}

void reconnecterMQTT() {
  while (!client.connected()) {
    Serial.print("Tentative de connexion MQTT...");
    
    // Créer un ID client aléatoire
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("connecté");
      
      // S'abonner aux topics
      client.subscribe(mqtt_topic_subscribe);
      Serial.print("Abonné au topic de commande: ");
      Serial.println(mqtt_topic_subscribe);
      
      client.subscribe(mqtt_topic_joueurs);
      Serial.print("Abonné au topic des joueurs: ");
      Serial.println(mqtt_topic_joueurs);
    } else {
      Serial.print("échec, rc=");
      Serial.print(client.state());
      Serial.println(" nouvelle tentative dans 5 secondes");
      delay(5000);
    }
  }
}

void envoyerDonnees(String typeDonnees, String valeur) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(server) + "?" + "api_key=" + writeAPIKey + "&" + typeDonnees + "=" + valeur;
    
    Serial.println("Envoi des données à ThingSpeak: " + url);
    http.begin(url);
    int httpResponseCode = http.GET();
    
    if (httpResponseCode > 0) {
      Serial.println("Réponse ThingSpeak: " + String(httpResponseCode));
    } else {
      Serial.println("Échec de l'envoi: " + String(httpResponseCode));
    }
    
    http.end();
  } else {
    Serial.println("WiFi non connecté, envoi impossible.");
  }
}