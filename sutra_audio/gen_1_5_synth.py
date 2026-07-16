#!/usr/bin/env python3
"""Sūtra 1.5 — Synth chain version (five-sector mandala).

वृत्तयः पञ्चतय्यः क्लिष्टाक्लिष्टाः
vṛttayaḥ pañcatayyaḥ kliṣṭākliṣṭāḥ
"The movements are fivefold, afflicted and unafflicted"

OSC → VCA (ADSR) → VCF (resonant lowpass) → delay → reverb
Five-sector mandala + Devanagari top.
"""
import base64
import math
import struct
import os
import random
from PIL import Image, ImageDraw, ImageFont

# ─── Sutra → Base64 → Frequency ─────────────────────────────
SUTRA = "वृत्तयः पञ्चतय्यः क्लिष्टाक्लिष्टाः"
UTF8 = SUTRA.encode('utf-8')
B64 = base64.b64encode(UTF8).decode()
B64_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="

notes = []
for c in B64:
    idx = B64_ALPHA.index(c)
    if c != '=':
        notes.append((c, idx, 55 + idx * (1100 - 55) / 63))

padding = sum(1 for c in B64 if c == '=')
byte_count = len(UTF8)
dr = byte_count % 9 or 9  # digital root of byte count
print(f"=== Sūtra 1.5 synth ===")
print(f"UTF-8: {len(UTF8)} bytes | Base64: {len(B64)} ({padding} padding)")
print(f"Notes: {len(notes)} | Freq: {notes[0][2]:.0f}–{notes[-1][2]:.0f} Hz | DR: {dr}")

# ─── SYNTH CHAIN ─────────────────────────────────────────────
SAMPLE_RATE = 22050
NOTE_DUR = 0.40
GAP = 0.06
NUM_NOTES = len(notes)
TOTAL = NUM_NOTES * (NOTE_DUR + GAP)

def synth_params(idx):
    t = idx / 63.0
    saw_mix = 0.5 + 0.5 * math.sin(t * math.pi * 2)
    pulse_width = 0.25 + 0.35 * t
    cutoff_base = 200 + 800 * t
    resonance = 2.0 + 6.0 * t
    attack  = 0.02 + 0.03 * (1 - t)
    decay   = 0.08 + 0.06 * t
    sustain = 0.4 + 0.3 * (1 - t)
    release = 0.12 + 0.15 * t
    delay_time = 0.15 + 0.20 * t
    delay_fb   = 0.25 + 0.20 * t
    reverb_wet = 0.15 + 0.15 * math.sin(t * math.pi)
    return {
        'saw_mix': saw_mix, 'pulse_width': pulse_width,
        'cutoff': cutoff_base, 'resonance': resonance,
        'attack': attack, 'decay': decay, 'sustain': sustain, 'release': release,
        'delay_time': delay_time, 'delay_fb': delay_fb, 'reverb_wet': reverb_wet,
    }

def simple_convolve(audio, kernel):
    out = []
    for i in range(len(audio)):
        s = 0.0
        for j in range(len(kernel)):
            if i - j >= 0:
                s += audio[i - j] * kernel[j]
        out.append(max(-1.0, min(1.0, s)))
    return out

