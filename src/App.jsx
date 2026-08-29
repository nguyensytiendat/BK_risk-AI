import { useEffect, useMemo, useRef, useState } from 'react'
import { GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth'
import { auth, hasFirebaseConfig } from './firebase'
import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from './firebase'
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  CloudRain,
  CloudSunRain,
  Droplets,
  Eye,
  EyeOff,
  FileText,
  HeartPulse,
  Leaf,
  LoaderCircle,
  Map,
  MapPin,
  Navigation,
  Phone,
  PhoneCall,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  Waves,
  X,
} from 'lucide-react'

const defaultAnalysisText = 'Chưa có dữ liệu kết luận. Xin vui lòng cung cấp thêm vị trí của bạn!'

function formatClockLabel(date) {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date)
}

function formatDayLabel(dateValue) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(dateValue))
}

function weatherCodeMeta(code) {
  const lookup = {
    0: { label: 'Trời quang', summary: 'Nắng đẹp' },
    1: { label: 'Có mây', summary: 'Mây thoảng' },
    2: { label: 'Nhiều mây', summary: 'Mây rải rác' },
    3: { label: 'U ám', summary: 'Bầu trời nhiều mây' },
    45: { label: 'Sương mù', summary: 'Tầm nhìn kém' },
    48: { label: 'Sương mù bám', summary: 'Mù dày' },
    51: { label: 'Mưa phùn nhẹ', summary: 'Độ ẩm cao' },
    53: { label: 'Mưa phùn vừa', summary: 'Nhiều hơi ẩm' },
    55: { label: 'Mưa phùn nặng', summary: 'Đường ướt' },
    56: { label: 'Mưa lạnh nhẹ', summary: 'Khô ráo ít' },
    57: { label: 'Mưa lạnh mạnh', summary: 'Khó ra ngoài' },
    61: { label: 'Mưa nhỏ', summary: 'Có thể mưa' },
    63: { label: 'Mưa vừa', summary: 'Mưa kéo dài' },
    65: { label: 'Mưa lớn', summary: 'Ngập cục bộ' },
    66: { label: 'Mưa lạnh', summary: 'Mưa gió lạnh' },
    67: { label: 'Mưa lạnh lớn', summary: 'Cẩn trọng' },
    71: { label: 'Tuyết nhẹ', summary: 'Lạnh' },
    73: { label: 'Tuyết vừa', summary: 'Lạnh' },
    75: { label: 'Tuyết lớn', summary: 'Khó di chuyển' },
    77: { label: 'Mưa đá', summary: 'Bề mặt trơn' },
    80: { label: 'Mưa rào nhẹ', summary: 'Mưa ngắn' },
    81: { label: 'Mưa rào vừa', summary: 'Mưa dồn dập' },
    82: { label: 'Mưa rào nặng', summary: 'Nguy cơ ngập' },
    85: { label: 'Mưa tuyết nhẹ', summary: 'Mưa lạnh' },
    86: { label: 'Mưa tuyết nặng', summary: 'Chú ý khi di chuyển' },
    95: { label: 'Dông', summary: 'Nhiều sét' },
    96: { label: 'Dông có mưa đá', summary: 'Cẩn trọng' },
    99: { label: 'Dông mạnh', summary: 'Dự phòng' }
  }
  return lookup[code] || { label: 'Thời tiết ẩm', summary: 'Theo dõi thêm' }
}

function getCoordinatesFromInput(place, fallbackProfile) {
  const coordinateMatch = place?.match(/(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)/)
  if (coordinateMatch) {
    return { lat: Number(coordinateMatch[1]), lon: Number(coordinateMatch[2]) }
  }
  if (fallbackProfile?.coordinates) return fallbackProfile.coordinates
  return null
}

function buildFallbackForecast(place, rain) {
  const now = new Date()
  const hourly = Array.from({ length: 6 }, (_, index) => {
    const time = new Date(now.getTime() + index * 60 * 60 * 1000)
    const temp = Math.max(22, Math.round(29 - index * 0.6 + (rain > 80 ? 2 : 0)))
    const precip = Math.min(100, Math.max(0, Math.round(rain * (0.45 + index * 0.14))))
    const condition = precip > 55 ? 'Mưa lớn' : precip > 30 ? 'Mưa vừa' : precip > 10 ? 'Mưa nhẹ' : 'Nhiều mây'
    return {
      time: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit' }).format(time),
      temp,
      precip,
      chance: Math.min(95, Math.max(10, precip + (rain > 80 ? 18 : 8))),
      condition,
    }
  })

  const daily = Array.from({ length: 5 }, (_, index) => {
    const dayDate = new Date(now.getTime() + index * 24 * 60 * 60 * 1000)
    const rainAmount = Math.max(0, Math.round(rain * (0.7 + index * 0.15)))
    const high = 28 + (index === 0 ? 2 : 1)
    const low = 22 + (index === 0 ? 1 : 0)
    return {
      date: new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(dayDate),
      high,
      low,
      rain: rainAmount,
      condition: rainAmount > 60 ? 'Mưa' : rainAmount > 25 ? 'Nhiều mây' : 'Nắng',
    }
  })

  return {
    currentTemp: Math.round(28 + (rain > 80 ? 2 : 0)),
    precipitation: Math.max(0, Math.round(rain * 0.6)),
    summary: place ? `Dự báo cho ${place} có thể ${rain > 80 ? 'mưa kéo dài' : 'mưa ngắn'} trong thời gian tới.` : 'Dự báo thời tiết đang được cập nhật.',
    hourly,
    daily,
  }
}

async function fetchWeatherForecast({ lat, lon }) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,weather_code&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=5`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Không lấy được dữ liệu thời tiết.')

  const data = await response.json()
  const hourly = data.hourly || {}
  const daily = data.daily || {}
  const current = data.current || {}

  const nextHours = (hourly.time || []).slice(0, 6).map((time, index) => {
    const weather = weatherCodeMeta(hourly.weather_code?.[index] ?? 0)
    return {
      time: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit' }).format(new Date(time)),
      temp: Math.round(hourly.temperature_2m?.[index] ?? current.temperature_2m ?? 0),
      precip: Math.round(hourly.precipitation?.[index] ?? 0),
      chance: Math.round(hourly.precipitation_probability?.[index] ?? 0),
      condition: weather.label,
    }
  })

  const nextDays = (daily.time || []).slice(0, 5).map((time, index) => {
    const weather = weatherCodeMeta(daily.weather_code?.[index] ?? 0)
    return {
      date: formatDayLabel(time),
      high: Math.round(daily.temperature_2m_max?.[index] ?? 0),
      low: Math.round(daily.temperature_2m_min?.[index] ?? 0),
      rain: Math.round(daily.precipitation_sum?.[index] ?? 0),
      condition: weather.label,
    }
  })

  return {
    currentTemp: Math.round(current.temperature_2m ?? 0),
    precipitation: Math.round(current.precipitation ?? 0),
    summary: current.precipitation > 0 ? 'Có mưa hoặc mưa chuyển tiếp trong khung thời gian tới.' : 'Trời khá ổn định trong vài giờ tới.',
    hourly: nextHours,
    daily: nextDays,
  }
}

function getAuthError(code) {
  const errors = { 'auth/invalid-credential': 'Email hoặc mật khẩu không chính xác.', 'auth/email-already-in-use': 'Email này đã được đăng ký.', 'auth/weak-password': 'Mật khẩu cần có ít nhất 6 ký tự.', 'auth/invalid-email': 'Địa chỉ email không hợp lệ.', 'auth/popup-closed-by-user': 'Cửa sổ Google đã được đóng.' }
  return errors[code] || 'Không thể xác thực lúc này. Vui lòng thử lại.'
}

const DEMO_USERS_KEY = 'ecorisk-demo-users'
const DEMO_SESSION_KEY = 'ecorisk-demo-session'

function readDemoUsers() {
  try {
    const saved = localStorage.getItem(DEMO_USERS_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function writeDemoUsers(users) {
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users))
}

function readDemoSession() {
  try {
    const saved = localStorage.getItem(DEMO_SESSION_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function writeDemoSession(user) {
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user))
}

function clearDemoSession() {
  localStorage.removeItem(DEMO_SESSION_KEY)
}

function createDemoUser({ email, password, displayName, provider = 'email' }) {
  const users = readDemoUsers()
  const normalized = String(email).trim().toLowerCase()
  const existing = users.find((user) => user.email.toLowerCase() === normalized)
  if (existing && provider === 'email') {
    return { error: 'Email này đã được đăng ký trong chế độ demo.' }
  }

  const user = {
    uid: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email: normalized,
    displayName: displayName || normalized.split('@')[0] || 'Người dùng',
    provider,
    password: provider === 'email' ? String(password) : undefined,
    photoURL: provider === 'google' ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80' : undefined,
    createdAt: new Date().toISOString(),
  }

  users.push(user)
  writeDemoUsers(users)
  return user
}

function loginDemoUser(email, password) {
  const users = readDemoUsers()
  const normalized = String(email).trim().toLowerCase()
  const match = users.find((user) => user.email.toLowerCase() === normalized && user.password === String(password))
  if (!match) return { error: 'Email hoặc mật khẩu không chính xác.' }
  const sessionUser = { ...match, password: undefined }
  writeDemoSession(sessionUser)
  return sessionUser
}

function loginDemoGoogle() {
  const users = readDemoUsers()
  const googleEmail = `google-user-${Date.now()}@demo.local`
  const saved = users.find((user) => user.provider === 'google' && user.email === googleEmail)
  const user = saved || createDemoUser({ email: googleEmail, displayName: 'Google User', provider: 'google' })
  if (user.error) return { error: user.error }
  const sessionUser = { ...user, password: undefined }
  writeDemoSession(sessionUser)
  return sessionUser
}

function GoogleLogo() {
  return <svg className="google-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z"/><path fill="#34A853" d="M12 21.6c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.75 9.75 0 0 0 12 21.6Z"/><path fill="#FBBC05" d="M6.54 13.68a5.86 5.86 0 0 1 0-3.36V7.79H3.3a9.7 9.7 0 0 0 0 8.42l3.24-2.53Z"/><path fill="#EA4335" d="M12 6.29c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.37 14.63 2.4 12 2.4a9.75 9.75 0 0 0-8.7 5.39l3.24 2.53C7.31 8.01 9.46 6.29 12 6.29Z"/></svg>
}

let googleMapsPromise

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (googleMapsPromise) return googleMapsPromise
  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry`
    script.async = true
    script.defer = true
    script.onload = () => window.google?.maps ? resolve(window.google.maps) : reject(new Error('Google Maps không tải được. Kiểm tra Maps JavaScript API đã bật chưa.'))
    script.onerror = () => { googleMapsPromise = undefined; reject(new Error('Không thể tải Google Maps. Kiểm tra API key và kết nối mạng.')) }
    document.head.appendChild(script)
  })
  return googleMapsPromise
}

