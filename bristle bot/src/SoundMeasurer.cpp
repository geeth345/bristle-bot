#include <SoundMeasurer.h>
#include <Arduino.h>
#include <mic.h>
#include <Communication.h>
#include <Locomotion.h>

// roughly based on the example from the Seeed studio mic library

// settings for nrf52840
#define DEBUG 0                   // no debugging "pin pulse during isr" idk what that means
#define SAMPLES 800               // Number of samples to caputure
#define SAMPLE_MILLIS 2000        // How often to sample

// config
mic_config_t mic_config
{
    .channel_cnt = 1,
    .sampling_rate = 16000, // sampling rate can only be 16000 or 41667
    .buf_size = 1600,
    .debug_pin = LED_BUILTIN
};

// mic instance
NRF52840_ADC_Class Mic(&mic_config);

int16_t recording_buf[SAMPLES];
volatile uint8_t recording = 0;
volatile static bool record_ready = false;


// Callback function for audio data - from the example
static void audio_rec_callback(uint16_t *buf, uint32_t buf_len) {
    static uint32_t idx = 0;
    
    // Copy samples from DMA buffer to our recording buffer
    for (uint32_t i = 0; i < buf_len; i++) {
      recording_buf[idx++] = buf[i];
      
      // Check if we've filled our recording buffer
      if (idx >= SAMPLES) { 
        idx = 0;
        record_ready = true;
        break;
      }
    }
}

void setupSoundLevel()
{
    Mic.set_callback(audio_rec_callback);

    if (!Mic.begin()) {
        Serial.println("Microphone init failed");
        while (1) {
            digitalWrite(LED_BUILTIN, HIGH);
            delay(50);
            digitalWrite(LED_BUILTIN, LOW);
            delay(200);
        }
    }

    Mic.pause(); // pause so callback does't run constantly

    Serial.println("Microphone init done");
}

void updateSoundLevel()
{   

    static unsigned long lastSample = 0;
    if (millis() - lastSample < SAMPLE_MILLIS)
    {
        return;
    }
    lastSample = millis();

    Serial.println("Resuming Recording, pausing motors ");
    Locomotion::stopMotors();
    delay(200); // wait for motors to stop
    Mic.resume();

    // Wait until recording is ready
    unsigned long startTime = millis();
    while (!record_ready) {
      if (millis() - startTime > 500) {
          Serial.println("Measurement timed out");
          recording = 0;
            Mic.pause();
            return;
        }
        delay(1);
    }

    Mic.pause();
    Serial.println("Done recording, resuming motors ");
    Locomotion::resumeMotors();

    //Serial.println("Finished sampling");
    
    // // Print all the samples
    // for (int i = 0; i < SAMPLES; i++) {
    //   Serial.println(recording_buf[i]);
    // }

    // average the samples
    int32_t sum = 0;
    for (int i = 0; i < SAMPLES; i++) {
        sum += abs(recording_buf[i]); // amplitude
    }
    uint8_t average = constrain(sum / SAMPLES, 0, 255);
    Serial.print("Sound Average: ");
    Serial.println(average);

    // update the sound level
    Comms::update_sound(average);

    
    // Reset flag
    record_ready = false;
    

    // // Small delay before starting the next recording
    // delay(1000);

    //Serial.println("Starting next sampling...");
}