def generate_wav(outpath):
    samples = []
    for n in range(NUM_NOTES):
        c, idx, freq = notes[n]
        p = synth_params(n)
        dur_samples = int((NOTE_DUR + GAP) * SAMPLE_RATE)
        note_samples = int(NOTE_DUR * SAMPLE_RATE)
        gap_samples = dur_samples - note_samples

        attack_s = int(p['attack'] * SAMPLE_RATE)
        decay_s = int(p['decay'] * SAMPLE_RATE)
        release_s = int(p['release'] * SAMPLE_RATE)

        buf = [0.0] * dur_samples
        for i in range(note_samples):
            t = i / SAMPLE_RATE
            # ADSR envelope
            if i < attack_s:
                env = i / attack_s
            elif i < attack_s + decay_s:
                env = p['sustain'] + (1 - p['sustain']) * (1 - (i - attack_s) / decay_s)
            elif i > note_samples - release_s:
                env = (note_samples - i) / release_s * p['sustain']
            else:
                env = p['sustain']
            # Saw wave
            saw = 2 * (t * freq - math.floor(t * freq + 0.5))
            # Pulse wave
            pw_phase = (t * freq) % 1.0
            pulse = 1.0 if pw_phase < p['pulse_width'] else -1.0
            # Mix
            wave = (1 - p['saw_mix']) * pulse + p['saw_mix'] * saw
            # Simple lowpass (moving average)
            cutoff_samples = max(1, int(SAMPLE_RATE / max(100, p['cutoff'])))
            if i >= cutoff_samples:
                wave_avg = 0.0
                for ci in range(cutoff_samples):
                    tt = (i - ci) / SAMPLE_RATE
                    saw_c = 2 * (tt * freq - math.floor(tt * freq + 0.5))
                    pw_c_phase = (tt * freq) % 1.0
                    pulse_c = 1.0 if pw_c_phase < p['pulse_width'] else -1.0
                    wave_avg += (1 - p['saw_mix']) * pulse_c + p['saw_mix'] * saw_c
                wave = wave_avg / cutoff_samples
            buf[i] = wave * env

        # Delay (short tap)
        delay_len = int(p['delay_time'] * SAMPLE_RATE)
        for i in range(delay_len, dur_samples):
            buf[i] += buf[i - delay_len] * p['delay_fb'] * 0.3
        # Simple reverb (long moving average)
        rev_len = min(30, int(p['reverb_wet'] * 100))
        if rev_len > 1:
            rev_buf = [0.0] * dur_samples
            for i in range(rev_len, dur_samples):
                s = sum(buf[max(0, i - rev_len + j)] for j in range(rev_len))
                rev_buf[i] = buf[i] + (s / rev_len) * p['reverb_wet'] * 0.2
            buf = rev_buf
        samples.extend(buf)

    # Normalize
    if samples:
        mx = max(max(samples, key=abs), 1e-9)
        samples = [s / mx * 0.85 for s in samples]

    with open(outpath, 'wb') as f:
        f.write(b'RIFF')
        data_size = len(samples) * 2
        f.write(struct.pack('<I', 36 + data_size))
        f.write(b'WAVEfmt ')
        f.write(struct.pack('<I', 16))
        f.write(struct.pack('<HHIIHH', 1, 1, SAMPLE_RATE, SAMPLE_RATE * 2, 2, 16))
        f.write(b'data')
        f.write(struct.pack('<I', data_size))
        for s in samples:
            val = max(-1, min(1, s))
            f.write(struct.pack('<h', int(val * 32767)))
    print(f"WAV: {outpath} ({len(samples)} samples, {TOTAL:.1f}s)")

# ─── FIVE-VORTEX MANDALA (simultaneous, not sequential) ────
SECTORS = 5
VRttis = ['pramāṇa', 'viparyaya', 'vikalpa', 'nidrā', 'smṛti']

sector_colors = [
    (180, 60, 90),    # pramāṇa — direct cognition
    (210, 100, 60),   # viparyaya — distorted perception
    (80, 160, 180),   # vikalpa — conceptual construction
    (60, 60, 120),    # nidrā — absence/sleep
    (160, 180, 80),   # smṛti — memory
]

