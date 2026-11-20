#!/usr/bin/env python3
"""
TTS Voice Generation & Broadcast Mastering Pipeline for Paws Off.

Generates and masters spoken chord/key announcement MP3 clips using Microsoft
Edge Neural TTS (en-US-AvaNeural) and an FFmpeg + K-weighted LUFS mastering
chain so every clip matches in tone, perceived loudness (~-18.45 LUFS), and
peak headroom (-6 dBFS).

Usage examples:
    python3 scripts/generate_voice_clips.py --verify
    python3 scripts/generate_voice_clips.py --list
    uvx --from edge-tts python scripts/generate_voice_clips.py --only bass-3 bass-5 bass-7
    uvx --from edge-tts python scripts/generate_voice_clips.py --custom chord-new "One six."
    uvx --from edge-tts python scripts/generate_voice_clips.py --all
"""

import argparse
import asyncio
import math
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT_DIR = REPO_ROOT / "public" / "voice"
VOICE_CLIPS_TS = REPO_ROOT / "src" / "audio" / "voiceClips.ts"

VOICE = "en-US-AvaNeural"
RATE = "-12%"
PITCH = "-3Hz"
SR = 44100
TARGET_PERCEP = -18.0

# Complete 49-clip catalog matching public/voice/*.mp3 and src/audio/voiceClips.ts.
# Trailing periods produce a natural falling cadence on standalone announcements.
VOICE_CLIPS: list[tuple[str, str]] = [
    # Major keys (12)
    ("key-0", "Key of C major."),
    ("key-1", "Key of D flat major."),
    ("key-2", "Key of D major."),
    ("key-3", "Key of E flat major."),
    ("key-4", "Key of E major."),
    ("key-5", "Key of F major."),
    ("key-6", "Key of F sharp major."),
    ("key-7", "Key of G major."),
    ("key-8", "Key of A flat major."),
    ("key-9", "Key of A major."),
    ("key-10", "Key of B flat major."),
    ("key-11", "Key of B major."),
    # Diatonic triads: number-only + optional quality forms (14)
    ("chord-I", "One."),
    ("chord-I-major", "One major."),
    ("chord-ii-short", "Two."),
    ("chord-ii", "Two minor."),
    ("chord-iii-short", "Three."),
    ("chord-iii", "Three minor."),
    ("chord-IV", "Four."),
    ("chord-IV-major", "Four major."),
    ("chord-V", "Five."),
    ("chord-V-major", "Five major."),
    ("chord-vi-short", "Six."),
    ("chord-vi", "Six minor."),
    ("chord-viio-short", "Seven."),
    ("chord-viio", "Seven diminished."),
    # Diatonic seventh chords (8)
    ("chord-Imaj7", "One major seven."),
    ("chord-ii7", "Two minor seven."),
    ("chord-iii7", "Three minor seven."),
    ("chord-IVmaj7", "Four major seven."),
    ("chord-V7", "Five seven."),
    ("chord-vi7", "Six minor seven."),
    ("chord-viihalfdim7", "Seven half diminished."),
    ("chord-viihalfdim7-m7b5", "Seven minor seven flat five."),
    # Secondary dominants (9)
    ("chord-V-of-ii", "Five of two."),
    ("chord-V-of-iii", "Five of three."),
    ("chord-V-of-V", "Five of five."),
    ("chord-V-of-vi", "Five of six."),
    ("chord-V7-of-ii", "Five seven of two."),
    ("chord-V7-of-iii", "Five seven of three."),
    ("chord-V7-of-IV", "Five seven of four."),
    ("chord-V7-of-V", "Five seven of five."),
    ("chord-V7-of-vi", "Five seven of six."),
    # Inversion & bass-tone suffixes chained onto base chord clips at runtime (6)
    ("inv-1", "first inversion."),
    ("inv-2", "second inversion."),
    ("inv-3", "third inversion."),
    ("bass-3", "third in bass."),
    ("bass-5", "fifth in bass."),
    ("bass-7", "seventh in bass."),
    # Scale-degree bass suffixes (12 chromatic degrees in key)
    ("deg-0", "over degree one."),
    ("deg-1", "over degree sharp one."),
    ("deg-2", "over degree two."),
    ("deg-3", "over degree sharp two."),
    ("deg-4", "over degree three."),
    ("deg-5", "over degree four."),
    ("deg-6", "over degree sharp four."),
    ("deg-7", "over degree five."),
    ("deg-8", "over degree sharp five."),
    ("deg-9", "over degree six."),
    ("deg-10", "over degree flat seven."),
    ("deg-11", "over degree seven."),
    # Solfege bass suffixes using phonetic spellings for accurate AvaNeural pronunciation (12)
    ("solf-0", "over dough."),
    ("solf-1", "over dee."),
    ("solf-2", "over ray."),
    ("solf-3", "over ree."),
    ("solf-4", "over me."),
    ("solf-5", "over fah."),
    ("solf-6", "over fee."),
    ("solf-7", "over soul."),
    ("solf-8", "over see."),
    ("solf-9", "over lah."),
    ("solf-10", "over tay."),
    ("solf-11", "over tea."),
]


