import { httpGet, httpPost } from './http.js'

export async function createRound(question) {
  return httpPost('/api/rounds/create', { question })
}

export async function getMyRounds() {
  return httpGet('/api/rounds/my')
}

export async function getRoundDetails(roundId) {
  return httpGet(`/api/rounds/${roundId}`)
}

export async function submitResponse(roundId, word) {
  return httpPost(`/api/rounds/${roundId}/respond`, { word })
}

export async function getWordCloudData(roundId) {
  return httpGet(`/api/rounds/${roundId}/wordcloud`)
}

export async function recordShare(roundId) {
  return httpPost(`/api/rounds/${roundId}/share`, {})
}

export async function getLeaderboard(roundId) {
  return httpGet(`/api/rounds/${roundId}/leaderboard`)
}
