#include "Communication.h"

#include <Arduino.h>
#include <ArduinoBLE.h>

#include <vector>

namespace Comms
{

    static uint8_t pos_x;
    static uint8_t pos_y;
    static uint8_t heading;
    static uint8_t battery_level;
    static uint8_t sound_level;

    static const char *LOCAL_NAME = "BristleBot";

    std::vector<uint8_t> create_manuf_data_packet()
    {
        std::vector<uint8_t> out = std::vector<uint8_t>(7);
        out[0] = 0xFF;
        out[1] = 0xFF;
        out[2] = pos_x;
        out[3] = pos_y;
        out[4] = heading;
        out[5] = battery_level;
        out[6] = sound_level;
        return out;
    }

    BLEAdvertisingData set_manuf_data()
    {
        BLEAdvertisingData packet;
        std::vector<uint8_t> data = create_manuf_data_packet();
        packet.setLocalName(LOCAL_NAME);
        packet.setManufacturerData(data.data(), data.size());
        return packet;
    }

    void setupCommunication()
    {

        pos_x = 0;
        pos_y = 0;
        heading = 0;
        battery_level = 255;
        sound_level = 0;
    }

    void advertiseBLE()
    {
        Serial.println("Advertising BLE...");

        // Create a custom advertisement packet

        BLEAdvertisingData data = set_manuf_data();
        BLE.setAdvertisingData(data);

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

    void update_heading(uint8_t h)
    {
        heading = h;
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

}