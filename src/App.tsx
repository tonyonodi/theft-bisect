import { useState, useRef, useEffect } from "react";
import "./App.css";

type BisectState = {
  startTime: number;
  endTime: number;
  currentTime: number;
};

function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [bisectState, setBisectState] = useState<BisectState | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<
    "playhead" | "startHandle" | "endHandle" | null
  >(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Handle file selection
  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      setIsVideoReady(false);
      setStepCount(0);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Initialize video when file is selected
  useEffect(() => {
    if (videoFile && videoRef.current) {
      const video = videoRef.current;
      const url = URL.createObjectURL(videoFile);
      video.src = url;

      const handleLoadedMetadata = () => {
        const duration = video.duration;
        setVideoDuration(duration);
        const midpoint = duration / 2;
        setBisectState({
          startTime: 0,
          endTime: duration,
          currentTime: midpoint,
        });
        video.currentTime = midpoint;
      };

      const handleSeeked = () => {
        setIsVideoReady(true);
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("seeked", handleSeeked);

      return () => {
        URL.revokeObjectURL(url);
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("seeked", handleSeeked);
      };
    }
  }, [videoFile]);

  // Handle video playback and looping
  useEffect(() => {
    if (!videoRef.current || !bisectState) return;

    const video = videoRef.current;

    const handleTimeUpdate = () => {
      if (!isPlaying || !bisectState) return;

      // Update currentTime while playing
      setBisectState((prev) =>
        prev ? { ...prev, currentTime: video.currentTime } : null
      );

      // Loop back to start when reaching end of range
      if (video.currentTime >= bisectState.endTime) {
        video.currentTime = bisectState.startTime;
      }
    };

    const handlePause = () => {
      if (isPlaying) {
        setIsPlaying(false);
        // Update currentTime to where the video was paused
        setBisectState((prev) =>
          prev ? { ...prev, currentTime: video.currentTime } : null
        );
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("pause", handlePause);
    };
  }, [isPlaying, bisectState]);

  // Play/pause toggle
  const handlePlayPause = () => {
    if (!videoRef.current || !bisectState) return;

    const video = videoRef.current;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      // Start from startTime if currently at or past endTime
      if (
        video.currentTime >= bisectState.endTime ||
        video.currentTime < bisectState.startTime
      ) {
        video.currentTime = bisectState.startTime;
      }
      video.play();
      setIsPlaying(true);
    }
  };

  // Handle bisect button clicks
  const handleBisect = (itemStillThere: boolean) => {
    if (!bisectState || !videoRef.current) return;

    setIsVideoReady(false);
    const newState: BisectState = itemStillThere
      ? {
          startTime: bisectState.currentTime,
          endTime: bisectState.endTime,
          currentTime: (bisectState.currentTime + bisectState.endTime) / 2,
        }
      : {
          startTime: bisectState.startTime,
          endTime: bisectState.currentTime,
          currentTime: (bisectState.startTime + bisectState.currentTime) / 2,
        };

    setBisectState(newState);
    videoRef.current.currentTime = newState.currentTime;
    setStepCount((prev) => prev + 1);
  };

  // Reset to start over
  const handleReset = () => {
    setVideoFile(null);
    setBisectState(null);
    setIsVideoReady(false);
    setStepCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Convert mouse position to video time
  const getTimeFromMousePosition = (clientX: number): number => {
    if (!timelineRef.current || !videoDuration) return 0;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage * videoDuration;
  };

  // Handle drag start
  const handleDragStart =
    (type: "playhead" | "startHandle" | "endHandle") =>
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setDragType(type);
    };

  // Handle mouse move during drag
  useEffect(() => {
    if (!isDragging || !dragType || !bisectState || !videoRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newTime = getTimeFromMousePosition(e.clientX);

      if (dragType === "playhead") {
        // Expand range if playhead goes outside it
        const constrainedTime = Math.max(0, Math.min(videoDuration, newTime));
        const newStartTime = Math.min(bisectState.startTime, constrainedTime);
        const newEndTime = Math.max(bisectState.endTime, constrainedTime);

        setBisectState((prev) =>
          prev
            ? {
                ...prev,
                startTime: newStartTime,
                endTime: newEndTime,
                currentTime: constrainedTime,
              }
            : null
        );
        videoRef.current!.currentTime = constrainedTime;
      } else if (dragType === "startHandle") {
        // Constrain start handle to not go past end
        const constrainedTime = Math.max(
          0,
          Math.min(bisectState.endTime - 1, newTime)
        );
        setBisectState((prev) =>
          prev ? { ...prev, startTime: constrainedTime } : null
        );
        // If currentTime is now outside range, move it
        if (bisectState.currentTime < constrainedTime) {
          setBisectState((prev) =>
            prev ? { ...prev, currentTime: constrainedTime } : null
          );
          videoRef.current!.currentTime = constrainedTime;
        }
      } else if (dragType === "endHandle") {
        // Constrain end handle to not go before start
        const constrainedTime = Math.max(
          bisectState.startTime + 1,
          Math.min(videoDuration, newTime)
        );
        setBisectState((prev) =>
          prev ? { ...prev, endTime: constrainedTime } : null
        );
        // If currentTime is now outside range, move it
        if (bisectState.currentTime > constrainedTime) {
          setBisectState((prev) =>
            prev ? { ...prev, currentTime: constrainedTime } : null
          );
          videoRef.current!.currentTime = constrainedTime;
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragType(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragType, bisectState, videoDuration]);

  // Handle timeline click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || !bisectState || !videoRef.current) return;

    const newTime = getTimeFromMousePosition(e.clientX);
    const constrainedTime = Math.max(0, Math.min(videoDuration, newTime));
    const newStartTime = Math.min(bisectState.startTime, constrainedTime);
    const newEndTime = Math.max(bisectState.endTime, constrainedTime);

    setBisectState((prev) =>
      prev
        ? {
            ...prev,
            startTime: newStartTime,
            endTime: newEndTime,
            currentTime: constrainedTime,
          }
        : null
    );
    videoRef.current.currentTime = constrainedTime;
  };

  return (
    <div className="app">
      <h1>Theft Bisect</h1>
      <p className="subtitle">
        Binary search through CCTV footage to find when theft occurred
      </p>

      {!videoFile ? (
        <div
          className="drop-zone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="drop-zone-content">
            <svg
              className="upload-icon"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
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
              style={{ display: "none" }}
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
            <div className="scrubber-container">
              {/* Play/Pause button */}
              <button
                className="play-pause-button"
                onClick={handlePlayPause}
                disabled={!isVideoReady}
              >
                {isPlaying ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M6 3H8V21H6V3ZM16 3H18V21H16V3Z"></path>
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M6 20.1957V3.80421C6 3.01878 6.86395 2.53993 7.53 2.95621L20.6432 11.152C21.2699 11.5436 21.2699 12.4563 20.6432 12.848L7.53 21.0437C6.86395 21.46 6 20.9812 6 20.1957Z"></path>
                  </svg>
                )}
              </button>
              <div
                ref={timelineRef}
                className="timeline"
                onClick={handleTimelineClick}
              >
                {/* Full timeline background */}
                <div className="timeline-track" />

                {/* Active range highlight */}
                <div
                  className="timeline-range"
                  style={{
                    left: `${(bisectState.startTime / videoDuration) * 100}%`,
                    width: `${
                      ((bisectState.endTime - bisectState.startTime) /
                        videoDuration) *
                      100
                    }%`,
                  }}
                />

                {/* Start handle */}
                <div
                  className="timeline-handle start-handle"
                  style={{
                    left: `${(bisectState.startTime / videoDuration) * 100}%`,
                  }}
                  onMouseDown={handleDragStart("startHandle")}
                >
                  <div className="handle-tooltip">
                    {formatTime(bisectState.startTime)}
                  </div>
                </div>

                {/* End handle */}
                <div
                  className="timeline-handle end-handle"
                  style={{
                    left: `${(bisectState.endTime / videoDuration) * 100}%`,
                  }}
                  onMouseDown={handleDragStart("endHandle")}
                >
                  <div className="handle-tooltip">
                    {formatTime(bisectState.endTime)}
                  </div>
                </div>

                {/* Playhead */}
                <div
                  className="timeline-playhead"
                  style={{
                    left: `${(bisectState.currentTime / videoDuration) * 100}%`,
                  }}
                  onMouseDown={handleDragStart("playhead")}
                >
                  <div className="playhead-line" />
                  <div className="playhead-handle" />
                  <div className="playhead-tooltip">
                    {formatTime(bisectState.currentTime)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="button-container">
            <button
              className="bisect-button still-there"
              onClick={() => handleBisect(true)}
              disabled={!isVideoReady || isPlaying}
            >
              Item Still There
            </button>
            <button
              className="bisect-button stolen"
              onClick={() => handleBisect(false)}
              disabled={!isVideoReady || isPlaying}
            >
              Item Stolen
            </button>
          </div>

          {bisectState && (
            <div className="info-panel">
              <button className="reset-button" onClick={handleReset}>
                Reset
              </button>
              <div className="info-item">
                <span className="label">Current time:</span>
                <span className="value">
                  {formatTime(bisectState.currentTime)}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Search range:</span>
                <span className="value">
                  {formatTime(bisectState.startTime)} -{" "}
                  {formatTime(bisectState.endTime)}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Range size:</span>
                <span className="value">
                  {formatTime(bisectState.endTime - bisectState.startTime)}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Steps taken:</span>
                <span className="value">{stepCount}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
