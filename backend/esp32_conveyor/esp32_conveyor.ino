#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ================= CONFIGURATION =================
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Replace with your laptop's Local IP (e.g., 192.168.1.5)
const String serverIp = "192.168.1.XX"; 
const int serverPort = 3000;
const String batchId = "YOUR_ACTIVE_BATCH_ID"; // You can dynamically fetch this, but hardcoding for testing is faster

const String serverUrl = "http://" + serverIp + ":" + String(serverPort) + "/api/batches/" + batchId + "/stage-sensor-data";

// Sensor Config
const int SENSOR_PIN = 34; // Example Analog/Digital Pin (e.g., IR Sensor or Encoder)

// FreeRTOS Queues & Tasks for High Speed
QueueHandle_t sensorDataQueue;
const int QUEUE_LENGTH = 20; // Buffer up to 20 readings

// Data structure
struct SensorReading {
  float speed;
  float objectCount;
  // Add other variables like weight, etc.
};

void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_PIN, INPUT);

  // Connect to Wi-Fi
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected! IP Address: " + WiFi.localIP().toString());

  // Create a queue for thread-safe data transfer between tasks
  sensorDataQueue = xQueueCreate(QUEUE_LENGTH, sizeof(SensorReading));

  // CORE 1: High-Speed Sensor Reading Task (Priority 2 - Higher)
  xTaskCreatePinnedToCore(
    sensorTask,   /* Task function. */
    "SensorTask", /* name of task. */
    4096,         /* Stack size of task */
    NULL,         /* parameter of the task */
    2,            /* priority of the task */
    NULL,         /* Task handle to keep track of created task */
    1             /* pin task to core 1 */
  );

  // CORE 0: Network Transmission Task (Priority 1 - Lower)
  xTaskCreatePinnedToCore(
    networkTask,   /* Task function. */
    "NetworkTask", /* name of task. */
    8192,          /* Stack size of task */
    NULL,          /* parameter of the task */
    1,             /* priority of the task */
    NULL,          /* Task handle to keep track of created task */
    0              /* pin task to core 0 */
  );
}

void loop() {
  // Empty. Everything is handled by FreeRTOS tasks.
  vTaskDelete(NULL); 
}

// ================= CORE 1: HIGH SPEED SENSOR CAPTURE =================
void sensorTask(void * pvParameters) {
  float currentSpeed = 0.0;
  int objectsDetected = 0;

  for(;;) {
    // 1. READ SENSOR VERY FAST AND ACCURATELY HERE
    // (e.g., read an IR sensor, rotary encoder interrupts, or analog value)
    int rawValue = analogRead(SENSOR_PIN); 

    // --- YOUR CUSTOM CONVEYOR LOGIC HERE ---
    currentSpeed = random(120, 150) / 100.0; // Simulated 1.2 to 1.5 m/s
    objectsDetected++;
    // ---------------------------------------

    SensorReading reading;
    reading.speed = currentSpeed;
    reading.objectCount = objectsDetected;

    // Send to queue for the network task to process
    if (xQueueSend(sensorDataQueue, &reading, pdMS_TO_TICKS(10)) != pdPASS) {
      Serial.println("Queue is full! Dropping reading.");
    }

    // Delay to control sampling rate (e.g., 50ms = 20Hz sampling)
    vTaskDelay(pdMS_TO_TICKS(50)); 
  }
}

// ================= CORE 0: NETWORK TRANSMISSION =================
void networkTask(void * pvParameters) {
  SensorReading incomingReading;

  for(;;) {
    // Wait for data from the sensor task
    if (xQueueReceive(sensorDataQueue, &incomingReading, portMAX_DELAY) == pdPASS) {
      
      if(WiFi.status() == WL_CONNECTED){
        HTTPClient http;
        http.begin(serverUrl);
        http.addHeader("Content-Type", "application/json");

        // Build JSON Payload
        StaticJsonDocument<512> doc;
        doc["stage"] = "Final QC";
        doc["deviceId"] = "ESP32-CONV-01";
        doc["operator"] = "IoT Conveyor Telemetry";

        JsonArray readings = doc.createNestedArray("readings");
        
        // Reading 1: Speed
        JsonObject r1 = readings.createNestedObject();
        r1["name"] = "Conveyor Speed";
        r1["parameter"] = "Conveyor Speed";
        r1["value"] = incomingReading.speed;
        r1["unit"] = "m/s";
        r1["instrument"] = "Speed Encoder";
        r1["result"] = "PASS";

        // Reading 2: Count
        JsonObject r2 = readings.createNestedObject();
        r2["name"] = "Objects Processed";
        r2["parameter"] = "Objects Processed";
        r2["value"] = incomingReading.objectCount;
        r2["unit"] = "count";
        r2["instrument"] = "IR Sensor";
        r2["result"] = "PASS";

        String requestBody;
        serializeJson(doc, requestBody);

        // Send HTTP POST
        int httpResponseCode = http.POST(requestBody);
        
        if (httpResponseCode > 0) {
          Serial.print("HTTP Response: ");
          Serial.println(httpResponseCode);
        } else {
          Serial.print("Error sending POST: ");
          Serial.println(httpResponseCode);
        }
        
        http.end(); // Free resources
      }
    }
  }
}
