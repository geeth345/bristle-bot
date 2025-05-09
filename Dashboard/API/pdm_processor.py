import numpy as np

class PDMProcessor:
    """
    PDM to dB converter with calibration support
    Processes raw PDM data from nRF52840 microphones
    """
    @staticmethod
    def pdm_to_pcm(data: bytes) -> np.ndarray:
        """
        Convert PDM bitstream to PCM samples
        Args:
            data: Raw PDM bytes from microphone
        Returns:
            Normalized PCM array in range [-1, 1]
        """
        # Convert bytes to bit array
        bits = np.unpackbits(np.frombuffer(data, dtype=np.uint8))
        # Convert bits to float values
        return bits.astype(np.float32) * 2 - 1  # 0→-1, 1→+1

    @staticmethod
    def calculate_dB(signal: np.ndarray, calibration: float = 0.0) -> float:
        """
        Calculate dB SPL from PCM signal with optional calibration offset
        Args:
            signal: PCM samples array
            calibration: Microphone calibration offset in dB
        Returns:
            Sound level in dB SPL
        """
        rms = np.sqrt(np.mean(np.square(signal)))
        return 20 * np.log10(max(rms, 1e-10)) + calibration

    @classmethod
    def process_pdm(cls, data: bytes, calibration: float = 0.0) -> float:
        """
        Complete PDM processing pipeline:
        1. Convert PDM to PCM
        2. Calculate RMS dB
        3. Apply calibration
        """
        pcm = cls.pdm_to_pcm(data)
        return cls.calculate_dB(pcm, calibration)