"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Webcam from "react-webcam"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Camera, Square, Upload, Loader2, AlertCircle, Video } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface VideoRecorderProps {
  onVideoReady: (blob: Blob, fileName: string) => void
  maxDuration?: number // seconds
  minDuration?: number // seconds
  maxFileSize?: number // bytes
  allowUpload?: boolean
}

export function VideoRecorder({
  onVideoReady,
  maxDuration = 60,
  minDuration = 45,
  maxFileSize = 100 * 1024 * 1024, // 100MB
  allowUpload = true,
}: VideoRecorderProps) {
  const webcamRef = useRef<Webcam>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<"record" | "upload">("record")
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate max bitrate to stay under 100MB for 60s
  // 100MB = 838,860,800 bits / 60s = ~13,981,013 bps
  // Use 13 Mbps to be safe (gives ~97.5 MB for 60s)
  const VIDEO_BITRATE = 13 * 1000 * 1000 // 13 Mbps

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
      }
    }
  }, [videoUrl])

  const handleDataAvailable = useCallback(
    ({ data }: BlobEvent) => {
      if (data.size > 0) {
        setRecordedChunks((prev) => [...prev, data])
      }
    },
    []
  )

  const startRecording = useCallback(() => {
    setError(null)
    setRecordedChunks([])
    setVideoBlob(null)
    setVideoUrl(null)
    setTimeElapsed(0)

    if (webcamRef.current && webcamRef.current.stream) {
      try {
        const options = {
          mimeType: "video/webm;codecs=vp9",
          videoBitsPerSecond: VIDEO_BITRATE,
        }

        // Fallback if vp9 is not supported
        let finalOptions = options
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          finalOptions = {
            mimeType: "video/webm",
            videoBitsPerSecond: VIDEO_BITRATE,
          }
        }

        mediaRecorderRef.current = new MediaRecorder(webcamRef.current.stream, finalOptions)
        mediaRecorderRef.current.addEventListener("dataavailable", handleDataAvailable)
        mediaRecorderRef.current.start()
        setRecording(true)

        // Start timer
        timerRef.current = setInterval(() => {
          setTimeElapsed((prev) => {
            const newTime = prev + 1
            // Auto-stop at max duration
            if (newTime >= maxDuration) {
              stopRecording()
              return maxDuration
            }
            return newTime
          })
        }, 1000)
      } catch (err) {
        console.error("Failed to start recording:", err)
        setError("Failed to start recording. Please check camera permissions.")
      }
    }
  }, [handleDataAvailable, maxDuration, VIDEO_BITRATE])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [recording])

  // Process recorded chunks into video blob
  useEffect(() => {
    if (recordedChunks.length > 0 && !recording) {
      const blob = new Blob(recordedChunks, { type: "video/webm" })

      // Validate size
      if (blob.size > maxFileSize) {
        setError(`Video size (${(blob.size / 1024 / 1024).toFixed(1)}MB) exceeds limit of ${maxFileSize / 1024 / 1024}MB`)
        setRecordedChunks([])
        return
      }

      // Validate duration
      if (timeElapsed < minDuration) {
        setError(`Video must be at least ${minDuration} seconds. You recorded ${timeElapsed} seconds.`)
        setRecordedChunks([])
        return
      }

      setVideoBlob(blob)
      const url = URL.createObjectURL(blob)
      setVideoUrl(url)
      setRecordedChunks([])
    }
  }, [recordedChunks, recording, maxFileSize, minDuration, timeElapsed])

  const handleUseVideo = () => {
    if (videoBlob) {
      const fileName = `interview-${Date.now()}.webm`
      onVideoReady(videoBlob, fileName)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)

    // Validate file type
    const validTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"]
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Please upload MP4, WebM, MOV, or MKV.")
      return
    }

    // Validate file size
    if (file.size > maxFileSize) {
      setError(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds limit of ${maxFileSize / 1024 / 1024}MB`)
      return
    }

    // Create blob and preview
    setVideoBlob(file)
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getTimeColor = () => {
    if (timeElapsed < minDuration) return "text-yellow-500"
    if (timeElapsed >= maxDuration - 10) return "text-red-500"
    return "text-green-500"
  }

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      {allowUpload && (
        <div className="flex gap-2 justify-center">
          <Button
            variant={mode === "record" ? "default" : "outline"}
            onClick={() => setMode("record")}
            className="flex-1"
          >
            <Camera className="mr-2 h-4 w-4" />
            Record Video
          </Button>
          <Button
            variant={mode === "upload" ? "default" : "outline"}
            onClick={() => setMode("upload")}
            className="flex-1"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Video
          </Button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Recording Mode */}
      {mode === "record" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            {!videoUrl ? (
              <>
                {/* Webcam Preview */}
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <Webcam
                    ref={webcamRef}
                    audio={true}
                    muted={true}
                    videoConstraints={{
                      width: 1280,
                      height: 720,
                      facingMode: "user",
                      frameRate: 30,
                    }}
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                    mirrored={true}
                  />

                  {/* Recording Indicator */}
                  {recording && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                      <span className="font-semibold">REC</span>
                    </div>
                  )}

                  {/* Timer */}
                  {recording && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full">
                      <span className={`text-lg font-mono font-semibold ${getTimeColor()}`}>
                        {formatTime(timeElapsed)} / {formatTime(maxDuration)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Recording Controls */}
                <div className="flex flex-col items-center gap-4">
                  <div className="text-sm text-muted-foreground text-center">
                    {!recording && (
                      <>
                        <p>
                          Record a {minDuration}-{maxDuration} second video introduction
                        </p>
                        <p className="text-xs mt-1">Maximum file size: {maxFileSize / 1024 / 1024}MB</p>
                      </>
                    )}
                    {recording && timeElapsed < minDuration && (
                      <p className="text-yellow-500">Record at least {minDuration - timeElapsed} more seconds</p>
                    )}
                  </div>

                  {!recording ? (
                    <Button onClick={startRecording} size="lg" className="min-w-[200px]">
                      <Camera className="mr-2 h-5 w-5" />
                      Start Recording
                    </Button>
                  ) : (
                    <Button onClick={stopRecording} variant="destructive" size="lg" className="min-w-[200px]">
                      <Square className="mr-2 h-5 w-5" />
                      Stop Recording
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Video Preview */}
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video src={videoUrl} controls className="w-full h-full object-cover" />
                </div>

                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Video recorded: {formatTime(timeElapsed)} | Size: {(videoBlob!.size / 1024 / 1024).toFixed(1)}MB
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={() => setVideoUrl(null)} variant="outline">
                      Re-record
                    </Button>
                    <Button onClick={handleUseVideo}>Use This Video</Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Mode */}
      {mode === "upload" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            {!videoUrl ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="p-4 rounded-full bg-primary/10">
                  <Video className="h-12 w-12 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <p className="font-medium">Upload Your Video</p>
                  <p className="text-sm text-muted-foreground">
                    MP4, WebM, MOV, or MKV (max {maxFileSize / 1024 / 1024}MB)
                  </p>
                </div>
                <label htmlFor="video-upload">
                  <input
                    id="video-upload"
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      Choose File
                    </span>
                  </Button>
                </label>
              </div>
            ) : (
              <>
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video src={videoUrl} controls className="w-full h-full object-cover" />
                </div>

                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    File size: {(videoBlob!.size / 1024 / 1024).toFixed(1)}MB
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={() => setVideoUrl(null)} variant="outline">
                      Choose Different File
                    </Button>
                    <Button onClick={handleUseVideo}>Use This Video</Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
