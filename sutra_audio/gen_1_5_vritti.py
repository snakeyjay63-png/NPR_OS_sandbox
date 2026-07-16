#!/usr/bin/env python3
"""
Sūtra 1.5 — Vṛtti-Dynamic Mandala

वृत्तयः पञ्चतय्यः क्लिष्टाक्लिष्टाः
vṛttayaḥ pañcatayyaḥ kliṣṭākliṣṭāḥ
"The movements are fivefold, afflicted and unafflicted"

Every note belongs to a vṛtti sector.
Vṛtti determines tempo, movement quality, visual behavior.
Not continuous animation — each note ADDS to the field.

Vṛtti movement qualities:
  pramāṇa   — direct, clear, steady     (medium speed, straight)
  viparyaya — distorted, erratic         (fast, twisting)
  vikalpa   — conceptual, fragmented     (fast, staccato dots)
  nidrā     — sleep, heavy, fading       (slow, drifting)
  smṛti     — memory, recall, return     (medium, spirals inward)
"""

import base64, math, struct, os, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ─── Sutra → Base64 → Notes ───
SUTRA = "वृत्तयः पञ्चतय्यः क्लिष्टाक्लिष्टाः"
UTF8 = SUTRA.encode('utf-8')
B64 = base64.b64encode(UTF8).decode()
B64_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="

notes = []
for c in B64:
    idx = B64_ALPHA.index(c)
    if c != '=':
        notes.append((c, idx, 55 + idx * (1100 - 55) / 63))

N = len(notes)
padding = sum(1 for c in B64 if c == '=')
dr = len(UTF8) % 9 or 9

print(f"=== Sūtra 1.5 — Vṛtti-Dynamic ===")
print(f"Notes: {N} | DR: {dr} | Padding: {padding}")

# ─── Vṛtti Assignment ───
# Divide notes into 5 sectors (not equal — follows the sutra structure)
VRttis = [
    ("pramāṇa",   "direct",   (180, 60, 90),   1.0),   # steady
    ("viparyaya", "distorted",(210, 100, 60),  1.6),   # fast, erratic
    ("vikalpa",   "concept",  (80, 160, 180),   1.4),   # fast, fragmented
    ("nidrā",     "sleep",    (60, 60, 120),    0.5),   # slow, heavy
    ("smṛti",     "memory",   (160, 180, 80),   0.8),   # medium, return
]

def assign_vritti(note_idx):
    """Assign each note to a vṛtti based on position"""
    sector_size = N / 5
    sector = int(note_idx / sector_size) % 5
    return VRttis[sector]

def vritti_note_duration(vritti_name, base_dur=0.35):
    """Vṛtti determines note duration"""
    speed_mult = {
        "pramāṇa": 1.0,
        "viparyaya": 0.65,  # fast
        "vikalpa": 0.7,     # fast
        "nidrā": 1.8,       # slow
        "smṛti": 1.2,       # medium-slow
    }
    return base_dur * speed_mult.get(vritti_name, 1.0)

# Compute per-note durations
note_durations = []
cumulative_times = [0]
for i, (c, idx, freq) in enumerate(notes):
    vritti = assign_vritti(i)
    dur = vritti_note_duration(vritti[0])
    note_durations.append(dur)
    cumulative_times.append(cumulative_times[-1] + dur + 0.04)  # 40ms gap

TOTAL_TIME = cumulative_times[-1]
print(f"Total time: {TOTAL_TIME:.1f}s (variable tempo)")

# Show tempo distribution
for name, eng, color, _ in VRttis:
    count = sum(1 for i in range(N) if assign_vritti(i)[0] == name)
    dur = vritti_note_duration(name)
    print(f"  {name} ({eng}): {count} notes @ {dur:.2f}s each = {count * dur:.1f}s")

# ─── Audio: Variable Tempo Synth ───
SAMPLE_RATE = 44100