def biquad(
    x: list[float],
    b0: float,
    b1: float,
    b2: float,
    a1: float,
    a2: float,
) -> list[float]:
    y = [0.0] * len(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, x0 in enumerate(x):
        y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        y[i] = y0
        x2, x1 = x1, x0
        y2, y1 = y1, y0
    return y


def k_weight(samples: list[float]) -> list[float]:
    """Apply ITU-R BS.1770 pre-filter + RLB high-pass K-weighting at 44.1 kHz."""
    s1 = biquad(
        samples,
        1.5308412300503478,
        -2.6509799951547297,
        1.1690790799215869,
        -1.6636551132560204,
        0.7125954280732254,
    )
    return biquad(
        s1,
        1.0,
        -2.0,
        1.0,
        -1.9891696736297957,
        0.9891990357870394,
    )


def measure(samples: list[float]) -> tuple[float, float, float, float]:
    """Measure gated active LUFS, 85th-percentile frame LUFS, perceptual blend, and peak dBFS."""
    kw = k_weight(samples)
    win = int(0.050 * SR)
    hop = int(0.010 * SR)
    frame_ms: list[tuple[float, float]] = []
    for i in range(0, len(kw) - win, hop):
        seg = kw[i : i + win]
        ms = sum(s * s for s in seg) / win
        db = -0.691 + 10.0 * math.log10(max(ms, 1e-12))
        frame_ms.append((ms, db))
    abs_gated = [m for m, d in frame_ms if d > -42.0]
    if not abs_gated:
        abs_gated = [m for m, _ in frame_ms]
    ungated_db = -0.691 + 10.0 * math.log10(
        max(sum(abs_gated) / max(1, len(abs_gated)), 1e-12)
    )
    gate_db = max(-42.0, ungated_db - 10.0)
    speech_ms = [m for m, d in frame_ms if d > gate_db]
    speech_dbs = sorted(d for _, d in frame_ms if d > gate_db)
    kw_act = -0.691 + 10.0 * math.log10(
        max(sum(speech_ms) / max(1, len(speech_ms)), 1e-12)
    )
    kw_p85 = speech_dbs[int(0.85 * (len(speech_dbs) - 1))] if speech_dbs else kw_act
    percep = 0.50 * kw_act + 0.50 * kw_p85
    peak = 20.0 * math.log10(max((abs(s) for s in samples), default=1e-9))
    return kw_act, kw_p85, percep, peak


def filter_pcm(samples: list[float], af: str) -> list[float]:
    p = subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0",
            "-af", af,
            "-f", "f32le", "pipe:1",
        ],
        input=struct.pack(f"<{len(samples)}f", *samples),
        stdout=subprocess.PIPE,
        check=True,
    )
    n = len(p.stdout) // 4
    return list(struct.unpack(f"<{n}f", p.stdout))