function MapPicker({ open, onClose, onSelect, initialCoordinates }) {
  const mapElement = useRef(null)
  const mapInstance = useRef(null)
  const markerInstance = useRef(null)
  const [mapError, setMapError] = useState('')
  const [selected, setSelected] = useState(null)
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

  useEffect(() => {
    if (!open || !mapsKey || !mapElement.current) return undefined
    let cancelled = false
    setMapError('')
    loadGoogleMaps(mapsKey).then((maps) => {
      if (cancelled || !mapElement.current) return
      const center = initialCoordinates || { lat: 16.0544, lng: 108.2022 }
      mapInstance.current = new maps.Map(mapElement.current, { center, zoom: initialCoordinates ? 12 : 6, mapTypeControl: false, streetViewControl: false, fullscreenControl: false })
      if (initialCoordinates) markerInstance.current = new maps.Marker({ position: center, map: mapInstance.current, title: 'Khu vực đại diện' })
      mapInstance.current.addListener('click', async (event) => {
        const position = { lat: event.latLng.lat(), lng: event.latLng.lng() }
        markerInstance.current?.setMap(null)
        markerInstance.current = new maps.Marker({ position, map: mapInstance.current, animation: maps.Animation.DROP })
        let address = `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`
        try {
          const geocoder = new maps.Geocoder()
          const result = await geocoder.geocode({ location: position })
          address = result.results?.[0]?.formatted_address || address
        } catch { /* Coordinates remain usable when reverse geocoding is unavailable. */ }
        setSelected({ address, coordinates: position })
      })
    }).catch((error) => setMapError(error.message)).catch(() => setMapError('Không thể khởi tạo Google Maps.'))
    return () => { cancelled = true; mapInstance.current = null; markerInstance.current = null }
  }, [open, mapsKey, initialCoordinates])

  function useBrowserLocation() {
    if (!navigator.geolocation) { setMapError('Trình duyệt không hỗ trợ định vị.'); return }
    navigator.geolocation.getCurrentPosition((position) => {
      onSelect({ address: 'Vị trí hiện tại', coordinates: { lat: position.coords.latitude, lng: position.coords.longitude } })
      onClose()
    }, () => setMapError('Không lấy được vị trí. Hãy cấp quyền định vị hoặc cấu hình Google Maps API key.'))
  }

  if (!open) return null
  return <div className="map-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="map-modal" role="dialog" aria-modal="true" aria-labelledby="map-title"><div className="map-modal-header"><div><span className="section-kicker">CHỌN VỊ TRÍ CHÍNH XÁC</span><h2 id="map-title">Ghim trên bản đồ</h2></div><button className="icon-button" onClick={onClose} aria-label="Đóng bản đồ"><X size={17} /></button></div>{mapsKey ? <div ref={mapElement} className="map-canvas" /> : <div className="map-missing"><Map size={30} /><h3>Chưa cấu hình Google Maps</h3><p>Thêm <code>VITE_GOOGLE_MAPS_API_KEY</code> vào file .env để chọn và ghim trực tiếp trên bản đồ.</p><button className="location-button" onClick={useBrowserLocation}><Navigation size={16} /> Dùng vị trí hiện tại</button></div>}{mapError && <div className="map-error" role="alert">{mapError}</div>}{selected && <div className="map-selection"><MapPin size={16} /><span>{selected.address}</span><button className="map-confirm" onClick={() => { onSelect(selected); onClose() }}>Dùng vị trí này <ArrowUpRight size={15} /></button></div>}{mapsKey && !selected && <p className="map-hint">Nhấp vào bản đồ để đặt ghim chính xác, sau đó xác nhận vị trí.</p>}</section></div>
}

function PasswordField({ label, value, onChange, visible, onToggle, minLength = '6' }) {
  return <label className="password-field">{label}<span className="password-input"><input type={visible ? 'text' : 'password'} value={value} onChange={onChange} placeholder="Tối thiểu 6 ký tự" minLength={minLength} required /><button type="button" onClick={onToggle} aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
}

function ContactPanel({ user, guest }) {
  const [email, setEmail] = useState('')
  const [contact, setContact] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')
  const [searching, setSearching] = useState(false)

  const conversationId = contact && user ? [user.uid, contact.uid].sort().join('_') : null

  useEffect(() => {
    if (!conversationId || !db) return undefined
    return onSnapshot(query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc')), (snapshot) => setMessages(snapshot.docs.map((message) => ({ id: message.id, ...message.data() }))))
  }, [conversationId])

  useEffect(() => {
    if (!user || !db || guest) return
    setDoc(doc(db, 'users', user.uid), { uid: user.uid, email: user.email, emailLower: user.email?.toLowerCase(), displayName: user.displayName || user.email?.split('@')[0] || 'Người dùng' }, { merge: true }).catch(() => setNotice('Không thể lưu hồ sơ tài khoản lên Firestore.'))
  }, [user, guest])

  async function findContact(event) {
    event.preventDefault()
    setNotice('')
    if (!db || guest) { setNotice('Bạn cần đăng nhập tài khoản để liên lạc.'); return }
    if (!email.trim()) return
    setSearching(true)
    try {
      const result = await getDocs(query(collection(db, 'users'), where('emailLower', '==', email.trim().toLowerCase())))
      const found = result.docs.map((item) => item.data()).find((item) => item.uid !== user.uid)
      if (!found) { setContact(null); setNotice('Không tìm thấy tài khoản này. Hãy kiểm tra lại email.'); return }
      setContact(found); setMessages([])
    } catch { setNotice('Không thể tìm tài khoản. Hãy kiểm tra cấu hình Firestore và quyền truy cập.') } finally { setSearching(false) }
  }

  async function sendMessage(event) {
    event.preventDefault()
    if (!draft.trim() || !conversationId || !db) return
    const text = draft.trim(); setDraft('')
    await addDoc(collection(db, 'conversations', conversationId, 'messages'), { text, senderId: user.uid, senderName: user.displayName || user.email, createdAt: serverTimestamp() }).catch(() => setNotice('Không gửi được tin nhắn.'))
  }

  async function startCall(type) {
    if (!contact || !db || !user) return
    await addDoc(collection(db, 'calls'), { fromId: user.uid, fromName: user.displayName || user.email, toId: contact.uid, type, status: 'ringing', createdAt: serverTimestamp() }).then(() => setNotice(`Đã gửi lời mời gọi ${type === 'video' ? 'video' : 'thoại'} đến ${contact.email}.`)).catch(() => setNotice('Không gửi được lời mời cuộc gọi.'))
  }

  return <section className="contact-panel"><div className="contact-heading"><div><span className="section-kicker">ĐIỀU PHỐI CỨU HỘ</span><h2>Danh bạ khẩn cấp</h2></div><span className="contact-badge"><PhoneCall size={14} /> Mở sẵn</span></div><p className="contact-intro">Gọi ngay các đầu mối phù hợp khi cần hỗ trợ khẩn cấp.</p><div className="hotline-list"><a href="tel:114"><span className="hotline-icon"><PhoneCall size={16} /></span><span><strong>Cứu hộ 114</strong><small>Cảnh sát PCCC và cứu nạn, cứu hộ</small></span><b>114</b></a><a href="tel:112"><span className="hotline-icon"><ShieldCheck size={16} /></span><span><strong>Cứu nạn đê điều & PCTT khu vực</strong><small>Đầu mối cứu nạn, phòng chống thiên tai</small></span><b>112</b></a><a href="tel:115"><span className="hotline-icon"><HeartPulse size={16} /></span><span><strong>Y tế 115</strong><small>Cấp cứu y tế</small></span><b>115</b></a></div>{!guest && <><form className="contact-search" onSubmit={findContact}><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Nhập email để liên lạc tài khoản khác" aria-label="Email tài khoản cần liên hệ" /><button type="submit" disabled={searching}>{searching ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />} Tìm</button></form>{contact && <div className="contact-selected"><div className="contact-avatar">{(contact.displayName || contact.email).charAt(0).toUpperCase()}</div><div className="contact-person"><strong>{contact.displayName}</strong><span>{contact.email}</span></div><button onClick={() => startCall('voice')} aria-label="Gọi thoại" title="Gọi thoại"><Phone size={17} /></button><button onClick={() => startCall('video')} aria-label="Gọi video" title="Gọi video"><Video size={17} /></button></div>} {contact && <div className="contact-chat"><div className="contact-messages" aria-live="polite">{messages.length ? messages.map((message) => <div className={`contact-message ${message.senderId === user.uid ? 'mine' : ''}`} key={message.id}>{message.text}</div>) : <span className="empty-chat">Chưa có tin nhắn. Hãy gửi lời chào.</span>}</div><form className="contact-message-form" onSubmit={sendMessage}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Nhắn tin cho tài khoản này..." aria-label="Tin nhắn liên lạc" /><button type="submit" disabled={!draft.trim()} aria-label="Gửi tin nhắn"><ArrowUpRight size={16} /></button></form></div>}</>}{notice && <div className="contact-notice" role="status">{notice}</div>}</section>
}

