import { useCallback, useEffect, useRef, useState } from 'react'
import { speechToText, textToSpeechBlob, playAudioBlob } from '../api/assistant'

export default function useVoiceAssistant() {
  const [micState, setMicState] = useState('idle')
  const [assistantAudio, setAssistantAudio] = useState('stopped')
  const [voiceError, setVoiceError] = useState('')

  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const recordedMimeTypeRef = useRef('audio/webm')
  const stopTimeoutRef = useRef(null)
  const currentAudioRef = useRef(null)
  const currentAudioUrlRef = useRef(null)

  const clearStopTimeout = useCallback(() => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current)
      stopTimeoutRef.current = null
    }
  }, [])

  const cleanupRecorderResources = useCallback(() => {
    clearStopTimeout()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    recorderRef.current = null
  }, [clearStopTimeout])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop()
      } catch {}
    }
  }, [])

  const startRecording = useCallback(async (onTranscript, maxDurationMs = 7000) => {
    if (micState !== 'idle') return false

    try {
      setVoiceError('')
      if (!navigator?.mediaDevices?.getUserMedia) {
        setVoiceError('Microphone not supported in this browser.')
        return false
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      if (typeof MediaRecorder === 'undefined') {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setVoiceError('Audio recording is not supported in this browser.')
        return false
      }

      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
      ]
      const selectedMimeType = supportedTypes.find((type) => {
        try {
          return MediaRecorder.isTypeSupported(type)
        } catch {
          return false
        }
      }) || ''

      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream)

      recorderRef.current = recorder
      chunksRef.current = []
      recordedMimeTypeRef.current = selectedMimeType || recorder.mimeType || 'audio/webm'

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        cleanupRecorderResources()
        setMicState('processing')

        try {
          const blobType = chunksRef.current[0]?.type || recordedMimeTypeRef.current || 'audio/webm'
          const audioBlob = new Blob(chunksRef.current, { type: blobType })
          const data = await speechToText(audioBlob)
          const transcript = (data?.text || '').trim()
          if (transcript && typeof onTranscript === 'function') {
            await onTranscript(transcript)
          } else if (!transcript) {
            setVoiceError('No speech detected. Try again.')
          }
        } catch (err) {
          setVoiceError(err?.message || 'Voice input failed.')
        } finally {
          setMicState('idle')
        }
      }

      recorder.start()
      setMicState('recording')

      stopTimeoutRef.current = setTimeout(() => {
        stopRecording()
      }, maxDurationMs)

      return true
    } catch (err) {
      cleanupRecorderResources()
      setVoiceError(err?.message || 'Unable to access microphone.')
      setMicState('idle')
      return false
    }
  }, [cleanupRecorderResources, micState, stopRecording])

  const toggleRecording = useCallback(async (onTranscript, maxDurationMs = 7000) => {
    if (micState === 'recording') {
      stopRecording()
      return
    }
    if (micState === 'idle') {
      await startRecording(onTranscript, maxDurationMs)
    }
  }, [micState, startRecording, stopRecording])

  const speakText = useCallback(async (text) => {
    const content = (text || '').trim()
    if (!content) return

    setVoiceError('')
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause()
      } catch {}
      currentAudioRef.current = null
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current)
      currentAudioUrlRef.current = null
    }

    setAssistantAudio('playing')
    try {
      const audioBlob = await textToSpeechBlob(content)
      const audioUrl = URL.createObjectURL(audioBlob)
      currentAudioUrlRef.current = audioUrl
      const audio = new Audio(audioUrl)
      currentAudioRef.current = audio
      await playAudioBlob(audio)
    } catch (err) {
      setVoiceError(err?.message || 'Text-to-speech failed.')
      throw err
    } finally {
      if (currentAudioRef.current) {
        currentAudioRef.current = null
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current)
        currentAudioUrlRef.current = null
      }
      setAssistantAudio('stopped')
    }
  }, [])

  useEffect(() => {
    return () => {
      clearStopTimeout()
      cleanupRecorderResources()
      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause()
        } catch {}
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current)
      }
    }
  }, [cleanupRecorderResources, clearStopTimeout])

  return {
    micState,
    assistantAudio,
    voiceError,
    startRecording,
    stopRecording,
    toggleRecording,
    speakText,
  }
}