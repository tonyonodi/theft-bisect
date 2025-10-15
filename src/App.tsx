import { useState, useRef, useEffect } from 'react'
import './App.css'

type BisectState = {
  startTime: number
  endTime: number
  currentTime: number
}

function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [bisectState, setBisectState] = useState<BisectState | null>(null)
  const [isVideoReady, setIsVideoReady] = useState(false)
  const [stepCount, setStepCount] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle file selection
  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file)
      setIsVideoReady(false)
      setStepCount(0)
    }
  }

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  // Initialize video when file is selected
  useEffect(() => {
    if (videoFile && videoRef.current) {
      const video = videoRef.current
      const url = URL.createObjectURL(videoFile)
      video.src = url

      const handleLoadedMetadata = () => {
        const duration = video.duration
        setVideoDuration(duration)
        const midpoint = duration / 2
        setBisectState({
          startTime: 0,
          endTime: duration,
          currentTime: midpoint
        })
        video.currentTime = midpoint
      }

      const handleSeeked = () => {
        setIsVideoReady(true)
      }

      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      video.addEventListener('seeked', handleSeeked)

      return () => {
        URL.revokeObjectURL(url)
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
        video.removeEventListener('seeked', handleSeeked)
      }
    }
  }, [videoFile])

  // Handle bisect button clicks
  const handleBisect = (itemStillThere: boolean) => {
    if (!bisectState || !videoRef.current) return

    setIsVideoReady(false)
    const newState: BisectState = itemStillThere
      ? {
          startTime: bisectState.currentTime,
          endTime: bisectState.endTime,
          currentTime: (bisectState.currentTime + bisectState.endTime) / 2
        }
      : {
          startTime: bisectState.startTime,
          endTime: bisectState.currentTime,
          currentTime: (bisectState.startTime + bisectState.currentTime) / 2
        }

    setBisectState(newState)
    videoRef.current.currentTime = newState.currentTime
    setStepCount(prev => prev + 1)
  }

  // Reset to start over
  const handleReset = () => {
    setVideoFile(null)
    setBisectState(null)
    setIsVideoReady(false)
    setStepCount(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="app">
      <h1>Theft Bisect</h1>
      <p className="subtitle">Binary search through CCTV footage to find when theft occurred</p>

      {!videoFile ? (
        <div
          className="drop-zone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="drop-zone-content">
            <svg className="upload-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p>Drop a video file here</p>
            <p className="or-text">or</p>
            <button
              className="select-file-button"
              onClick={() => fileInputRef.current?.click()}
            >
              Select File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      ) : (
        <div className="bisect-container">
          <div className="video-container">
            <video
              ref={videoRef}
              className="video-display"
              style={{ opacity: isVideoReady ? 1 : 0.5 }}
            />
            {!isVideoReady && <div className="loading">Loading frame...</div>}
          </div>

          {bisectState && (
            <div className="info-panel">
              <div className="info-item">
                <span className="label">Current time:</span>
                <span className="value">{formatTime(bisectState.currentTime)}</span>
              </div>
              <div className="info-item">
                <span className="label">Search range:</span>
                <span className="value">
                  {formatTime(bisectState.startTime)} - {formatTime(bisectState.endTime)}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Range size:</span>
                <span className="value">{formatTime(bisectState.endTime - bisectState.startTime)}</span>
              </div>
              <div className="info-item">
                <span className="label">Steps taken:</span>
                <span className="value">{stepCount}</span>
              </div>
            </div>
          )}

          <div className="button-container">
            <button
              className="bisect-button still-there"
              onClick={() => handleBisect(true)}
              disabled={!isVideoReady}
            >
              Item Still There
            </button>
            <button
              className="bisect-button stolen"
              onClick={() => handleBisect(false)}
              disabled={!isVideoReady}
            >
              Item Stolen
            </button>
          </div>

          <button className="reset-button" onClick={handleReset}>
            Reset
          </button>
        </div>
      )}
    </div>
  )
}

export default App
