// Sound effects using Web Audio API

export const playPointsAwardedSound = () => {
  try {
    console.log('🎵 Attempting to play points sound...')
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    
    // Resume audio context (required on some browsers)
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }
    
    // Create a pleasant "success" sound with multiple tones
    const playTone = (frequency, startTime, duration, volume = 0.2) => {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = frequency
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime)
      gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + startTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + startTime + duration)
      
      oscillator.start(audioContext.currentTime + startTime)
      oscillator.stop(audioContext.currentTime + startTime + duration)
    }
    
    // Play a cheerful ascending melody (C-E-G chord) - louder
    playTone(523.25, 0, 0.2, 0.25)    // C5
    playTone(659.25, 0.1, 0.2, 0.25)  // E5
    playTone(783.99, 0.2, 0.3, 0.3)   // G5
    
    console.log('✅ Points awarded sound played successfully!')
    return true
  } catch (err) {
    console.error('❌ Audio error:', err)
    return false
  }
}

export const playSuccessSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // Happy "ding" sound
    oscillator.frequency.value = 1000
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2)
  } catch (err) {
    console.log('Audio not available:', err)
  }
}