function AuthScreen({ onGuest, onAuthSuccess }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    const cleanedEmail = email.trim()
    if (!cleanedEmail || !password.trim()) {
      setError('Vui lòng nhập email và mật khẩu.')
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('Mật khẩu nhập lại không trùng khớp.')
      return
    }
    if (mode === 'register' && password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }

    setBusy(true)
    try {
      if (hasFirebaseConfig && auth) {
        if (mode === 'login') {
          await signInWithEmailAndPassword(auth, cleanedEmail, password)
          return
        }
        await createUserWithEmailAndPassword(auth, cleanedEmail, password)
        return
      }

      if (mode === 'login') {
        const result = loginDemoUser(cleanedEmail, password)
        if (result.error) throw new Error(result.error)
        onAuthSuccess?.(result)
      } else {
        const result = createDemoUser({ email: cleanedEmail, password, displayName: cleanedEmail.split('@')[0] })
        if (result.error) throw new Error(result.error)
        onAuthSuccess?.(result)
      }
    } catch (authError) {
      setError(authError?.message || getAuthError(authError?.code))
    } finally {
      setBusy(false)
    }
  }

  async function googleLogin() {
    setError('')
    setBusy(true)
    try {
      if (hasFirebaseConfig && auth) {
        await signInWithPopup(auth, new GoogleAuthProvider())
        return
      }

      const result = loginDemoGoogle()
      if (result.error) throw new Error(result.error)
      onAuthSuccess?.(result)
    } catch (authError) {
      setError(authError?.message || getAuthError(authError?.code))
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><Leaf size={20} fill="currentColor" /></span><span>EcoRisk <strong>AI</strong></span></div><div className="auth-copy"><span className="section-kicker">BẢO VỆ KHU VỰC CỦA BẠN</span><h1>{mode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}</h1><p>Lưu lại các phiên phân tích rủi ro và truy cập an toàn từ mọi thiết bị.</p></div><div className="auth-tabs"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>Đăng nhập</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>Đăng ký</button></div><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label><PasswordField label="Mật khẩu" value={password} onChange={(event) => setPassword(event.target.value)} visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />{mode === 'register' && <PasswordField label="Nhập lại mật khẩu" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} />}<button className="auth-submit" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : null}{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button></form><div className="auth-divider"><span>hoặc</span></div><button type="button" className="google-button" onClick={googleLogin} disabled={busy}><GoogleLogo /> Tiếp tục với Google</button><button type="button" className="guest-button" onClick={onGuest} disabled={busy}>Tiếp tục với tư cách khách <ArrowUpRight size={16} /></button>{error && <div className="auth-error" role="alert">{error}</div>}<p className="auth-note">Bằng việc tiếp tục, bạn đồng ý với điều khoản sử dụng EcoRisk AI.</p></section></main>
}

