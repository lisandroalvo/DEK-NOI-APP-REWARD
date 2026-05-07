// Sound effects using Web Audio API

// Global audio context - create once and reuse
let globalAudioContext = null;

const getAudioContext = () => {
  if (!globalAudioContext) {
    globalAudioContext = new (window.AudioContext || window.webkitAudioContext)()
  }
  return globalAudioContext
}

// Initialize audio on first user interaction
export const initAudio = () => {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
    console.log('🎵 Audio initialized')
  } catch (err) {
    console.error('Audio init error:', err)
  }
}

export const playPointsAwardedSound = async () => {
  try {
    console.log('\ud83c\udfb5 Attempting to play points sound...')
    const audioContext = getAudioContext()
    
    // FORCE resume audio context
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
      console.log('Audio context resumed from suspended state')
    }
    
    console.log('Audio context state:', audioContext.state)
    
    // Create a VERY LOUD "success" sound with multiple tones
    const playTone = (frequency, startTime, duration, volume) => {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = frequency
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime)
      gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + startTime + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + startTime + duration)
      
      oscillator.start(audioContext.currentTime + startTime)
      oscillator.stop(audioContext.currentTime + startTime + duration)
    }
    
    // Play a VERY LOUD cheerful ascending melody (C-E-G chord) - MAX VOLUME
    playTone(523.25, 0, 0.3, 0.8)      // C5 - VERY LOUD
    playTone(659.25, 0.15, 0.3, 0.8)   // E5 - VERY LOUD
    playTone(783.99, 0.3, 0.4, 1.0)    // G5 - MAX VOLUME
    
    console.log('\u2705 LOUD Points awarded sound played successfully!')
    return true
  } catch (err) {
    console.error('\u274c Audio error:', err)
    return false
  }
}

export const playSuccessSound = async () => {
  try {
    console.log('🔔 Playing notification sound...')
    const audioContext = getAudioContext()
    
    // FORCE resume if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
      console.log('Audio context resumed')
    }
    
    // LOUD notification sound - three tones
    const playTone = (frequency, startTime, duration, volume) => {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = frequency
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime)
      gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + startTime + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + startTime + duration)
      
      oscillator.start(audioContext.currentTime + startTime)
      oscillator.stop(audioContext.currentTime + startTime + duration)
    }
    
    // LOUD "ding-dong-ding" notification - VERY AUDIBLE
    playTone(1000, 0, 0.2, 0.6)      // First tone - HIGH & LOUD
    playTone(800, 0.15, 0.2, 0.5)    // Second tone - LOUD
    playTone(1000, 0.3, 0.25, 0.6)   // Third tone - HIGH & LOUD
    
    console.log('✅ LOUD notification sound played!')
  } catch (err) {
    console.error('❌ Audio error:', err)
  }
}
