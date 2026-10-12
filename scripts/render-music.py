"""Render Emberfall's original metal arena loop, using only synthesized voices.

144 BPM / 16 bars / D minor. Double-tracked distorted guitars, palm-muted
power riffs, bass, and a full drum kit. This is an original composition, with
no samples or third-party music. Every tail wraps around the loop boundary.
Requires Python, numpy, and ffmpeg (libmp3lame); rendering is deterministic.
"""

import json
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np


RATE = 44100
BPM = 144
BEAT = 60 / BPM
BARS = 16
COUNT = round(RATE * BEAT * 4 * BARS)
RNG = np.random.default_rng(68247)
MIX = np.zeros((COUNT, 2), dtype=np.float64)


def add(voice, start, amp=1.0, pan=0.5, room=0.0):
    """Equal-power placement and a small, circular stereo room send."""
    indices = (round(start * RATE) + np.arange(len(voice))) % COUNT
    np.add.at(MIX[:, 0], indices, voice * amp * np.sqrt(1 - pan))
    np.add.at(MIX[:, 1], indices, voice * amp * np.sqrt(pan))
    if room:
        for delay, level, room_pan in [(0.039, 1.0, 0.23), (0.067, 0.7, 0.78)]:
            late = (indices + round(delay * RATE)) % COUNT
            np.add.at(MIX[:, 0], late, voice * amp * room * level * np.sqrt(1 - room_pan))
            np.add.at(MIX[:, 1], late, voice * amp * room * level * np.sqrt(room_pan))


def envelope(t, length, attack=0.0015, release=0.025):
    return (1 - np.exp(-t / attack)) * np.clip((length - t) / release, 0, 1)


def noise_band(length, low, high):
    """Smooth filters avoid the brittle white-noise sound of basic drum synths."""
    count = round(length * RATE)
    frequencies = np.fft.rfftfreq(count, 1 / RATE)
    spectrum = np.fft.rfft(RNG.normal(0, 1, count))
    response = frequencies**2 / (frequencies**2 + low**2)
    response *= 1 / np.sqrt(1 + (frequencies / high) ** 8)
    return np.fft.irfft(spectrum * response, n=count)


def guitar(root, start, length, muted=True, accent=1.0):
    """Two independent string takes through oversampled distortion and a cab.

    Saturation is calculated at 88.2 kHz, then low-passed before decimation.
    Small differences in tuning, pick phase, and timing create double tracking.
    """
    oversampled_count = 2 * round(length * RATE)
    t = np.arange(oversampled_count) / (RATE * 2)
    for take, pan in enumerate((0.075, 0.925)):
        cents = (-3.6 if take == 0 else 3.2) + RNG.uniform(-0.7, 0.7)
        raw = np.zeros_like(t)
        for interval, weight in [(0, 1.0), (7, 0.70), (12, 0.43)]:
            hz = 440 * 2 ** ((root + interval - 69 + cents / 100) / 12)
            # A tiny pitch fall and faster upper-partial decay model a pick attack.
            phase = 2 * np.pi * hz * (t + 0.000045 * (1 - np.exp(-t / 0.011)))
            pick_phase = RNG.uniform(-0.10, 0.10)
            for harmonic in range(1, 15):
                pickup = 0.40 + 0.60 * abs(np.sin(harmonic * np.pi * 0.19))
                decay = np.exp(-t * harmonic * (2.5 if muted else 0.80))
                raw += weight * pickup * decay * np.sin(phase * harmonic + pick_phase) / harmonic**1.34
        raw *= 1 + 0.9 * np.exp(-t / 0.018)
        driven = np.tanh(raw * 4.4 + 0.055) - np.tanh(0.055)
        driven += 0.10 * np.tanh(raw * 1.3)
        frequencies = np.fft.rfftfreq(oversampled_count, 1 / (RATE * 2))
        cabinet = frequencies**2 / (frequencies**2 + 61**2)
        cabinet *= 1 / np.sqrt(1 + (frequencies / 3900) ** 8)
        cabinet *= 1 + 0.38 * np.exp(-((frequencies - 920) / 650) ** 2)
        cabinet *= 1 - 0.32 * np.exp(-((frequencies - 2800) / 560) ** 2)
        filtered = np.fft.irfft(np.fft.rfft(driven) * cabinet, n=oversampled_count)
        body = np.exp(-t / (0.095 if muted else 1.15))
        body *= envelope(t, length, 0.0012, 0.019 if muted else 0.060)
        voice = (filtered * body)[::2]
        offset = (0.0013 if take == 0 else 0.0045) + RNG.uniform(-0.0008, 0.0008)
        add(voice, start + offset, 0.33 * accent, pan, 0.028 if muted else 0.060)