def draw_five_vortex(t):
    """Draw the five-vortex mandala at continuous time t (0..1)."""
    W, H = 1280, 720
    img = Image.new('RGB', (W, H), (10, 10, 15))
    draw = ImageDraw.Draw(img)
    cx, cy = W // 2, H // 2 + 10

    # t is continuous 0..1, not discrete note index

    # Five simultaneous spirals, each at different speed/phase
    spiral_params = [
        {'speed': 1.0, 'phase': 0.0,  'width': 2},   # pramāṇa
        {'speed': 0.7, 'phase': 0.4,  'width': 2},   # viparyaya
        {'speed': 1.3, 'phase': 0.8,  'width': 1},   # vikalpa
        {'speed': 0.5, 'phase': 1.2,  'width': 3},   # nidrā
        {'speed': 1.1, 'phase': 1.6,  'width': 2},   # smṛti
    ]

    for s, params in enumerate(spiral_params):
        color = sector_colors[s]
        # Each spiral has independent rotation
        rot_offset = t * params['speed'] * 2 * math.pi + params['phase']

        # Draw spiral trail
        trail_len = 120
        for i in range(trail_len):
            progress = i / trail_len
            # Radius expands from center outward
            base_r = 30 + progress * 320
            # Spiral angle
            angle = rot_offset + i * 0.15 * params['speed']
            # Add subtle oscillation
            osc = math.sin(i * 0.05 + s) * 15
            r = base_r + osc

            x = cx + r * math.cos(angle)
            y = cy + r * math.sin(angle)

            # Fade trail
            alpha = max(0, 1 - progress * 1.2)
            fill = tuple(int(c * alpha) for c in color)

            dot_size = params['width']
            draw.ellipse([x - dot_size, y - dot_size, x + dot_size, y + dot_size], fill=fill)

    # Connection lines between spiral tips
    tips = []
    for s, params in enumerate(spiral_params):
        rot_offset = t * params['speed'] * 2 * math.pi + params['phase']
        r = 30 + 1.0 * 320
        angle = rot_offset + 120 * 0.15 * params['speed']
        tips.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))

    for i in range(len(tips)):
        j = (i + 1) % len(tips)
        draw.line([tips[i], tips[j]], fill=(30, 30, 50), width=1)

    # Center: the field (static)
    draw.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=(200, 180, 140))

    # Outer ring showing 5 kliṣṭāḥ/akliṣṭāḥ quality
    quality_r = 380
    for s in range(SECTORS):
        angle = -math.pi / 2 + s * (2 * math.pi / SECTORS)
        x = cx + quality_r * math.cos(angle)
        y = cy + quality_r * math.sin(angle)
        # Alternate: kliṣṭāḥ (warmer) vs akliṣṭāḥ (cooler)
        q = 'k' if s % 2 == 0 else 'a'
        draw.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(255, 200, 100) if q == 'k' else (100, 200, 255))

    # Top: Devanagari
    try:
        font_top = ImageFont.truetype("/usr/share/fonts/truetype/freefont/FreeSerif.ttf", 26)
    except:
        font_top = ImageFont.load_default()
    draw.text((cx - 310, 25), SUTRA, fill=(220, 200, 180), font=font_top)

    # Bottom: note info (interpolated from continuous t)
    try:
        font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 13)
    except:
        font_sm = ImageFont.load_default()
    note_float = t * (NUM_NOTES - 1)
    note_idx = int(note_float)
    if note_idx < len(notes):
        c, idx, freq = notes[note_idx]
        info = f"{note_idx+1}/{NUM_NOTES} | {c} idx:{idx} {freq:.0f}Hz | DR:{dr}"
    else:
        info = f"DR:{dr} | fivefold"
    draw.text((cx - 120, H - 35), info, fill=(180, 160, 140), font=font_sm)

    return img

def render_video(wavpath, outpath, fps=10):
    frames_dir = '/tmp/npr_frames_1_5'
    os.makedirs(frames_dir, exist_ok=True)
    # Total duration matches audio: TOTAL seconds
    total_frames = int(TOTAL * fps)
    for i in range(total_frames):
        t = i / max(1, total_frames - 1)  # 0..1
        note_idx = int(t * (NUM_NOTES - 1))
        img = draw_five_vortex(note_idx, NUM_NOTES)
        img.save(os.path.join(frames_dir, f'{i:04d}.png'))
    print(f"Frames: {total_frames} @ {fps}fps = {total_frames/fps:.1f}s")
    cmd = (f'ffmpeg -y -r {fps} -i {frames_dir}/%04d.png -i "{wavpath}" '
           f'-c:v libx264 -pix_fmt yuv420p -r {fps} -c:a aac -b:a 128k '
           f'-shortest "{outpath}"')
    os.system(cmd)
    os.system(f'rm -rf {frames_dir}')
    print(f"MP4: {outpath}")

# ─── MAIN ────────────────────────────────────────────────────
OUTDIR = os.path.dirname(os.path.abspath(__file__))
WAV = os.path.join(OUTDIR, 'mp4', '01_05_five_sector.wav')
MP4 = os.path.join(OUTDIR, 'mp4', '01_05_five_sector.mp4')
os.makedirs(os.path.join(OUTDIR, 'mp4'), exist_ok=True)

generate_wav(WAV)
render_video(WAV, MP4, fps=10)
print("Done.")
