#include "Communication.h"

#include <Arduino.h>
#include <ArduinoBLE.h>

#include <vector>

static BLEAdvertisingData advData;
static volatile uint8_t pos_x;
static volatile uint8_t pos_y;
static volatile uint8_t battery_level;
static volatile uint8_t sound_level;

std::vector<uint8_t> create_manuf_data_packet()
{
    std::vector<uint8_t> out = std::vector<uint8_t>(6);
    out[0] = 0xFF;
    out[1] = 0xFF;
    out[2] = pos_x;
    out[3] = pos_y;
    out[4] = battery_level;
    out[5] = sound_level;
    return out;
}

void set_manuf_data()
{
    std::vector<uint8_t> data = create_manuf_data_packet();
    advData.setManufacturerData(data.data(), data.size());
}

void setupCommunication()
{

    pos_x = 0;
    pos_y = 0;
    battery_level = 255;
    sound_level = 0;

    advData.setLocalName("BristleBot"); // <-- This line is important
    set_manuf_data();
}

void advertiseBLE()
{
    Serial.println("Advertising BLE...");
    pos_x++;

    // Create a custom advertisement packet

    set_manuf_data();
    BLE.setAdvertisingData(advData);

    if (!BLE.advertise())
    {
        Serial.println("Error Setting advertisement");
    }
}

void update_position(uint8_t x, uint8_t y)
{
    pos_x = x;
    pos_y = y;
}

void update_battery_level(uint8_t level)
{
    battery_level = level;
}

void update_sound(uint8_t level)
{
    sound_level = level;
}

void stopAdvertiseBLE()
{

    Serial.println("End Advertising...");

    BLE.stopAdvertise();
}