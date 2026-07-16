#!/usr/bin/env python3
"""
NPR-OS Sūtra 1.6: क्लिष्टाः प्रज्ञा-विघ्नकाः
"The painful ones are obstacles to clear perception"

74 bytes → 100 Base64 → 99 notes (strip padding)
Digital root: 1 | Visarga: open release
Theme: kliṣṭāḥ (painful) → prajñā-vighñakāḥ (obstacles to perception)
Synth: harsh noise gate → filtered saw + square → dissonant intervals
"""

import struct, math, os, subprocess
import numpy as np
import base64

# ─── Sūtra ───
SUTRA = "क्लिष्टाः प्रज्ञा-विघ्नकाः"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
WAV_PATH = os.path.join(OUTPUT_DIR, "01_06_standard_synth.wav")
MP4_PATH = os.path.join(OUTPUT_DIR, "01_06_standard_synth.mp4")

# ─── Base64 → Notes ───
b64_str = base64.b64encode(SUTRA.encode('utf-8')).decode('ascii')
# Strip padding
b64_chars = [c for c in b64_str if c != '=']
N = len(b64_chars)

B64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
freqs = []
for c in b64_chars:
    idx = B64_MAP.index(c)
    freq = 55 + idx * (1045 / 63)
    freqs.append(freq)

print(f"Sūtra 1.6: {SUTRA}")
print(f"Notes: {N} | Freq range: {min(freqs):.1f}-{max(freqs):.1f} Hz | Mean: {sum(freqs)/len(freqs):.1f} Hz")
print(f"Digital root: 1 | Padding: {len(b64_str) - N}")

# ─── Synth: Harsh → Filtered → Dissonant ───
SAMPLE_RATE = 44100
NOTE_DURATION = 0.35  # slightly faster — tension
GAP = 0.05

def sawtooth(t, f):
    """Sawtooth wave — rich harmonics"""
    x = 2.0 * (f * t - np.floor(f * t + 0.5))
    # Soft clip to avoid harshness
    return np.tanh(x * 0.7)

def square_wave(t, f):
    """Square wave — odd harmonics"""
    return np.sign(np.sin(2 * np.pi * f * t))

def noise_burst(t, decay=0.08):
    """Noise burst for kliṣṭā (painful) texture"""
    noise = np.random.randn(len(t))
    env = np.exp(-t / decay)
    return noise * env * 0.15

def generate_note(freq, duration, sr, note_idx, total_notes):
    """Generate one note with synth chain"""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    
    # Position-based: early = more harsh, late = more resolved
    pos = note_idx / max(total_notes - 1, 1)
    
    # Layer 1: sawtooth (main body)
    saw = sawtooth(t, freq)
    
    # Layer 2: square wave (harmonic thickness)
    sq = square_wave(t, freq) * 0.3
    
    # Layer 3: dissonant minor 2nd (painful tension)
    # Only for first half — kliṣṭāḥ
    if note_idx < total_notes * 0.5:
        dissonant_freq = freq * (16/15)  # minor second
        dissonant = sawtooth(t, dissonant_freq) * 0.15 * (1 - pos)
    else:
        dissonant = np.zeros_like(t)
    
    # Layer 4: noise burst at start (obstacle texture)
    noise = noise_burst(t, decay=0.05 + pos * 0.05)
    
    # Combine
    signal = saw * 0.5 + sq + dissonant + noise
    
    # Envelope: fast attack (tension), slow release
    attack = 0.02
    attack_samples = int(sr * attack)
    env_attack = np.linspace(0.1, 1.0, attack_samples)
    env_rest = np.ones(len(t) - attack_samples) * 0.9
    # Exponential decay
    env_decay = np.exp(-3 * t / duration)
    
    envelope = np.concatenate([env_attack, env_rest])[:len(t)]
    envelope = envelope * env_decay
    
    # Low-pass filter that opens up over time (obstacle → clarity)
    # Simple first-order LP with position-dependent cutoff
    if len(signal) > 1:
        # Smooth the signal to simulate LP
        alpha = 0.3 + pos * 0.4  # more smooth = more filtered early
        filtered = np.zeros_like(signal)
        filtered[0] = signal[0]
        for i in range(1, len(signal)):
            filtered[i] = alpha * signal[i] + (1 - alpha) * filtered[i-1]
        signal = filtered
    
    signal = signal * envelope
    
    # Add gap
    gap_samples = int(sr * GAP)
    signal = np.concatenate([signal, np.zeros(gap_samples)])
    
    return signal