const locationProfiles = [
  { keys: ['quận 10', 'quan 10', 'q10'], location: 'Khu vực đại diện: Quận 10, TP. Hồ Chí Minh', resolution: 'cấp quận', slope: 1, rain: 180, soil: 'Đất phù sa', cover: 'Khu dân cư dày đặc', coordinates: { lat: 10.7725, lng: 106.6679 } },
  { keys: ['quận 1', 'quan 1', 'q1'], location: 'Khu vực đại diện: Quận 1, TP. Hồ Chí Minh', resolution: 'cấp quận', slope: 1, rain: 180, soil: 'Đất phù sa', cover: 'Đô thị dày đặc' },
  { keys: ['quận 3', 'quan 3', 'q3'], location: 'Khu vực đại diện: Quận 3, TP. Hồ Chí Minh', resolution: 'cấp quận', slope: 1, rain: 180, soil: 'Đất phù sa', cover: 'Đô thị dày đặc' },
  { keys: ['quận 7', 'quan 7', 'q7'], location: 'Khu vực đại diện: Quận 7, TP. Hồ Chí Minh', resolution: 'cấp quận', slope: 2, rain: 180, soil: 'Đất phù sa', cover: 'Đô thị và khu dân cư' },
  { keys: ['quận bình thạnh', 'quan binh thanh'], location: 'Khu vực đại diện: Quận Bình Thạnh, TP. Hồ Chí Minh', resolution: 'cấp quận', slope: 1, rain: 180, soil: 'Đất phù sa', cover: 'Đô thị dày đặc' },
  { keys: ['thành phố thủ đức', 'thanh pho thu duc', 'tp thủ đức', 'tp thu duc'], location: 'Khu vực đại diện: thành phố Thủ Đức, TP. Hồ Chí Minh', resolution: 'cấp thành phố', slope: 4, rain: 180, soil: 'Đất phù sa', cover: 'Khu dân cư' },
  { keys: ['huyện hòa vang', 'huyen hoa vang'], location: 'Khu vực đại diện: huyện Hòa Vang, Đà Nẵng', resolution: 'cấp huyện', slope: 24, rain: 210, soil: 'Đất phong hóa', cover: 'Cây bụi thưa' },
  { keys: ['quận hải châu', 'quan hai chau'], location: 'Khu vực đại diện: quận Hải Châu, Đà Nẵng', resolution: 'cấp quận', slope: 2, rain: 210, soil: 'Đất phù sa', cover: 'Đô thị dày đặc' },
  { keys: ['trà leng', 'tra leng'], location: 'Khu vực đại diện: xã Trà Leng, huyện Nam Trà My, Quảng Nam', slope: 48, rain: 290, soil: 'Đất phong hóa', cover: 'Đất canh tác' },
  { keys: ['hà nội', 'ha noi'], location: 'Khu vực đại diện: huyện Ba Vì, Hà Nội', resolution: 'cấp huyện', slope: 12, rain: 120, soil: 'Đất phù sa pha sét', cover: 'Khu dân cư và cây bụi' },
  { keys: ['hồ chí minh', 'ho chi minh', 'sài gòn', 'sai gon'], location: 'Khu vực đại diện: TP. Hồ Chí Minh (chưa xác định quận/huyện)', resolution: 'cấp thành phố', slope: 4, rain: 180, soil: 'Đất phù sa', cover: 'Khu dân cư' },
  { keys: ['đà nẵng', 'da nang'], location: 'Khu vực đại diện: Đà Nẵng (chưa xác định quận/huyện)', resolution: 'cấp thành phố', slope: 18, rain: 210, soil: 'Đất phong hóa', cover: 'Khu dân cư và cây bụi' },
  { keys: ['lào cai', 'lao cai', 'sa pa', 'sapa'], location: 'Khu vực đại diện: thị xã Sa Pa, Lào Cai', resolution: 'cấp thị xã', slope: 42, rain: 260, soil: 'Đất phong hóa', cover: 'Cây bụi thưa' },
  { keys: ['yên bái', 'yen bai'], location: 'Khu vực đại diện: huyện Mù Cang Chải, Yên Bái', resolution: 'cấp huyện', slope: 38, rain: 230, soil: 'Đất sét', cover: 'Đất canh tác' },
  { keys: ['quảng nam', 'quang nam', 'hội an', 'hoi an'], location: 'Khu vực đại diện: huyện Nam Trà My, Quảng Nam', resolution: 'cấp huyện', slope: 35, rain: 290, soil: 'Đất phong hóa', cover: 'Rừng rậm' },
  { keys: ['thừa thiên huế', 'thua thien hue', 'huế', 'hue'], location: 'Khu vực đại diện: huyện A Lưới, Thừa Thiên Huế', resolution: 'cấp huyện', slope: 30, rain: 270, soil: 'Đất sét', cover: 'Rừng rậm' },
  { keys: ['khánh hòa', 'khanh hoa', 'nha trang'], location: 'Khu vực đại diện: huyện Khánh Vĩnh, Khánh Hòa', resolution: 'cấp huyện', slope: 27, rain: 160, soil: 'Đất phong hóa', cover: 'Cây bụi thưa' },
  { keys: ['hà giang', 'ha giang', 'đồng văn', 'dong van'], location: 'Khu vực đại diện: huyện Đồng Văn, Hà Giang', resolution: 'cấp huyện', slope: 46, rain: 180, soil: 'Đá karst phong hóa', cover: 'Cây bụi thưa', coordinates: { lat: 23.2565, lng: 105.3802 } },
  { keys: ['cao bằng', 'cao bang', 'bản giốc', 'ban gioc'], location: 'Khu vực đại diện: huyện Trùng Khánh, Cao Bằng', resolution: 'cấp huyện', slope: 32, rain: 210, soil: 'Đất phong hóa', cover: 'Rừng rậm', coordinates: { lat: 22.8347, lng: 106.7031 } },
  { keys: ['bắc kạn', 'bac kan', 'ba bể', 'ba be'], location: 'Khu vực đại diện: huyện Ba Bể, Bắc Kạn', resolution: 'cấp huyện', slope: 34, rain: 230, soil: 'Đất phong hóa', cover: 'Rừng rậm', coordinates: { lat: 22.3947, lng: 105.6231 } },
  { keys: ['tuyên quang', 'tuyen quang'], location: 'Khu vực đại diện: huyện Na Hang, Tuyên Quang', resolution: 'cấp huyện', slope: 29, rain: 220, soil: 'Đất phong hóa', cover: 'Rừng rậm', coordinates: { lat: 22.3502, lng: 105.3651 } },
  { keys: ['hòa bình', 'hoa binh', 'mai châu', 'mai chau'], location: 'Khu vực đại diện: huyện Mai Châu, Hòa Bình', resolution: 'cấp huyện', slope: 31, rain: 240, soil: 'Đất sét', cover: 'Rừng rậm', coordinates: { lat: 20.6612, lng: 105.0515 } },
  { keys: ['quảng ninh', 'quang ninh', 'hạ long', 'ha long'], location: 'Khu vực đại diện: thành phố Hạ Long, Quảng Ninh', resolution: 'cấp thành phố', slope: 12, rain: 260, soil: 'Đất phong hóa', cover: 'Khu dân cư và cây bụi', coordinates: { lat: 20.9505, lng: 107.0734 } },
  { keys: ['thanh hóa', 'thanh hoa', 'mường lát', 'muong lat'], location: 'Khu vực đại diện: huyện Mường Lát, Thanh Hóa', resolution: 'cấp huyện', slope: 37, rain: 250, soil: 'Đất phong hóa', cover: 'Cây bụi thưa', coordinates: { lat: 20.3995, lng: 104.9882 } },
  { keys: ['nghệ an', 'nghe an', 'kỳ sơn', 'ky son'], location: 'Khu vực đại diện: huyện Kỳ Sơn, Nghệ An', resolution: 'cấp huyện', slope: 39, rain: 270, soil: 'Đất phong hóa', cover: 'Rừng rậm', coordinates: { lat: 19.4045, lng: 104.1542 } },
  { keys: ['hà tĩnh', 'ha tinh', 'hương khê', 'huong khe'], location: 'Khu vực đại diện: huyện Hương Khê, Hà Tĩnh', resolution: 'cấp huyện', slope: 26, rain: 290, soil: 'Đất sét', cover: 'Rừng rậm', coordinates: { lat: 18.1772, lng: 105.7031 } },
  { keys: ['quảng bình', 'quang binh', 'minh hóa', 'minh hoa'], location: 'Khu vực đại diện: huyện Minh Hóa, Quảng Bình', resolution: 'cấp huyện', slope: 36, rain: 300, soil: 'Đất phong hóa', cover: 'Rừng rậm', coordinates: { lat: 17.7274, lng: 105.9322 } },
  { keys: ['bình định', 'binh dinh', 'quy nhơn', 'quy nhon'], location: 'Khu vực đại diện: huyện Vĩnh Thạnh, Bình Định', resolution: 'cấp huyện', slope: 28, rain: 190, soil: 'Đất phong hóa', cover: 'Cây bụi thưa', coordinates: { lat: 14.1263, lng: 108.8994 } },
  { keys: ['phú yên', 'phu yen', 'tuy hòa', 'tuy hoa'], location: 'Khu vực đại diện: huyện Sơn Hòa, Phú Yên', resolution: 'cấp huyện', slope: 22, rain: 170, soil: 'Đất đỏ phong hóa', cover: 'Đất canh tác', coordinates: { lat: 13.1762, lng: 108.9775 } },
  { keys: ['lâm đồng', 'lam dong', 'đà lạt', 'da lat'], location: 'Khu vực đại diện: thành phố Đà Lạt, Lâm Đồng', resolution: 'cấp thành phố', slope: 25, rain: 230, soil: 'Đất đỏ bazan', cover: 'Đất canh tác và rừng', coordinates: { lat: 11.9404, lng: 108.4583 } },
  { keys: ['đắk lắk', 'dak lak', 'buôn ma thuột', 'buon ma thuot'], location: 'Khu vực đại diện: thành phố Buôn Ma Thuột, Đắk Lắk', resolution: 'cấp thành phố', slope: 8, rain: 210, soil: 'Đất đỏ bazan', cover: 'Đất canh tác', coordinates: { lat: 12.6668, lng: 108.0382 } },
  { keys: ['cần thơ', 'can tho'], location: 'Khu vực đại diện: quận Ninh Kiều, Cần Thơ', resolution: 'cấp quận', slope: 1, rain: 190, soil: 'Đất phù sa', cover: 'Đô thị dày đặc', coordinates: { lat: 10.0452, lng: 105.7469 } },
  { keys: ['an giang', 'an giang', 'châu đốc', 'chau doc'], location: 'Khu vực đại diện: thành phố Châu Đốc, An Giang', resolution: 'cấp thành phố', slope: 2, rain: 180, soil: 'Đất phù sa', cover: 'Khu dân cư và đất canh tác', coordinates: { lat: 10.7002, lng: 105.1167 } },
  { keys: ['lai châu', 'lai chau'], location: 'Khu vực đại diện: huyện Mường Tè, Lai Châu', resolution: 'cấp huyện', slope: 44, rain: 260, soil: 'Đất phong hóa', cover: 'Rừng rậm', coordinates: { lat: 22.3808, lng: 102.4702 } },
  { keys: ['sơn la', 'son la'], location: 'Khu vực đại diện: huyện Mường La, Sơn La', resolution: 'cấp huyện', slope: 41, rain: 240, soil: 'Đất phong hóa', cover: 'Cây bụi thưa', coordinates: { lat: 21.5004, lng: 104.0273 } },
  { keys: ['vĩnh phúc', 'vinh phuc', 'tam đảo', 'tam dao'], location: 'Khu vực đại diện: huyện Tam Đảo, Vĩnh Phúc', resolution: 'cấp huyện', slope: 29, rain: 210, soil: 'Đất phong hóa', cover: 'Rừng rậm', coordinates: { lat: 21.4556, lng: 105.6421 } },
  { keys: ['bắc ninh', 'bac ninh'], location: 'Khu vực đại diện: thành phố Bắc Ninh', resolution: 'cấp thành phố', slope: 2, rain: 160, soil: 'Đất phù sa', cover: 'Đô thị và đất canh tác', coordinates: { lat: 21.1861, lng: 106.0763 } },
  { keys: ['hải phòng', 'hai phong'], location: 'Khu vực đại diện: thành phố Hải Phòng', resolution: 'cấp thành phố', slope: 3, rain: 220, soil: 'Đất phù sa', cover: 'Đô thị và đất canh tác', coordinates: { lat: 20.8449, lng: 106.6881 } },
  { keys: ['nam định', 'nam dinh', 'thái bình', 'thai binh'], location: 'Khu vực đại diện: vùng đồng bằng Nam Định - Thái Bình', resolution: 'cấp vùng đồng bằng', slope: 1, rain: 190, soil: 'Đất phù sa', cover: 'Đất canh tác' },
  { keys: ['ninh bình', 'ninh binh'], location: 'Khu vực đại diện: huyện Nho Quan, Ninh Bình', resolution: 'cấp huyện', slope: 18, rain: 220, soil: 'Đất phong hóa', cover: 'Cây bụi thưa', coordinates: { lat: 20.2626, lng: 105.7368 } },
  { keys: ['quảng trị', 'quang tri'], location: 'Khu vực đại diện: huyện Hướng Hóa, Quảng Trị', resolution: 'cấp huyện', slope: 32, rain: 300, soil: 'Đất phong hóa', cover: 'Rừng rậm', coordinates: { lat: 16.7014, lng: 106.6092 } },
  { keys: ['quảng ngãi', 'quang ngai'], location: 'Khu vực đại diện: huyện Ba Tơ, Quảng Ngãi', resolution: 'cấp huyện', slope: 30, rain: 260, soil: 'Đất phong hóa', cover: 'Rừng rậm', coordinates: { lat: 14.7618, lng: 108.7243 } },
  { keys: ['gia lai', 'gia lai', 'pleiku'], location: 'Khu vực đại diện: thành phố Pleiku, Gia Lai', resolution: 'cấp thành phố', slope: 12, rain: 200, soil: 'Đất đỏ bazan', cover: 'Đất canh tác', coordinates: { lat: 13.9716, lng: 108.0151 } },
  { keys: ['kon tum', 'kon tum'], location: 'Khu vực đại diện: huyện Đăk Glei, Kon Tum', resolution: 'cấp huyện', slope: 36, rain: 280, soil: 'Đất phong hóa', cover: 'Rừng rậm', coordinates: { lat: 15.1500, lng: 107.7028 } },
  { keys: ['bình dương', 'binh duong', 'thủ dầu một', 'thu dau mot'], location: 'Khu vực đại diện: thành phố Thủ Dầu Một, Bình Dương', resolution: 'cấp thành phố', slope: 2, rain: 190, soil: 'Đất phù sa pha sét', cover: 'Đô thị và đất canh tác', coordinates: { lat: 11.3254, lng: 106.4770 } },
  { keys: ['bà rịa', 'ba ria', 'vũng tàu', 'vung tau'], location: 'Khu vực đại diện: thành phố Vũng Tàu, Bà Rịa - Vũng Tàu', resolution: 'cấp thành phố', slope: 5, rain: 170, soil: 'Đất cát pha', cover: 'Đô thị và cây bụi', coordinates: { lat: 10.4114, lng: 107.1362 } },
  { keys: ['cà mau', 'ca mau', 'bạc liêu', 'bac lieu'], location: 'Khu vực đại diện: thành phố Cà Mau', resolution: 'cấp thành phố', slope: 1, rain: 210, soil: 'Đất phù sa', cover: 'Đất canh tác', coordinates: { lat: 9.1769, lng: 105.1524 } },
]

