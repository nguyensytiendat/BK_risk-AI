import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronDown,
  CloudRain,
  Compass,
  FileText,
  KeyRound,
  Leaf,
  LoaderCircle,
  MapPin,
  Mountain,
  Navigation,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trees,
  Waves,
  X,
} from 'lucide-react'

const soilOptions = ['Đất sét', 'Đá cứng', 'Cát bở rời', 'Đất pha phù sa', 'Đất phong hóa']
const coverOptions = ['Rừng rậm', 'Cây bụi thưa', 'Đồi trọc', 'Khu dân cư', 'Đất canh tác']
const defaultAnalysisText = 'Dữ liệu đang chờ phân tích. Hãy nhập các điều kiện địa hình và bắt đầu phân tích để nhận đánh giá từ chuyên gia Gemini.'

function getFallbackAnalysis({ slope, rain, soil, cover, score, label }) {
  const emergency = score >= 50
    ? 'Theo dõi nứt đất, dòng bùn và tiếng động bất thường; sẵn sàng di chuyển người và tài sản khỏi chân taluy khi mưa còn tiếp diễn.'
    : 'Duy trì lối thoát nước thông thoáng và kiểm tra các điểm trũng sau mỗi đợt mưa lớn.'
  return `Độ dốc ${slope}° kết hợp với ${rain} mm mưa trong 24 giờ tạo áp lực nước đáng kể; ${soil} và thảm phủ ${cover.toLowerCase()} có thể làm giảm độ ổn định lớp đất mặt. Mức nguy cơ heuristic hiện tại là ${label.toLowerCase()} với điểm ${score}/100. ${emergency} Khoanh vùng mái dốc nhạy cảm và cân nhắc khảo sát địa kỹ thuật nếu khu vực có công trình hoặc dân cư.`
}

function getRiskScore({ slope, rain, soil, cover }) {
  const soilRisk = { 'Đất sét': 15, 'Cát bở rời': 18, 'Đất phong hóa': 13, 'Đất pha phù sa': 10, 'Đá cứng': 4 }
  const coverRisk = { 'Đồi trọc': 20, 'Cây bụi thưa': 12, 'Đất canh tác': 10, 'Khu dân cư': 8, 'Rừng rậm': 1 }
  return Math.min(98, Math.round(slope * 0.8 + rain * 0.105 + soilRisk[soil] + coverRisk[cover]))
}

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

function SliderField({ label, value, max, unit, icon: Icon, onChange }) {
  return (
    <div className="slider-field">
      <div className="field-heading">
        <label>{label}</label>
        <span className="metric-value">{value}<em>{unit}</em></span>
      </div>
      <div className="slider-row">
        <Icon size={17} strokeWidth={1.8} />
        <input type="range" min="0" max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} style={{ '--fill': `${(value / max) * 100}%` }} />
      </div>
      <div className="range-labels"><span>0 {unit}</span><span>{max} {unit}</span></div>
    </div>
  )
}