# ─── Generate Full Audio ───
print("Synthesizing...")
all_notes = []
for i, freq in enumerate(freqs):
    note = generate_note(freq, NOTE_DURATION, SAMPLE_RATE, i, N)
    all_notes.append(note)

audio = np.concatenate(all_notes)
audio = audio / (np.max(np.abs(audio)) * 1.1)  # Normalize

total_time = N * (NOTE_DURATION + GAP)
print(f"Total duration: {total_time:.1f}s | Samples: {len(audio)}")

# ─── Write WAV ───
with open(WAV_PATH, 'wb') as f:
    # RIFF header
    f.write(b'RIFF')
    chunk_size = 4 + (8 + 24 + 8 + len(audio) * 2)
    f.write(struct.pack('<I', chunk_size))
    f.write(b'WAVE')
    
    # fmt chunk
    f.write(b'fmt ')
    f.write(struct.pack('<I', 16))  # chunk size
    f.write(struct.pack('<H', 1))  # PCM
    f.write(struct.pack('<H', 1))  # mono
    f.write(struct.pack('<I', SAMPLE_RATE))
    f.write(struct.pack('<I', SAMPLE_RATE * 2))
    f.write(struct.pack('<H', 2))  # block align
    f.write(struct.pack('<H', 16))  # bits per sample
    
    # data chunk
    f.write(b'data')
    f.write(struct.pack('<I', len(audio) * 2))
    samples = np.int16(audio * 32767)
    f.write(samples.tobytes())

print(f"WAV written: {WAV_PATH} ({os.path.getsize(WAV_PATH)/1024:.0f}KB)")

# ─── Mandala Visualization ───
from PIL import Image, ImageDraw, ImageFont
import colorsys

