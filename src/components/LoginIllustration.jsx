import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Building2,
  Sparkles,
  UtensilsCrossed,
  Waves,
  X,
  Maximize2,
  MapPin,
  CheckCircle2,
  DoorOpen,
} from 'lucide-react'

const HOTEL_CIRCLES = [
  {
    id: 'pool',
    title: 'Poolside Dining & Lantern Terrace',
    tag: 'Restaurant & Lounge',
    image: '/horecaos_hotel_pool.jpg',
    desc: 'Outdoor candlelit dining alongside the illuminated luxury resort pool and palm garden.',
    location: 'Lagoon Terrace & Bistro',
  },
  {
    id: 'cliff',
    title: 'Grand Palace & Reflection Fountain',
    tag: 'Flagship Hotel',
    image: '/horecaos_hotel_cliff.jpg',
    desc: 'Grand luxury hotel facade featuring illuminated glass atrium and circular reflection pool.',
    location: 'Oceanfront Plaza',
  },
  {
    id: 'fountain',
    title: 'Porte-Cochère & Waterfall Plaza',
    tag: 'Grand Entrance',
    image: '/horecaos_hotel_fountain.jpg',
    desc: 'Multi-tiered waterfall entrance plaza with illuminated palm drive and VIP concierge.',
    location: 'Central Gateway',
  },
]

// Floating particle config — fixed positions for consistency
const PARTICLES = [
  { id: 1,  size: 5,  top: '12%', left: '8%',  delay: '0s',   dur: '7s'   },
  { id: 2,  size: 3,  top: '25%', left: '18%', delay: '1.2s', dur: '9s'   },
  { id: 3,  size: 6,  top: '38%', left: '5%',  delay: '0.5s', dur: '8s'   },
  { id: 4,  size: 4,  top: '55%', left: '22%', delay: '2.1s', dur: '6.5s' },
  { id: 5,  size: 3,  top: '70%', left: '10%', delay: '0.9s', dur: '10s'  },
  { id: 6,  size: 7,  top: '80%', left: '30%', delay: '1.7s', dur: '7.5s' },
  { id: 7,  size: 4,  top: '18%', left: '72%', delay: '0.3s', dur: '8.5s' },
  { id: 8,  size: 5,  top: '45%', left: '80%', delay: '1.5s', dur: '7s'   },
  { id: 9,  size: 3,  top: '62%', left: '68%', delay: '2.4s', dur: '9.5s' },
  { id: 10, size: 6,  top: '88%', left: '55%', delay: '0.7s', dur: '6s'   },
  { id: 11, size: 4,  top: '8%',  left: '45%', delay: '1.9s', dur: '8s'   },
  { id: 12, size: 3,  top: '92%', left: '78%', delay: '0.4s', dur: '11s'  },
]

// Ambient glowing orb config
const ORBS = [
  { id: 1, size: 180, top: '-5%', left: '-8%',  delay: '0s',   dur: '12s', opacity: 0.18 },
  { id: 2, size: 240, top: '30%', left: '55%',  delay: '3s',   dur: '16s', opacity: 0.10 },
  { id: 3, size: 140, top: '70%', left: '-5%',  delay: '1.5s', dur: '10s', opacity: 0.15 },
  { id: 4, size: 200, top: '85%', left: '60%',  delay: '5s',   dur: '14s', opacity: 0.08 },
]


const TAGLINES = [
  'Where Luxury Meets Excellence',
  'Crafting Unforgettable Experiences',
  'Your Premier Hospitality Partner',
  'Redefining Hotel Management',
]

