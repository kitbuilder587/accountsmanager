#!/usr/bin/env python3
"""
Instagram Reels uploader using instagrapi.
Called as subprocess from Node.js publisher.

Usage:
    python3 scripts/instagram-upload.py \
        --video /path/to/video.mp4 \
        --caption "Caption text #reels" \
        --session /path/to/session.json \
        --username USERNAME \
        --password PASSWORD

Session file is saved after first login and reused for subsequent uploads.
If session is expired, re-authenticates with username/password.

Requires: pip3 install instagrapi
"""
import argparse
import json
import os
import sys

def main():
    parser = argparse.ArgumentParser(description='Upload Instagram Reel')
    parser.add_argument('--video', required=True, help='Path to video file')
    parser.add_argument('--caption', default='', help='Caption text')
    parser.add_argument('--session', required=True, help='Path to session JSON file')
    parser.add_argument('--username', default='', help='Instagram username (for first login)')
    parser.add_argument('--password', default='', help='Instagram password (for first login)')
    parser.add_argument('--thumbnail', default='', help='Path to thumbnail image')
    args = parser.parse_args()

    try:
        from instagrapi import Client
    except ImportError:
        print(json.dumps({"success": False, "error": "instagrapi not installed. Run: pip3 install instagrapi"}))
        sys.exit(1)

    if not os.path.exists(args.video):
        print(json.dumps({"success": False, "error": f"Video file not found: {args.video}"}))
        sys.exit(1)

    cl = Client()

    # Try loading existing session
    logged_in = False
    if os.path.exists(args.session):
        try:
            cl.load_settings(args.session)
            cl.login_by_sessionid(cl.settings.get("authorization_data", {}).get("sessionid", ""))
            # Verify session is valid
            cl.get_timeline_feed()
            logged_in = True
            print(f"Logged in via saved session", file=sys.stderr)
        except Exception as e:
            print(f"Session expired or invalid: {e}", file=sys.stderr)

    # Login with credentials if session failed
    if not logged_in:
        if not args.username or not args.password:
            print(json.dumps({"success": False, "error": "No valid session and no credentials provided. Set INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD env vars."}))
            sys.exit(1)

        try:
            cl.login(args.username, args.password)
            logged_in = True
            print(f"Logged in as {args.username}", file=sys.stderr)
        except Exception as e:
            print(json.dumps({"success": False, "error": f"Login failed: {str(e)}"}))
            sys.exit(1)

    # Save session for next time
    try:
        cl.dump_settings(args.session)
    except Exception as e:
        print(f"Warning: could not save session: {e}", file=sys.stderr)

    # Upload reel
    try:
        thumbnail_path = args.thumbnail if args.thumbnail and os.path.exists(args.thumbnail) else None

        media = cl.clip_upload(
            path=args.video,
            caption=args.caption,
            thumbnail=thumbnail_path,
        )

        result = {
            "success": True,
            "media_id": str(media.pk),
            "media_code": media.code,
            "url": f"https://www.instagram.com/reel/{media.code}/",
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": f"Upload failed: {str(e)}"}))
        sys.exit(1)

if __name__ == '__main__':
    main()