def bass(root, start, length, accent=1.0):
    t = np.arange(round(length * RATE)) / RATE
    hz = 440 * 2 ** ((root - 12 - 69) / 12)
    phase = 2 * np.pi * hz * t
    voice = np.sin(phase) + 0.46 * np.sin(phase * 2) + 0.12 * np.sin(phase * 3)
    voice = 0.73 * np.tanh(voice * 1.65) + 0.27 * np.sin(phase)
    voice *= envelope(t, length, 0.003, 0.022) * np.exp(-t / 0.60)
    add(voice, start, 0.35 * accent)


def kick(start, accent=1.0):
    length = 0.32
    t = np.arange(round(length * RATE)) / RATE
    phase = 2 * np.pi * (46 * t + 96 * 0.022 * (1 - np.exp(-t / 0.022)))
    body = np.sin(phase) * np.exp(-t / 0.093)
    attack = noise_band(length, 1400, 4900) * np.exp(-t / 0.008)
    beater = np.sin(2 * np.pi * 1820 * t) * np.exp(-t / 0.0035)
    voice = (body + 0.21 * attack + 0.12 * beater) * envelope(t, length, 0.0006, 0.025)
    add(voice, start, 0.87 * accent)


def snare(start, accent=1.0):
    length = 0.29
    t = np.arange(round(length * RATE)) / RATE
    phase = 2 * np.pi * (177 * t + 33 * 0.018 * (1 - np.exp(-t / 0.018)))
    body = (np.sin(phase) + 0.42 * np.sin(phase * 1.63)) * np.exp(-t / 0.061)
    wires = noise_band(length, 870, 8900) * np.exp(-t / 0.066)
    transient = noise_band(length, 1700, 7100) * np.exp(-t / 0.010)
    voice = (body * 0.53 + wires * 0.75 + transient * 0.24)
    voice *= envelope(t, length, 0.0007, 0.025)
    add(voice, start, 0.74 * accent, 0.47, 0.13)


def cymbal(start, accent=1.0, kind="hat", pan=0.71):
    length, decay, gain = {
        "hat": (0.12, 0.027, 0.091),
        "open": (0.35, 0.095, 0.080),
        "ride": (0.40, 0.10, 0.059),
        "crash": (1.30, 0.36, 0.165),
    }[kind]
    t = np.arange(round(length * RATE)) / RATE
    metal = sum(np.sin(2 * np.pi * hz * t + RNG.uniform(0, 2 * np.pi))
                for hz in (3621, 4837, 5789, 7133, 8539, 10217)) / 6
    voice = 0.82 * noise_band(length, 3400, 12300) + 0.18 * metal
    voice *= np.exp(-t / decay) * envelope(t, length, 0.0008, 0.035)
    add(voice, start, gain * accent, pan, 0.10)


def tom(start, midi, accent=1.0, pan=0.5):
    length = 0.29
    t = np.arange(round(length * RATE)) / RATE
    hz = 440 * 2 ** ((midi - 69) / 12)
    phase = 2 * np.pi * (hz * t + hz * 0.15 * 0.018 * (1 - np.exp(-t / 0.018)))
    voice = (np.sin(phase) + 0.30 * np.sin(phase * 1.57)) * np.exp(-t / 0.091)
    voice += noise_band(length, 600, 4200) * np.exp(-t / 0.010) * 0.15
    voice *= envelope(t, length, 0.001, 0.030)
    add(voice, start, 0.57 * accent, pan, 0.12)


# Entries are sixteenth-note position, root offset, gate in sixteenths, mute.
# Pedal rhythms, open accents, and a contrasting wide-chord section keep the
# short combat loop moving without a prominent melody competing with effects.
RIFF_A = [(0, 0, 1.5, False), (2, 0, .85, True), (3, 0, .85, True),
          (5, 0, .9, True), (6, 0, 1.2, True), (8, 3, 1.5, False),
          (10, 0, .85, True), (11, 0, .85, True), (13, 0, .9, True),
          (14, 1, 1.6, False)]
RIFF_B = [(0, 0, 1.5, False), (2, 0, .85, True), (3, 0, .85, True),
          (4, 0, 1.5, False), (6, 0, .85, True), (7, 0, .85, True),
          (8, 0, 2.5, False), (11, 0, .85, True), (12, 2, 1.5, False),
          (14, 0, .85, True), (15, 0, .85, True)]
RIFF_WIDE = [(0, 0, 4.0, False), (4, 0, .9, True), (6, 0, .9, True),
             (7, 0, .85, True), (8, 0, 3.1, False), (11, 0, .85, True),
             (12, 0, 1.5, False), (14, 0, .85, True), (15, 0, .85, True)]
ROOTS = [38, 38, 34, 36, 38, 38, 34, 36, 38, 34, 41, 36, 38, 38, 34, 36]