def generate_note_variable(freq, duration, sr, vritti_name, note_idx):
    """Synth with vṛtti-specific character"""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    
    # Base: sine + harmonic
    signal = np.sin(2 * np.pi * freq * t)
    
    # Vṛtti modifications
    if vritti_name == "pramāṇa":
        # Clear, pure — minimal modification
        signal += np.sin(2 * np.pi * freq * 2 * t) * 0.15
    elif vritti_name == "viparyaya":
        # Distorted — wave folding
        signal = np.tanh(signal * 2)
        # Add detuned copy
        signal += np.sin(2 * np.pi * freq * 1.05 * t) * 0.3
    elif vritti_name == "vikalpa":
        # Fragmented — staccato pulses
        pulse = (np.sin(2 * np.pi * 8 * t) > 0).astype(float)
        signal = signal * (0.5 + 0.5 * pulse)
        signal += np.sin(2 * np.pi * freq * 3 * t) * 0.1
    elif vritti_name == "nidrā":
        # Sleep — sub-octave, muffled
        signal *= 0.5
        signal += np.sin(2 * np.pi * freq * 0.5 * t) * 0.4
        # Heavy low-pass (smooth)
        if len(signal) > 10:
            smoothed = np.zeros_like(signal)
            smoothed[0] = signal[0]
            for j in range(1, len(signal)):
                smoothed[j] = 0.15 * signal[j] + 0.85 * smoothed[j-1]
            signal = smoothed
    elif vritti_name == "smṛti":
        # Memory — echo effect
        signal += np.sin(2 * np.pi * freq * t - 2) * 0.25  # delayed copy
        signal += np.sin(2 * np.pi * freq * 1.5 * t) * 0.1
    
    # ADSR envelope
    attack_s = int(0.02 * sr)
    release_s = int(0.1 * sr)
    if vritti_name == "nidrā":
        release_s = int(0.3 * sr)  # longer release for sleep
    
    env = np.ones(len(t))
    if attack_s > 0:
        env[:attack_s] = np.linspace(0.1, 1.0, attack_s)
    if release_s > 0 and release_s < len(t):
        env[-release_s:] = np.linspace(1.0, 0.0, release_s)
    
    # Exponential decay
    decay = np.exp(-2 * t / duration)
    env = env * decay
    
    signal = signal * env
    
    gap_samples = int(0.04 * sr)
    signal = np.concatenate([signal, np.zeros(gap_samples)])
    
    return signal

# Generate audio
print("Synthesizing with variable tempo...")
all_samples = []
for i, (c, idx, freq) in enumerate(notes):
    vritti = assign_vritti(i)
    dur = note_durations[i]
    note = generate_note_variable(freq, dur, SAMPLE_RATE, vritti[0], i)
    all_samples.append(note)

audio = np.concatenate(all_samples)
audio = audio / (np.max(np.abs(audio)) * 1.1)
print(f"Audio: {len(audio)/SAMPLE_RATE:.1f}s, {len(audio)} samples")

# Write WAV
OUTDIR = os.path.dirname(os.path.abspath(__file__))
WAV = os.path.join(OUTDIR, 'mp4', '01_05_five_sector.wav')
os.makedirs(os.path.join(OUTDIR, 'mp4'), exist_ok=True)

with open(WAV, 'wb') as f:
    f.write(b'RIFF')
    data_size = len(audio) * 2
    f.write(struct.pack('<I', 36 + data_size))
    f.write(b'WAVEfmt ')
    f.write(struct.pack('<I', 16))
    f.write(struct.pack('<HHIIHH', 1, 1, SAMPLE_RATE, SAMPLE_RATE * 2, 2, 16))
    f.write(b'data')
    f.write(struct.pack('<I', data_size))
    samples_int = np.int16(audio * 32767)
    f.write(samples_int.tobytes())

print(f"WAV: {WAV} ({os.path.getsize(WAV)/1024:.0f}KB)")

# ─── Vṛtti-Dynamic Visualization ───
# Each note ADDS a visual element. Speed determined by vṛtti.
# Not continuous animation — discrete note events.

W, H = 1280, 720
CX, CY = W // 2, H // 2 + 15
MAX_R = 300

def vritti_angle_speed(vritti_name, note_idx, frame_t):
    """Each vṛtti has different angular movement"""
    speeds = {
        "pramāṇa": 0.5,      # steady
        "viparyaya": 2.0,     # fast, erratic
        "vikalpa": 1.5,       # fast, fragmented
        "nidrā": 0.2,         # very slow
        "smṛti": -0.7,        # reverse (return/recall)
    }
    base = speeds.get(vritti_name, 0.5)
    # Add note-specific offset
    angle = (note_idx / N) * 2 * math.pi + frame_t * base
    return angle

def vritti_radius_behavior(vritti_name, freq, note_idx, frame_t, note_active):
    """Each vṛtti has different radius behavior"""
    base_r = 40 + ((freq - 55) / 1045) * (MAX_R - 40)
    
    if vritti_name == "pramāṇa":
        # Steady, fixed position
        return base_r
    elif vritti_name == "viparyaya":
        # Erratic oscillation
        return base_r + math.sin(frame_t * 4 + note_idx) * 40
    elif vritti_name == "vikalpa":
        # Fragmented — jumps between positions
        jump = math.floor(frame_t * 3 + note_idx * 0.5) % 3
        return base_r + (jump - 1) * 50
    elif vritti_name == "nidrā":
        # Fading inward
        fade = max(0.3, 1 - frame_t * 0.1)
        return base_r * fade
    elif vritti_name == "smṛti":
        # Spiraling inward (memory recall)
        spiral = math.exp(-frame_t * 0.15)
        return base_r * (0.3 + 0.7 * spiral)
    return base_r

