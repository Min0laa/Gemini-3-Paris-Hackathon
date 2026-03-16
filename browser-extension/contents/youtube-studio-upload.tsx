import { useRef, useState, useEffect } from "react"
import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"

import videoUrl from "url:~/assets/ai-add-nike.mp4"
import googleVideoUrl from "url:~/assets/google-ai-pixel-ad.mp4"
import previewVideoUrl from "url:~/assets/fullvideo.mp4"
import nikeLogoUrl from "url:~/assets/nikelogo.png"
import holyLogoUrl from "url:~/assets/holylogo.png"
import googleLogoUrl from "url:~/assets/googlelogo.png"
import nikeProductUrl from "url:~/assets/nike.png"
import holyProductUrl from "url:~/assets/hoyl.png"
import googleProductUrl from "url:~/assets/phone.png"

export const config: PlasmoCSConfig = {
  matches: [
    "https://studio.youtube.com/*/videos/upload*",
    "https://studio.youtube.com/channel/*/videos/upload*"
  ]
}

export const getInlineAnchor: PlasmoGetInlineAnchor = async () => {
  const maxAttempts = 30
  for (let i = 0; i < maxAttempts; i++) {
    const anchor = document.querySelector(
      ".container.style-scope.ytcp-uploads-video-elements"
    )
    if (anchor) {
      return {
        element: anchor,
        insertPosition: "afterend" as const
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return null
}

export const getShadowHostId = () => "youtube-studio-extension-injection"

const RADIO_OPTIONS = [
  {
    id: "1",
    image: nikeLogoUrl,
    productImage: nikeProductUrl,
    title: "Nike",
    subtitle: "Sportswear and athletic lifestyle brand",
    descriptionOnSelect:
      "Tired of slipping on muddy trails? You need the new Nike Kiger 10. They are super lightweight and pack absolute monster grip. These keep you completely locked in, so you can just focus on flying. Ready to upgrade your trail run? Hit the link below!"
  },
  {
    id: "2",
    image: holyLogoUrl,
    productImage: holyProductUrl,
    title: "Holy",
    subtitle: "The energetic beverage",
    descriptionOnSelect:
      "Tired of feeling like a soggy potato by 3pm? You need Holy Energy. It's like someone plugged your brain directly into a lightning bolt… but in a tasty drink. Suddenly you're answering emails, finishing projects, and questioning why you ever drank sad office coffee. Ready to ascend? Grab a Holy and feel the power. Link below."
  },
  {
    id: "3",
    image: googleLogoUrl,
    productImage: googleProductUrl,
    title: "Google",
    subtitle: "Technology and innovation company",
    descriptionOnSelect:
      "Still taking photos that look like they were captured by a potato? Meet the new Google Pixel 10. Ridiculously smart camera, insanely smooth performance, and AI that actually feels useful. From perfect night shots to editing photos like a pro in seconds, the Pixel 10 basically makes you look like you know what you're doing. Ready to upgrade your pocket tech? Hit the link below."
  }
]

const GENERATING_STATUS_MESSAGES = [
  "Extracting data...",
  "Generating image...",
  "Generating video...",
  "Compiling...",
  "Analyzing frame...",
  "Building ad..."
]

const LOADING_DURATION_MS = 10_000

// Help/AI icon
const HelpIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="24"
    viewBox="0 0 24 24"
    width="24"
    focusable="false"
    aria-hidden="true"
    style={{
      display: "block",
      width: "100%",
      height: "100%",
      fill: "currentColor",
      pointerEvents: "none"
    }}
  >
    <path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 2a9 9 0 110 18.001A9 9 0 0112 3Zm0 2a1 1 0 00-1 1v1.104a3.5 3.5 0 00-1.435.656C8.886 8.3 8.5 9.09 8.5 10c0 .525.13 1.005.402 1.417.251.368.591.667.989.869.638.339 1.437.495 2.058.615l.109.022c.728.143 1.242.259 1.588.456.107.053.2.133.268.232.039.063.086.174.086.389 0 .2-.267 1-2 1-1.033 0-1.547-.303-1.788-.509a1.199 1.199 0 01-.274-.337 1 1 0 00-1.886.662L9 14.5l-.948.317.001.002.008.024c.055.143.123.281.203.413.175.283.394.537.648.753.478.41 1.156.765 2.088.915V18a1 1 0 002 0v-1.082c1.757-.299 3-1.394 3-2.918 0-.534-.125-1.022-.387-1.444a2.7 2.7 0 00-.978-.915c-.671-.383-1.512-.548-2.153-.673l-.04-.008c-.74-.145-1.258-.251-1.614-.439a.699.699 0 01-.258-.206c-.029-.045-.07-.13-.07-.315 0-.308.114-.518.31-.674C11.027 9.153 11.414 9 12 9c.463.006.917.133 1.316.368.167.095.323.206.468.331l.005.004.01.01a1 1 0 001.408-1.42L14.5 9l.706-.708-.011-.011-.017-.016-.054-.05A5 5 0 0013 7.115V6a1 1 0 00-1-1Z" />
  </svg>
)

// Close icon
const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="24"
    viewBox="0 0 24 24"
    width="24"
    style={{ fill: "currentColor" }}
  >
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
)

// Document / list icon (header left)
const DocumentIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="24"
    viewBox="0 0 24 24"
    width="24"
    style={{ fill: "currentColor" }}
  >
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6zm8-12l4 4h-4V8z" />
  </svg>
)

