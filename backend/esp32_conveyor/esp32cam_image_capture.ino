#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>

// ================= CONFIGURATION =================
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Replace with your laptop's Local IP
const String serverIp = "10.10.182.59"; 
const int serverPort = 3000;

// The endpoint for raw JPEG frames from ESP32-CAM
const String serverUrl = "http://" + serverIp + ":" + String(serverPort) + "/api/esp32-cam/frame?deviceId=ESP32-CAM-01";

// AI Thinker ESP32-CAM Pin Definition
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

void setup() {
  Serial.begin(115200);
  
  // Wi-Fi Connection
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");

  // Camera Configuration
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG; 

  // Image Quality & Size
  if(psramFound()){
    config.frame_size = FRAMESIZE_VGA; // 640x480 for decent AI analysis
    config.jpeg_quality = 12; // 0-63 (Lower means higher quality)
    config.fb_count = 1;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  // Initialize Camera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }
  
  // Flip image if needed (depending on how you mount it)
  // sensor_t * s = esp_camera_sensor_get();
  // s->set_vflip(s, 1);
  // s->set_hmirror(s, 1);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    
    // Capture Frame
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      delay(1000);
      return;
    }
    
    Serial.println("Captured a frame. Sending to backend...");

    HTTPClient http;
    http.begin(serverUrl);
    // Important: Sending as raw JPEG binary
    http.addHeader("Content-Type", "image/jpeg");
    http.addHeader("x-device-id", "ESP32-CAM-01"); // Authenticate as our device

    // Send HTTP POST with the frame buffer
    int httpResponseCode = http.POST(fb->buf, fb->len);
    
    if (httpResponseCode > 0) {
      Serial.print("HTTP Response: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("Error sending POST: ");
      Serial.println(httpResponseCode);
    }
    
    http.end();
    
    // Free the frame buffer to prevent memory leaks
    esp_camera_fb_return(fb);
    
  } else {
    Serial.println("WiFi Disconnected");
  }

  // Send 1 frame every 5 seconds (change based on your conveyor speed)
  delay(5000); 
}