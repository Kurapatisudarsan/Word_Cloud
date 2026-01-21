import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { apiOtpRequest } from '../api/authApi.js'
import logo from '../assets/zdotapps.png'
import emailIcon from '../assets/email_icon.png'
import whatsappIcon from '../assets/whatsapp_icon.png'
import './LoginPage.css'

function LoginPage() {
  const navigate = useNavigate()
  const { signIn, signInWithOtp, status, user } = useAuth()
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [challengeId, setChallengeId] = useState(null)
  const [teams, setTeams] = useState([])
  const [teamNo, setTeamNo] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const otpRefs = useRef([])

  const otpKey = useMemo(() => otp.join(''), [otp])

  useEffect(() => {
    if (status === 'ready' && user) {
      navigate('/landing', { replace: true })
    }
  }, [navigate, status, user])

  function onOtpChange(index, rawValue) {
    const nextValue = (rawValue || '').replace(/\s+/g, '').slice(0, 1)
    setOtp((prev) => {
      const copy = [...prev]
      copy[index] = nextValue
      return copy
    })

    if (nextValue && index < otpRefs.current.length - 1) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  function onOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  async function requestOtp(channel) {
    if (submitting) return
    setErrorMessage('')
    setInfoMessage('')
    setSubmitting(true)
    try {
      const value = (username || '').trim()

      const payload = {
        channel,
        phone: channel === 'whatsapp' ? value : undefined,
        email: channel === 'email' ? value : undefined,
        team_no: teamNo || undefined,
      }

      const data = await apiOtpRequest(payload)
      setChallengeId(data.challenge_id)
      setTeams([])
      setOtp(['', '', '', '', '', ''])
      setInfoMessage(channel === 'email' ? 'Key sent to your Email Id.' : 'Key sent to your Mobile Number.')
      otpRefs.current[0]?.focus()
    } catch (err) {
      if (err?.status === 409 && Array.isArray(err?.payload?.teams)) {
        setTeams(err.payload.teams)
      }
      setChallengeId(null)
      setOtp(['', '', '', '', '', ''])
      setErrorMessage(err?.message || 'Unable to request key')
    } finally {
      setSubmitting(false)
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (submitting) return

    setErrorMessage('')
    setInfoMessage('')
    setSubmitting(true)
    try {
      const key = otpKey
      if (challengeId && key.length === 6) {
        await signInWithOtp({ challenge_id: challengeId, otp: key })
      } else {
        await signIn({ username, password })
      }
      navigate('/landing')
    } catch (err) {
      setErrorMessage(err?.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-wrapper">
      <div className="glass-panel">
        <div className="glass-content">
          <div className="logo">
            <img src={logo} alt="ZDrive" height="120" />
          </div>

          <form id="loginForm" onSubmit={onSubmit}>
            {errorMessage ? <div className="text-danger mb-2">{errorMessage}</div> : null}
            {infoMessage ? <div className="text-success mb-2">{infoMessage}</div> : null}

            <div className="field">
              <label>Email Id or Mobile Number</label>
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setErrorMessage('')
                  setInfoMessage('')
                  setChallengeId(null)
                  setTeams([])
                  setTeamNo('')
                  setOtp(['', '', '', '', '', ''])
                }}
              />
            </div>

            <div className="get-key">
              <span>Get key from:</span>
              <button
                type="button"
                className="key-icon"
                onClick={() => requestOtp('email')}
                disabled={submitting}
              >
                <img src={emailIcon} alt="Email" />
              </button>
              <button
                type="button"
                className="key-icon"
                onClick={() => requestOtp('whatsapp')}
                disabled={submitting}
              >
                <img src={whatsappIcon} alt="WhatsApp" />
              </button>
            </div>

            {teams.length ? (
              <div className="field mt-3">
                <label>Team Number</label>
                <select
                  value={teamNo}
                  onChange={(e) => {
                    setTeamNo(e.target.value)
                    setErrorMessage('')
                    setInfoMessage('')
                    setChallengeId(null)
                    setOtp(['', '', '', '', '', ''])
                  }}
                >
                  <option value="">Select team</option>
                  {teams.map((t) => (
                    <option key={`team-${t.team_no}`} value={t.team_no}>
                      Team {t.team_no}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="field mt-3">
              <label>Enter Key</label>
              <input type="hidden" name="key" value={otpKey} />
              <div className="otp-boxes">
                {otp.map((value, index) => (
                  <input
                    key={`otp-${index}`}
                    type="text"
                    maxLength={1}
                    value={value}
                    onChange={(e) => onOtpChange(index, e.target.value)}
                    onKeyDown={(e) => onOtpKeyDown(index, e)}
                    ref={(el) => {
                      otpRefs.current[index] = el
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="or-text">(OR)</div>

            <div className="field password">
              <label>Password</label>
              <input
                type={passwordVisible ? 'text' : 'password'}
                id="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <i
                className={`bi ${passwordVisible ? 'bi-eye-slash' : 'bi-eye'} password-eye`}
                id="togglePassword"
                role="button"
                tabIndex={0}
                onClick={() => setPasswordVisible((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setPasswordVisible((v) => !v)
                }}
              />
            </div>

            <button className="login-btn" type="submit" disabled={submitting}>
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
