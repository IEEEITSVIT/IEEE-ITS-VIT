/* Line icons for the admin (replace the old emoji icons). 24×24, stroke = currentColor. */
const P = {
    dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
    design: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7.4-9-7.4zM7.5 11.5h.01M10.5 7.5h.01M15.5 8.5h.01',
    home: 'M3 11l9-7 9 7M5 9.5V21h5v-6h4v6h5V9.5',
    image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 9.5h.01',
    popup: 'M4 4h16v12H4zM8 20h8M12 16v4',
    megaphone: 'M3 10v4h3l7 4V6L6 10zM16 9a3 3 0 0 1 0 6M19 6a7 7 0 0 1 0 12',
    film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    type: 'M5 6V4h14v2M12 4v16M9 20h6',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
    camera: 'M4 8h4l2-3h4l2 3h4v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 6v1',
    school: 'M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6',
    code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
    pen: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    book: 'M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z',
    video: 'M3 6h12v12H3zM15 10l6-3v10l-6-3',
    help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01',
    box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
    inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
    shirt: 'M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c0 2-1.5 3-4 3S8 5 8 3z',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
    compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
    folder: 'M3 6h6l2 2h10v11H3z',
    tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
    sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
    news: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 13h7M7 16h4',
    tv: 'M3 7h18v12H3zM8 3l4 4 4-4',
    gamepad: 'M6 8h12a4 4 0 0 1 4 4v1a4 4 0 0 1-7 2.6L14 15h-4l-1 .6A4 4 0 0 1 2 13v-1a4 4 0 0 1 4-4zM7 10v4M5 12h4M15.5 11h.01M18 13h.01',
    send: 'M21 3L10 14M21 3l-7 18-4-7-7-4z',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    scroll: 'M8 3h11v15a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-1h12v1a3 3 0 0 0 3 3M8 3a3 3 0 0 0-3 3v11M11 8h5M11 12h5',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
    check: 'M5 12l5 5L20 7',
    alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
    crop: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeOff: 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 4M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2',
    drag: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
    monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
    tablet: 'M6 3h12v18H6zM11 18h2',
    phone: 'M8 2h8v20H8zM11 18h2',
    refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
    external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
    pointer: 'M5 3l14 7-6 2-2 6z',
    reset: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
    plus: 'M12 5v14M5 12h14',
    copy: 'M8 8h12v12H8zM4 16V4h12',
    menu: 'M4 6h16M4 12h16M4 18h16',
    close: 'M6 6l12 12M18 6L6 18',
}

export default function Icon({ name, size = 18, className = '', title }) {
    const d = P[name]
    if (!d) return null
    return (
        <svg className={`adm-ico ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined}>
            {title && <title>{title}</title>}
            <path d={d} />
        </svg>
    )
}