export default function LoginIllustration({
  isLoggingInSuccess = false,
}) {
  const containerRef = useRef(null)
  const animFrameRef = useRef(null)
  const targetMouse = useRef({ x: 0, y: 0 })
  const sceneParallax = useRef({ x: 0, y: 0 })

  const [previewHotel, setPreviewHotel] = useState(null)
  const [parallax, setParallax] = useState({ x: 0, y: 0 })
  const [isMountedPop, setIsMountedPop] = useState(false)
  const [taglineIdx, setTaglineIdx] = useState(0)
  const [taglineFading, setTaglineFading] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    } catch {
      return false
    }
  })

  // Trigger pop-out animation on mount
  useEffect(() => {
    const t = setTimeout(() => setIsMountedPop(true), 60)
    return () => clearTimeout(t)
  }, [])

  // Rotating tagline cycle
  useEffect(() => {
    if (reducedMotion) return
    const interval = setInterval(() => {
      setTaglineFading(true)
      setTimeout(() => {
        setTaglineIdx((prev) => (prev + 1) % TAGLINES.length)
        setTaglineFading(false)
      }, 500)
    }, 3500)
    return () => clearInterval(interval)
  }, [reducedMotion])

  // Reduced motion listener
  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      const handler = (e) => setReducedMotion(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } catch {
      return undefined
    }
  }, [])

  // Mouse tilt / parallax
  useEffect(() => {
    if (reducedMotion || previewHotel || isLoggingInSuccess) return
    const onMove = (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      targetMouse.current = { x: nx, y: ny }
    }
    const onLeave = () => { targetMouse.current = { x: 0, y: 0 } }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('mouseleave', onLeave)

    let alive = true
    const loop = () => {
      if (!alive) return
      const lerp = 0.06
      sceneParallax.current.x += (targetMouse.current.x * 10 - sceneParallax.current.x) * lerp
      sceneParallax.current.y += (targetMouse.current.y * 6 - sceneParallax.current.y) * lerp
      setParallax({ x: sceneParallax.current.x, y: sceneParallax.current.y })
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
  }, [reducedMotion, previewHotel, isLoggingInSuccess])

  return (
    <div
      className={`ref-showcase-container ${isMountedPop ? 'ref-popped-in' : 'ref-initial-pop'} ${isLoggingInSuccess ? 'login-transition-active' : ''}`}
      ref={containerRef}
      aria-label="HORECAOS Hotel and Restaurant Visual Showcase"
    >
      {/* ── AMBIENT GLOWING ORBS ────────────────────────────────────────────── */}
      {ORBS.map((orb) => (
        <div
          key={orb.id}
          className="lx-orb"
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            left: orb.left,
            opacity: orb.opacity,
            animationDelay: orb.delay,
            animationDuration: orb.dur,
          }}
        />
      ))}

      {/* ── AURORA SWEEP LAYER ──────────────────────────────────────────────── */}
      <div className="lx-aurora-layer" aria-hidden="true" />

      {/* ── FLOATING BOKEH PARTICLES ────────────────────────────────────────── */}
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className="lx-particle"
          style={{
            width: p.size,
            height: p.size,
            top: p.top,
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.dur,
          }}
        />
      ))}

      {/* ── ARCHITECTURAL SKETCH LINE-ART ───────────────────────────────────── */}
      <svg className="ref-sketch-art-svg" viewBox="0 0 700 800" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#ffffff" strokeWidth="1.5" opacity="0.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 120 140 L 350 70 L 420 100 V 700 H 120 Z" fill="none" />
          <path d="M 160 210 H 380 M 160 270 H 380 M 160 330 H 380 M 160 390 H 380" strokeDasharray="6 6" />
          <path d="M 360 200 L 540 140 L 660 200 V 740 H 360 Z" fill="none" />
          <path d="M 400 280 H 610 M 400 360 H 610 M 400 440 H 610" strokeDasharray="6 6" />
          <path d="M 180 500 A 35 35 0 0 1 250 500 V 620 H 180 Z" />
          <path d="M 280 500 A 35 35 0 0 1 350 500 V 620 H 280 Z" />
        </g>
        {/* Animated building line-draw paths */}
        <g stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" fill="none" strokeLinecap="round">
          <path className="lx-draw-path lx-draw-1" d="M 60 750 L 60 400 L 150 380 L 150 750" strokeDasharray="600" strokeDashoffset="600" />
          <path className="lx-draw-path lx-draw-2" d="M 550 730 L 550 350 L 680 320 L 680 730" strokeDasharray="700" strokeDashoffset="700" />
          <path className="lx-draw-path lx-draw-3" d="M 60 400 H 150 M 60 450 H 150 M 60 500 H 150 M 60 550 H 150 M 60 600 H 150" strokeDasharray="200" strokeDashoffset="200" />
        </g>
        {/* Lightning bolts */}
        <g stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.85">
          <path className="ref-bolt b-top-left"     d="M 50 50 L 70 70 L 58 78 L 80 102" />
          <path className="ref-bolt b-top-mid"      d="M 460 55 L 480 75 L 470 83 L 488 107" />
          <path className="ref-bolt b-mid"          d="M 370 290 L 385 305 L 377 312 L 390 330" />
          <path className="ref-bolt b-bottom-left"  d="M 55 690 L 72 708 L 64 715 L 80 735" />
          <path className="ref-bolt b-bottom-right" d="M 610 510 L 630 530 L 620 538 L 640 560" stroke="#fde047" />
        </g>
      </svg>

      {/* ── TOP BRAND HEADER ────────────────────────────────────────────────── */}
      <div className="ref-brand-header lx-slide-down">
        <div className="ref-brand-icon-box lx-pulse-ring-wrap">
          <Building2 size={22} color="#ffffff" />
        </div>
        <div className="ref-brand-title-wrap">
          <div className="ref-brand-main">HORECAOS</div>
          <div className="ref-brand-sub">HOTEL AND RESTAURANT</div>
        </div>
      </div>

      {/* ── ROTATING TAGLINE ────────────────────────────────────────────────── */}
      <div className="lx-tagline-wrap">
        <span className={`lx-tagline-text ${taglineFading ? 'lx-tagline-out' : 'lx-tagline-in'}`}>
          {TAGLINES[taglineIdx]}
        </span>
        <span className="lx-tagline-cursor" aria-hidden="true">|</span>
      </div>

      {/* ── CENTERED VERTICAL TRACK & 3 HOTEL CIRCLES ──────────────────────── */}
      <div
        className="ref-showcase-stage centered-stage"
        style={{
          transform: isLoggingInSuccess
            ? undefined
            : `perspective(1000px) rotateY(${parallax.x * 0.35}deg) rotateX(${-parallax.y * 0.3}deg) translate3d(${parallax.x * 0.7}px, ${parallax.y * 0.7}px, 0)`,
        }}
      >
        {/* Dark vertical panel bar */}
        <div className="ref-vertical-bar" />

        {/* 1. LARGE CIRCLE — Poolside */}
        <div
          className="ref-hotel-circle circle-large pop-step-1"
          onClick={() => setPreviewHotel(HOTEL_CIRCLES[0])}
          title="Click to view full photo: Poolside Dining & Lantern Terrace"
        >
          <div className="lx-circle-pulse-ring lx-ring-violet" />
          <div className="ref-circle-frame">
            <img src="/horecaos_hotel_pool.jpg" alt="HORECAOS Hotel Poolside Restaurant" className="ref-circle-img" />
            <div className="ref-circle-badge">
              <UtensilsCrossed size={11} className="text-violet-accent" />
              <span>Poolside Dining</span>
            </div>
            <div className="ref-click-hint"><Maximize2 size={14} /></div>
          </div>
          <div className="ref-floating-chip chip-top-right">
            <Sparkles size={12} className="text-violet-accent" />
            <span>Lantern Terrace</span>
          </div>
        </div>

        {/* 2. MEDIUM CIRCLE — Grand Palace */}
        <div
          className="ref-hotel-circle circle-medium pop-step-2"
          onClick={() => setPreviewHotel(HOTEL_CIRCLES[1])}
          title="Click to view full photo: Grand Palace & Reflection Fountain"
        >
          <div className="lx-circle-pulse-ring lx-ring-amber" />
          <div className="ref-circle-frame">
            <img src="/horecaos_hotel_cliff.jpg" alt="HORECAOS Grand Palace" className="ref-circle-img" />
            <div className="ref-circle-badge">
              <Building2 size={11} className="text-violet-accent" />
              <span>Grand Hotel</span>
            </div>
            <div className="ref-click-hint"><Maximize2 size={13} /></div>
          </div>
          <div className="ref-floating-chip chip-bottom-right">
            <Waves size={12} className="text-violet-accent" />
            <span>Reflection Fountain</span>
          </div>
        </div>

        {/* 3. SMALL CIRCLE — Entrance Plaza */}
        <div
          className="ref-hotel-circle circle-small pop-step-3"
          onClick={() => setPreviewHotel(HOTEL_CIRCLES[2])}
          title="Click to view full photo: Porte-Cochère & Waterfall Plaza"
        >
          <div className="lx-circle-pulse-ring lx-ring-emerald" />
          <div className="ref-circle-frame plate-border">
            <img src="/horecaos_hotel_fountain.jpg" alt="HORECAOS Entrance Plaza" className="ref-circle-img" />
            <div className="ref-click-hint"><Maximize2 size={12} /></div>
          </div>
          <div className="ref-floating-chip chip-mini">
            <span>Entrance Plaza</span>
          </div>
        </div>
      </div>


      {/* ── INTERACTIVE FULL IMAGE LIGHTBOX (PORTALED TO BODY) ──────────────── */}
      {previewHotel && typeof document !== 'undefined' && createPortal(
        <div className="ref-modal-backdrop" onClick={() => setPreviewHotel(null)}>
          <div className="ref-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ref-modal-close-btn"
              onClick={() => setPreviewHotel(null)}
              aria-label="Close Preview"
            >
              <X size={18} />
            </button>
            <div className="ref-modal-img-wrap">
              <img src={previewHotel.image} alt={previewHotel.title} className="ref-modal-img" />
            </div>
            <div className="ref-modal-content">
              <div className="ref-modal-tag">{previewHotel.tag}</div>
              <h3 className="ref-modal-title">{previewHotel.title}</h3>
              <p className="ref-modal-desc">{previewHotel.desc}</p>
              <div className="ref-modal-meta">
                <MapPin size={13} className="text-violet-accent" />
                <span>{previewHotel.location} • HORECAOS Hotel and Restaurant</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