for bar, root in enumerate(ROOTS):
    start = bar * 4 * BEAT
    wide = 8 <= bar < 12
    riff = RIFF_WIDE if wide else (RIFF_A if bar % 4 < 2 else RIFF_B)
    for step, interval, gate, muted in riff:
        # Only the D pedal bars use the tense flat-second/minor-third motif.
        offset = interval if root == 38 else 0
        position = start + step * BEAT / 4
        length = max(0.095, gate * BEAT / 4)
        accent = (0.90 if muted else 1.04) * (1 + RNG.uniform(-0.035, 0.035))
        guitar(root + offset, position, length, muted, accent)
        bass(root + offset, position, length, 0.87 if muted else 1.0)

    kick_steps = [0, 3, 6, 8, 10, 11, 14] if not wide else [0, 2, 6, 7, 8, 11, 14]
    for step in kick_steps:
        kick(start + step * BEAT / 4, 1.0 if step in (0, 8) else 0.84)
    for step in (4, 12):
        snare(start + step * BEAT / 4, 1.0)
    if bar % 2 == 1 and bar % 4 != 3:
        snare(start + 11 * BEAT / 4, 0.20)

    for step in range(0, 16, 2):
        kind = "ride" if wide else ("open" if step == 14 else "hat")
        cymbal(start + step * BEAT / 4, 1.0 if step % 4 == 0 else 0.72, kind)
    if bar in (0, 4, 8, 10, 12):
        cymbal(start, 0.93, "crash", 0.25 if bar % 8 == 0 else 0.80)
    if bar % 4 == 3:
        snare(start + 13 * BEAT / 4, 0.47)
        tom(start + 14 * BEAT / 4, 50, 0.83, 0.33)
        tom(start + 15 * BEAT / 4, 43, 0.96, 0.72)
        kick(start + 15 * BEAT / 4, 0.69)


# Remove subsonic rumble with a circular filter, retaining bass fundamentals.
frequencies = np.fft.rfftfreq(COUNT, 1 / RATE)
highpass = frequencies**2 / (frequencies**2 + 24**2)
MIX = np.fft.irfft(np.fft.rfft(MIX, axis=0) * highpass[:, None], n=COUNT, axis=0)


def master(drive):
    compressed = np.tanh(MIX * drive)
    return compressed * (0.78 / max(1e-9, np.max(np.abs(compressed))))


# Modest bus saturation brings the music to a predictable background level.
# Keep ample peak headroom for the game's simultaneous combat sounds and for
# small MP3 reconstruction overshoots. Do not hard-limit drum transients.
low, high = 0.001, 6.0
for _ in range(30):
    middle = (low + high) / 2
    candidate = master(middle)
    if np.sqrt(np.mean(candidate**2)) < 0.225:
        low = middle
    else:
        high = middle
audio = master((low + high) / 2)
audio *= min(1.0, 0.225 / np.sqrt(np.mean(audio**2)))

target = Path(__file__).resolve().parents[1] / "dist/assets/arena-theme.mp3"
target.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as temporary:
    wav_path = Path(temporary) / "emberfall-metal.wav"
    for attempt in range(2):
        with wave.open(str(wav_path), "wb") as output:
            output.setnchannels(2)
            output.setsampwidth(2)
            output.setframerate(RATE)
            output.writeframes(np.round(audio * 32767).astype("<i2").tobytes())
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path),
            "-codec:a", "libmp3lame", "-q:a", "2", "-write_xing", "1",
            "-metadata", "title=Emberfall - Iron and Embers",
            "-metadata", "comment=Original synthesized metal arena loop; 144 BPM",
            str(target),
        ], check=True)
        decoded_bytes = subprocess.run([
            "ffmpeg", "-v", "error", "-i", str(target), "-f", "f32le",
            "-acodec", "pcm_f32le", "-ac", "2", "-ar", str(RATE), "-",
        ], check=True, capture_output=True).stdout
        decoded = np.frombuffer(decoded_bytes, dtype="<f4").reshape(-1, 2)
        decoded_peak = float(np.max(np.abs(decoded)))
        if decoded_peak <= 0.85:
            break
        audio *= 0.835 / decoded_peak
    if decoded_peak > 0.85:
        raise RuntimeError(f"Unexpected MP3 reconstruction peak: {decoded_peak:.4f}")

print(json.dumps({
    "path": str(target),
    "seconds": round(COUNT / RATE, 6),
    "decoded_seconds": round(len(decoded) / RATE, 6),
    "bpm": BPM,
    "bars": BARS,
    "channels": 2,
    "pcm_rms": round(float(np.sqrt(np.mean(audio**2))), 4),
    "pcm_peak": round(float(np.max(np.abs(audio))), 4),
    "decoded_rms": round(float(np.sqrt(np.mean(decoded**2))), 4),
    "decoded_peak": round(decoded_peak, 4),
    "clipped_samples": int(np.count_nonzero(np.abs(decoded) >= 1)),
    "bytes": target.stat().st_size,
}, indent=2))
