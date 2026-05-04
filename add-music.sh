#!/bin/bash

echo "🎵 Adding splash music file..."
echo ""
echo "Please drag and drop your splash-music.mp3 file here and press Enter:"
read -e MUSIC_FILE

# Remove quotes if present
MUSIC_FILE="${MUSIC_FILE//\'/}"
MUSIC_FILE="${MUSIC_FILE//\"/}"

if [ -f "$MUSIC_FILE" ]; then
    cp "$MUSIC_FILE" public/splash-music.mp3
    echo "✅ Music file copied to public/splash-music.mp3"
    echo ""
    echo "Now building and deploying..."
    npm run build
    npx firebase-tools deploy --only hosting
    echo ""
    echo "🎉 Done! Your splash screen now has music!"
else
    echo "❌ File not found. Please try again."
fi