export default function App() {
  const [place, setPlace] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('114')
  const [slope, setSlope] = useState(22)
  const [rain, setRain] = useState(146)
  const [soil, setSoil] = useState('Đất sét')
  const [cover, setCover] = useState('Cây bụi thưa')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('ecorisk-gemini-key') || import.meta.env.VITE_GEMINI_API_KEY || '')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState(null)
  const [analysisText, setAnalysisText] = useState(defaultAnalysisText)
  const score = useMemo(() => getRiskScore({ slope, rain, soil, cover }), [slope, rain, soil, cover])
  const meta = riskMeta(score)

  async function analyze() {
    setLoading(true)
    setNotice(null)
    const startedAt = Date.now()
    const key = apiKey.trim()
    if (key) localStorage.setItem('ecorisk-gemini-key', key)
    const prompt = `Dựa vào độ dốc ${slope} độ, lượng mưa ${rain} mm và loại đất ${soil}, hãy viết 1 đoạn văn ngắn gọn (tối đa 4 câu) đánh giá nguy cơ địa chất và đưa ra lời khuyên an toàn. Địa điểm: ${place || 'chưa cung cấp'}. Thảm phủ: ${cover}. Chỉ trả về văn bản thuần túy bằng tiếng Việt, không JSON, không markdown.`
    if (!key) {
      await new Promise((resolve) => setTimeout(resolve, 750))
      setAnalysisText(getFallbackAnalysis({ slope, rain, soil, cover, score, label: meta.label }))
      setNotice({ type: 'warning', message: 'Chưa có API Key. Đang dùng mô hình heuristic tại chỗ; thêm Gemini API Key để nhận phân tích AI chuyên sâu hơn.' })
      setLoading(false)
      return
    }
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      let response
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`, {
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
      setNotice({ type: 'success', message: 'Phân tích đã được tạo bởi Gemini 1.5 Flash.' })
    } catch (error) {
      const reason = error.name === 'AbortError' ? 'Gemini mất quá nhiều thời gian phản hồi.' : error.message || 'Không thể kết nối Gemini do lỗi mạng.'
      setNotice({ type: 'error', message: `${reason} Đã tự động chuyển sang mô phỏng heuristic và vẫn hiển thị đủ kết quả.` })
      setAnalysisText(getFallbackAnalysis({ slope, rain, soil, cover, score, label: meta.label }))
    } finally {
      const remaining = Math.max(0, 750 - (Date.now() - startedAt))
      if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining))
      setLoading(false)
    }
  }

  function reset() { setPlace(''); setEmergencyPhone('114'); setSlope(22); setRain(146); setSoil('Đất sét'); setCover('Cây bụi thưa'); setAnalysisText(defaultAnalysisText); setNotice(null) }

  return <div className={`app-shell${score >= 75 ? ' risk-alert' : ''}`}>
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark"><Leaf size={20} fill="currentColor" /></span><span>EcoRisk <strong>AI</strong></span></a><div className="status"><span className="status-dot" /> Hệ thống hoạt động <span className="header-divider" /> <span className="version">v1.0</span></div></header>
    <main>
      <section className="hero"><img className="hcmut-watermark" src="/01_logobachkhoasang%20(1).png" alt="" aria-hidden="true" /><div className="hero-content"><div className="eyebrow"><span /> TRÍ TUỆ PHÂN TÍCH ĐỊA HÌNH</div><h1>Đọc vị rủi ro<br /><span>Chủ động ứng phó</span></h1><p className="hero-copy">Đánh giá nguy cơ sạt lở và ngập lụt bằng dữ liệu tại chỗ, kết hợp cùng trí tuệ nhân tạo Gemini.</p></div></section>
      <div className="dashboard-grid">
        <section className="panel input-panel"><div className="panel-top"><div><span className="section-kicker">01 / DỮ LIỆU ĐẦU VÀO</span><h2>Thông tin khu vực</h2></div><button className="icon-button" onClick={reset} aria-label="Đặt lại dữ liệu" title="Đặt lại dữ liệu"><RefreshCw size={17} /></button></div>
          <div className="form-stack">
            <div className="two-col location-row"><div className="text-field"><label htmlFor="place">Tên địa điểm hoặc tọa độ</label><div className="input-with-icon"><MapPin size={18} /><input id="place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Ví dụ: Đà Nẵng, 16.0544° N..." /></div></div><div className="text-field"><label htmlFor="emergency-phone">Số cứu hộ khẩn cấp</label><div className="input-with-icon emergency-input"><PhoneCall size={18} /><input id="emergency-phone" type="tel" value={emergencyPhone || (!place.trim() ? '114' : '')} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder={place ? 'Nhập số cứu hộ địa phương' : '114'} /><a href={`tel:${emergencyPhone || '114'}`} aria-label={`Gọi số cứu hộ ${emergencyPhone || '114'}`} title="Gọi cứu hộ"><PhoneCall size={16} /></a></div></div></div>
            <div className="two-col"><SliderField label="Độ dốc" value={slope} max={60} unit="°" icon={Mountain} onChange={setSlope} /><SliderField label="Lượng mưa 24h" value={rain} max={500} unit="mm" icon={CloudRain} onChange={setRain} /></div>
            <div className="two-col"><div className="select-field"><label htmlFor="soil">Loại đất</label><div className="select-wrap"><Compass size={17} /><select id="soil" value={soil} onChange={(e) => setSoil(e.target.value)}>{soilOptions.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></div></div><div className="select-field"><label htmlFor="cover">Thảm phủ</label><div className="select-wrap"><Trees size={17} /><select id="cover" value={cover} onChange={(e) => setCover(e.target.value)}>{coverOptions.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></div></div></div>
          </div>
          <div className="key-area"><div className="key-heading"><KeyRound size={16} /><span>Gemini API Key</span><span className="optional">Không bắt buộc</span></div><div className="key-input"><input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Dán API key của bạn tại đây" /><button onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Ẩn API key' : 'Hiện API key'}>{showKey ? <X size={16} /> : <ArrowUpRight size={16} />}</button></div><p>Key chỉ được lưu trong trình duyệt của bạn.</p></div>
          <button className="analyze-button" onClick={analyze} disabled={loading}>{loading ? <LoaderCircle size={18} className="spin" /> : <Sparkles size={18} />}{loading ? 'Đang phân tích...' : 'Phân tích Nguy cơ bằng Gemini'}<ArrowUpRight size={17} /></button>
          {loading && <div className="analysis-progress" role="status"><div className="progress-top"><LoaderCircle size={14} className="spin" /><span>Đang gửi dữ liệu và tổng hợp kết quả...</span><b>AI</b></div><div className="progress-track"><span /></div></div>}
        </section>

        <section className="panel result-panel"><div className="result-heading"><div><span className="section-kicker">02 / KẾT QUẢ PHÂN TÍCH</span><h2>Chỉ số rủi ro hiện tại</h2></div><span className="live-pill"><span /> LIVE</span></div><div className="gauge-section"><Gauge score={score} /><div className="gauge-side"><div className="risk-label" style={{ color: meta.color }}><span className="risk-dot" style={{ background: meta.color }} /> MỨC ĐỘ {meta.label.toUpperCase()}</div><p>Điểm số được tổng hợp từ địa hình, lượng mưa, loại đất và mức độ che phủ.</p><div className="legend"><span><i className="low" /> Thấp</span><span><i className="medium" /> Trung bình</span><span><i className="high" /> Cao</span></div></div></div><div className="insights-heading"><span className="section-kicker">03 / AI INSIGHTS</span><span className="insights-line" /></div><article className="expert-insight"><div className="expert-icon"><Sparkles size={19} /></div><div><h3>Đánh giá từ Chuyên gia Gemini</h3><p>{analysisText}</p></div></article>{notice && <div className={`notice notice-${notice.type}`} role="alert"><Check size={15} /> {notice.message}</div>}</section>
      </div>
      <footer><span><FileText size={14} /> Báo cáo được tạo từ dữ liệu người dùng cung cấp</span><span><Navigation size={14} /> Dữ liệu chỉ mang tính tham khảo, không thay thế cảnh báo chính thức</span></footer>
    </main>
  </div>
}