# Pre-compute note timing
note_start_times = cumulative_times[:-1]
note_end_times = cumulative_times[1:]

# Generate frames
FPS = 15
TOTAL_FRAMES = int(TOTAL_TIME * FPS)
frames = []

print(f"Rendering {TOTAL_FRAMES} frames @ {FPS}fps...")

# Persistent trail: each note leaves a trace
# trail[note_idx] = list of (x, y, alpha) positions
trails = [[] for _ in range(N)]

for frame in range(TOTAL_FRAMES):
    frame_t = frame / FPS
    
    img = Image.new('RGB', (W, H), '#08080f')
    draw = ImageDraw.Draw(img)
    
    # Draw faint sector boundaries
    for s in range(5):
        angle_s = -math.pi/2 + s * (2 * math.pi / 5)
        angle_e = -math.pi/2 + (s + 1) * (2 * math.pi / 5)
        color = tuple(c // 8 for c in VRttis[s][2])
        for r in range(60, MAX_R + 40, 20):
            pts = []
            for a_deg in range(int(math.degrees(angle_s)), int(math.degrees(angle_e)) + 1, 5):
                a = math.radians(a_deg)
                pts.append((CX + r * math.cos(a), CY + r * math.sin(a)))
            if len(pts) >= 2:
                draw.line(pts, fill=color, width=1)
    
    # Draw sector labels
    devanagari_font = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf", 14)
    latin_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    
    sector_labels = ["प्रमाण", "वपर्याय", "विकल्प", "निद्रा", "स्मृति"]
    for s in range(5):
        angle = -math.pi/2 + s * (2 * math.pi / 5) + (math.pi / 5)
        r = MAX_R + 50
        x = CX + r * math.cos(angle)
        y = CY + r * math.sin(angle)
        color = VRttis[s][2]
        try:
            draw.text((int(x - 20), int(y - 8)), sector_labels[s], fill=color, font=devanagari_font)
            draw.text((int(x - 20), int(y + 10)), VRttis[s][1], fill=(130, 130, 150), font=latin_font)
        except:
            draw.text((int(x - 20), int(y - 8)), VRttis[s][0], fill=color, font=latin_font)
    
    # Draw each note
    for i in range(N):
        c, idx, freq = notes[i]
        vritti = assign_vritti(i)
        vritti_name, vritti_eng, color, _ = vritti
        
        # Is this note active?
        is_active = note_start_times[i] <= frame_t < note_end_times[i]
        is_past = frame_t >= note_end_times[i]
        
        if not is_active and not is_past:
            continue
        
        # Compute position based on vṛtti
        angle = vritti_angle_speed(vritti_name, i, frame_t)
        
        if is_active:
            note_local_t = frame_t - note_start_times[i]
            note_progress = note_local_t / note_durations[i]
            radius = vritti_radius_behavior(vritti_name, freq, i, note_local_t, True)
            
            # Bright when active
            brightness = 1.0 if note_progress < 0.3 else max(0.4, 1 - note_progress)
            fill = tuple(int(c * brightness) for c in color)
            dot_r = 6
        else:
            # Faded trace
            elapsed_since = frame_t - note_end_times[i]
            brightness = max(0.08, 0.4 - elapsed_since * 0.01)
            fill = tuple(int(c * brightness) for c in color)
            radius = vritti_radius_behavior(vritti_name, freq, i, frame_t, False)
            dot_r = 3
        
        x = CX + radius * math.cos(angle)
        y = CY + radius * math.sin(angle)
        
        # Draw dot with glow
        if is_active:
            # Glow ring
            for r in range(dot_r + 4, dot_r, -1):
                glow_fill = tuple(int(c * 0.2) for c in color)
                draw.ellipse([x - r, y - r, x + r, y + r], fill=glow_fill)
        
        draw.ellipse([x - dot_r, y - dot_r, x + dot_r, y + dot_r], fill=fill)
        
        # Active note: draw connection line to center
        if is_active:
            draw.line([(CX, CY), (x, y)], fill=tuple(c // 3 for c in color), width=1)
        
        # Vṛtti-specific visual: trails
        if vritti_name == "viparyaya" and is_active:
            # Chaotic trails
            for trail_i in range(3):
                ta = angle + trail_i * 0.3
                tr = radius + trail_i * 15
                tx = CX + tr * math.cos(ta)
                ty = CY + tr * math.sin(ta)
                draw.ellipse([tx - 1, ty - 1, tx + 1, ty + 1], fill=tuple(c // 2 for c in color))
        elif vritti_name == "vikalpa" and is_active:
            # Fragmented dots around main position
            for frag_i in range(5):
                fa = angle + frag_i * 0.4
                fr = radius + (frag_i - 2) * 10
                fx = CX + fr * math.cos(fa)
                fy = CY + fr * math.sin(fa)
                draw.ellipse([fx - 1, fy - 1, fx + 1, fy + 1], fill=tuple(c // 2 for c in color))
        elif vritti_name == "smṛti" and is_active:
            # Spiral trail (memory recall path)
            for sp in range(8):
                sp_t = sp * 0.2
                sp_a = angle - sp_t
                sp_r = radius * (0.3 + 0.7 * (sp / 8))
                sx = CX + sp_r * math.cos(sp_a)
                sy = CY + sp_r * math.sin(sp_a)
                alpha = sp / 8
                draw.ellipse([sx - 1, sy - 1, sx + 1, sy + 1], 
                           fill=tuple(int(c * alpha * 0.5) for c in color))
    
    # Center dot — the field (static witness)
    draw.ellipse([CX - 3, CY - 3, CX + 3, CY + 3], fill=(200, 180, 140))
    
    # Top: Sutra text
    try:
        font_top = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf", 22)
    except:
        font_top = ImageFont.load_default()
    draw.text((CX - 320, 15), SUTRA, fill=(220, 200, 180), font=font_top)
    
    # Bottom: current note info + vṛtti
    font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 12)
    
    # Find active note
    active_note = None
    for i in range(N):
        if note_start_times[i] <= frame_t < note_end_times[i]:
            active_note = i
            break
    
    if active_note is not None:
        c, idx, freq = notes[active_note]
        vritti = assign_vritti(active_note)
        info = f"{active_note+1}/{N} | {c} idx:{idx} {freq:.0f}Hz | ● {vritti[0]} ({vritti[1]})"
        color = vritti[2]
    else:
        info = f"DR:{dr} | fivefold"
        color = (180, 180, 180)
    
    draw.text((100, H - 30), info, fill=color, font=font_sm)
    
    # Progress bar
    progress = frame_t / TOTAL_TIME
    bar_w = int(W * 0.6 * progress)
    draw.rectangle([W//2 - W//4, H - 10, W//2 - W//4 + bar_w, H - 2], fill=(100, 100, 200))
    
    frames.append(img)
    
    if frame % 50 == 0:
        print(f"  Frame {frame}/{TOTAL_FRAMES} ({frame/FPS:.1f}s)")

# Save frames
tmp_dir = os.path.join(OUTDIR, "tmp_1_5_vritti")
os.makedirs(tmp_dir, exist_ok=True)
for fi, img in enumerate(frames):
    img.save(os.path.join(tmp_dir, f"frame_{fi:04d}.png"))

# Encode
MP4 = os.path.join(OUTDIR, 'mp4', '01_05_five_sector.mp4')
cmd = [
    "ffmpeg", "-y",
    "-framerate", str(FPS),
    "-i", os.path.join(tmp_dir, "frame_%04d.png"),
    "-i", WAV,
    "-c:v", "libx264", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-shortest", MP4
]
result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode != 0:
    print(f"FFMPEG ERROR: {result.stderr}")
else:
    print(f"MP4: {MP4} ({os.path.getsize(MP4)/1024/1024:.1f}MB)")

# Cleanup
for f in os.listdir(tmp_dir):
    os.remove(os.path.join(tmp_dir, f))
os.rmdir(tmp_dir)

# ─── Final Analysis ───
print(f"\n=== Vṛtti-Dynamic Summary ===")
print(f"Total: {N} notes over {TOTAL_TIME:.1f}s")
for name, eng, color, _ in VRttis:
    sector_notes = [i for i in range(N) if assign_vritti(i)[0] == name]
    sector_time = sum(note_durations[i] for i in sector_notes) + len(sector_notes) * 0.04
    avg_dur = sum(note_durations[i] for i in sector_notes) / len(sector_notes)
    print(f"  {name:12s} ({eng:10s}): {len(sector_notes):3d} notes | {avg_dur:.2f}s avg | {sector_time:.1f}s total")
print(f"\nTempo range: {min(note_durations):.2f}s (fastest) → {max(note_durations):.2f}s (slowest)")
print(f"Speed ratio: {max(note_durations)/min(note_durations):.1f}x")
