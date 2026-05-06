// Sound effects using Web Audio API

export const playPointsAwardedSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    
    // Create a pleasant "success" sound with multiple tones
    const playTone = (frequency, startTime, duration, volume = 0.15) => {
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
    
    // Play a cheerful ascending melody (C-E-G chord)
    playTone(523.25, 0, 0.15, 0.12)    // C5
    playTone(659.25, 0.08, 0.15, 0.12) // E5
    playTone(783.99, 0.16, 0.25, 0.15) // G5
    
    console.log('🎵 Points awarded sound played!')
  } catch (err) {
    console.log('Audio not available:', err)
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
