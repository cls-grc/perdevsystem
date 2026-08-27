import React, { useEffect, useRef, useState } from 'react'

export default function LoginIllustration({
  isPasswordVisible = false,
  isLoading = false,
  isLoggingInSuccess = false,
  isDark = true,
}) {
  const containerRef = useRef(null)
  const animFrameRef = useRef(null)
  const targetMouse = useRef({ x: 0.2, y: -0.1 })
  const sceneParallax = useRef({ x: 0, y: 0 })

  const [parallax, setParallax] = useState({ x: 0, y: 0 })
  const [staffEye, setStaffEye] = useState({ x: 0, y: 0 })
  const [isBlinking, setIsBlinking] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const h = (e) => setReducedMotion(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  useEffect(() => {
    if (isPasswordVisible) return
    const id = setInterval(() => {
      setIsBlinking(true)
      setTimeout(() => setIsBlinking(false), 180)
    }, 4200)
    return () => clearInterval(id)
  }, [isPasswordVisible])

  useEffect(() => {
    if (reducedMotion) return
    const onMove = (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      targetMouse.current = { x: nx, y: ny }
    }
    const onLeave = () => { targetMouse.current = { x: 0.15, y: -0.08 } }
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('mouseleave', onLeave)
    let alive = true
    const loop = () => {
      if (!alive) return
      const lerp = 0.07
      sceneParallax.current.x += (targetMouse.current.x * 16 - sceneParallax.current.x) * lerp
      sceneParallax.current.y += (targetMouse.current.y * 12 - sceneParallax.current.y) * lerp
      setParallax({ x: sceneParallax.current.x, y: sceneParallax.current.y })
      setStaffEye({ x: targetMouse.current.x * 7, y: targetMouse.current.y * 5 })
      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)
    return () => {
      alive = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [reducedMotion])

  const eyesClosed = isPasswordVisible || isBlinking

  // ─── STAR POSITIONS (dark mode) ─────────────────────────────────────────────
  const starData = [
    // left sky
    { cx:42,   cy:35,  r:1.5, d:'0s'   }, { cx:115,  cy:18,  r:2.8, d:'1.2s' },
    { cx:88,   cy:62,  r:1.2, d:'0.6s' }, { cx:195,  cy:42,  r:2.0, d:'2.1s' },
    { cx:148,  cy:100, r:1.5, d:'1.7s' }, { cx:260,  cy:28,  r:1.8, d:'0.4s' },
    { cx:310,  cy:80,  r:1.2, d:'2.8s' }, { cx:340,  cy:48,  r:2.4, d:'1.0s' },
    { cx:22,   cy:115, r:1.5, d:'1.5s' }, { cx:370,  cy:125, r:1.8, d:'0.9s' },
    { cx:280,  cy:108, r:1.2, d:'2.3s' }, { cx:235,  cy:68,  r:2.0, d:'0.2s' },
    // center top (above tower crown)
    { cx:455,  cy:28,  r:1.5, d:'3.1s' }, { cx:590,  cy:18,  r:1.8, d:'0.7s' },
    { cx:680,  cy:38,  r:1.2, d:'1.8s' }, { cx:525,  cy:52,  r:1.5, d:'2.5s' },
    { cx:740,  cy:115, r:1.5, d:'2.2s' }, { cx:160,  cy:115, r:1.2, d:'3.4s' },
    // right sky
    { cx:820,  cy:50,  r:2.0, d:'1.4s' }, { cx:875,  cy:25,  r:1.5, d:'0.3s' },
    { cx:920,  cy:72,  r:1.8, d:'2.0s' }, { cx:1000, cy:40,  r:2.4, d:'1.1s' },
    { cx:1052, cy:65,  r:1.2, d:'2.7s' }, { cx:1082, cy:30,  r:1.8, d:'0.5s' },
    { cx:782,  cy:92,  r:1.5, d:'1.9s' }, { cx:972,  cy:112, r:1.2, d:'1.6s' },
    { cx:855,  cy:108, r:1.8, d:'3.0s' }, { cx:1030, cy:95,  r:1.5, d:'0.8s' },
  ]

  // ─── THEME PALETTE ────────────────────────────────────────────────────────
  const C = isDark ? {
    facadeTop:'#2e1065', facadeMid:'#1e1b4b', facadeBot:'#0f172a',
    facadeSideTop:'#170d38', facadeSideBot:'#090a16',
    roofTop:'#4c1d95', roofBot:'#312e81',
    bistroTop:'#3730a3', bistroBot:'#1e1b4b',
    bistroSide:'#1e1b4b', bistroSideStroke:'#312e81',
    crownFill:'#1e1b4b',
    plazaTop:'#18182c', plazaSideL:'#0d0e1a', plazaSideR:'#090a14',
    signBg:'#090a16',
    elevShaft:'rgba(15,23,42,0.85)',
    fountainBase:'#0f172a',
    patioRect:'rgba(15,23,42,0.7)', patioTable:'#334155',
    staffL:'#1e1b4b', staffR:'#4c1d95',
    floorRect:'rgba(255,255,255,0.03)',
    floorStroke:'rgba(99,102,241,0.35)', floorStroke5:'rgba(168,85,247,0.35)',
    plazaStroke:'rgba(168,85,247,0.45)', plazaSideStroke:'rgba(168,85,247,0.2)',
    towerStroke:'#6366f1', bistroStroke:'#4338ca',
    roofStroke:'#4c1d95', crownStroke:'#818cf8',
    bldgA:'#1a1035', bldgB:'#0f1729', bldgC:'#12142a', bldgD:'#0a0c1e',
    bldgBg:'#0b0c1a', bldgSideA:'#0d0920', bldgSideB:'#080a18',
    bldgWin:'#fef08a', bldgWinB:'#38bdf8', bldgWinC:'#a855f7',
    bldgStroke:'rgba(99,102,241,0.5)', bldgStrokeAlt:'rgba(168,85,247,0.4)',
    bldgBgFill:'#06070f',
  } : {
    facadeTop:'#c7d2fe', facadeMid:'#dde1fc', facadeBot:'#e0e7ff',
    facadeSideTop:'#a5b4fc', facadeSideBot:'#93c5fd',
    roofTop:'#818cf8', roofBot:'#6366f1',
    bistroTop:'#a5b4fc', bistroBot:'#c7d2fe',
    bistroSide:'#93c5fd', bistroSideStroke:'#6366f1',
    crownFill:'#e0e7ff',
    plazaTop:'#cbd5e1', plazaSideL:'#94a3b8', plazaSideR:'#64748b',
    signBg:'#1e1b4b',
    elevShaft:'rgba(148,163,184,0.6)',
    fountainBase:'#bfdbfe',
    patioRect:'rgba(148,163,184,0.45)', patioTable:'#94a3b8',
    staffL:'#4338ca', staffR:'#7c3aed',
    floorRect:'rgba(99,102,241,0.08)',
    floorStroke:'rgba(99,102,241,0.4)', floorStroke5:'rgba(124,58,237,0.45)',
    plazaStroke:'rgba(99,102,241,0.55)', plazaSideStroke:'rgba(99,102,241,0.3)',
    towerStroke:'#4f46e5', bistroStroke:'#4f46e5',
    roofStroke:'#4338ca', crownStroke:'#6366f1',
    bldgA:'#ddd6fe', bldgB:'#e0e7ff', bldgC:'#c7d2fe', bldgD:'#bfdbfe',
    bldgBg:'#ede9fe', bldgSideA:'#a5b4fc', bldgSideB:'#93c5fd',
    bldgWin:'#fef08a', bldgWinB:'#7dd3fc', bldgWinC:'#c4b5fd',
    bldgStroke:'rgba(99,102,241,0.45)', bldgStrokeAlt:'rgba(124,58,237,0.4)',
    bldgBgFill:'#c7d2fe',
  }

  const wo  = isDark ? '0.82' : '0.58'  // window opacity normal
  const woH = isDark ? '0.95' : '0.72'  // window opacity highlight

  return (
    <div className={`login-illustration-hero ${isLoggingInSuccess ? 'login-success-portal-active' : ''}`}
      ref={containerRef} aria-hidden="true">
      <div className="illustration-glow-ambient" />
      <div className="illustration-glow-spotlight" />



      {/* VIP Keycard on login */}
      {isLoggingInSuccess && (
        <div className="vip-keycard-hologram-overlay">
          <div className="keycard-pulse-ring" />
          <div className="keycard-card">
            <div className="keycard-chip" />
            <div className="keycard-logo">HORECAOS LUXURY RESORT</div>
            <div className="keycard-status">WELCOME ACCESS GRANTED</div>
            <div className="keycard-bar" />
          </div>
        </div>
      )}

      {/* 3D HOTEL CITY SCENE */}
      <div className="hotel-scene-container"
        style={{
          transform: `perspective(1200px) rotateY(${parallax.x * 0.4}deg) rotateX(${-parallax.y * 0.3}deg) translate3d(${parallax.x}px,${parallax.y}px,0)`,
          transition: 'transform 0.15s ease-out',
        }}>
        {/*
          viewBox: 0 0 1100 800
          Scene shifted ~50px lower vs previous to give more ground presence
          Buildings spread edge-to-edge: x=0..1100
          Main tower: x=390–790 (400px wide), crown peak y=60
          Bistro left wing: x=155–388 (233px wide)
          Left Annex: x=50–150 (100px wide)
          Left Garden Pavilion: x=145–215 (70px wide)
          Left Spa (far): x=0–45 (silhouette only)
          Right Conf Center: x=793–908 (115px wide)
          Right Arcade: x=908–990 (82px wide)
          Right Tower B (far): x=988–1055 (67px wide)
          Far bg skyline: x=0..1100 (ghosted)
          Ground base: y=680
        */}
        <svg viewBox="0 0 1100 800" className="hotel-architectural-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="skyGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#c084fc" stopOpacity={isDark?'0.3':'0.18'}/>
              <stop offset="50%"  stopColor="#6366f1" stopOpacity={isDark?'0.2':'0.1'}/>
              <stop offset="100%" stopColor={isDark?'#0f172a':'#e0e7ff'} stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="facadeFront" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={C.facadeTop}/>
              <stop offset="50%"  stopColor={C.facadeMid}/>
              <stop offset="100%" stopColor={C.facadeBot}/>
            </linearGradient>
            <linearGradient id="facadeSide3D" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={C.facadeSideTop}/>
              <stop offset="100%" stopColor={C.facadeSideBot}/>
            </linearGradient>
            <linearGradient id="roofSlab3D" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor={C.roofTop}/>
              <stop offset="100%" stopColor={C.roofBot}/>
            </linearGradient>
            <linearGradient id="hotelGlass3D" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#38bdf8" stopOpacity="0.45"/>
              <stop offset="50%"  stopColor="#818cf8" stopOpacity="0.25"/>
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0.15"/>
            </linearGradient>
            <linearGradient id="bistroFront3D" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={C.bistroTop}/>
              <stop offset="100%" stopColor={C.bistroBot}/>
            </linearGradient>
            <linearGradient id="bldgGradA" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={C.bldgA}/>
              <stop offset="100%" stopColor={C.bldgB}/>
            </linearGradient>
            <linearGradient id="bldgGradB" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={C.bldgC}/>
              <stop offset="100%" stopColor={C.bldgD}/>
            </linearGradient>
            <linearGradient id="bldgRoofA" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor={C.bldgSideA}/>
              <stop offset="100%" stopColor={C.bldgSideB}/>
            </linearGradient>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#fef08a"/>
              <stop offset="30%"  stopColor="#fbbf24"/>
              <stop offset="70%"  stopColor="#f59e0b"/>
              <stop offset="100%" stopColor="#d97706"/>
            </linearGradient>
            <linearGradient id="volBeam" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%"   stopColor="#fbbf24" stopOpacity="0.95"/>
              <stop offset="50%"  stopColor="#a855f7" stopOpacity="0.5"/>
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
            </linearGradient>
            <filter id="glowGold" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="b"/>
              <feComposite in="SourceGraphic" in2="b" operator="over"/>
            </filter>
            <filter id="glowWarm" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="b"/>
              <feComposite in="SourceGraphic" in2="b" operator="over"/>
            </filter>
            <filter id="glowSoft" x="-15%" y="-15%" width="130%" height="130%">
              <feGaussianBlur stdDeviation="2" result="b"/>
              <feComposite in="SourceGraphic" in2="b" operator="over"/>
            </filter>
            {/* Moon glow */}
            <filter id="glowMoon" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="10" result="b"/>
              <feComposite in="SourceGraphic" in2="b" operator="over"/>
            </filter>
            {/* Sun glow */}
            <filter id="glowSun" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="12" result="b"/>
              <feComposite in="SourceGraphic" in2="b" operator="over"/>
            </filter>
            {/* Crescent moon mask — white=show, black circle=cut crescent */}
            <mask id="moonCrescent">
              <rect width="1100" height="800" fill="white"/>
              <circle cx="982" cy="58" r="30" fill="black"/>
            </mask>
            {/* Seamless right-edge fade mask */}
            <mask id="edgeFadeMask">
              <linearGradient id="edgeFadeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="white"/>
                <stop offset="86%" stopColor="white"/>
                <stop offset="96%" stopColor="white" stopOpacity="0.35"/>
                <stop offset="100%" stopColor="white" stopOpacity="0"/>
              </linearGradient>
              <rect width="1100" height="800" fill="url(#edgeFadeGrad)"/>
            </mask>
          </defs>

          {/* Masked scene content for smooth boundary fade */}
          <g mask="url(#edgeFadeMask)">

          {/* ── SKY ATMOSPHERE (dark: moon+stars | light: sun+clouds) ── */}
          <g className="sky-atmosphere">
            {isDark ? (
              <>
                {/* Crescent Moon */}
                <circle cx="960" cy="76" r="40"
                  fill="#fef9c3" opacity="0.92"
                  mask="url(#moonCrescent)"
                  filter="url(#glowMoon)"
                />
                {/* Soft halo ring */}
                <circle cx="960" cy="76" r="48"
                  fill="none" stroke="#fef08a" strokeWidth="1.5" opacity="0.18"
                />
                {/* Stars */}
                {starData.map((s, i) => (
                  <circle
                    key={i}
                    className="star-twinkle"
                    style={{ animationDelay: s.d }}
                    cx={s.cx} cy={s.cy} r={s.r}
                    fill="white" opacity="0.88"
                  />
                ))}
              </>
            ) : (
              <>
                {/* Sun */}
                <circle cx="155" cy="82" r="44"
                  fill="#fbbf24" opacity="0.95"
                  filter="url(#glowSun)"
                />
                {/* Sun rays */}
                <g className="sun-rays" transform="translate(155,82)">
                  {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg => (
                    <line key={deg}
                      transform={`rotate(${deg})`}
                      x1="52" y1="0" x2="72" y2="0"
                      stroke="#f59e0b" strokeWidth="3.5"
                      strokeLinecap="round" opacity="0.85"
                    />
                  ))}
                </g>
                {/* Cloud 1 — upper right, slow drift */}
                <g className="cloud-drift" style={{ animationDuration:'22s', animationDelay:'0s' }}>
                  <ellipse cx="740" cy="52" rx="68" ry="28" fill="white" opacity="0.92"/>
                  <ellipse cx="790" cy="38" rx="48" ry="26" fill="white" opacity="0.92"/>
                  <ellipse cx="690" cy="44" rx="40" ry="22" fill="white" opacity="0.92"/>
                  <ellipse cx="756" cy="52" rx="85" ry="18" fill="white" opacity="0.78"/>
                </g>
                {/* Cloud 2 — upper center, medium drift */}
                <g className="cloud-drift" style={{ animationDuration:'30s', animationDelay:'-12s' }}>
                  <ellipse cx="490" cy="42" rx="56" ry="22" fill="white" opacity="0.82"/>
                  <ellipse cx="536" cy="30" rx="38" ry="20" fill="white" opacity="0.82"/>
                  <ellipse cx="448" cy="36" rx="32" ry="18" fill="white" opacity="0.82"/>
                  <ellipse cx="492" cy="42" rx="68" ry="14" fill="white" opacity="0.68"/>
                </g>
                {/* Cloud 3 — far right, fastest drift */}
                <g className="cloud-drift" style={{ animationDuration:'18s', animationDelay:'-6s' }}>
                  <ellipse cx="980" cy="68" rx="52" ry="20" fill="white" opacity="0.78"/>
                  <ellipse cx="1022" cy="56" rx="34" ry="18" fill="white" opacity="0.78"/>
                  <ellipse cx="942"  cy="60" rx="30" ry="16" fill="white" opacity="0.78"/>
                  <ellipse cx="982" cy="68" rx="64" ry="12" fill="white" opacity="0.64"/>
                </g>
              </>
            )}
          </g>

          {/* ── FAR BACKGROUND CITY SKYLINE ── */}
          <g className="surround-bg-skyline" opacity={isDark?'0.5':'0.38'}>
            {/* Left far silhouettes */}
            <rect x="0"   y="340" width="30"  height="345" fill={C.bldgBgFill} stroke={C.bldgStroke} strokeWidth="0.8"/>
            <rect x="5"   y="305" width="20"  height="40"  fill={C.bldgBgFill} stroke={C.bldgStroke} strokeWidth="0.8"/>
            <rect x="32"  y="360" width="22"  height="325" fill={C.bldgBgFill} stroke={C.bldgStroke} strokeWidth="0.8"/>
            <rect x="56"  y="315" width="18"  height="370" fill={C.bldgBgFill} stroke={C.bldgStroke} strokeWidth="0.8"/>
            <rect x="76"  y="290" width="14"  height="38"  fill={C.bldgBgFill} stroke={C.bldgStroke} strokeWidth="0.8"/>
            {/* Right far silhouettes */}
            <rect x="1022" y="330" width="30" height="355" fill={C.bldgBgFill} stroke={C.bldgStroke} strokeWidth="0.8"/>
            <rect x="1028" y="290" width="16" height="44"  fill={C.bldgBgFill} stroke={C.bldgStroke} strokeWidth="0.8"/>
            <rect x="1054" y="350" width="25" height="335" fill={C.bldgBgFill} stroke={C.bldgStroke} strokeWidth="0.8"/>
            <rect x="1060" y="310" width="14" height="42"  fill={C.bldgBgFill} stroke={C.bldgStroke} strokeWidth="0.8"/>
            <rect x="1080" y="370" width="20" height="315" fill={C.bldgBgFill} stroke={C.bldgStroke} strokeWidth="0.8"/>
            {/* Tiny far windows */}
            <rect x="4"    y="355" width="9" height="6" rx="1" fill={C.bldgWin}  opacity="0.5"/>
            <rect x="35"   y="372" width="8" height="5" rx="1" fill={C.bldgWinB} opacity="0.5"/>
            <rect x="59"   y="328" width="8" height="5" rx="1" fill={C.bldgWinC} opacity="0.5"/>
            <rect x="1025" y="344" width="9" height="6" rx="1" fill={C.bldgWin}  opacity="0.5"/>
            <rect x="1057" y="362" width="8" height="5" rx="1" fill={C.bldgWinB} opacity="0.5"/>
            <rect x="1083" y="382" width="8" height="5" rx="1" fill={C.bldgWinC} opacity="0.5"/>
          </g>

          {/* ── GROUND PLAZA (full width) ── */}
          <g className="hotel-anim-foundation">
            <ellipse cx="550" cy="720" rx="530" ry="58" fill="url(#skyGlow)"/>
            {/* 3D isometric base slab — full width */}
            <path d="M 0 680 L 550 640 L 1100 680 L 550 725 Z" fill={C.plazaTop} stroke={C.plazaStroke} strokeWidth="2.5"/>
            <path d="M 0 680 L 550 725 L 550 742 L 0 697 Z"    fill={C.plazaSideL} stroke={C.plazaSideStroke}/>
            <path d="M 550 725 L 1100 680 L 1100 697 L 550 742 Z" fill={C.plazaSideR} stroke={C.plazaSideStroke}/>
            {/* LED driveway lines */}
            <path d="M 60 672 L 550 650 L 1040 672" stroke="#818cf8" strokeWidth="2" strokeDasharray="8 5" opacity="0.7"/>
            <path d="M 550 650 L 550 720" stroke="#fbbf24" strokeWidth="2.5" opacity="0.9"/>
            {/* Fountain */}
            <ellipse cx="550" cy="662" rx="42" ry="14" fill={C.fountainBase} stroke="#38bdf8" strokeWidth="1.5"/>
            <ellipse cx="550" cy="662" rx="34" ry="11" fill="#0284c7" opacity="0.8"/>
            <path d="M 550 662 Q 538 634 532 639 M 550 662 Q 550 628 550 634 M 550 662 Q 562 634 568 639"
              stroke="#7dd3fc" strokeWidth="2" fill="none" strokeLinecap="round"/>
            {/* Palms — now at true edges */}
            <path d="M 90 672 Q 82 600 62 576"  stroke="#047857" strokeWidth="7" strokeLinecap="round"/>
            <path d="M 62 576 Q 26 564 12 582 M 62 576 Q 36 548 22 542 M 62 576 Q 76 546 94 553 M 62 576 Q 100 572 106 590"
              stroke="#10b981" strokeWidth="4" strokeLinecap="round"/>
            <path d="M 1010 672 Q 1018 600 1038 576" stroke="#047857" strokeWidth="7" strokeLinecap="round"/>
            <path d="M 1038 576 Q 1074 564 1088 582 M 1038 576 Q 1064 548 1078 542 M 1038 576 Q 1024 546 1006 553 M 1038 576 Q 1000 572 994 590"
              stroke="#10b981" strokeWidth="4" strokeLinecap="round"/>
          </g>

          {/* ── FAR-LEFT: SPA TOWER (x 0–90) ── */}
          <g className="surround-bldg-far-l">
            <rect x="2"   y="430" width="88" height="255" rx="6" fill="url(#bldgGradA)" stroke={C.bldgStroke} strokeWidth="1.5"/>
            <path d="M 90 430 L 106 416 L 106 680 L 90 685 Z" fill={C.bldgSideA} stroke={C.bldgStrokeAlt} strokeWidth="1"/>
            <path d="M 2 430 L 16 416 L 106 416 L 90 430 Z"   fill="url(#bldgRoofA)" stroke={C.bldgStrokeAlt} strokeWidth="1"/>
            {/* Spire */}
            <line x1="46" y1="416" x2="46" y2="392" stroke={C.bldgWin} strokeWidth="2.5" opacity="0.85"/>
            <circle cx="46" cy="389" r="5" fill={C.bldgWin} filter="url(#glowSoft)" opacity="0.95"/>
            {/* Sign */}
            <rect x="8"  y="440" width="74" height="15" rx="3" fill={C.signBg} stroke="url(#goldGrad)" strokeWidth="1"/>
            <text x="45" y="452" textAnchor="middle" fill="#fbbf24" fontSize="7.5" fontWeight="900" letterSpacing="0.8">SPA & WELLNESS</text>
            {/* Windows 4×2 */}
            {[0,1,2,3].map(r=>[0,1].map(c=>(
              <rect key={`spa-${r}-${c}`}
                x={10+c*38} y={464+r*46} width="28" height="32" rx="3"
                fill={r%2===0?C.bldgWin:C.bldgWinB} opacity={wo} filter="url(#glowSoft)"/>
            )))}
            {/* Entrance */}
            <path d="M 8 668 L 88 668 L 84 685 L 12 685 Z" fill="#7c3aed" opacity="0.8"/>
          </g>

          {/* ── NEAR-LEFT: HORECAOS ANNEX (x 92–215) ── */}
          <g className="surround-bldg-left1">
            <rect x="92"  y="380" width="122" height="305" rx="8" fill="url(#bldgGradA)" stroke={C.bldgStroke} strokeWidth="2"/>
            <path d="M 214 380 L 232 362 L 232 678 L 214 685 Z" fill={C.bldgSideA} stroke={C.bldgStrokeAlt} strokeWidth="1.5"/>
            <path d="M 92 380 L 108 362 L 232 362 L 214 380 Z"  fill="url(#bldgRoofA)" stroke={C.bldgStrokeAlt} strokeWidth="1.5"/>
            {/* Rooftop lanterns */}
            <line x1="96" y1="362" x2="212" y2="362" stroke="#818cf8" strokeWidth="2" opacity="0.7"/>
            <circle cx="124" cy="358" r="6" fill="#fbbf24" filter="url(#glowSoft)" opacity="0.9"/>
            <circle cx="153" cy="358" r="6" fill="#fbbf24" filter="url(#glowSoft)" opacity="0.9"/>
            <circle cx="182" cy="358" r="6" fill="#fbbf24" filter="url(#glowSoft)" opacity="0.9"/>
            {/* Sign */}
            <rect x="100" y="390" width="106" height="15" rx="3" fill={C.signBg} stroke="url(#goldGrad)" strokeWidth="1"/>
            <text x="153" y="402" textAnchor="middle" fill="#fbbf24" fontSize="7" fontWeight="900" letterSpacing="0.8">HORECAOS ANNEX</text>
            {/* Windows 5×2 */}
            {[0,1,2,3,4].map(r=>[0,1].map(c=>(
              <rect key={`anx-${r}-${c}`}
                x={102+c*54} y={414+r*48} width="38" height="34" rx="3"
                fill={c===0?C.bldgWin:C.bldgWinC} opacity={wo} filter="url(#glowSoft)"/>
            )))}
            {/* Entrance awning */}
            <path d="M 98 664 L 210 664 L 205 680 L 103 680 Z" fill="#e11d48" opacity="0.85"/>
            <path d="M 98 664 L 210 664" stroke="#fbbf24" strokeWidth="2"/>
            <path d="M 116 664 L 113 680 M 138 664 L 135 680 M 160 664 L 157 680 M 182 664 L 179 680"
              stroke="#fff" strokeWidth="6" opacity="0.4"/>
          </g>

          {/* ── NEAR-LEFT: GARDEN PAVILION (x 218–298) ── */}
          <g className="surround-bldg-left2">
            <rect x="218" y="448" width="80"  height="237" rx="6" fill="url(#bldgGradB)" stroke={C.bldgStroke} strokeWidth="1.5"/>
            <path d="M 298 448 L 312 434 L 312 680 L 298 685 Z" fill={C.bldgSideB} stroke={C.bldgStroke} strokeWidth="1"/>
            <path d="M 218 448 L 230 434 L 312 434 L 298 448 Z" fill="url(#bldgRoofA)" strokeWidth="1"/>
            {/* Glass dome */}
            <ellipse cx="258" cy="434" rx="24" ry="11" fill="url(#hotelGlass3D)" stroke="#c084fc" strokeWidth="1.5"/>
            {/* Windows 4×1 */}
            {[0,1,2,3].map(r=>(
              <rect key={`gard-${r}`} x={228} y={466+r*50} width="56" height="36" rx="3"
                fill={r%2===0?C.bldgWin:C.bldgWinB} opacity={wo} filter="url(#glowSoft)"/>
            ))}
            {/* Green garden strip */}
            <rect x="222" y="650" width="72" height="10" fill="#047857" opacity="0.75" rx="3"/>
          </g>

          {/* ── BISTRO FINE DINING (x 155–388) ── */}
          <g className="hotel-anim-restaurant">
            <rect x="155" y="390" width="233" height="295" rx="10" fill="url(#bistroFront3D)" stroke={C.bistroStroke} strokeWidth="2.5"/>
            <path d="M 388 390 L 415 373 L 415 678 L 388 685 Z" fill={C.bistroSide} stroke={C.bistroSideStroke} strokeWidth="1.5"/>
            <path d="M 155 390 L 178 373 L 415 373 L 388 390 Z" fill="url(#roofSlab3D)" stroke={C.roofStroke}/>
            <rect x="162" y="400" width="220" height="9"   fill="url(#goldGrad)"/>
            {/* Awning */}
            <path d="M 140 444 L 404 444 L 393 476 L 152 476 Z" fill="#e11d48" opacity="0.95"/>
            <path d="M 140 444 L 404 444" stroke="#fbbf24" strokeWidth="3"/>
            <path d="M 166 444 L 161 476 M 196 444 L 191 476 M 226 444 L 221 476 M 256 444 L 251 476 M 286 444 L 281 476 M 316 444 L 311 476 M 346 444 L 341 476 M 376 444 L 371 476"
              stroke="#fff" strokeWidth="8" opacity="0.4"/>
            {/* Signboard */}
            <rect x="186" y="410" width="156" height="26" rx="5" fill={C.signBg} stroke="url(#goldGrad)" strokeWidth="1.5"/>
            <text x="264" y="428" textAnchor="middle" fill="#fbbf24" fontSize="12" fontWeight="900" letterSpacing="1.5" filter="url(#glowWarm)">
              HORECAOS BISTRO
            </text>
            {/* Dining windows 2 rows × 3 cols */}
            {[0,1].map(r=>[0,1,2].map(c=>(
              <rect key={`bist-${r}-${c}`} className="win-glow"
                x={168+c*68} y={490+r*62} width="52" height="46" rx="5"
                fill={r===0?'#fef08a':'#fbbf24'} opacity={r===0?woH:wo} filter="url(#glowWarm)"/>
            )))}
            <circle cx="194" cy="508" r="7" fill="#fbbf24"/>
            <circle cx="264" cy="508" r="7" fill="#fbbf24"/>
            <circle cx="334" cy="508" r="7" fill="#fbbf24"/>
            <path d="M 185 534 H 203 M 194 522 V 534" stroke={isDark?'#78350f':'#92400e'} strokeWidth="2"/>
            <path d="M 255 534 H 273 M 264 522 V 534" stroke={isDark?'#78350f':'#92400e'} strokeWidth="2"/>
            <path d="M 325 534 H 343 M 334 522 V 534" stroke={isDark?'#78350f':'#92400e'} strokeWidth="2"/>
            {/* Patio */}
            <rect x="162" y="612" width="220" height="52" fill={C.patioRect} rx="6" stroke="rgba(168,85,247,0.3)"/>
            <circle cx="204" cy="637" r="10" fill={C.patioTable} stroke="#94a3b8"/>
            <circle cx="264" cy="637" r="10" fill={C.patioTable} stroke="#94a3b8"/>
            <circle cx="324" cy="637" r="10" fill={C.patioTable} stroke="#94a3b8"/>
            <circle cx="204" cy="637" r="5"  fill="#f97316" filter="url(#glowWarm)"/>
            <circle cx="264" cy="637" r="5"  fill="#f97316" filter="url(#glowWarm)"/>
            <circle cx="324" cy="620" r="4"  fill="#fbbf24" filter="url(#glowWarm)"/>
          </g>

          {/* ── MAIN HORECAOS HOTEL TOWER (x 390–790) ── */}
          <g className="hotel-anim-tower">
            {/* Tower front */}
            <rect x="390" y="130" width="400" height="555" rx="16" fill="url(#facadeFront)" stroke={C.towerStroke} strokeWidth="3"/>
            {/* 3D side */}
            <path d="M 790 130 L 836 106 L 836 660 L 790 685 Z" fill="url(#facadeSide3D)" stroke={C.bistroSideStroke} strokeWidth="2"/>
            {/* 3D roof */}
            <path d="M 390 130 L 432 106 L 836 106 L 790 130 Z" fill="url(#roofSlab3D)" stroke={C.roofStroke} strokeWidth="2"/>

            {/* Crown */}
            <g className="horecaos-brand-crown">
              <path d="M 390 130 L 590 58 L 790 130 Z" fill={C.crownFill} stroke={C.crownStroke} strokeWidth="2.5"/>
              <path d="M 500 108 A 90 90 0 0 1 680 108 Z" fill="url(#hotelGlass3D)" stroke="#c084fc" strokeWidth="2"/>
              <g transform="translate(590, 84) scale(2.4)" fill="url(#goldGrad)" filter="url(#glowGold)">
                <path d="M0 -7 L2 -2 L7 -2 L3 1 L5 6 L0 3 L-5 6 L-3 1 L-7 -2 L-2 -2 Z"/>
              </g>
              <g className="horecaos-title-popup">
                <rect x="398" y="138" width="384" height="36" rx="8" fill={C.signBg} stroke="url(#goldGrad)" strokeWidth="2.5"/>
                <text x="590" y="162" textAnchor="middle" fill="url(#goldGrad)"
                  fontSize="13" fontWeight="900" letterSpacing="1" filter="url(#glowGold)">
                  HORECAOS HOTEL AND RESTAURANT
                </text>
              </g>
            </g>

            {/* Floor 5 — Penthouse */}
            <g className="hotel-floor floor-5">
              <rect x="410" y="185" width="360" height="62" rx="6" fill={C.floorRect} stroke={C.floorStroke5}/>
              <line x1="410" y1="238" x2="770" y2="238" stroke="#c084fc" strokeWidth="2" opacity="0.6"/>
              <rect className="win-glow delay-5" x="424" y="194" width="64" height="40" rx="4" fill="#a855f7" opacity={wo}  filter="url(#glowGold)"/>
              <rect className="win-glow delay-5" x="508" y="194" width="64" height="40" rx="4" fill="#3b82f6" opacity={wo}  filter="url(#glowGold)"/>
              <rect className="win-glow delay-5" x="592" y="194" width="64" height="40" rx="4" fill="#fef08a" opacity={woH} filter="url(#glowGold)"/>
              <rect className="win-glow delay-5" x="676" y="194" width="64" height="40" rx="4" fill="#a855f7" opacity={wo}  filter="url(#glowGold)"/>
            </g>

            {/* Floor 4 — Executive */}
            <g className="hotel-floor floor-4">
              <rect x="410" y="260" width="360" height="62" rx="6" fill={C.floorRect} stroke={C.floorStroke}/>
              <line x1="410" y1="313" x2="770" y2="313" stroke="#818cf8" strokeWidth="2" opacity="0.6"/>
              <rect className="win-glow delay-4" x="424" y="269" width="64" height="40" rx="4" fill="#fef08a" opacity={woH} filter="url(#glowGold)"/>
              <rect className="win-glow delay-4" x="508" y="269" width="64" height="40" rx="4" fill="#6366f1" opacity={wo}  filter="url(#glowGold)"/>
              <rect className="win-glow delay-4" x="592" y="269" width="64" height="40" rx="4" fill="#fef08a" opacity={woH} filter="url(#glowGold)"/>
              <rect className="win-glow delay-4" x="676" y="269" width="64" height="40" rx="4" fill="#38bdf8" opacity={wo}  filter="url(#glowGold)"/>
            </g>

            {/* Floor 3 — Superior */}
            <g className="hotel-floor floor-3">
              <rect x="410" y="335" width="360" height="62" rx="6" fill={C.floorRect} stroke={C.floorStroke}/>
              <line x1="410" y1="388" x2="770" y2="388" stroke="#818cf8" strokeWidth="2" opacity="0.6"/>
              <rect className="win-glow delay-3" x="424" y="344" width="64" height="40" rx="4" fill="#38bdf8" opacity={wo}  filter="url(#glowGold)"/>
              <rect className="win-glow delay-3" x="508" y="344" width="64" height="40" rx="4" fill="#fef08a" opacity={woH} filter="url(#glowGold)"/>
              <rect className="win-glow delay-3" x="592" y="344" width="64" height="40" rx="4" fill="#c084fc" opacity={wo}  filter="url(#glowGold)"/>
              <rect className="win-glow delay-3" x="676" y="344" width="64" height="40" rx="4" fill="#fef08a" opacity={woH} filter="url(#glowGold)"/>
            </g>

            {/* Floor 2 — Ballroom */}
            <g className="hotel-floor floor-2">
              <rect x="410" y="410" width="360" height="62" rx="6" fill={C.floorRect} stroke={C.floorStroke}/>
              <rect className="win-glow delay-2" x="424" y="420" width="156" height="42" rx="4" fill="#fef08a" opacity={woH} filter="url(#glowGold)"/>
              <rect className="win-glow delay-2" x="594" y="420" width="156" height="42" rx="4" fill="#a855f7" opacity={wo}  filter="url(#glowGold)"/>
            </g>

            {/* Elevator shaft */}
            <rect x="570" y="185" width="34" height="290" rx="5" fill={C.elevShaft} stroke="#818cf8" strokeWidth="1.5"/>
            <rect className="elevator-car-anim" x="573" y="414" width="28" height="36" rx="4" fill="#f59e0b" filter="url(#glowGold)"/>

            {/* Grand Porte-Cochère */}
            <g className="hotel-lobby-portico">
              <path d="M 402 484 L 778 484 L 808 524 L 372 524 Z" fill="url(#goldGrad)"/>
              <rect x="385" y="516" width="410" height="9" fill="#d97706"/>
              <rect x="414" y="524" width="18" height="160" fill="url(#goldGrad)"/>
              <rect x="520" y="524" width="18" height="160" fill="url(#goldGrad)"/>
              <rect x="640" y="524" width="18" height="160" fill="url(#goldGrad)"/>
              <rect x="748" y="524" width="18" height="160" fill="url(#goldGrad)"/>
              {/* Lobby interior glow */}
              <rect x="432" y="524" width="322" height="160" fill="#fef08a" opacity={isDark?'0.4':'0.3'} filter="url(#glowGold)"/>

              {/* Volumetric beam on login */}
              <path className={`entrance-light-beam ${isLoggingInSuccess?'beam-active':''}`}
                d="M 480 524 L 700 524 L 870 700 L 310 700 Z"
                fill="url(#volBeam)" filter="url(#glowGold)"/>

              {/* Entrance Doors */}
              <g className={`hotel-entrance-doors ${isLoggingInSuccess?'doors-open':''}`}>
                <g className="door-leaf left-door-leaf">
                  <rect className="door-panel" x="530" y="532" width="52" height="108" rx="4"
                    fill="url(#hotelGlass3D)" stroke="#f59e0b" strokeWidth="2.5"/>
                  <line x1="574" y1="576" x2="574" y2="602" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/>
                </g>
                <g className="door-leaf right-door-leaf">
                  <rect className="door-panel" x="584" y="532" width="52" height="108" rx="4"
                    fill="url(#hotelGlass3D)" stroke="#f59e0b" strokeWidth="2.5"/>
                  <line x1="592" y1="576" x2="592" y2="602" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/>
                </g>
              </g>

              {/* Red carpet */}
              <path d="M 516 650 L 654 650 L 672 700 L 498 700 Z" fill="#be123c" stroke="#f59e0b" strokeWidth="1.5"/>
            </g>

            {/* Staff characters */}
            <g className="hospitality-staff-avatars" transform={`translate(${staffEye.x * 0.8},${staffEye.y * 0.6})`}>
              {/* Concierge — feet at lobby floor y=684, figure height=65 → translate y=619 */}
              <g transform="translate(466, 619)">
                <path d="M 12 35 C 5 35,2 55,2 65 L 28 65 C 28 55,25 35,18 35 Z" fill={C.staffL} stroke="#f59e0b" strokeWidth="1.5"/>
                <polygon points="13,37 17,37 15,40" fill="#fbbf24"/>
                <circle cx="15" cy="22" r="11" fill="#fde047"/>
                <path d="M 5 16 C 5 10,25 10,25 16 Z" fill="#b91c1c"/>
                <rect x="5" y="15" width="20" height="3" fill="#fbbf24"/>
                {!eyesClosed ? (<>
                  <circle cx={12+staffEye.x*0.3} cy={22+staffEye.y*0.3} r="2" fill="#0f172a"/>
                  <circle cx={18+staffEye.x*0.3} cy={22+staffEye.y*0.3} r="2" fill="#0f172a"/>
                </>) : (<>
                  <line x1="10" y1="22" x2="14" y2="22" stroke="#0f172a" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="16" y1="22" x2="20" y2="22" stroke="#0f172a" strokeWidth="2" strokeLinecap="round"/>
                </>)}
                <path d="M 12 27 Q 15 30 18 27" stroke="#0f172a" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </g>
              {/* Hostess — feet at lobby floor y=684 */}
              <g transform="translate(680, 619)">
                <path d="M 12 35 C 4 35,0 55,0 65 L 26 65 C 26 55,22 35,14 35 Z" fill={C.staffR} stroke="#a855f7" strokeWidth="1.5"/>
                <circle cx="13" cy="22" r="10" fill="#fde047"/>
                <path d="M 2 20 C 2 8,24 8,24 20 C 24 24,20 12,13 12 C 6 12,2 24,2 20 Z" fill="#78350f"/>
                {!eyesClosed ? (<>
                  <circle cx={10+staffEye.x*0.3} cy={21+staffEye.y*0.3} r="2" fill="#0f172a"/>
                  <circle cx={16+staffEye.x*0.3} cy={21+staffEye.y*0.3} r="2" fill="#0f172a"/>
                </>) : (<>
                  <line x1="8"  y1="21" x2="12" y2="21" stroke="#0f172a" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="14" y1="21" x2="18" y2="21" stroke="#0f172a" strokeWidth="2" strokeLinecap="round"/>
                </>)}
                <path d="M 10 26 Q 13 29 16 26" stroke="#0f172a" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </g>
            </g>
          </g>

          {/* ── NEAR-RIGHT: CONVENTION CENTER (x 793–918) ── */}
          <g className="surround-bldg-right1">
            <rect x="793" y="368" width="125" height="317" rx="8" fill="url(#bldgGradA)" stroke={C.bldgStroke} strokeWidth="2"/>
            <path d="M 918 368 L 940 350 L 940 678 L 918 685 Z" fill={C.bldgSideA} stroke={C.bldgStrokeAlt} strokeWidth="1.5"/>
            <path d="M 793 368 L 812 350 L 940 350 L 918 368 Z" fill="url(#bldgRoofA)" stroke={C.bldgStrokeAlt} strokeWidth="1.5"/>
            {/* Helipad */}
            <circle cx="855" cy="347" r="14" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.85"/>
            <text x="855" y="352" textAnchor="middle" fill="#fbbf24" fontSize="10" fontWeight="900" opacity="0.95">H</text>
            {/* Sign */}
            <rect x="800" y="378" width="110" height="16" rx="3" fill={C.signBg} stroke="url(#goldGrad)" strokeWidth="1"/>
            <text x="855" y="390" textAnchor="middle" fill="#fbbf24" fontSize="7.5" fontWeight="900" letterSpacing="0.8">CONVENTION CTR</text>
            {/* Windows 5×3 */}
            {[0,1,2,3,4].map(r=>[0,1,2].map(c=>(
              <rect key={`conf-${r}-${c}`}
                x={802+c*38} y={404+r*50} width="28" height="36" rx="3"
                fill={r%2===0?(c%2===0?C.bldgWin:C.bldgWinB):C.bldgWinC}
                opacity={wo} filter="url(#glowSoft)"/>
            )))}
            {/* Entrance */}
            <path d="M 800 664 L 912 664 L 907 685 L 805 685 Z" fill="#7c3aed" opacity="0.8"/>
          </g>

          {/* ── NEAR-RIGHT: THE ARCADE (x 920–1005) ── */}
          <g className="surround-bldg-right2">
            <rect x="920" y="430" width="82" height="255" rx="6" fill="url(#bldgGradB)" stroke={C.bldgStroke} strokeWidth="1.5"/>
            <path d="M 1002 430 L 1018 415 L 1018 678 L 1002 685 Z" fill={C.bldgSideB} stroke={C.bldgStroke} strokeWidth="1"/>
            <path d="M 920 430 L 934 415 L 1018 415 L 1002 430 Z" fill="url(#bldgRoofA)" strokeWidth="1"/>
            {/* Arch accent */}
            <path d="M 928 415 A 28 28 0 0 1 996 415 Z" fill="url(#hotelGlass3D)" stroke="#818cf8" strokeWidth="1.5"/>
            {/* Sign */}
            <rect x="928" y="440" width="66" height="15" rx="3" fill={C.signBg} stroke="url(#goldGrad)" strokeWidth="1"/>
            <text x="961" y="452" textAnchor="middle" fill="#fbbf24" fontSize="7.5" fontWeight="900" letterSpacing="0.8">THE ARCADE</text>
            {/* Windows 4×2 */}
            {[0,1,2,3].map(r=>[0,1].map(c=>(
              <rect key={`arc-${r}-${c}`}
                x={928+c*36} y={464+r*50} width="24" height="34" rx="3"
                fill={r%2===0?C.bldgWin:C.bldgWinC} opacity={wo} filter="url(#glowSoft)"/>
            )))}
            {/* Retail awning */}
            <path d="M 922 648 L 1000 648 L 996 668 L 926 668 Z" fill="#e11d48" opacity="0.85"/>
            <path d="M 922 648 L 1000 648" stroke="#fbbf24" strokeWidth="1.5"/>
            <path d="M 938 648 L 935 668 M 955 648 L 952 668 M 972 648 L 969 668 M 989 648 L 986 668"
              stroke="#fff" strokeWidth="5" opacity="0.4"/>
          </g>

          {/* ── FAR-RIGHT: TOWER B (x 1007–1097) ── */}
          <g className="surround-bldg-far-r">
            <rect x="1007" y="412" width="88" height="273" rx="6" fill="url(#bldgGradA)" stroke={C.bldgStroke} strokeWidth="1.5"/>
            <path d="M 1095 412 L 1100 396 L 1100 678 L 1095 685 Z" fill={C.bldgSideA} stroke={C.bldgStrokeAlt} strokeWidth="1"/>
            <path d="M 1007 412 L 1021 396 L 1100 396 L 1095 412 Z" fill="url(#bldgRoofA)" strokeWidth="1"/>
            {/* Spire */}
            <line x1="1051" y1="396" x2="1051" y2="368" stroke={C.bldgWinB} strokeWidth="2.5" opacity="0.85"/>
            <circle cx="1051" cy="364" r="5" fill={C.bldgWinB} filter="url(#glowSoft)" opacity="0.95"/>
            {/* Sign */}
            <rect x="1014" y="422" width="74" height="15" rx="3" fill={C.signBg} stroke="url(#goldGrad)" strokeWidth="1"/>
            <text x="1051" y="434" textAnchor="middle" fill="#fbbf24" fontSize="7.5" fontWeight="900" letterSpacing="0.8">TOWER B</text>
            {/* Windows 4×2 */}
            {[0,1,2,3].map(r=>[0,1].map(c=>(
              <rect key={`twrb-${r}-${c}`}
                x={1015+c*40} y={446+r*52} width="28" height="36" rx="3"
                fill={c===0?C.bldgWin:C.bldgWinB} opacity={wo} filter="url(#glowSoft)"/>
            )))}
          </g>

          </g>
        </svg>
      </div>
    </div>
  )
}
