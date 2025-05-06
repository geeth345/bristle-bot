#include "Communication.h"

#include <Arduino.h>
#include <ArduinoBLE.h>

static BLEAdvertisingData advData;

void setupCommunication() {
    
    advData.setLocalName("BristleBot"); // <-- This line is important
    advData.setManufacturerData((uint8_t *)"\x00\x01\x02\x03\x04\x05", 6);
    

}

void advertiseBLE() {
    Serial.println("Advertising BLE...");

    // Create a custom advertisement packet
    
    BLE.setAdvertisingData(advData);

    if (!BLE.advertise()) {
        Serial.println("Error Setting advertisement");
    }


    
}

void stopAdvertiseBLE() {

    Serial.println("End Advertising...");
    
    BLE.stopAdvertise();

}