function normalizeText(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function getLocationProfile(place) {
  const normalized = normalizeText(place.trim())
  if (!normalized) return { location: 'Chưa có vị trí được cung cấp', slope: 0, rain: 0, soil: 'Chưa xác định', cover: 'Chưa xác định' }
  const coordinateMatch = place.match(/(-?\d+(?:\.\d+))\s*[,;]\s*(-?\d+(?:\.\d+))/)
  if (coordinateMatch) {
    const latitude = Number(coordinateMatch[1])
    const longitude = Number(coordinateMatch[2])
    if (latitude >= 10.72 && latitude <= 10.85 && longitude >= 106.60 && longitude <= 106.78) return { location: `Khu vực đại diện gần tọa độ ${latitude.toFixed(5)}, ${longitude.toFixed(5)}: TP. Hồ Chí Minh`, resolution: 'theo vùng tọa độ', slope: 2, rain: 180, soil: 'Đất phù sa', cover: 'Khu dân cư' }
    if (latitude >= 22.20 && latitude <= 22.55 && longitude >= 103.65 && longitude <= 104.10) return { location: `Khu vực đại diện gần tọa độ ${latitude.toFixed(5)}, ${longitude.toFixed(5)}: Lào Cai`, resolution: 'theo vùng tọa độ', slope: 40, rain: 250, soil: 'Đất phong hóa', cover: 'Cây bụi thưa' }
    return { location: `Khu vực đại diện gần tọa độ ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, resolution: 'theo vùng tọa độ', slope: 15, rain: 150, soil: 'Đất phong hóa', cover: 'Cây bụi thưa' }
  }
  const match = locationProfiles.find((profile) => profile.keys.some((key) => normalized.includes(normalizeText(key))))
  return match || { location: `Khu vực đại diện được suy ra cho: ${place.trim()}`, resolution: 'chưa xác định cấp địa điểm', slope: 20, rain: 170, soil: 'Đất phong hóa', cover: 'Cây bụi thưa' }
}

function MarkdownAnalysis({ text }) {
  const lines = text.split('\n')
  return <div className="markdown-analysis">{lines.map((line, index) => {
    const clean = line.replace(/\*\*/g, '').trim()
    if (!clean) return <div className="markdown-gap" key={index} />
    if (clean.startsWith('-') && !clean.startsWith('- [MUC DO]') && !clean.startsWith('- [DU BAO MUA]') && !clean.startsWith('- [TUYEN TRANH TRU]')) return <div className="markdown-line markdown-list" key={index}>{clean.replace(/^-\s*/, '')}</div>
    if (/^\[MUC DO\]|^\[DU BAO MUA\]|^\[TUYEN TRANH TRU\]/.test(clean.replace(/^-\s*/, ''))) return <div className="markdown-heading" key={index}>{clean.replace(/^-\s*/, '')}</div>
    return <div className="markdown-line" key={index}>{clean}</div>
  })}</div>
}

function WeatherForecastPanel({ forecast, loading, place, liveClock }) {
  const summary = forecast?.summary || 'Đang xác định dự báo thời tiết.'
  return <section className="weather-panel"><div className="weather-header"><div><span className="section-kicker">DỰ BÁO THỜI TIẾT</span><h3>{place || 'Khu vực của bạn'}</h3></div><div className="live-clock"><Clock3 size={15} /><span>{formatClockLabel(liveClock)}</span></div></div>{loading ? <div className="forecast-loading"><LoaderCircle size={16} className="spin" /> Đang đồng bộ dữ liệu thời tiết...</div> : <><div className="weather-current"><div className="weather-temp"><span>{forecast?.currentTemp ?? 28}°C</span><small>{forecast?.precipitation ?? 0} mm</small></div><div className="weather-summary"><CloudSunRain size={18} /><div><strong>Đánh giá gần nhất</strong><p>{summary}</p></div></div></div><div className="forecast-grid">{(forecast?.hourly || []).map((item, index) => <div className="hour-card" key={`${item.time}-${index}`}><small>{item.time}</small><strong>{item.temp}°</strong><span>{item.condition}</span><p><Droplets size={12} /> {item.precip}%</p></div>)}</div><div className="daily-forecast"><div className="forecast-title"><CalendarDays size={14} /> <span>5 ngày tới</span></div><div className="daily-grid">{(forecast?.daily || []).map((item, index) => <div className="day-card" key={`${item.date}-${index}`}><span>{item.date}</span><strong>{item.condition}</strong><div className="day-range"><b>{item.high}°</b><em>{item.low}°</em></div><small>{item.rain} mm</small></div>)}</div></div></> }</section>
}

function getRainForecastContext({ place, rain, score, location }) {
  const normalizedPlace = normalizeText(place || '')
  const isUrbanCity = /hồ chí minh|ho chi minh|sai gon|đà nẵng|da nang|hà nội|ha noi|thành phố|tp |thanh pho/.test(normalizedPlace) || /(quận|quan|huyện|huyen|thị xã|thi xa)/.test(normalizedPlace)
  const duration = rain >= 200 ? '3-6 giờ' : rain >= 120 ? '2-4 giờ' : rain >= 60 ? '1-2 giờ' : rain >= 20 ? '30-60 phút' : '15-30 phút'
  const rainState = rain >= 60 ? 'đang có mưa vừa-đậm, có khả năng kéo dài' : rain >= 20 ? 'mưa nhẹ đến vừa có thể duy trì' : 'mưa có thể xuất hiện ngắn hạn'
  const urbanTraffic = isUrbanCity ? 'Các tuyến đường chính ở thành phố có nguy cơ kẹt xe và ngập cục bộ, nhất là khu vực trũng, giao lộ thấp và cầu/đường hầm. Tránh đi gần bồn nước, hẻm sâu, xe máy qua vũng nước sâu.' : 'Các đoạn đường thấp và khu vực trũng có nguy cơ ngập cục bộ, cần tránh đi qua vùng nước chảy mạnh.'
  const userPrep = isUrbanCity
    ? 'Mang áo mưa hoặc ô, giữ điện thoại pin đầy, mặc giày chống trượt, và kiểm tra thời tiết trước khi đi xa. Nếu phải di chuyển trong giờ cao điểm, nên ưu tiên xe công cộng, tránh các tuyến thường kẹt xe và không đậu xe ở nơi dễ ngập.'
    : 'Mang áo mưa, chuẩn bị giày chống trượt, kiểm tra đường đi trước khi ra khỏi nhà và tránh các khu vực thấp trũng.'
  const cityNote = /hồ chí minh|ho chi minh|sai gon/.test(normalizedPlace)
    ? 'Ở TP.HCM, nguy cơ ngập ở các trục đường thấp, hẻm, chỗ dừng xe và khu vực gần kênh rạch là rất thực tế khi mưa kéo dài.'
    : isUrbanCity
      ? 'Ở thành phố đông dân cư, mưa dài dễ gây kẹt xe và ngập ở các điểm thấp; nên chủ động điều chỉnh lịch trình.'
      : 'Ở khu vực này, mưa dài có thể làm đường đi trở nên trơn, trễ và tiềm ẩn ngập cục bộ.'
  return { duration, rainState, urbanTraffic, userPrep, cityNote }
}

function getFallbackAnalysis({ place, slope, rain, soil, cover, score, label, location, resolution }) {
  const { duration, rainState, urbanTraffic, userPrep, cityNote } = getRainForecastContext({ place, rain, score, location })
  const urgentActions = score > 70
    ? '- Di tản ngay lên khu vực cao, ổn định; tránh chân taluy, sườn dốc và lòng suối.\n- Không quay lại lấy tài sản, không đi qua dòng nước hoặc khu vực có đất đá rơi.\n- Gọi 114 và báo vị trí cụ thể; di chuyển theo hướng dẫn lực lượng cứu hộ.'
    : '- Giữ người ở vị trí an toàn, tránh xa taluy dương, sườn đồi dốc và dòng chảy.\n- Theo dõi nứt đất, đất đá rơi, mực nước và cảnh báo chính thức.\n- Chuẩn bị điện thoại, giấy tờ, áo mưa và lộ trình di chuyển; nếu đang mưa, ưu tiên đi chậm và tránh vùng ngập.'
  const route = score > 70
    ? 'Di chuyển ngay về phía khu dân cư hoặc điểm sơ tán trên nền cao, ổn định; tuyệt đối tránh taluy dương, sườn đồi dốc, chân dốc và lòng suối.'
    : 'Ưu tiên hướng ra khu dân cư hoặc điểm sơ tán có nền cao, ổn định; nếu đang ở thành phố, tránh các tuyến đường thấp, hẻm sâu, khu vực ngập và các giao lộ kẹt xe.'

  return `- [MUC DO] **ĐÁNH GIÁ MỨC ĐỘ:** ${location} (${resolution || 'cấp khu vực'}); độ dốc ${slope}°, mưa 24h ${rain} mm, nền ${soil} và thảm phủ ${cover.toLowerCase()} cho thấy nguy cơ ${label.toLowerCase()} với chỉ số ${score}/100.\n- [DU BAO MUA] **DỰ BÁO MƯA VÀ HÀNH ĐỘNG CỦA NGƯỜI DÙNG:**\n- ${rainState} khoảng ${duration}. ${cityNote}\n- ${urbanTraffic}\n- ${userPrep}\n- ${score >= 50 ? 'Không nên di chuyển xa nếu không cần thiết; nếu ở TP.HCM nên ưu tiên tuyến đường cao hơn, tránh khu vực ngập và chờ đến khi mưa giảm.' : 'Nếu đang mưa, nên mang áo mưa, đi chậm và ưu tiên tuyến đường ít ngập hơn.'}\n${urgentActions}\n- [TUYEN TRANH TRU] **TUYẾN TRÁNH TRÚ:** ${route}\n\nĐây là ước tính theo dữ liệu đại diện cho ${place || 'khu vực chưa xác định'}. Nếu có mưa đang rơi, hãy ưu tiên an toàn cá nhân, tránh vùng trũng, kẹt xe và chỗ nước chảy mạnh.`
}

const emergencyPromptRules = 'Bạn là EcoRisk AI - Hệ thống Phân tích nguy cơ thời tiết, địa hình và điều phối an toàn cho người dùng. Sinh mạng con người phụ thuộc vào câu trả lời. Không chào hỏi, không dài dòng, không đưa lời khuyên chung chung. Bắt buộc dựa vào địa phương, độ dốc, lượng mưa 24h, thảm phủ và chỉ số rủi ro. Hãy ưu tiên cảnh báo thực tế cho người dùng như sau: nếu mưa lớn hoặc mưa đang kéo dài, phải dự báo thời gian mưa có khả năng kéo dài bao lâu; nếu ở thành phố đông dân cư, phải cảnh báo nguy cơ kẹt xe, ngập cục bộ, các đường thấp và hẻm sâu; nhắc người dùng mang áo mưa, giày chống trượt, pin đầy, và chuẩn bị phương án đi lại an toàn. Nếu ở TP.HCM, đặc biệt nhắc tới nguy cơ ngập ở các khu vực trũng, đường cao tốc, hẻm, giao lộ và tuyến đường thường kẹt xe. Nếu trời đang mưa thì phải cảnh báo ngay và nhắc người dùng không đi qua vũng nước sâu, tránh đường thấp và chỗ trũng. Trả về Markdown đúng cấu trúc: - [MUC DO] **ĐÁNH GIÁ MỨC ĐỘ:** 1 câu; - [DU BAO MUA] **DỰ BÁO MƯA VÀ HÀNH ĐỘNG CỦA NGƯỜI DÙNG:** đúng 3-4 gạch đầu dòng, trong đó có thời lượng mưa dự kiến, cảnh báo thành phố đông dân cư / kẹt xe / ngập cục bộ, và hành động thực tế như mang áo mưa, giày chống trượt, tránh đường thấp; - [TUYEN TRANH TRU] **TUYẾN TRÁNH TRÚ:** hướng di chuyển an toàn dựa trên địa hình, ưu tiên đường cao, khu dân cư hoặc điểm sơ tán, tránh taluy dương, sườn đồi dốc và vùng ngập. Nếu dữ liệu không rõ, yêu cầu ở yên tại vị trí an toàn hiện tại và gọi 114. Giọng điệu bình tĩnh, thực tế, chu đáo với người dùng.'

function getRiskScore({ slope, rain, soil, cover }) {
  if (!slope && !rain) return 0
  const slopeRisk = slope < 5 ? 2 : slope < 15 ? 8 : slope < 25 ? 16 : slope < 35 ? 27 : slope < 45 ? 38 : 45
  const rainRisk = rain < 50 ? 3 : rain < 100 ? 8 : rain < 150 ? 14 : rain < 200 ? 20 : rain < 300 ? 28 : 35
  const soilRisk = soil.includes('Đá') ? 4 : soil.includes('Cát') ? 18 : soil.includes('phù sa') ? 10 : soil.includes('bazan') ? 12 : soil.includes('sét') ? 15 : 13
  const coverRisk = cover.includes('Rừng') ? 1 : cover.includes('trọc') ? 10 : cover.includes('canh tác') ? 8 : cover.includes('Khu dân cư') ? 6 : 9
  return Math.min(98, slopeRisk + rainRisk + soilRisk + coverRisk)
}

const quickPresets = [
  { label: 'Trà Leng', risk: 'Nguy cơ Rất Cao', profile: locationProfiles.find((item) => item.keys.includes('trà leng')) },
  { label: 'Sa Pa', risk: 'Nguy cơ Cao', profile: locationProfiles.find((item) => item.keys.includes('lào cai')) },
  { label: 'Đà Nẵng', risk: 'An toàn', profile: { location: 'Khu vực đại diện: huyện Hòa Vang, Đà Nẵng', slope: 4, rain: 55, soil: 'Đá cứng', cover: 'Rừng rậm' } },
]

function riskMeta(score) {
  if (score >= 75) return { label: 'Rất cao', color: '#c74634', soft: '#fbe8e4', text: 'text-danger', icon: AlertTriangle }
  if (score >= 50) return { label: 'Cao', color: '#de762f', soft: '#fff0df', text: 'text-orange', icon: AlertTriangle }
  if (score >= 25) return { label: 'Trung bình', color: '#d29a26', soft: '#fff6d9', text: 'text-warning', icon: Waves }
  return { label: 'Thấp', color: '#4f8a60', soft: '#e9f3e8', text: 'text-forest', icon: ShieldCheck }
}

function Gauge({ score }) {
  const meta = riskMeta(score)
  const radius = 82
  const circumference = 2 * Math.PI * radius
  const progress = circumference * (score / 100)
  return (
    <div className="gauge-wrap" style={{ '--risk-color': meta.color, '--risk-soft': meta.soft }}>
      <svg viewBox="0 0 220 220" className="gauge" role="img" aria-label={`Điểm rủi ro ${score} trên 100`}>
        <circle className="gauge-track" cx="110" cy="110" r={radius} />
        <circle className="gauge-progress" cx="110" cy="110" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference - progress} />
      </svg>
      <div className="gauge-value">
        <span>{score}</span><small>/100</small>
        <b style={{ color: meta.color }}>{meta.label}</b>
      </div>
    </div>
  )
}

function ChatBox({ apiKey, location, slope, rain, score, meta, safetyStatus }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Xin chào. Tôi có thể giúp bạn đọc chỉ số rủi ro hoặc hướng dẫn các bước an toàn tiếp theo.' }])
  const [question, setQuestion] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (safetyStatus !== 'help') return
    setMessages((current) => [...current, { role: 'assistant', type: 'help-notice', text: `Bạn có thể tìm hỗ trợ tại trạm cứu hộ gần nhất, UBND xã/phường hoặc công an địa phương, trạm y tế/bệnh viện và điểm sơ tán cộng đồng. Hãy chia sẻ vị trí ${location} khi gọi hỗ trợ; nếu có nguy hiểm tức thời, gọi 114.` }])
  }, [safetyStatus])

  async function sendMessage(event) {
    event.preventDefault()
    const message = question.trim()
    if (!message || sending) return
    setQuestion('')
    setMessages((current) => [...current, { role: 'user', text: message }])
    setSending(true)
    const prompt = `${emergencyPromptRules} Dữ liệu hiện tại: địa phương/tọa độ ${location}; độ dốc ${slope}°; lượng mưa 24h ${rain} mm; chỉ số rủi ro ${score}/100 (${meta.label}). Người dùng hỏi: ${message}. Trả lời bằng tiếng Việt, ưu tiên cảnh báo mưa dài, ngập, kẹt xe và các hành động thật sự cần làm của người dùng.`
    try {
      if (!apiKey.trim()) throw new Error('no-key')
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) })
      if (!response.ok) throw new Error('api')
      const data = await response.json()
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (!answer) throw new Error('empty')
      setMessages((current) => [...current, { role: 'assistant', text: answer }])
    } catch {
      const { duration, rainState, urbanTraffic, userPrep, cityNote } = getRainForecastContext({ place: location, rain, score, location })
      const fallback = score > 70
        ? `- [MUC DO] **ĐÁNH GIÁ MỨC ĐỘ:** Mưa và địa hình hiện tại cho thấy nguy cơ cao, đặc biệt ở các khu vực thấp và sườn dốc.\n- [DU BAO MUA] **DỰ BÁO MƯA VÀ HÀNH ĐỘNG CỦA NGƯỜI DÙNG:**\n- ${rainState} khoảng ${duration}. ${cityNote}\n- ${urbanTraffic}\n- ${userPrep}\n- Không nên di chuyển xa nếu không cần thiết; nếu phải đi, ưu tiên tuyến đường cao, ít ngập và nên báo vị trí cho người thân.\n- [TUYEN TRANH TRU] **TUYẾN TRÁNH TRÚ:** Di chuyển theo hướng lên cao, tránh các đoạn đường thấp, hẻm sâu và nơi nước có thể cuốn trôi.`
        : `- [MUC DO] **ĐÁNH GIÁ MỨC ĐỘ:** Khu vực hiện đang có nguy cơ cần theo dõi, đặc biệt nếu trời đang mưa và người dùng di chuyển trong thành phố.\n- [DU BAO MUA] **DỰ BÁO MƯA VÀ HÀNH ĐỘNG CỦA NGƯỜI DÙNG:**\n- ${rainState} khoảng ${duration}. ${cityNote}\n- ${urbanTraffic}\n- ${userPrep}\n- Nếu đã bắt đầu mưa, nên mang áo mưa, đi chậm và tránh những tuyến đường thường ngập hoặc kẹt xe.\n- [TUYEN TRANH TRU] **TUYẾN TRÁNH TRÚ:** Ưu tiên đường cao, ít ngập, tránh hẻm sâu và các điểm trũng.`
      setMessages((current) => [...current, { role: 'assistant', text: fallback }])
    } finally { setSending(false) }
  }

  return <section className="chat-box"><div className="chat-heading"><div><span className="section-kicker">HỖ TRỢ TRỰC TUYẾN</span><h2>Trợ lý an toàn EcoRisk</h2></div><span className="chat-status"><span /> Sẵn sàng</span></div><div className="chat-messages" aria-live="polite">{messages.map((message, index) => <div className={`chat-message chat-${message.role}${message.type ? ` chat-${message.type}` : ''}`} key={`${message.role}-${message.type || 'standard'}-${index}`}>{message.text}</div>)}{sending && <div className="chat-message chat-assistant chat-typing"><LoaderCircle size={14} className="spin" /> Đang trả lời...</div>}</div><form className="chat-form" onSubmit={sendMessage}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Mô tả tình trạng hoặc đặt câu hỏi..." aria-label="Tin nhắn cho trợ lý an toàn" /><button type="submit" disabled={sending || !question.trim()} aria-label="Gửi tin nhắn" title="Gửi tin nhắn"><ArrowUpRight size={17} /></button></form></section>
}

function FloatingChatBubble() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [activeId, setActiveId] = useState('team-lead')
  const [threads, setThreads] = useState([
    { id: 'team-lead', name: 'Nguyễn Sỹ Tiến Đạt', role: 'Hỗ trợ kỹ thuật', avatar: 'Đ', accent: '#397255', status: 'online', messages: [
        { id: 1, sender: 'them', text: 'Mình đang theo dõi tình trạng mưa và tuyến đường dễ ngập ở khu vực của bạn.' },
        { id: 2, sender: 'me', text: 'Cảm ơn. Tôi cần hướng dẫn di chuyển an toàn ngay lúc này.' },
      ]
    },
    { id: 'rescue', name: 'Đội cứu hộ', role: 'Mạng lưới khẩn cấp', avatar: 'C', accent: '#de762f', status: 'online', messages: [
        { id: 1, sender: 'them', text: 'Đội cứu hộ đang sẵn sàng hỗ trợ; hãy chia sẻ vị trí nếu có nguy cơ nước dâng.' },
      ]
    },
    { id: 'coordinator', name: 'Lan Anh', role: 'Điều phối địa phương', avatar: 'L', accent: '#4f8a60', status: 'busy', messages: [
        { id: 1, sender: 'them', text: 'Khu vực của bạn đang có mưa kéo dài, nên ưu tiên tuyến đường cao hơn.' },
      ]
    },
  ])

  const activeThread = threads.find((thread) => thread.id === activeId) || threads[0]

  function sendMessage(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !activeThread) return

    setThreads((current) => current.map((thread) =>
      thread.id === activeThread.id
        ? { ...thread, messages: [...thread.messages, { id: Date.now(), sender: 'me', text }] }
        : thread
    ))
    setDraft('')
  }

  function addSystemNote(label, type) {
    if (!activeThread) return
    const note = type === 'voice' ? `Đã gửi lời mời gọi thoại đến ${activeThread.name}.` : `Đã gửi lời mời gọi video đến ${activeThread.name}.`
    setThreads((current) => current.map((thread) =>
      thread.id === activeThread.id
        ? { ...thread, messages: [...thread.messages, { id: Date.now(), sender: 'them', text: label ? `${note} ${label}` : note }] }
        : thread
    ))
  }

  return (
    <div className={`floating-chat ${open ? 'open' : ''}`}>
      {!open && (
        <button type="button" className="chat-bubble-trigger" onClick={() => setOpen(true)} aria-label="Mở hội thoại">
          <Users size={18} />
          <span>Chat</span>
        </button>
      )}

      {open && (
        <div className="chat-float-panel" role="dialog" aria-label="Hộp tin nhắn nhanh">
          <div className="chat-float-header">
            <div className="chat-float-title">
              <span className="section-kicker">HỘI THOẠI</span>
              <h3>Liên hệ nhanh</h3>
            </div>
            <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Đóng hộp chat">
              <X size={16} />
            </button>
          </div>

          <div className="chat-float-body">
            <div className="chat-float-contacts">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className={`chat-contact ${thread.id === activeThread.id ? 'selected' : ''}`}
                  onClick={() => setActiveId(thread.id)}
                >
                  <span className="contact-avatar" style={{ background: thread.accent }}>{thread.avatar}</span>
                  <span className="contact-meta">
                    <strong>{thread.name}</strong>
                    <small>{thread.status === 'online' ? 'Trực tuyến' : 'Bận'}</small>
                  </span>
                </button>
              ))}
            </div>

            <div className="chat-float-thread">
              <div className="chat-thread-topbar">
                <div>
                  <strong>{activeThread.name}</strong>
                  <small>{activeThread.role}</small>
                </div>
                <div className="chat-actions">
                  <button type="button" aria-label="Gọi thoại" onClick={() => addSystemNote('Hãy nhắn tin ngay khi cần hỗ trợ.', 'voice')}>
                    <Phone size={15} />
                  </button>
                  <button type="button" aria-label="Gọi video" onClick={() => addSystemNote('Hãy tham gia video call ngay nếu tình huống cần hỗ trợ trực tiếp.', 'video')}>
                    <Video size={15} />
                  </button>
                </div>
              </div>

              <div className="chat-thread-messages" aria-live="polite">
                {activeThread.messages.map((message) => (
                  <div key={message.id} className={`chat-thread-message ${message.sender === 'me' ? 'mine' : ''}`}>
                    {message.text}
                  </div>
                ))}
              </div>

              <form className="chat-thread-form" onSubmit={sendMessage}>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Nhập tin nhắn..."
                  aria-label="Nhập tin nhắn nhanh"
                />
                <button type="submit" aria-label="Gửi tin nhắn" disabled={!draft.trim()}>
                  <ArrowUpRight size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [guest, setGuest] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [place, setPlace] = useState('')
  const [mapOpen, setMapOpen] = useState(false)
  const [safetyStatus, setSafetyStatus] = useState('safe')
  const [manualProfile, setManualProfile] = useState(null)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState(null)
  const [analysisText, setAnalysisText] = useState(defaultAnalysisText)
  const [weatherForecast, setWeatherForecast] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [liveClock, setLiveClock] = useState(new Date())
  const profile = useMemo(() => getLocationProfile(place), [place])
  const activeProfile = manualProfile || profile
  const { slope, rain, soil, cover, location, resolution } = activeProfile
  const score = useMemo(() => getRiskScore({ slope, rain, soil, cover }), [slope, rain, soil, cover])
  const meta = riskMeta(score)

  useEffect(() => {
    const timer = setInterval(() => setLiveClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const coordinates = getCoordinatesFromInput(place, activeProfile)
    if (!coordinates) {
      setWeatherForecast(buildFallbackForecast(place, rain))
      return
    }

    let active = true
    setWeatherLoading(true)
    fetchWeatherForecast(coordinates).then((data) => {
      if (!active) return
      setWeatherForecast(data)
    }).catch(() => {
      if (!active) return
      setWeatherForecast(buildFallbackForecast(place, rain))
    }).finally(() => {
      if (active) setWeatherLoading(false)
    })

    return () => { active = false }
  }, [place, activeProfile, rain])

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      const demoUser = readDemoSession()
      setUser(demoUser)
      setAuthLoading(false)
      return undefined
    }

    return onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); setAuthLoading(false) })
  }, [])

  function handleAuthSuccess(nextUser) {
    setUser(nextUser)
    setGuest(false)
    setAuthLoading(false)
  }

  function handleLogout() {
    if (hasFirebaseConfig && auth && user) {
      signOut(auth)
      setUser(null)
      setGuest(false)
      return
    }

    clearDemoSession()
    setUser(null)
    setGuest(false)
  }

  if (authLoading) return <main className="auth-page"><div className="auth-loading"><LoaderCircle size={24} className="spin" /> Đang kiểm tra phiên đăng nhập...</div></main>
  if (!user && !guest) return <AuthScreen onGuest={() => setGuest(true)} onAuthSuccess={handleAuthSuccess} />

  async function analyze() {
    setLoading(true)
    setNotice(null)
    const startedAt = Date.now()
    const key = apiKey.trim()
    if (!place.trim()) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setAnalysisText(defaultAnalysisText)
      setNotice({ type: 'warning', message: 'Chưa có vị trí để phân tích. Vui lòng nhập tỉnh, thành phố hoặc chọn ghim trên bản đồ.' })
      setLoading(false)
      return
    }
    const prompt = `${emergencyPromptRules} Dữ liệu đầu vào: người dùng nhập ${place}; khu vực đại diện chính xác nhất hiện có ${location} (${resolution || 'cấp khu vực'}); độ dốc ${slope} độ; lượng mưa 24h ${rain} mm; loại đất ${soil}; thảm phủ ${cover}; chỉ số rủi ro ${score}/100 (${meta.label}). Không được gán dữ liệu của quận/huyện khác cho địa điểm người dùng nhập. Hãy phân tích ngay theo đúng cấu trúc Markdown đã yêu cầu.`
    if (!key) {
      await new Promise((resolve) => setTimeout(resolve, 750))
      setAnalysisText(getFallbackAnalysis({ place, slope, rain, soil, cover, score, label: meta.label, location, resolution }))
      setNotice({ type: 'warning', message: 'Chưa cấu hình Gemini API Key. Đang dùng phân tích heuristic theo dữ liệu đại diện.' })
      setLoading(false)
      return
    }
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      let response
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        })
      } finally { clearTimeout(timeoutId) }
      if (!response.ok) {
        if ([400, 401, 403].includes(response.status)) throw new Error('API Key Gemini không hợp lệ hoặc đã hết quyền truy cập.')
        throw new Error(`Gemini trả về lỗi HTTP ${response.status}.`)
      }
      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
      if (!text) throw new Error('Gemini không trả về nội dung đánh giá.')
      setAnalysisText(text)
      setNotice({ type: 'success', message: 'Phân tích đã được tạo bởi Gemini 3.6 Flash.' })
    } catch (error) {
      const reason = error.name === 'AbortError' ? 'Gemini mất quá nhiều thời gian phản hồi.' : error.message || 'Không thể kết nối Gemini do lỗi mạng.'
      setNotice({ type: 'error', message: `${reason} Đã tự động chuyển sang mô phỏng heuristic và vẫn hiển thị đủ kết quả.` })
      setAnalysisText(getFallbackAnalysis({ place, slope, rain, soil, cover, score, label: meta.label, location, resolution }))
    } finally {
      const remaining = Math.max(0, 750 - (Date.now() - startedAt))
      if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining))
      setLoading(false)
    }
  }

  function reset() { setPlace(''); setManualProfile(null); setAnalysisText(defaultAnalysisText); setNotice(null) }

  function updatePlace(value) { setPlace(value); setManualProfile(null); setAnalysisText(defaultAnalysisText); setNotice(null) }

  function applyPreset(preset) { setPlace(preset.label); setManualProfile(preset.profile); setAnalysisText(defaultAnalysisText); setNotice({ type: 'success', message: `Đã chọn nhanh ${preset.label}: ${preset.risk}.` }) }

  function updateMetric(field, value) { setManualProfile({ ...activeProfile, [field]: value }) }

  return <div className={`app-shell${score >= 75 ? ' risk-alert' : score > 0 && score < 25 ? ' safe-alert' : ''}`}>
    <header className="topbar"><div className="brand-cluster"><a className="brand" href="/"><span className="brand-mark"><Leaf size={20} fill="currentColor" /></span><span>EcoRisk <strong>AI</strong></span></a><span className="owner-tag">By Nguyễn Sỹ Tiến Đạt</span></div><div className="status"><div className="top-clock"><Clock3 size={15} /><span>{formatClockLabel(liveClock)}</span></div><span className="status-dot" /> Hệ thống hoạt động <span className="header-divider" /> <span className="version">v1.0</span><button className="logout-button" onClick={handleLogout}>{user?.email || 'Khách'} · Đăng xuất</button></div></header>
    <main>
      <section className="hero"><img className="hcmut-watermark" src="/01_logobachkhoasang%20(1).png" alt="" aria-hidden="true" /><div className="hero-content"><div className="eyebrow"><span /> TRÍ TUỆ PHÂN TÍCH ĐỊA HÌNH</div><h1>Đọc vị rủi ro<br /><span>Chủ động ứng phó</span></h1><p className="hero-copy">Đánh giá nguy cơ sạt lở và ngập lụt bằng dữ liệu tại chỗ, kết hợp cùng dự báo thời tiết theo giờ và ngày để lên kế hoạch an toàn hơn.</p></div></section>
      <div className="dashboard-grid">
        <section className="panel input-panel"><div className="panel-top"><div><span className="section-kicker">01 / DỮ LIỆU ĐẦU VÀO</span><h2>Thông tin khu vực</h2></div><button className="icon-button" onClick={reset} aria-label="Đặt lại dữ liệu" title="Đặt lại dữ liệu"><RefreshCw size={17} /></button></div>
          <div className="form-stack"><div className="text-field"><label htmlFor="place">Nhập tỉnh, quận/huyện hoặc tọa độ</label><div className="input-with-icon location-input"><MapPin size={18} /><input id="place" value={place} onChange={(e) => updatePlace(e.target.value)} placeholder="Ví dụ: Quận 10, Đà Nẵng, 16.0544° N..." /><button type="button" className="map-button" onClick={() => setMapOpen(true)} aria-label="Chọn vị trí trên bản đồ" title="Chọn vị trí trên bản đồ"><Map size={18} /></button></div></div><div className="quick-presets"><span>GỢI Ý NHANH</span>{quickPresets.map((preset) => <button type="button" key={preset.label} onClick={() => applyPreset(preset)}>📍 {preset.label} <small>({preset.risk})</small></button>)}</div><div className="location-hint"><Sparkles size={15} /><span>{location}. Dữ liệu đang ở {resolution || 'cấp khu vực'}; các chỉ số được tự động lấy từ vùng đại diện này.</span></div><div className="interactive-facts"><label>Độ dốc <strong>{slope}°</strong><input type="range" min="0" max="60" value={slope} onChange={(e) => updateMetric('slope', Number(e.target.value))} /></label><label>Lượng mưa 24h <strong>{rain} mm</strong><input type="range" min="0" max="300" value={Math.min(rain, 300)} onChange={(e) => updateMetric('rain', Number(e.target.value))} /></label></div><div className="auto-facts"><div><span>Loại đất</span><b>{soil}</b></div><div><span>Thảm phủ</span><b>{cover}</b></div></div><a className="emergency-quick" href="tel:114"><PhoneCall size={15} /> Cứu hộ khẩn cấp <strong>114</strong></a></div>
          <button className="analyze-button" onClick={analyze} disabled={loading}>{loading ? <LoaderCircle size={18} className="spin" /> : <Sparkles size={18} />}{loading ? 'Đang phân tích...' : 'Phân tích Nguy cơ bằng Gemini'}<ArrowUpRight size={17} /></button>
          {loading && <div className="analysis-progress" role="status"><div className="progress-top"><LoaderCircle size={14} className="spin" /><span>Đang gửi dữ liệu và tổng hợp kết quả...</span><b>AI</b></div><div className="progress-track"><span /></div></div>}
          <div className="safety-status"><span className="status-label">TRẠNG THÁI HIỆN TẠI</span><div className="status-options"><button className={safetyStatus === 'safe' ? 'selected safe-choice' : ''} onClick={() => setSafetyStatus('safe')}><ShieldCheck size={17} /> Tôi an toàn</button><button className={safetyStatus === 'help' ? 'selected help-choice' : ''} onClick={() => setSafetyStatus('help')}><AlertTriangle size={17} /> Cần được giúp đỡ</button></div>{safetyStatus === 'help' && <a className="help-call" href="tel:114"><PhoneCall size={15} /> Gọi cứu hộ khẩn cấp 114</a>}</div>
        </section>

        <section className="panel result-panel"><div className="result-heading"><div><span className="section-kicker">02 / KẾT QUẢ PHÂN TÍCH</span><h2>Chỉ số rủi ro hiện tại</h2></div><span className="live-pill"><span /> LIVE</span></div><div className="gauge-section"><Gauge score={score} /><div className="gauge-side"><div className="risk-label" style={{ color: meta.color }}><span className="risk-dot" style={{ background: meta.color }} /> MỨC ĐỘ {meta.label.toUpperCase()}</div><p>Điểm số được tổng hợp từ địa hình, lượng mưa, loại đất và mức độ che phủ.</p><div className="legend"><span><i className="low" /> Thấp</span><span><i className="medium" /> Trung bình</span><span><i className="high" /> Cao</span></div></div></div><div className="insights-heading"><span className="section-kicker">03 / AI INSIGHTS</span><span className="insights-line" /></div><article className="expert-insight"><div className="expert-icon"><Sparkles size={19} /></div><div><h3>Đánh giá từ Chuyên gia Gemini</h3><MarkdownAnalysis text={analysisText} /></div></article>{notice && <div className={`notice notice-${notice.type}`} role="alert"><Check size={15} /> {notice.message}</div>}</section>
      </div>
      <WeatherForecastPanel forecast={weatherForecast} loading={weatherLoading} place={location || place || 'Khu vực của bạn'} liveClock={liveClock} />
      <ChatBox apiKey={apiKey} location={location} slope={slope} rain={rain} score={score} meta={meta} safetyStatus={safetyStatus} />
      <ContactPanel user={user} guest={guest} />
      <footer><span><FileText size={14} /> Báo cáo được tạo từ dữ liệu người dùng cung cấp</span><span><Navigation size={14} /> Dữ liệu chỉ mang tính tham khảo, không thay thế cảnh báo chính thức</span></footer>
    </main>
    <FloatingChatBubble />
    <MapPicker open={mapOpen} onClose={() => setMapOpen(false)} initialCoordinates={activeProfile.coordinates} onSelect={({ address, coordinates }) => setPlace(`${address} (${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)})`)} />
  </div>
}