def master_clip(raw_mp3: str, out_mp3: str) -> tuple[float, float, float, float, float]:
    """Master a raw Edge TTS MP3 to broadcast warmth, dynamics, LUFS, and peak headroom."""
    eq_filter = (
        "highpass=f=75,"
        "equalizer=f=210:t=q:w=1.2:g=2.0,"
        "equalizer=f=3200:t=q:w=1.5:g=-3.0,"
        "equalizer=f=6800:t=q:w=1.4:g=-2.8,"
        "lowpass=f=9000"
    )
    proc = subprocess.run(
        [
            "ffmpeg", "-v", "error",
            "-i", raw_mp3,
            "-af", eq_filter,
            "-ar", str(SR), "-ac", "1",
            "-f", "f32le", "pipe:1",
        ],
        stdout=subprocess.PIPE,
        check=True,
    )
    count = len(proc.stdout) // 4
    samples = list(struct.unpack(f"<{count}f", proc.stdout))

    # Trim leading silence (-30ms pad) and preserve natural tail (+240ms pad).
    thresh = 0.0025
    first = 0
    while first < count and abs(samples[first]) < thresh:
        first += 1
    last = count - 1
    while last > first and abs(samples[last]) < thresh:
        last -= 1
    if first >= last:
        first, last = 0, count - 1

    start_idx = max(0, first - int(0.030 * SR))
    end_idx = min(count, last + 1 + int(0.240 * SR))
    trimmed = samples[start_idx:end_idx]

    # Initial gain normalize into de-esser + peak compressor.
    _, _, p0, _ = measure(trimmed)
    g0 = 10.0 ** ((TARGET_PERCEP - p0) / 20.0)
    pre = [s * g0 for s in trimmed]

    comp_af = (
        "deesser=i=0.20:m=0.30:f=0.55:s=o,"
        "acompressor=threshold=0.115:ratio=2.8:attack=3:release=85:knee=2.0:detection=peak:makeup=1"
    )
    lim_af = "alimiter=level_in=1:level_out=1:limit=0.501:attack=4:release=60:level=false:latency=true"

    # Two closed-loop loudness + -6 dBFS limiter passes.
    cur = filter_pcm(pre, comp_af)
    for _ in range(2):
        _, _, p_cur, _ = measure(cur)
        g = 10.0 ** ((TARGET_PERCEP - p_cur) / 20.0)
        cur = filter_pcm([s * g for s in cur], lim_af)

    _, _, p_end, _ = measure(cur)
    if abs(TARGET_PERCEP - p_end) > 0.03:
        g_fin = 10.0 ** ((TARGET_PERCEP - p_end) / 20.0)
        cur = [max(-0.56, min(0.56, s * g_fin)) for s in cur]

    # Raised-cosine fade-in (25ms), fade-out (160ms), and 60ms trailing guard silence.
    fi = min(int(0.025 * SR), len(cur) // 4)
    fo = min(int(0.160 * SR), len(cur) // 2)
    for i in range(fi):
        cur[i] *= 0.5 * (1.0 - math.cos(math.pi * i / fi))
    for i in range(fo):
        idx = len(cur) - fo + i
        cur[idx] *= 0.5 * (1.0 + math.cos(math.pi * i / fo))
    cur.extend([0.0] * int(0.060 * SR))

    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0",
            "-c:a", "libmp3lame", "-b:a", "128k",
            out_mp3,
        ],
        input=struct.pack(f"<{len(cur)}f", *cur),
        check=True,
    )

    p_ver = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", out_mp3, "-ar", str(SR), "-ac", "1", "-f", "f32le", "pipe:1"],
        stdout=subprocess.PIPE,
        check=True,
    )
    nv = len(p_ver.stdout) // 4
    ver = list(struct.unpack(f"<{nv}f", p_ver.stdout))
    kw_act, kw_p85, percep_f, peak_f = measure(ver)
    return nv / SR, kw_act, kw_p85, percep_f, peak_f


