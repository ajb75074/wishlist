#!/usr/bin/env python3
"""Standalone experiment: local background removal for a single product image.

Not part of the web app or extension - a throwaway script to test whether
rembg's cutouts are good enough for real wishlist product photos before any
integration work happens.

Usage:
    python prepare_piece.py input/product.jpg output/product-cutout.png
"""

import argparse
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError


def parse_args():
    parser = argparse.ArgumentParser(
        description="Remove the background from a single product image and save a transparent PNG.",
    )
    parser.add_argument("input_path", help="Path to the source product image (jpg/png/etc).")
    parser.add_argument("output_path", help="Path to write the transparent PNG cutout to.")
    return parser.parse_args()


def main():
    args = parse_args()
    input_path = Path(args.input_path)
    output_path = Path(args.output_path)

    if not input_path.exists():
        print(f"Error: input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    try:
        input_bytes = input_path.read_bytes()
    except OSError as error:
        print(f"Error: could not read input file: {error}", file=sys.stderr)
        sys.exit(1)

    # Fail fast on a bad/corrupt file before spending time on removal.
    try:
        with Image.open(BytesIO(input_bytes)) as probe:
            probe.verify()
    except UnidentifiedImageError:
        print(f"Error: not a recognizable image file: {input_path}", file=sys.stderr)
        sys.exit(1)

    try:
        from rembg import remove
    except ImportError:
        print(
            "Error: rembg is not installed. Run: pip install -r requirements.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Removing background from {input_path} ...")

    try:
        output_bytes = remove(input_bytes)
    except Exception as error:  # rembg/onnxruntime can raise a range of error types
        print(f"Error: background removal failed: {error}", file=sys.stderr)
        sys.exit(1)

    try:
        cutout = Image.open(BytesIO(output_bytes)).convert("RGBA")
    except UnidentifiedImageError:
        print("Error: rembg did not return a valid image.", file=sys.stderr)
        sys.exit(1)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        cutout.save(output_path, format="PNG")
    except OSError as error:
        print(f"Error: could not save output file: {error}", file=sys.stderr)
        sys.exit(1)

    # input_path is only ever read, never written - the original is untouched.
    print(f"Saved transparent cutout to: {output_path.resolve()}")


if __name__ == "__main__":
    main()
