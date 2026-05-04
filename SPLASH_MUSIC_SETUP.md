# 🎵 Splash Screen Music Setup

## How to Add Your Background Music

The splash screen is now configured to play background music with smooth fade in/out effects!

### Steps to Add Music:

1. **Prepare your music file:**
   - Format: MP3 (recommended for best browser compatibility)
   - Duration: 6-10 seconds recommended
   - File size: Keep under 1MB for fast loading

2. **Name your file:**
   - Rename it to: `splash-music.mp3`

3. **Place the file:**
   - Put `splash-music.mp3` in the `/public` folder
   - Path should be: `/Users/lisandroalvo/DEK-NOI-APP-REWARD/public/splash-music.mp3`

4. **That's it!** The splash screen will automatically:
   - ✅ Load the music
   - ✅ Fade in from 0% to 50% volume (smooth start)
   - ✅ Play during the 6-second splash animation
   - ✅ Fade out smoothly before ending
   - ✅ Stop completely when splash completes

### Music Settings:

**Current Configuration:**
- **Fade In:** 200ms delay, then gradual increase to 50% volume
- **Max Volume:** 50% (not too loud)
- **Fade Out:** Starts at 5.5 seconds
- **Total Duration:** 6.2 seconds

**To Adjust Volume:**
Edit `/src/components/SplashScreen.jsx` line 60:
```javascript
if (volume < 0.5) { // Change 0.5 to your desired max (0.0 to 1.0)
```

**To Change Timing:**
Edit the fade timers on lines 83-85:
```javascript
const fadeInTimer = setTimeout(fadeIn, 200)    // When to start fade in
const fadeOutTimer = setTimeout(fadeOut, 5500) // When to start fade out
```

### File Structure:
```
DEK-NOI-APP-REWARD/
├── public/
│   ├── splash-music.mp3  ← Put your music file here!
│   ├── icon-192.png
│   └── ...
├── src/
│   └── components/
│       └── SplashScreen.jsx
└── ...
```

### Troubleshooting:

**Music doesn't play?**
- Check browser console for errors
- Ensure file is named exactly `splash-music.mp3`
- Verify file is in `/public` folder
- Some browsers block autoplay - user interaction may be needed

**Music too loud/quiet?**
- Adjust max volume in code (line 60)
- Or adjust your source audio file volume

**Want different music file name?**
- Edit line 30 in `SplashScreen.jsx`:
```javascript
const audioElement = new Audio('/your-file-name.mp3')
```

### Recommended Music:
- Upbeat, positive vibes
- Short jingle or intro
- Clear start and end points
- No sudden loud parts
- Matches your brand energy

Enjoy your enhanced splash screen! 🎵✨
