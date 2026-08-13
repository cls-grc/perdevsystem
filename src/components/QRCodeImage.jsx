import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function QRCodeImage({ value, size = 70, className = '' }) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    if (!value) return
    let active = true
    QRCode.toDataURL(value, {
      margin: 1,
      width: size * 2,
      color: {
        dark: '#282631',
        light: '#ffffff'
      }
    })
      .then(url => {
        if (active) setDataUrl(url)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [value, size])

  if (!dataUrl) {
    return (
      <div
        className={`qr-placeholder ${className}`}
        style={{
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
          background: '#f4f2ff',
          borderRadius: 4,
          fontSize: 10,
          color: '#654bd2'
        }}
      >
        QR
      </div>
    )
  }

  return (
    <img
      src={dataUrl}
      alt="Certificate Verification QR Code"
      className={`qr-code-img ${className}`}
      style={{ width: size, height: size, objectFit: 'contain', borderRadius: 4 }}
    />
  )
}