// Stop icon
const StopIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ flexShrink: 0 }}
  >
    <path d="M6 6h12v12H6z" />
  </svg>
)

// Check icon
const CheckIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ flexShrink: 0 }}
  >
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
)

// Refresh/Regenerate icon
const RefreshIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ flexShrink: 0 }}
  >
    <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
  </svg>
)

// Bookmark/Save icon
const BookmarkIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ flexShrink: 0 }}
  >
    <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z" />
  </svg>
)

// Trash/Delete icon
const TrashIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)

// Sparkle icon (Generate AI ads button)
const SparkleIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ flexShrink: 0 }}
  >
    <path d="M12 0L14.09 9.91L24 12L14.09 14.09L12 24L9.91 14.09L0 12L9.91 9.91L12 0Z" />
  </svg>
)

// Info / speech bubble icon (header)
const InfoIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="20"
    viewBox="0 0 24 24"
    width="20"
    style={{ fill: "currentColor" }}
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
  </svg>
)

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

const STORAGE_KEY = "yt-studio-ai-ads-v1"

const YouTubeStudioPanel = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showInfoTooltip, setShowInfoTooltip] = useState(false)
  const [frameThumbnails, setFrameThumbnails] = useState<string[]>([])
  const [selectedZone, setSelectedZone] = useState<number | null>(null)
  const [generateDisabledReason, setGenerateDisabledReason] = useState<
    string | null
  >(null)
  const [isGeneratingModalOpen, setIsGeneratingModalOpen] = useState(false)
  const [generatingBrandId, setGeneratingBrandId] = useState<string | null>(null)
  const [generatingStatusIndex, setGeneratingStatusIndex] = useState(0)
  const [generatingPhase, setGeneratingPhase] = useState<"loading" | "result">(
    "loading"
  )
  const [hasValidatedResult, setHasValidatedResult] = useState(false)
  const [savedAdFor, setSavedAdFor] = useState<{
    title: string
    image: string
  } | null>(null)
  const [generatedAdsList, setGeneratedAdsList] = useState<
    Array<{
      sponsorTitle: string
      sponsorImage: string
      thumbnail: string
      zone: number
      brandId: string
    }>
  >([])
  const [previewAdForModal, setPreviewAdForModal] = useState<{
    zone: number
    brandId: string
  } | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const [selectedGeneratedAdIndex, setSelectedGeneratedAdIndex] = useState<
    number | null
  >(null)

  // Restore persisted ads on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.generatedAdsList) setGeneratedAdsList(parsed.generatedAdsList)
        if (parsed.savedAdFor) setSavedAdFor(parsed.savedAdFor)
      }
    } catch {}
  }, [])

  // Persist ads to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ generatedAdsList, savedAdFor }))
    } catch {}
  }, [generatedAdsList, savedAdFor])

  // Auto-select the last generated ad when the list grows
  useEffect(() => {
    if (generatedAdsList.length > 0) {
      setSelectedGeneratedAdIndex(generatedAdsList.length - 1)
    }
  }, [generatedAdsList.length])

  // When opening modal to edit, reselect the previously saved ad
  useEffect(() => {
    if (isModalOpen && savedAdFor && generatedAdsList.length > 0) {
      const idx = generatedAdsList.findIndex(
        (ad) =>
          ad.sponsorTitle === savedAdFor.title &&
          ad.sponsorImage === savedAdFor.image
      )
      if (idx >= 0) {
        setSelectedGeneratedAdIndex(idx)
      }
    }
  }, [isModalOpen])

  const ZONE_POSITIONS = [0.15, 0.48, 0.81] as const

  const canGenerate = selectedZone !== null && selectedOption !== null
  const getGenerateDisabledReason = (): string => {
    if (!selectedOption && selectedZone === null)
      return "Select a brand and a placement zone in the timeline"
    if (!selectedOption) return "Select a brand"
    return "Select a placement zone in the timeline"
  }

  const handleGenerateClick = () => {
    if (canGenerate) {
      setGenerateDisabledReason(null)
      setGeneratingBrandId(selectedOption)
      setIsGeneratingModalOpen(true)
      setGeneratingStatusIndex(0)
      setGeneratingPhase("loading")
    } else {
      setGenerateDisabledReason(getGenerateDisabledReason())
      setTimeout(() => setGenerateDisabledReason(null), 4000)
    }
  }

  const selectZone = (index: number) => {
    setSelectedZone(index)
    if (videoRef.current && duration > 0) {
      const t = ZONE_POSITIONS[index] * duration
      videoRef.current.currentTime = t
      setCurrentTime(t)
    }
  }
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime)
  }
  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration)
  }

  useEffect(() => {
    if (!isModalOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModalOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isModalOpen])

  useEffect(() => {
    if (previewAdForModal === null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewAdForModal(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [previewAdForModal])

  const generatingResultVideoRef = useRef<HTMLVideoElement>(null)
  const regenerateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isGeneratingModalOpen) return
    const statusInterval = setInterval(() => {
      setGeneratingStatusIndex(
        (i) => (i + 1) % GENERATING_STATUS_MESSAGES.length
      )
    }, 1800)
    const resultTimeout = setTimeout(() => setGeneratingPhase("result"), LOADING_DURATION_MS)
    return () => {
      clearInterval(statusInterval)
      clearTimeout(resultTimeout)
    }
  }, [isGeneratingModalOpen])

  const closeGeneratingModal = () => {
    if (regenerateTimeoutRef.current) {
      clearTimeout(regenerateTimeoutRef.current)
      regenerateTimeoutRef.current = null
    }
    setIsGeneratingModalOpen(false)
    setGeneratingBrandId(null)
  }

  const handleResultVideoLoaded = () => {
    if (
      generatingResultVideoRef.current &&
      selectedZone !== null &&
      generatingResultVideoRef.current.duration > 0
    ) {
      generatingResultVideoRef.current.currentTime =
        ZONE_POSITIONS[selectedZone] * generatingResultVideoRef.current.duration
    }
  }

  useEffect(() => {
    if (!videoRef.current || !duration || duration <= 0) return
    const video = videoRef.current
    const savedTime = video.currentTime
    const positions = [0.15, 0.48, 0.81]
    const thumbs: string[] = []
    let idx = 0

    const capture = (): void => {
      if (idx >= positions.length) {
        setFrameThumbnails(thumbs)
        video.currentTime = savedTime
        return
      }
      const t = positions[idx] * duration
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked)
        const canvas = document.createElement("canvas")
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(video, 0, 0)
          thumbs.push(canvas.toDataURL("image/jpeg", 0.8))
        }
        idx++
        capture()
      }
      video.addEventListener("seeked", onSeeked)
      video.currentTime = t
    }
    capture()
  }, [duration])

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = x / rect.width
    const t = Math.max(0, Math.min(duration, pct * duration))
    videoRef.current.currentTime = t
    setCurrentTime(t)
  }

  const selected = RADIO_OPTIONS.find((o) => o.id === selectedOption)

  return (
    <>
      <div
        className="container style-scope ytcp-uploads-video-elements"
        data-plasmo-extension-injection
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          width: "100%",
          padding: "16px 20px",
          margin: "24px 0 0 0",
          background: "#212121",
          borderRadius: "10px",
          fontFamily: '"Roboto","Noto",sans-serif',
          fontSize: "14px"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flex: 1,
            minWidth: 0
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              color: "#ffffff",
              flexShrink: 0
            }}
          >
            <HelpIcon />
          </div>
          <div style={{ minWidth: 0, paddingLeft: "20px" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 500,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              Add AI-generated ads
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 5px",
                  fontSize: "9px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "#4d3a00",
                  background: "#facc15",
                  borderRadius: 3,
                  lineHeight: 1
                }}
              >
                New
              </span>
            </h3>
            <div
              className="section-sublabel"
              style={{
                marginTop: "4px",
                fontSize: "14px",
                color: "#aaaaaa",
                lineHeight: 1.4
              }}
            >
              Create more engaging ads and improve retention on your videos
            </div>
            {savedAdFor && (
              <div
                style={{
                  marginTop: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: "#aaaaaa"
                }}
              >
                <img
                  src={savedAdFor.image}
                  alt=""
                  style={{
                    width: 24,
                    height: 24,
                    objectFit: "contain",
                    borderRadius: 4,
                    background: "#ffffff"
                  }}
                />
                <span>
                  An ad was generated for <strong style={{ color: "#ffffff" }}>{savedAdFor.title}</strong>
                </span>
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4caf50"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          style={{
            height: "36px",
            padding: "0 16px",
            background: "#383838",
            border: "none",
            borderRadius: "9999px",
            fontSize: "14px",
            fontWeight: 500,
            color: "#ffffff",
            cursor: "pointer"
          }}
        >
          {savedAdFor ? "Edit AI Ad" : "Create"}
        </button>
      </div>

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483647,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.7)",
            fontFamily: '"Roboto","Noto",sans-serif'
          }}
          onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
        >
          <div
            style={{
              width: "90%",
              maxWidth: 900,
              maxHeight: "90vh",
              background: "#212121",
              borderRadius: "24px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              boxShadow: "0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                background: "#2a2a2a",
                borderBottom: "1px solid #383838"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  color: "#ffffff",
                  fontSize: "16px",
                  fontWeight: 500
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    color: "#ffffff",
                    flexShrink: 0
                  }}
                >
                  <HelpIcon />
                </div>
                Create AI ad
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexShrink: 0,
                  flexWrap: "nowrap"
                }}
              >
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    height: 36,
                    flexShrink: 0
                  }}
                  onMouseEnter={() => setShowInfoTooltip(true)}
                  onMouseLeave={() => setShowInfoTooltip(false)}
                >
                  <button
                    type="button"
                    style={{
                      width: 36,
                      height: 36,
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "transparent",
                      border: "none",
                      color: "#ffffff",
                      cursor: "pointer",
                      borderRadius: "50%"
                    }}
                    aria-label="Learn more"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      height="24"
                      viewBox="0 0 24 24"
                      width="24"
                      style={{ fill: "currentColor", display: "block" }}
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                    </svg>
                  </button>
                  {showInfoTooltip && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: "50%",
                        transform: "translateX(-50%) translateY(8px)",
                        padding: "12px 16px",
                        background: "#383838",
                        color: "#ffffff",
                        fontSize: "13px",
                        lineHeight: 1.5,
                        borderRadius: "8px",
                        maxWidth: 480,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                        zIndex: 10,
                        pointerEvents: "none"
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        AI-generated ads, seamlessly integrated
                      </div>
                      Create high-converting ads at the perfect moment in your video. Our AI finds the best placement so ads feel native and boost engagement without disrupting the viewer experience.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  style={{
                    height: 36,
                    padding: "0 16px",
                    background: "#383838",
                    border: "none",
                    borderRadius: "9999px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#ffffff",
                    cursor: "pointer"
                  }}
                >
                  Save Draft
                </button>
                {generatedAdsList.length > 0 && (
                  <button
                    type="button"
                    disabled={selectedGeneratedAdIndex === null}
                    onClick={() => {
                      if (selectedGeneratedAdIndex === null) return
                      const ad = generatedAdsList[selectedGeneratedAdIndex]
                      if (ad) {
                        setSavedAdFor({
                          title: ad.sponsorTitle,
                          image: ad.sponsorImage
                        })
                      }
                      setHasValidatedResult(false)
                      setSelectedGeneratedAdIndex(null)
                      setIsModalOpen(false)
                    }}
                    style={{
                      height: 36,
                      padding: "0 16px",
                      background:
                        selectedGeneratedAdIndex !== null
                          ? "#ffffff"
                          : "#666666",
                      border: "1px solid #383838",
                      borderRadius: "9999px",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#0f0f0f",
                      cursor:
                        selectedGeneratedAdIndex !== null
                          ? "pointer"
                          : "not-allowed",
                      opacity: selectedGeneratedAdIndex !== null ? 1 : 0.6
                    }}
                  >
                    Done
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    width: 32,
                    height: 32,
                    padding: 0,
                    background: "transparent",
                    border: "none",
                    color: "#ffffff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  aria-label="Close"
                >
                  <CloseIcon />
                </button>
              </div>
            </header>

            {generatedAdsList.length > 0 && (
              <div
                style={{
                  padding: "12px 20px",
                  borderBottom: "1px solid #383838",
                  background: "#212121"
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#ffffff",
                    marginBottom: 10
                  }}
                >
                  Generated ads
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8
                  }}
                >
                  {generatedAdsList.map((ad, idx) => {
                    const isSelected = selectedGeneratedAdIndex === idx
                    return (
                      <div
                        key={idx}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedGeneratedAdIndex(idx)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setSelectedGeneratedAdIndex(idx)
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "8px 12px",
                          background: isSelected ? "#383838" : "#2a2a2a",
                          borderRadius: 8,
                          cursor: "pointer",
                          border: isSelected
                            ? "1px solid #ffffff"
                            : "1px solid transparent"
                        }}
                      >
                        <img
                          src={ad.thumbnail}
                          alt=""
                          style={{
                            width: 48,
                            height: 28,
                            objectFit: "cover",
                            borderRadius: 4
                          }}
                        />
                        <img
                          src={ad.sponsorImage}
                          alt=""
                          style={{
                            width: 20,
                            height: 20,
                            objectFit: "contain",
                            background: "#ffffff",
                            borderRadius: 4
                          }}
                        />
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flex: 1
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              color: "#ffffff"
                            }}
                          >
                            {ad.sponsorTitle}
                          </span>
                          {isSelected && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "3px 6px",
                                fontSize: "9px",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                color: "#ffffff",
                                background: "rgba(255, 255, 255, 0.2)",
                                borderRadius: 3,
                                lineHeight: 1
                              }}
                            >
                              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Selected
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center"
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            title="Preview"
                            onClick={() =>
                              setPreviewAdForModal({ zone: ad.zone, brandId: ad.brandId })
                            }
                            style={{
                              padding: "6px 10px",
                              background: "#383838",
                              border: "1px solid #555",
                              borderRadius: 6,
                              color: "#ffffff",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6
                            }}
                          >
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            Preview
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => {
                              const newList = generatedAdsList.filter(
                                (_, i) => i !== idx
                              )
                              setGeneratedAdsList(newList)
                              setSelectedGeneratedAdIndex((prev) => {
                                if (prev === null) return null
                                if (newList.length === 0) return null
                                if (prev === idx) {
                                  return idx > 0 ? idx - 1 : 0
                                }
                                return prev > idx ? prev - 1 : prev
                              })
                            }}
                            style={{
                              padding: 6,
                              background: "#4a2020",
                              border: "1px solid #6a3030",
                              borderRadius: 6,
                              color: "#ff6b6b",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                          >
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "40% 1fr",
                gridTemplateRows: "minmax(0, 1fr)",
                gap: 0,
                flex: 1,
                minHeight: 0,
                maxHeight: 460,
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  padding: "24px",
                  borderRight: "1px solid #383838",
                  overflowY: "auto",
                  minHeight: 0,
                  overflowX: "hidden"
                }}
              >
                <div style={{ color: "#ffffff", fontWeight: 500, marginBottom: 8 }}>
                  Available brands
                </div>
                {RADIO_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      padding: "12px",
                      background: selectedOption === opt.id ? "#383838" : "#2a2a2a",
                      borderRadius: "8px",
                      cursor: "pointer",
                      border: selectedOption === opt.id ? "1px solid #ffffff" : "1px solid transparent"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px"
                      }}
                    >
                      <input
                        type="radio"
                        name="ad-format"
                        value={opt.id}
                        checked={selectedOption === opt.id}
                        onChange={() => setSelectedOption(opt.id)}
                        style={{
                          appearance: "none",
                          WebkitAppearance: "none",
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          margin: 0,
                          border:
                            selectedOption === opt.id
                              ? "2px solid #ffffff"
                              : "2px solid #808080",
                          background:
                            selectedOption === opt.id
                              ? "#ffffff"
                              : "transparent",
                          flexShrink: 0
                        }}
                      />
                      <img
                        src={opt.image}
                        alt=""
                        style={{
                          width: 48,
                          height: 48,
                          objectFit: "cover",
                          borderRadius: 4,
                          background: "#ffffff"
                        }}
                      />
                      <div>
                        <div style={{ color: "#ffffff", fontWeight: 500 }}>{opt.title}</div>
                        <div style={{ color: "#aaaaaa", fontSize: 13 }}>{opt.subtitle}</div>
                      </div>
                    </div>
                    {selectedOption === opt.id && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                          marginTop: 0
                        }}
                      >
                        <img
                          src={opt.productImage}
                          alt=""
                          style={{
                            width: "100%",
                            maxHeight: 120,
                            objectFit: "contain",
                            borderRadius: 4,
                            background: "rgba(255, 255, 255, 0.08)"
                          }}
                        />
                        <div
                          style={{
                            color: "#cccccc",
                            fontSize: 14,
                            lineHeight: 1.5
                          }}
                        >
                          {opt.descriptionOnSelect}
                        </div>
                      </div>
                    )}
                  </label>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  padding: "24px",
                  overflow: "hidden",
                  flex: 1
                }}
              >
                <div style={{ color: "#ffffff", fontWeight: 500, marginBottom: 8 }}>
                  Preview
                </div>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                <video
                  ref={videoRef}
                  src={previewVideoUrl}
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  style={{
                    width: "100%",
                    maxHeight: 300,
                    background: "#000"
                  }}
                />
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "20px 24px",
                borderTop: "1px solid #383838"
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px"
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "#888",
                    lineHeight: 1.4
                  }}
                >
                  Timeline — key moments where the ad will be placed for better engagement.
                </p>
                <div
                  style={{
                    position: "relative"
                  }}
                >
                  <div
                    role="slider"
                    tabIndex={0}
                    onClick={handleTimelineClick}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft" && videoRef.current) {
                        videoRef.current.currentTime = Math.max(0, currentTime - 2)
                      }
                      if (e.key === "ArrowRight" && videoRef.current) {
                        videoRef.current.currentTime = Math.min(duration, currentTime + 2)
                      }
                    }}
                    style={{
                      position: "relative",
                      height: 48,
                      background: "#2a2a2a",
                      borderRadius: "4px",
                      overflow: "hidden",
                      cursor: "pointer"
                    }}
                  >
                  {duration > 0 && (
                    <>
                      {[0, 1, 2].map((idx) => {
                        const isSelected = selectedZone === idx
                        const overlay = isSelected
                          ? "rgba(76,175,80,0.3)"
                          : "rgba(255,152,0,0.3)"
                        const borderColor = isSelected ? "#4caf50" : "#ff9800"
                        return (
                          <div
                            key={idx}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation()
                              selectZone(idx)
                            }}
                            style={{
                              position: "absolute",
                              left: `${ZONE_POSITIONS[idx] * 100}%`,
                              width: "8%",
                              top: 0,
                              bottom: 0,
                              opacity: 0.6,
                              background: frameThumbnails[idx]
                                ? `linear-gradient(${overlay}, ${overlay}), url(${frameThumbnails[idx]}) center/cover`
                                : overlay,
                              borderLeft: `1px solid ${borderColor}`,
                              borderRight: `1px solid ${borderColor}`,
                              cursor: "pointer"
                            }}
                          />
                        )
                      })}
                      <div
                        style={{
                          position: "absolute",
                          left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                          transform: "translateX(-50%)",
                          top: 0,
                          width: 3,
                          height: 48,
                          background: "#ffffff",
                          zIndex: 1
                        }}
                      />
                    </>
                  )}
                  </div>
                  {duration > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        left: `${(currentTime / duration) * 100}%`,
                        transform: "translateX(-50%)",
                        top: 48,
                        marginTop: 8,
                        padding: "4px 8px",
                        background: "#383838",
                        borderRadius: "6px",
                        color: "#ffffff",
                        fontSize: 12,
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        zIndex: 2
                      }}
                    >
                      {formatTime(currentTime)}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 8,
                    paddingTop: 12
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      width: "100%"
                    }}
                  >
                    <span style={{ color: "#aaaaaa", fontSize: 13 }}>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                    <div style={{ position: "relative" }}>
                      <button
                        type="button"
                        aria-disabled={!canGenerate}
                        onClick={handleGenerateClick}
                        style={{
                          height: 40,
                          padding: "0 24px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          background: canGenerate ? "#ffffff" : "#383838",
                          border: "none",
                          borderRadius: "9999px",
                          fontSize: 14,
                          fontWeight: 500,
                          color: canGenerate ? "#0f0f0f" : "#6a6a6a",
                          cursor: canGenerate ? "pointer" : "not-allowed"
                        }}
                      >
                        <SparkleIcon size={18} />
                        Generate Ad
                      </button>
                      {generateDisabledReason && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            right: 0,
                            marginTop: 8,
                            padding: "10px 14px",
                            background: "#383838",
                            color: "#ffffff",
                            fontSize: 13,
                            borderRadius: 8,
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                            maxWidth: 280,
                            zIndex: 10
                          }}
                        >
                          {generateDisabledReason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isGeneratingModalOpen && selectedZone !== null && (
        <>
          <style>{`
            @keyframes generatingShimmer {
              0% { background-position: 0% 0; }
              100% { background-position: 200% 0; }
            }
            @keyframes sparkle {
              0%, 100% { opacity: 0; transform: scale(0.8); }
              50% { opacity: 1; transform: scale(1); }
            }
          `}</style>
          <div
            role="dialog"
            aria-modal="true"
            aria-busy={generatingPhase === "loading"}
            aria-live="polite"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2147483647,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.7)",
              fontFamily: '"Roboto","Noto",sans-serif'
            }}
          >
            <div
              style={{
                width: "90%",
                maxWidth: 720,
                background: "#212121",
                borderRadius: 24,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)"
              }}
            >
              {generatingPhase === "loading" && frameThumbnails[selectedZone] ? (
                <>
                  <div
                    style={{
                      padding: 20,
                      flex: 1
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        height: 420,
                        overflow: "hidden",
                        borderRadius: 8
                      }}
                    >
                      <img
                        src={frameThumbnails[selectedZone]}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block"
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "linear-gradient(90deg, transparent 0%, transparent 35%, rgba(255,255,255,0.6) 50%, transparent 65%, transparent 100%)",
                          backgroundSize: "200% 100%",
                          width: "100%",
                          animation: "generatingShimmer 1.8s ease-in-out infinite",
                          pointerEvents: "none"
                        }}
                      />
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          style={{
                            position: "absolute",
                            left: `${15 + (i * 7) % 70}%`,
                            top: `${10 + (i * 11) % 80}%`,
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.9)",
                            boxShadow: "0 0 8px rgba(255,255,255,0.8)",
                            animation: `sparkle 1.5s ease-in-out infinite`,
                            animationDelay: `${(i * 0.15) % 1.5}s`,
                            pointerEvents: "none"
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "12px 20px 16px",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 12
                    }}
                  >
                    <span
                      style={{
                        color: "#888",
                        fontSize: 13
                      }}
                    >
                      {GENERATING_STATUS_MESSAGES[generatingStatusIndex]}
                    </span>
                    <button
                      type="button"
                      onClick={closeGeneratingModal}
                      style={{
                        background: "#383838",
                        border: "none",
                        padding: "0 20px",
                        color: "#ffffff",
                        fontSize: 14,
                        height: 40,
                        borderRadius: "9999px",
                        fontWeight: 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8
                      }}
                    >
                      <StopIcon size={18} />
                      Stop generating
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      padding: 20,
                      flex: 1
                    }}
                  >
                    <div
                      style={{
                        height: 420,
                        overflow: "hidden",
                        background: "#000",
                        borderRadius: 8
                      }}
                    >
                      <video
                        ref={generatingResultVideoRef}
                        src={generatingBrandId === "3" ? googleVideoUrl : videoUrl}
                        controls
                        autoPlay
                        onLoadedMetadata={handleResultVideoLoaded}
                        onError={(e) => {
                          const v = e.currentTarget
                          console.error("[Ad preview video error]", v.error?.message ?? "unknown", v.error?.code)
                        }}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain"
                        }}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "12px 20px 16px",
                      display: "flex",
                      gap: 12,
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "nowrap"
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        color: "#aaaaaa",
                        flexShrink: 0
                      }}
                    >
                      Review your generated ad
                    </span>
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                        flexShrink: 0
                      }}
                    >
                      <button
                        type="button"
                        onClick={closeGeneratingModal}
                        style={{
                          height: 40,
                          padding: "0 20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          background: "#383838",
                          border: "none",
                          borderRadius: "9999px",
                          fontSize: 14,
                          fontWeight: 500,
                          color: "#ffffff",
                          cursor: "pointer"
                        }}
                      >
                        <TrashIcon size={18} />
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (regenerateTimeoutRef.current) {
                            clearTimeout(regenerateTimeoutRef.current)
                          }
                          setGeneratingPhase("loading")
                          setGeneratingStatusIndex(0)
                          regenerateTimeoutRef.current = setTimeout(
                            () => setGeneratingPhase("result"),
                            LOADING_DURATION_MS
                          )
                        }}
                        style={{
                          height: 40,
                          padding: "0 20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          background: "#383838",
                          border: "none",
                          borderRadius: "9999px",
                          fontSize: 14,
                          fontWeight: 500,
                          color: "#ffffff",
                          cursor: "pointer"
                        }}
                      >
                        <RefreshIcon size={18} />
                        Regenerate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const brand = RADIO_OPTIONS.find(
                            (o) => o.id === selectedOption
                          )
                          if (brand && selectedZone !== null) {
                            const thumb = frameThumbnails[selectedZone]
                            if (thumb) {
                              setGeneratedAdsList((prev) => [
                                ...prev,
                                {
                                  sponsorTitle: brand.title,
                                  sponsorImage: brand.image,
                                  thumbnail: thumb,
                                  zone: selectedZone,
                                  brandId: brand.id
                                }
                              ])
                            }
                          }
                          setHasValidatedResult(true)
                          closeGeneratingModal()
                        }}
                        style={{
                          height: 40,
                          padding: "0 20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          background: "#ffffff",
                          border: "none",
                          borderRadius: "9999px",
                          fontSize: 14,
                          fontWeight: 500,
                          color: "#0f0f0f",
                          cursor: "pointer"
                        }}
                      >
                        <CheckIcon size={18} />
                        Validate
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {previewAdForModal !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Preview ad"
          onClick={() => setPreviewAdForModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483647,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.85)",
            cursor: "pointer"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16
            }}
          >
            <video
              ref={previewVideoRef}
              src={previewAdForModal.brandId === "3" ? googleVideoUrl : videoUrl}
              controls
              autoPlay
              onLoadedMetadata={() => {
                const v = previewVideoRef.current
                if (v && v.duration > 0) {
                  const pos = ZONE_POSITIONS[previewAdForModal.zone]
                  v.currentTime = pos * v.duration
                  v.play().catch(() => {})
                }
              }}
              style={{
                maxWidth: "90vw",
                maxHeight: "80vh",
                background: "#000",
                borderRadius: 8
              }}
            />
            <button
              type="button"
              onClick={() => setPreviewAdForModal(null)}
              style={{
                padding: "8px 20px",
                background: "#ffffff",
                border: "none",
                borderRadius: "9999px",
                fontSize: 14,
                fontWeight: 500,
                color: "#0f0f0f",
                cursor: "pointer"
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default YouTubeStudioPanel
