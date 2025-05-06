#pragma once

#include <cstdint>

void setupCommunication();
void advertiseBLE();
void stopAdvertiseBLE();

void update_position(uint8_t x, uint8_t y);
void update_battery_level(uint8_t level);
void update_sound(uint8_t level);