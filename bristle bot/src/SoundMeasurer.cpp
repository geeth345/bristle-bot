#include <SoundMeasurer.h>
#include <Arduino.h>
#include <mic.h>

// roughly based on the example from the Seeed studio mic library

// settings for nrf52840
#define DEBUG 0                   // no debugging "pin pulse during isr" idk what that means
#define SAMPLES 800               // Number of samples to caputure

// config
mic_config_t mic_config
{
    .channel_cnt = 1,
    .sampling_rate = 16000,
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
    Serial.println("Resuming recording");
    Mic.resume();

    // Wait until recording is ready
    while (!record_ready) {
        delay(20);
    }
    Mic.pause();
    Serial.println("Done recording");

    //Serial.println("Finished sampling");
    
    // // Print all the samples
    // for (int i = 0; i < SAMPLES; i++) {
    //   Serial.println(recording_buf[i]);
    // }

    // average the samples
    int16_t sum = 0;
    for (int i = 0; i < SAMPLES; i++) {
        sum += abs(recording_buf[i]);
    }
    int16_t average = sum / SAMPLES;
    Serial.print("Sound Average: ");
    Serial.println(average);


    
    // Reset flag
    record_ready = false;
    

    // // Small delay before starting the next recording
    // delay(1000);

    //Serial.println("Starting next sampling...");
}