WIDTH, HEIGHT = 1280, 720
CENTER = (WIDTH // 2, HEIGHT // 2)
MAX_RADIUS = 280

def freq_to_hsl(freq):
    """Map frequency to HSL color"""
    h = ((freq - 55) / 1045) * 360
    s = 0.8
    l = 0.35 + 0.35 * ((freq - 55) / 1045)
    return h, s, l

# Create frames
frames = []
frame_duration = 0.3  # 3fps for visualization
total_frames = math.ceil(total_time / frame_duration)

for frame_idx in range(total_frames):
    img = Image.new('RGB', (WIDTH, HEIGHT), '#0a0a0f')
    draw = ImageDraw.Draw(img)
    
    # Background gradient
    for r in range(MAX_RADIUS + 50, 0, -10):
        h, s, l = freq_to_hsl(55 + (r / (MAX_RADIUS + 50)) * 1045)
        color = colorsys.hls_to_rgb(h/360, l, s)
        rgb = tuple(int(c * 255) for c in color)
        draw.ellipse(
            [CENTER[0] - r, CENTER[1] - r, CENTER[0] + r, CENTER[1] + r],
            fill=rgb
        )
    
    # Find which notes are active in this frame
    t_current = frame_idx * frame_duration
    notes_active = []
    for i in range(N):
        note_start = i * (NOTE_DURATION + GAP)
        note_end = note_start + NOTE_DURATION
        if note_start <= t_current < note_end:
            notes_active.append(i)
    
    # Draw active notes as orbiting points
    for i, note_idx in enumerate(notes_active):
        freq = freqs[note_idx]
        h, s, l = freq_to_hsl(freq)
        color = colorsys.hls_to_rgb(h/360, l, s)
        rgb = tuple(int(c * 255) for c in color)
        
        radius = MAX_RADIUS * ((freq - 55) / 1045)
        angle = (note_idx / N) * 2 * math.pi + t_current * 2
        
        x = CENTER[0] + radius * math.cos(angle)
        y = CENTER[1] + radius * math.sin(angle)
        
        # Glow
        for r in range(12, 0, -1):
            alpha = r / 12
            draw.ellipse([x - r, y - r, x + r, y + r], fill=rgb)
        
        # Dissonant indicator for painful notes
        if note_idx < N * 0.5:
            draw.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(255, 50, 50))
    
    # Draw connecting lines for dissonant pairs
    if len(notes_active) >= 2:
        for i in range(len(notes_active) - 1):
            idx1, idx2 = notes_active[i], notes_active[i + 1]
            if idx1 < N * 0.5 and idx2 < N * 0.5:
                r1 = MAX_RADIUS * ((freqs[idx1] - 55) / 1045)
                r2 = MAX_RADIUS * ((freqs[idx2] - 55) / 1045)
                a1 = (idx1 / N) * 2 * math.pi + t_current * 2
                a2 = (idx2 / N) * 2 * math.pi + t_current * 2
                x1, y1 = CENTER[0] + r1 * math.cos(a1), CENTER[1] + r1 * math.sin(a1)
                x2, y2 = CENTER[0] + r2 * math.cos(a2), CENTER[1] + r2 * math.sin(a2)
                draw.line([(x1, y1), (x2, y2)], fill=(255, 100, 100, 128), width=2)
    
    # Sutra text
    devanagari_font = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf", 20)
    draw.text((20, HEIGHT - 40), f"1.6 — {SUTRA}", fill=(200, 200, 220), font=devanagari_font)
    
    # Progress bar
    progress = frame_idx / total_frames
    bar_width = int(WIDTH * 0.6 * progress)
    draw.rectangle([WIDTH // 2 - WIDTH // 4, 20, WIDTH // 2 - WIDTH // 4 + bar_width, 30], 
                   fill=(100, 100, 200))
    
    # Label: kliṣṭā (painful) vs prajñā (perception)
    phase = "kliṣṭāḥ — painful obstacles" if frame_idx < total_frames * 0.5 else "prajñā-vighñakāḥ — blocking perception"
    draw.text((20, 10), phase, fill=(180, 100, 100),
             font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16))
    
    frames.append(img)

# ─── Encode Video ───
if frames:
    tmp_dir = os.path.join(OUTPUT_DIR, "tmp_frames_1_6")
    os.makedirs(tmp_dir, exist_ok=True)
    for fi, img in enumerate(frames):
        img.save(os.path.join(tmp_dir, f"frame_{fi:04d}.png"))
    
    # ffmpeg: frames + audio → mp4
    cmd = [
        "ffmpeg", "-y",
        "-r", str(int(1/frame_duration)),
        "-i", os.path.join(tmp_dir, "frame_%04d.png"),
        "-i", WAV_PATH,
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        MP4_PATH
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    # Cleanup
    for f in os.listdir(tmp_dir):
        os.remove(os.path.join(tmp_dir, f))
    os.rmdir(tmp_dir)
    print(f"MP4 written: {MP4_PATH} ({os.path.getsize(MP4_PATH)/1024/1024:.1f}MB)")

# ─── Post Analysis ───
# Dissonance analysis
dissonant_count = sum(1 for i in range(N) if i < N * 0.5)
resolved_count = N - dissonant_count
print(f"\n=== Sūtra 1.6 Analysis ===")
print(f"Dissonant notes (kliṣṭāḥ): {dissonant_count}")
print(f"Resolved notes (vighñakāḥ): {resolved_count}")
print(f"Ratio: {dissonant_count/resolved_count:.2f}")
print(f"Theme: Painful mental modifications as obstacles to discernment")
