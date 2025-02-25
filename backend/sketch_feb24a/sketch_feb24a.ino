#include <WiFi.h>
#include <PubSubClient.h> // Bibliothèque MQTT pour ESP32
#include <FastLED.h>
#include <HTTPClient.h>  // Ajoutez cette ligne

// Configuration Wi-Fi
const char *ssid = "Livebox-DE34_exterieur";
const char *password = "N5x479G7PxzCzb5Cts";

// Configuration MQTT
const char* mqtt_server = "test.mosquitto.org"; // Broker MQTT public
const int mqtt_port = 1883;
const char* mqtt_topic_publish = "drapeaux/etat";
const char* mqtt_topic_subscribe = "drapeaux/commande";

// Configuration ThingSpeak (pour la compatibilité avec votre système existant)
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
String etatDrapeau = "inactif"; // inactif, rouge, bleu
unsigned long dernierEnvoi = 0;
const long intervalle = 5000; // Intervalle d'envoi en ms

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
  // Vérifier la connexion WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Connexion WiFi perdue, tentative de reconnexion...");
    connecterWiFi();
  }
  
  // Vérifier la connexion MQTT et reconnecter si nécessaire
  if (!client.connected()) {
    reconnecterMQTT();
  }
  client.loop();
  
  // Gestion des boutons
  if (digitalRead(bouton1) == LOW) {
    Serial.println("Bouton 1 appuyé : DRAPEAU ROUGE");
    etatDrapeau = "rouge";
    allumerLEDs(CRGB(255, 0, 0)); // Rouge
    publierEtat();
    delay(500);
  } else if (digitalRead(bouton2) == LOW) {
    Serial.println("Bouton 2 appuyé : DRAPEAU BLEU");
    etatDrapeau = "bleu";
    allumerLEDs(CRGB(0, 0, 255)); // Bleu
    publierEtat();
    delay(500);
  } else if (etatDrapeau != "inactif") {
    // Si aucun bouton n'est appuyé mais un drapeau était actif
    etatDrapeau = "inactif";
    eteindreLEDs();
    publierEtat();
  }
  
  // Envoi périodique de l'état à ThingSpeak (compatibilité)
  unsigned long maintenant = millis();
  if (maintenant - dernierEnvoi >= intervalle) {
    dernierEnvoi = maintenant;
    
    if (etatDrapeau == "rouge") {
      envoyerDonnees("field3", "rouge");
    } else if (etatDrapeau == "bleu") {
      envoyerDonnees("field4", "bleu");
    } else {
      envoyerDonnees("field5", "inactif");
    }
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
  
  // Traitement des commandes reçues
  if (message == "rouge") {
    etatDrapeau = "rouge";
    allumerLEDs(CRGB(255, 0, 0));
  } else if (message == "bleu") {
    etatDrapeau = "bleu";
    allumerLEDs(CRGB(0, 0, 255));
  } else if (message == "inactif" || message == "off") {
    etatDrapeau = "inactif";
    eteindreLEDs();
  }
}

void publierEtat() {
  client.publish(mqtt_topic_publish, etatDrapeau.c_str());
  Serial.print("État publié: ");
  Serial.println(etatDrapeau);
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
      
      // S'abonner au topic de commande
      client.subscribe(mqtt_topic_subscribe);
      Serial.print("Abonné au topic: ");
      Serial.println(mqtt_topic_subscribe);
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