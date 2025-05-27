#pragma once

#include <cstdint>

namespace Comms
{

    // setup communication settings
    void setupCommunication();
    // start advertising on BLE
    void advertiseBLE();
    // stop advertising on BLE
    void stopAdvertiseBLE();

    // update the position on the BLE packet
    void update_position(uint8_t x, uint8_t y);
    // update the heading on the BLE packet
    void update_heading(uint8_t h);
    // update the battery level on the BLE packet
    void update_battery_level(uint8_t level);
    // update the sound level on the BLE packet
    void update_sound(uint8_t level);

}