async def generate_clips(clips: Iterable[tuple[str, str]], out_dir: Path) -> None:
    try:
        import edge_tts  # type: ignore[import-not-found]
    except ImportError:
        print(
            "Error: edge-tts is required for synthesis. Run with:\n"
            "  uvx --from edge-tts python scripts/generate_voice_clips.py ...",
            file=sys.stderr,
        )
        sys.exit(1)

    out_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp_dir:
        for slug, text in clips:
            raw_mp3 = os.path.join(tmp_dir, f"{slug}_raw.mp3")
            tmp_out = os.path.join(tmp_dir, f"{slug}.mp3")
            final_out = out_dir / f"{slug}.mp3"

            for attempt in range(5):
                try:
                    comm = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
                    await comm.save(raw_mp3)
                    break
                except Exception as exc:
                    if attempt == 4:
                        raise
                    print(f"Retry {slug} ({attempt + 1}/4): {exc}")
                    await asyncio.sleep(2.0 * (attempt + 1))

            dur, kw_act, kw_p85, percep_f, peak_f = master_clip(raw_mp3, tmp_out)
            shutil.move(tmp_out, str(final_out))
            print(
                f"OK {slug:22s} dur={dur:.2f}s  KW_Act={kw_act:6.2f}  "
                f"KW_P85={kw_p85:6.2f}  Percep={percep_f:6.2f}  Peak={peak_f:6.2f}  ({text})"
            )
            await asyncio.sleep(0.55)


def verify_clips(out_dir: Path) -> int:
    expected = {f"{slug}.mp3" for slug, _ in VOICE_CLIPS}
    missing: list[str] = []
    for filename in sorted(expected):
        p = out_dir / filename
        if not p.is_file() or p.stat().st_size == 0:
            missing.append(filename)

    ts_files: set[str] = set()
    if VOICE_CLIPS_TS.is_file():
        ts_src = VOICE_CLIPS_TS.read_text(encoding="utf-8")
        ts_files = set(re.findall(r":\s*'([^']+\.mp3)'", ts_src))

    only_in_ts = sorted(ts_files - expected)
    only_in_script = sorted(expected - ts_files) if ts_files else []

    print(
        f"Voice catalog: {len(VOICE_CLIPS)} clips, missing in {out_dir}: {len(missing)}, "
        f"voiceClips.ts sync diff: {len(only_in_ts) + len(only_in_script)}"
    )
    if missing:
        print("Missing MP3s:", ", ".join(missing), file=sys.stderr)
    if only_in_ts:
        print("Only in src/audio/voiceClips.ts:", ", ".join(only_in_ts), file=sys.stderr)
    if only_in_script:
        print("Only in scripts/generate_voice_clips.py:", ", ".join(only_in_script), file=sys.stderr)

    return 1 if (missing or only_in_ts or only_in_script) else 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate and master Paws Off TTS voice clips.",
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--list",
        action="store_true",
        help=f"List all {len(VOICE_CLIPS)} catalog slugs and texts.",
    )
    mode.add_argument(
        "--verify",
        action="store_true",
        help="Verify all catalog MP3s exist and match src/audio/voiceClips.ts.",
    )
    mode.add_argument(
        "--only",
        nargs="+",
        metavar="SLUG",
        help="Regenerate specific catalog slugs (e.g. chord-V7 inv-1).",
    )
    mode.add_argument(
        "--custom",
        nargs=2,
        metavar=("SLUG", "TEXT"),
        help='Generate and master a custom clip (e.g. --custom test-clip "Five.").',
    )
    mode.add_argument(
        "--all",
        action="store_true",
        help=f"Regenerate and master all {len(VOICE_CLIPS)} catalog clips.",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help=f"Output directory (default: {DEFAULT_OUT_DIR})",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.list:
        for slug, text in VOICE_CLIPS:
            print(f"{slug:24s} {text}")
        print(f"Total: {len(VOICE_CLIPS)} clips")
        return 0

    if args.verify:
        return verify_clips(args.out_dir)

    catalog = dict(VOICE_CLIPS)
    if args.only:
        unknown = [s for s in args.only if s not in catalog]
        if unknown:
            print(f"Unknown slug(s): {', '.join(unknown)}", file=sys.stderr)
            return 1
        selected = [(s, catalog[s]) for s in args.only]
    elif args.custom:
        slug, text = args.custom
        selected = [(slug, text)]
    else:
        selected = list(VOICE_CLIPS)

    asyncio.run(generate_clips(selected, args.out_dir))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
