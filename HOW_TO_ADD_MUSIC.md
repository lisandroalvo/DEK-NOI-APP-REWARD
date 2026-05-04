# 🎵 How to Add Splash Screen Music

## Quick Steps:

1. **Get your MP3 file** (10-12 seconds recommended)

2. **Rename it to:** `splash-music.mp3`

3. **Copy it to the public folder:**
   ```
   /Users/lisandroalvo/DEK-NOI-APP-REWARD/public/splash-music.mp3
   ```

4. **Rebuild and deploy:**
   ```bash
   cd /Users/lisandroalvo/DEK-NOI-APP-REWARD
   npm run build
   npx firebase-tools deploy --only hosting
   ```

## That's it!

The music will:
- ✅ Fade in smoothly (0% → 50% volume)
- ✅ Play during the 12-second splash
- ✅ Fade out smoothly before ending
- ✅ Stop completely when splash completes

## Troubleshooting:

**Music doesn't play?**
- Check browser console for errors
- Verify file is named exactly `splash-music.mp3`
- Ensure file is in `/public` folder (not `/src`)
- Some browsers block autoplay - this is normal

**File location check:**
```bash
ls -la /Users/lisandroalvo/DEK-NOI-APP-REWARD/public/splash-music.mp3
```

If you see the file details, it's in the right place! 🎉
