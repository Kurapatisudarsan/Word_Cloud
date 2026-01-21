import { httpJson } from './http.js'

export function apiLogin({ username, password }) {
  return httpJson('/api/login', {
    method: 'POST',
    body: { username, password },
  })
}

export function apiMe({ token }) {
  return httpJson('/api/me', {
    method: 'GET',
    token,
  })
}

export function apiLogout({ token }) {
  return httpJson('/api/logout', {
    method: 'POST',
    token,
  })
}

export function apiOtpRequest({ channel, phone, email, team_no }) {
  return httpJson('/api/otp/request', {
    method: 'POST',
    body: { channel, phone, email, team_no },
  })
}

export function apiOtpVerify({ challenge_id, otp }) {
  return httpJson('/api/otp/verify', {
    method: 'POST',
    body: { challenge_id, otp },
  })
}
