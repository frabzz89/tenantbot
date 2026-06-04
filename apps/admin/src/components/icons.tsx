// Brand SVG icons — Telegram and WhatsApp
// Inline SVGs so no external dependency is needed.

export function TelegramIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="50" cy="50" r="50" fill="#229ED9" />
      <path
        fill="white"
        fillRule="evenodd"
        d="M18 47 L84 22 C88 20 92 25 89 31 L73 83 C71 88 66 89 62 86 L44 72 L36 80
           C35 81 33 81 32 80 L34 66 L76 29 C78 27 75 25 73 27 L27 57 L13 53
           C9 52 9 49 18 47 Z"
      />
    </svg>
  )
}

export function WhatsAppIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="50" cy="50" r="50" fill="#25D366" />
      <path
        fill="white"
        d="M50.3 17c-18.2 0-33 14.7-33 32.8 0 5.8 1.6 11.2 4.3 15.9L17 83l17.6-4.5
           c4.5 2.5 9.7 3.9 15.2 3.9h.1c18.2 0 33-14.7 33-32.8C82.9 31.5 68.1 17 50.3 17z
           m.1 59.9c-5 0-9.7-1.3-13.8-3.6l-1-.6L26.4 75l2.8-10.1-.7-1
           c-2.6-4.1-4-8.9-4-14 0-15.3 12.5-27.7 27.8-27.7 7.5 0 14.5 2.9 19.7 7.9
           s8 12 8 19.3c-.1 15.2-12.6 27.5-27.6 27.5z
           m15.2-20.7c-.8-.4-4.9-2.4-5.6-2.7-.7-.3-1.2-.4-1.8.4-.5.8-2 2.7-2.5 3.2
           -.5.5-.9.6-1.8.2-4.4-2.2-7.3-3.9-10.2-8.8-.8-1.3.8-1.2 2.2-4
           .2-.4.1-.8-.1-1.2-.2-.4-1.8-4.3-2.5-5.9-.6-1.5-1.3-1.3-1.8-1.3h-.5
           c-.5 0-1.4.2-2.1 1-.7.8-2.8 2.8-2.8 6.8s2.9 7.9 3.3 8.4
           c.4.5 5.6 8.6 13.7 12 5.1 2.2 7 2.4 9.5 2 1.5-.3 4.7-1.9 5.4-3.8
           .7-1.9.7-3.5.5-3.8-.3-.4-.8-.6-1.5-1z"
      />
    </svg>
  )
}
