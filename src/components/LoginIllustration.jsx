import React, { useEffect, useRef, useState } from 'react'

export default function LoginIllustration({ isPasswordVisible = false, isLoading = false }) {
  const containerRef = useRef(null)
  const animFrameRef = useRef(null)

  // Target mouse position normalized (-1 to 1)
  const targetMouse = useRef({ x: 0.3, y: -0.1 })

  // Interpolated positions for Female and Male eyes
  const femaleEyePos = useRef({ x: 0, y: 0 })
  const maleEyePos = useRef({ x: 0, y: 0 })
  const headParallax = useRef({ x: 0, y: 0 })

  // State to trigger render updates on RAF
  const [femalePupil, setFemalePupil] = useState({ x: 0, y: 0 })
  const [malePupil, setMalePupil] = useState({ x: 0, y: 0 })
  const [headOffset, setHeadOffset] = useState({ x: 0, y: 0 })
  const [isBlinking, setIsBlinking] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Check user preference for reduced motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)
    const handleChange = (e) => setReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Natural periodic blinking (every 4 seconds)
  useEffect(() => {
    if (isPasswordVisible) return

    const blinkInterval = setInterval(() => {
      setIsBlinking(true)
      setTimeout(() => {
        setIsBlinking(false)
      }, 180)
    }, 4000)

    return () => clearInterval(blinkInterval)
  }, [isPasswordVisible])

  // Real-time responsive mouse tracking
  useEffect(() => {
    if (reducedMotion) return

    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window
      // Normalize: x from -1 (far left) to 1 (far right), y from -1 (top) to 1 (bottom)
      const nx = (e.clientX / innerWidth) * 2 - 1
      const ny = (e.clientY / innerHeight) * 2 - 1
      targetMouse.current = { x: nx, y: ny }
    }

    const handleMouseLeave = () => {
      targetMouse.current = { x: 0.3, y: -0.1 }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('pointermove', handleMouseMove, { passive: true })
    document.addEventListener('mouseleave', handleMouseLeave)

    let isRunning = true
    const loop = () => {
      if (!isRunning) return

      // Snappy, super fluid spring interpolation (lerp factor 0.16)
      const lerp = 0.16
      const headLerp = 0.09

      // Maximum noticeable travel in SVG units:
      // Female eye travel (socket rx=15, ry=18): up to 13.5px X, 11px Y
      const targetFemaleX = targetMouse.current.x * 13.5
      const targetFemaleY = targetMouse.current.y * 11.0

      // Male eye travel (socket rx=14.5, ry=17): up to 12.5px X, 10.5px Y
      const targetMaleX = targetMouse.current.x * 12.5
      const targetMaleY = targetMouse.current.y * 10.5

      // Head parallax shift
      const targetHeadX = targetMouse.current.x * 8.0
      const targetHeadY = targetMouse.current.y * 6.0

      // Interpolate
      femaleEyePos.current.x += (targetFemaleX - femaleEyePos.current.x) * lerp
      femaleEyePos.current.y += (targetFemaleY - femaleEyePos.current.y) * lerp

      maleEyePos.current.x += (targetMaleX - maleEyePos.current.x) * lerp
      maleEyePos.current.y += (targetMaleY - maleEyePos.current.y) * lerp

      headParallax.current.x += (targetHeadX - headParallax.current.x) * headLerp
      headParallax.current.y += (targetHeadY - headParallax.current.y) * headLerp

      setFemalePupil({
        x: femaleEyePos.current.x,
        y: femaleEyePos.current.y,
      })

      setMalePupil({
        x: maleEyePos.current.x,
        y: maleEyePos.current.y,
      })

      setHeadOffset({
        x: headParallax.current.x,
        y: headParallax.current.y,
      })

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      isRunning = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('pointermove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [reducedMotion])

  const eyesClosed = isPasswordVisible || isBlinking

  return (
    <div className="login-illustration-hero" ref={containerRef} aria-hidden="true">
      {/* Background ambient glow lighting */}
      <div className="illustration-glow-ambient" />
      <div className="illustration-glow-spotlight" />

      {/* Top Left Floating Analytics Chart */}
      <div className="floating-analytics-card">
        <div className="analytics-card-dots">
          <span className="dot-bar" />
          <span className="dot-bar" />
          <span className="dot-bar" />
          <span className="dot-bar" />
          <span className="dot-bar" />
        </div>
        <div className="analytics-card-chart">
          <svg width="140" height="54" viewBox="0 0 140 54" fill="none">
            <path
              d="M4 42 C 22 40, 42 24, 62 28 C 82 32, 95 10, 115 16 C 126 19, 133 9, 137 7"
              stroke="#a855f7"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M4 42 C 22 40, 42 24, 62 28 C 82 32, 95 10, 115 16 C 126 19, 133 9, 137 7 L 137 54 L 4 54 Z"
              fill="url(#chartAreaGlow)"
              opacity="0.25"
            />
            <defs>
              <linearGradient id="chartAreaGlow" x1="0" y1="0" x2="0" y2="54" gradientUnits="userSpaceOnUse">
                <stop stopColor="#a855f7" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Floating Left Users Icon Badge */}
      <div className="floating-badge-users">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>

      {/* Floating Right Checklist Badge */}
      <div className="floating-badge-checklist">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2.4" strokeLinecap="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      </div>

      {/* Floating Cursor Pointer & Dotted Trail */}
      <div className="floating-cursor-trail">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="cursor-trail-svg">
          <path
            d="M20 100 C 40 85, 70 80, 80 45 C 85 28, 92 20, 98 12"
            stroke="#a855f7"
            strokeWidth="2.2"
            strokeDasharray="4 4"
            strokeLinecap="round"
            className="trail-dash-anim"
          />
        </svg>
        <div className="cursor-pointer-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff" stroke="#9333ea" strokeWidth="1.8">
            <path d="M3 3l7 18 3-7 7-3L3 3z" />
          </svg>
        </div>
      </div>

      {/* Ambient Floating Dust Particles */}
      <div className="star-dust d1">✦</div>
      <div className="star-dust d2">●</div>
      <div className="star-dust d3">✦</div>
      <div className="star-dust d4">●</div>

      {/* 3D Animated Character Vector Rig */}
      <div className="character-stage-container">
        <svg
          viewBox="0 0 800 660"
          className="character-rig-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradients */}
            <radialGradient id="femaleSkinGrad" cx="38%" cy="32%" r="72%">
              <stop offset="0%" stopColor="#fff0e2" />
              <stop offset="40%" stopColor="#ffdac8" />
              <stop offset="85%" stopColor="#f4baa4" />
              <stop offset="100%" stopColor="#e09b81" />
            </radialGradient>

            <radialGradient id="maleSkinGrad" cx="38%" cy="32%" r="72%">
              <stop offset="0%" stopColor="#ffe9d8" />
              <stop offset="40%" stopColor="#f8cfb9" />
              <stop offset="85%" stopColor="#eeb095" />
              <stop offset="100%" stopColor="#d58b6e" />
            </radialGradient>

            <linearGradient id="femaleHairGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#48291a" />
              <stop offset="45%" stopColor="#2c160b" />
              <stop offset="100%" stopColor="#100703" />
            </linearGradient>

            <linearGradient id="femaleHairHigh" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#75432b" />
              <stop offset="100%" stopColor="#2c160b" />
            </linearGradient>

            <linearGradient id="maleHairGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3d2116" />
              <stop offset="50%" stopColor="#221109" />
              <stop offset="100%" stopColor="#0c0401" />
            </linearGradient>

            <linearGradient id="femaleSuitGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#9333ea" />
              <stop offset="45%" stopColor="#7c3aed" />
              <stop offset="85%" stopColor="#581c87" />
              <stop offset="100%" stopColor="#3b0764" />
            </linearGradient>

            <linearGradient id="maleSuitGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#221f52" />
              <stop offset="50%" stopColor="#161338" />
              <stop offset="100%" stopColor="#080718" />
            </linearGradient>

            <linearGradient id="necktieGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="70%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#4c1d95" />
            </linearGradient>

            <radialGradient id="irisFemale3D" cx="38%" cy="38%" r="62%">
              <stop offset="0%" stopColor="#92400e" />
              <stop offset="35%" stopColor="#78350f" />
              <stop offset="75%" stopColor="#451a03" />
              <stop offset="100%" stopColor="#170902" />
            </radialGradient>

            <radialGradient id="irisMale3D" cx="38%" cy="38%" r="62%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="35%" stopColor="#3730a3" />
              <stop offset="75%" stopColor="#1e1b4b" />
              <stop offset="100%" stopColor="#080512" />
            </radialGradient>

            <linearGradient id="sclera3D" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="25%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>

            <filter id="charShadowDrop" x="-15%" y="-15%" width="130%" height="135%">
              <feDropShadow dx="0" dy="24" stdDeviation="28" floodColor="#04030a" floodOpacity="0.65" />
            </filter>

            {/* EYE CLIPS — cleanly keeps iris inside the socket */}
            <clipPath id="fLeftEyeClip">
              <ellipse cx="202" cy="275" rx="15" ry="18" />
            </clipPath>
            <clipPath id="fRightEyeClip">
              <ellipse cx="266" cy="272" rx="15" ry="18" />
            </clipPath>

            <clipPath id="mLeftEyeClip">
              <ellipse cx="510" cy="242" rx="14.5" ry="17" />
            </clipPath>
            <clipPath id="mRightEyeClip">
              <ellipse cx="578" cy="238" rx="14.5" ry="17" />
            </clipPath>
          </defs>

          {/* ============================================================== */}
          {/* 1. FEMALE CHARACTER (EMPLOYEE) - LEFT                          */}
          {/* ============================================================== */}
          <g
            id="char-female-group"
            filter="url(#charShadowDrop)"
            transform={`translate(${headOffset.x * 0.75}, ${headOffset.y * 0.75})`}
          >
            {/* Long Back Hair */}
            <path
              d="M120,300 C100,380 90,520 150,570 C180,590 220,570 240,550 C230,480 210,400 190,340 Z"
              fill="url(#femaleHairGrad)"
            />
            <path
              d="M160,220 C100,240 85,340 95,470 C105,560 170,590 200,580 C190,490 195,380 210,290 Z"
              fill="url(#femaleHairGrad)"
            />

            {/* Body & Blazer */}
            <g id="female-torso-group">
              <path d="M195,410 L275,410 L250,510 L220,510 Z" fill="#ffffff" />
              <path d="M220,410 L235,465 L250,410 Z" fill="#e2e8f0" />

              <path
                d="M135,460 C150,410 185,405 215,405 L220,540 L120,660 L60,660 C55,590 90,500 135,460 Z"
                fill="url(#femaleSuitGrad)"
              />
              <path
                d="M335,460 C320,410 285,405 255,405 L250,540 L350,660 L410,660 C415,590 380,500 335,460 Z"
                fill="url(#femaleSuitGrad)"
              />
              <path d="M195,405 L240,520 L215,535 L170,445 Z" fill="#a855f7" />
              <path d="M275,405 L230,520 L255,535 L300,445 Z" fill="#9333ea" />
              <path d="M120,630 L350,630 L360,660 L110,660 Z" fill="url(#femaleSuitGrad)" />
            </g>

            {/* Tablet Device & Arms */}
            <g id="female-arms-group">
              <path d="M125,480 C110,540 145,600 190,620 L205,580 C170,560 155,520 160,485 Z" fill="#6b21a8" />
              <path d="M345,480 C360,540 325,600 280,620 L265,580 C300,560 315,520 310,485 Z" fill="#581c87" />

              <rect x="155" y="515" width="160" height="115" rx="14" fill="#1e1338" stroke="#a855f7" strokeWidth="2.8" />
              <rect x="165" y="525" width="140" height="95" rx="9" fill="#2d1a4e" />
              <rect x="175" y="538" width="50" height="7" rx="3.5" fill="#a855f7" />
              <rect x="175" y="552" width="80" height="5" rx="2.5" fill="#ffffff" opacity="0.6" />
              <circle cx="280" cy="552" r="11" fill="#a855f7" opacity="0.3" />
              <polyline points="274 552 278 556 286 548" fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" />
              <rect x="175" y="568" width="120" height="4" rx="2" fill="#ffffff" opacity="0.35" />
              <rect x="175" y="578" width="95" height="4" rx="2" fill="#ffffff" opacity="0.35" />

              <path d="M145,565 C145,545 168,550 172,570 C178,590 152,595 145,565 Z" fill="url(#femaleSkinGrad)" />
              <path d="M325,565 C325,545 302,550 298,570 C292,590 318,595 325,565 Z" fill="url(#femaleSkinGrad)" />
            </g>

            {/* Neck */}
            <path d="M215,350 L255,350 L255,415 L215,415 Z" fill="url(#femaleSkinGrad)" />
            <path d="M215,365 C228,385 242,385 255,365 L255,385 C242,405 228,405 215,385 Z" fill="#be7b64" opacity="0.35" />

            {/* Head & Face */}
            <g id="female-head-group" transform={`translate(${headOffset.x * 0.45}, ${headOffset.y * 0.45})`}>
              <path
                d="M175,275 C175,365 205,395 235,395 C265,395 295,365 295,275 C295,210 265,190 235,190 C205,190 175,210 175,275 Z"
                fill="url(#femaleSkinGrad)"
              />
              <circle cx="175" cy="290" r="12" fill="url(#femaleSkinGrad)" />
              <circle cx="295" cy="290" r="12" fill="url(#femaleSkinGrad)" />
              <circle cx="175" cy="302" r="4" fill="#fbbf24" />
              <circle cx="295" cy="302" r="4" fill="#fbbf24" />

              {/* Eyebrows */}
              <path d="M192,248 C202,240 216,242 224,250" stroke="#2c160b" strokeWidth="3.4" strokeLinecap="round" fill="none" />
              <path d="M246,250 C254,242 268,240 278,248" stroke="#2c160b" strokeWidth="3.4" strokeLinecap="round" fill="none" />

              {/* Nose */}
              <path d="M235,272 C230,290 228,298 238,300" stroke="#c0785d" strokeWidth="2.4" strokeLinecap="round" fill="none" />

              {/* Smile */}
              <path
                d="M218,332 C226,348 244,348 252,332"
                stroke="#be123c"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
              <path d="M224,334 C230,342 240,342 246,334" fill="#ffffff" />

              {/* Soft Cheeks */}
              <ellipse cx="196" cy="305" rx="11" ry="6" fill="#f43f5e" opacity="0.22" />
              <ellipse cx="274" cy="305" rx="11" ry="6" fill="#f43f5e" opacity="0.22" />

              {/* ========================================================== */}
              {/* FEMALE LEFT EYE (DIRECT SVG TRANSFORM TRACKING)            */}
              {/* ========================================================== */}
              <g id="female-left-eye">
                {/* Sclera / Whites */}
                <ellipse cx="202" cy="275" rx="15" ry="18" fill="url(#sclera3D)" />

                {/* Pupil & Iris (Directly transforms via SVG transform attr) */}
                <g clipPath="url(#fLeftEyeClip)">
                  <g transform={`translate(${femalePupil.x}, ${femalePupil.y})`}>
                    <circle cx="202" cy="275" r="9.8" fill="url(#irisFemale3D)" />
                    <circle cx="202" cy="275" r="5.0" fill="#0c0702" />
                    <circle cx="205.5" cy="271.5" r="3.4" fill="#ffffff" />
                    <circle cx="199" cy="279" r="1.7" fill="#ffffff" opacity="0.85" />
                  </g>

                  {/* Top Shadow */}
                  <ellipse cx="202" cy="259" rx="14" ry="4.5" fill="#48291a" opacity="0.35" />

                  {/* Eyelid (Closes on password visible / blink) */}
                  <rect
                    x="184"
                    y="254"
                    width="36"
                    height="42"
                    fill="url(#femaleSkinGrad)"
                    style={{
                      transform: eyesClosed ? 'translateY(0)' : 'translateY(-105%)',
                      transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                  {/* Closed Eyelash line */}
                  <path
                    d="M187,276 Q202,284 217,276"
                    stroke="#1c0f07"
                    strokeWidth="3.4"
                    strokeLinecap="round"
                    fill="none"
                    style={{
                      opacity: eyesClosed ? 1 : 0,
                      transition: 'opacity 0.18s ease',
                    }}
                  />
                </g>

                <path d="M186,272 C194,260 210,260 218,272" stroke="#1c0f07" strokeWidth="3.6" strokeLinecap="round" fill="none" />
              </g>

              {/* ========================================================== */}
              {/* FEMALE RIGHT EYE (DIRECT SVG TRANSFORM TRACKING)           */}
              {/* ========================================================== */}
              <g id="female-right-eye">
                {/* Sclera / Whites */}
                <ellipse cx="266" cy="272" rx="15" ry="18" fill="url(#sclera3D)" />

                {/* Pupil & Iris */}
                <g clipPath="url(#fRightEyeClip)">
                  <g transform={`translate(${femalePupil.x}, ${femalePupil.y})`}>
                    <circle cx="266" cy="272" r="9.8" fill="url(#irisFemale3D)" />
                    <circle cx="266" cy="272" r="5.0" fill="#0c0702" />
                    <circle cx="269.5" cy="268.5" r="3.4" fill="#ffffff" />
                    <circle cx="263" cy="276" r="1.7" fill="#ffffff" opacity="0.85" />
                  </g>

                  {/* Top Shadow */}
                  <ellipse cx="266" cy="256" rx="14" ry="4.5" fill="#48291a" opacity="0.35" />

                  {/* Eyelid */}
                  <rect
                    x="248"
                    y="251"
                    width="36"
                    height="42"
                    fill="url(#femaleSkinGrad)"
                    style={{
                      transform: eyesClosed ? 'translateY(0)' : 'translateY(-105%)',
                      transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                  <path
                    d="M251,273 Q266,281 281,273"
                    stroke="#1c0f07"
                    strokeWidth="3.4"
                    strokeLinecap="round"
                    fill="none"
                    style={{
                      opacity: eyesClosed ? 1 : 0,
                      transition: 'opacity 0.18s ease',
                    }}
                  />
                </g>

                <path d="M250,269 C258,257 274,257 282,269" stroke="#1c0f07" strokeWidth="3.6" strokeLinecap="round" fill="none" />
              </g>

              {/* Front Bangs & Styled Hair Volume */}
              <path
                d="M170,250 C180,185 235,160 280,175 C310,185 305,235 300,265 C290,215 260,195 225,210 C195,220 180,240 170,250 Z"
                fill="url(#femaleHairGrad)"
              />
              <path
                d="M170,250 C190,215 230,220 255,240 C220,230 190,245 170,270 Z"
                fill="url(#femaleHairHigh)"
              />
            </g>
          </g>

          {/* ============================================================== */}
          {/* 2. MALE CHARACTER (SUPERVISOR / MANAGER) - RIGHT               */}
          {/* ============================================================== */}
          <g
            id="char-male-group"
            filter="url(#charShadowDrop)"
            transform={`translate(${headOffset.x * 1.05}, ${headOffset.y * 1.05})`}
          >
            {/* Body & Dark Navy Suit */}
            <g id="male-torso-group">
              <path d="M500,380 L590,380 L570,510 L520,510 Z" fill="#ffffff" />
              <polygon points="538,390 552,390 558,490 545,520 532,490" fill="url(#necktieGrad)" />
              <polygon points="536,385 554,385 550,400 540,400" fill="#581c87" />

              <path
                d="M440,440 C455,390 490,375 525,375 L530,510 L420,660 L350,660 C345,580 380,490 440,440 Z"
                fill="url(#maleSuitGrad)"
              />
              <path
                d="M650,440 C635,390 600,375 565,375 L560,510 L670,660 L740,660 C745,580 710,490 650,440 Z"
                fill="url(#maleSuitGrad)"
              />
              <path d="M505,375 L545,500 L520,510 L470,415 Z" fill="#312e81" />
              <path d="M585,375 L545,500 L570,510 L620,415 Z" fill="#1e1b4b" />
              <path d="M420,620 L670,620 L680,660 L410,660 Z" fill="url(#maleSuitGrad)" />
            </g>

            {/* Folded Arms Pose */}
            <g id="male-folded-arms-group">
              <path
                d="M420,470 C395,520 435,595 515,600 L600,600 C660,595 700,530 675,470 L635,505 C640,545 610,575 570,575 L505,575 C470,575 445,545 450,505 Z"
                fill="#16143c"
              />
              <path d="M485,545 C498,538 518,552 525,568 L492,575 Z" fill="url(#maleSkinGrad)" />
              <path d="M595,545 C582,538 562,552 555,568 L588,575 Z" fill="url(#maleSkinGrad)" />
            </g>

            {/* Neck */}
            <path d="M525,320 L570,320 L570,390 L525,390 Z" fill="url(#maleSkinGrad)" />
            <path d="M525,335 C540,360 555,360 570,335 L570,355 C555,380 540,380 525,355 Z" fill="#be7b64" opacity="0.35" />

            {/* Head & Facial Features */}
            <g id="male-head-group" transform={`translate(${headOffset.x * 0.55}, ${headOffset.y * 0.55})`}>
              <path
                d="M485,245 C485,340 515,370 548,370 C580,370 610,340 610,245 C610,175 580,150 548,150 C515,150 485,175 485,245 Z"
                fill="url(#maleSkinGrad)"
              />
              <circle cx="485" cy="255" r="13" fill="url(#maleSkinGrad)" />
              <circle cx="610" cy="255" r="13" fill="url(#maleSkinGrad)" />

              {/* Styled Volumetric Hair */}
              <path
                d="M472,225 C468,160 508,125 552,125 C596,125 618,155 614,200 C596,190 575,182 542,188 C508,194 485,212 472,225 Z"
                fill="url(#maleHairGrad)"
              />
              <path
                d="M510,135 C555,118 600,135 618,165 C590,148 555,148 510,170 Z"
                fill="#4a2c1d"
              />

              {/* Eyebrows */}
              <path d="M500,223 C512,216 528,217 536,223" stroke="#1c1917" strokeWidth="3.6" strokeLinecap="round" fill="none" />
              <path d="M556,223 C564,217 580,216 592,223" stroke="#1c1917" strokeWidth="3.6" strokeLinecap="round" fill="none" />

              {/* Nose */}
              <path d="M548,240 C544,260 540,270 550,272" stroke="#be7b64" strokeWidth="2.6" strokeLinecap="round" fill="none" />

              {/* Smile */}
              <path
                d="M532,305 C542,318 558,318 568,305"
                stroke="#991b1b"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />

              {/* ========================================================== */}
              {/* MALE LEFT EYE (DIRECT SVG TRANSFORM TRACKING)              */}
              {/* ========================================================== */}
              <g id="male-left-eye">
                <ellipse cx="510" cy="242" rx="14.5" ry="17" fill="url(#sclera3D)" />

                <g clipPath="url(#mLeftEyeClip)">
                  <g transform={`translate(${malePupil.x}, ${malePupil.y})`}>
                    <circle cx="510" cy="242" r="9.2" fill="url(#irisMale3D)" />
                    <circle cx="510" cy="242" r="4.6" fill="#090514" />
                    <circle cx="513.5" cy="238.5" r="3.2" fill="#ffffff" />
                    <circle cx="507" cy="246" r="1.6" fill="#ffffff" opacity="0.8" />
                  </g>

                  <ellipse cx="510" cy="227" rx="13" ry="4" fill="#221109" opacity="0.3" />

                  {/* Eyelid */}
                  <rect
                    x="493"
                    y="223"
                    width="34"
                    height="40"
                    fill="url(#maleSkinGrad)"
                    style={{
                      transform: eyesClosed ? 'translateY(0)' : 'translateY(-105%)',
                      transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                  <path
                    d="M496,243 Q510,250 524,243"
                    stroke="#1c1917"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    fill="none"
                    style={{
                      opacity: eyesClosed ? 1 : 0,
                      transition: 'opacity 0.18s ease',
                    }}
                  />
                </g>

                <path d="M495,240 C502,230 518,230 525,240" stroke="#1c1917" strokeWidth="3.4" strokeLinecap="round" fill="none" />
              </g>

              {/* ========================================================== */}
              {/* MALE RIGHT EYE (DIRECT SVG TRANSFORM TRACKING)             */}
              {/* ========================================================== */}
              <g id="male-right-eye">
                <ellipse cx="578" cy="238" rx="14.5" ry="17" fill="url(#sclera3D)" />

                <g clipPath="url(#mRightEyeClip)">
                  <g transform={`translate(${malePupil.x}, ${malePupil.y})`}>
                    <circle cx="578" cy="238" r="9.2" fill="url(#irisMale3D)" />
                    <circle cx="578" cy="238" r="4.6" fill="#090514" />
                    <circle cx="581.5" cy="234.5" r="3.2" fill="#ffffff" />
                    <circle cx="575" cy="242" r="1.6" fill="#ffffff" opacity="0.8" />
                  </g>

                  <ellipse cx="578" cy="223" rx="13" ry="4" fill="#221109" opacity="0.3" />

                  {/* Eyelid */}
                  <rect
                    x="561"
                    y="219"
                    width="34"
                    height="40"
                    fill="url(#maleSkinGrad)"
                    style={{
                      transform: eyesClosed ? 'translateY(0)' : 'translateY(-105%)',
                      transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                  <path
                    d="M564,239 Q578,246 592,239"
                    stroke="#1c1917"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    fill="none"
                    style={{
                      opacity: eyesClosed ? 1 : 0,
                      transition: 'opacity 0.18s ease',
                    }}
                  />
                </g>

                <path d="M563,236 C570,226 586,226 593,236" stroke="#1c1917" strokeWidth="3.4" strokeLinecap="round" fill="none" />
              </g>

              {/* Stylish Glasses (Layered on top of eyes) */}
              <g id="male-glasses">
                <rect x="488" y="220" width="42" height="38" rx="11" fill="rgba(255,255,255,0.08)" stroke="#111827" strokeWidth="4" />
                <rect x="556" y="216" width="42" height="38" rx="11" fill="rgba(255,255,255,0.08)" stroke="#111827" strokeWidth="4" />
                <path d="M530,234 C540,228 548,228 556,234" stroke="#111827" strokeWidth="4" strokeLinecap="round" fill="none" />
                <path d="M488,232 L470,242" stroke="#111827" strokeWidth="3.4" strokeLinecap="round" />
                <path d="M598,228 L616,238" stroke="#111827" strokeWidth="3.4" strokeLinecap="round" />
                {/* Glare Highlights */}
                <path d="M494,226 L512,226" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity="0.65" />
                <path d="M562,222 L580,222" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity="0.65" />
              </g>
            </g>
          </g>
        </svg>
      </div>

      {/* Hero Headline & Mission Copy */}
      <div className="illustration-caption-block">
        <h2 className="hero-punchline">
          Empowering <span className="text-violet-gradient">People</span>.<br />
          Building <span className="text-violet-gradient">Futures</span>.
        </h2>
        <p className="hero-subtext">
          PerDevSys helps organizations develop their greatest asset — their people.
        </p>
      </div>
    </div>
  )
}
