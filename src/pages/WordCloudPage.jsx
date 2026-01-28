import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import {
    getRoundDetails,
    getWordCloudData,
    recordShare,
    getLeaderboard
} from '../api/wordCloudApi.js'
import WordCloud from '../components/WordCloud.jsx'
import './WordCloudPage.css'

function WordCloudPage() {
    const { roundId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [round, setRound] = useState(null)
    const [cloudData, setCloudData] = useState({ words: [], total_responses: 0 })
    const [leaderboard, setLeaderboard] = useState([])
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState(null)
    const pollIntervalRef = useRef(null)

    useEffect(() => {
        loadData()

        // Poll for updates every 3 seconds
        pollIntervalRef.current = setInterval(() => {
            loadWordCloudData()
            loadLeaderboard()
        }, 3000)

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
            }
        }
    }, [roundId])

    async function loadData() {
        try {
            setLoading(true)
            await Promise.all([
                loadRoundDetails(),
                loadWordCloudData(),
                loadLeaderboard()
            ])
        } catch (err) {
            showToast(err?.message || 'Failed to load data', 'error')
        } finally {
            setLoading(false)
        }
    }

    async function loadRoundDetails() {
        const data = await getRoundDetails(roundId)
        setRound(data)
    }

    async function loadWordCloudData() {
        const data = await getWordCloudData(roundId)
        setCloudData(data)
    }

    async function loadLeaderboard() {
        const data = await getLeaderboard(roundId)
        setLeaderboard(data.leaderboard || [])
    }

    function showToast(message, type = 'info') {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    function copyShareLink() {
        const link = `${window.location.origin}/round/${roundId}/share`
        navigator.clipboard.writeText(link).then(async () => {
            showToast('Link copied! +1 point earned', 'success')
            try {
                await recordShare(roundId)
                await loadLeaderboard()
            } catch (err) {
                console.error('Failed to record share:', err)
            }
        })
    }

    function shareToWhatsApp() {
        const link = `${window.location.origin}/round/${roundId}/share`
        const text = `Join my word cloud: ${round?.question || 'Answer the question!'}`
        const url = `https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}`
        window.open(url, '_blank')
        handleShare()
    }

    function shareToTwitter() {
        const link = `${window.location.origin}/round/${roundId}/share`
        const text = `Join my word cloud: ${round?.question || 'Answer the question!'}`
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`
        window.open(url, '_blank')
        handleShare()
    }

    async function handleShare() {
        showToast('Thanks for sharing! +1 point earned', 'success')
        try {
            await recordShare(roundId)
            await loadLeaderboard()
        } catch (err) {
            console.error('Failed to record share:', err)
        }
    }

    async function nativeShare() {
        const shareLink = `${window.location.origin}/round/${roundId}/share`
        const shareData = {
            title: 'Join my Word Cloud!',
            text: `${round?.question || 'Answer the question!'}`,
            url: shareLink
        }

        try {
            if (navigator.share) {
                await navigator.share(shareData)
                handleShare()
            } else {
                // Fallback: copy to clipboard
                await navigator.clipboard.writeText(shareLink)
                showToast('Link copied to clipboard!', 'success')
                handleShare()
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Share failed:', err)
            }
        }
    }

    if (loading) {
        return (
            <div className="wordcloud-loading">
                <div className="spinner"></div>
                <p>Loading word cloud...</p>
            </div>
        )
    }

    return (
        <div className="wordcloud-container">
            {/* Header */}
            <header className="wordcloud-header glass-card-light">
                <button className="btn btn-small btn-secondary" onClick={() => navigate('/dashboard')}>
                    <i className="bi bi-arrow-left"></i>
                    Back to Dashboard
                </button>
                <span className="team-badge">Team {user?.team_no || '--'}</span>
            </header>

            {/* Main Content */}
            <div className="wordcloud-main">
                {/* Left Side - Word Cloud */}
                <div className="wordcloud-section">
                    <div className="section-card glass-card fade-in">
                        <div className="section-header">
                            <h2>{round?.question}</h2>
                            <div className="response-stats">
                                <span className="stat-badge">
                                    <i className="bi bi-chat-dots-fill"></i>
                                    {cloudData.total_responses} responses
                                </span>
                                <span className={`stat-badge ${round?.status}`}>
                                    {round?.status || 'active'}
                                </span>
                            </div>
                        </div>

                        {cloudData.words.length === 0 ? (
                            <div className="empty-cloud">
                                <div className="empty-icon">💭</div>
                                <h4>No responses yet</h4>
                                <p>Share the link below to start collecting words!</p>
                            </div>
                        ) : (
                            <div className="cloud-wrapper">
                                <WordCloud words={cloudData.words} />
                            </div>
                        )}

                        {/* Share Section */}
                        <div className="share-section">
                            <h4>Share this round</h4>
                            <div className="share-link-box">
                                <input
                                    type="text"
                                    className="share-link-input"
                                    value={`${window.location.origin}/round/${roundId}/share`}
                                    readOnly
                                />
                                <button className="btn btn-medium btn-primary" onClick={copyShareLink}>
                                    <i className="bi bi-clipboard"></i>
                                    Copy Link
                                </button>
                                <button className="btn btn-medium btn-primary" onClick={nativeShare}>
                                    <i className="bi bi-share"></i>
                                    Share
                                </button>
                            </div>
                            <div className="share-buttons">
                                <button className="btn btn-medium btn-social whatsapp" onClick={shareToWhatsApp}>
                                    <i className="bi bi-whatsapp"></i>
                                    WhatsApp
                                </button>
                                <button className="btn btn-medium btn-social twitter" onClick={shareToTwitter}>
                                    <i className="bi bi-twitter"></i>
                                    Twitter
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side - Leaderboard */}
                <div className="leaderboard-section">
                    <div className="section-card glass-card-light fade-in">
                        <h3>
                            <i className="bi bi-trophy-fill"></i>
                            Leaderboard
                        </h3>
                        {leaderboard.length === 0 ? (
                            <div className="empty-leaderboard">
                                <p>No scores yet</p>
                            </div>
                        ) : (
                            <div className="leaderboard-list">
                                {leaderboard.map((player) => (
                                    <div key={player.rank} className={`leaderboard-item rank-${player.rank}`}>
                                        <div className="player-rank">
                                            {player.rank === 1 && '🥇'}
                                            {player.rank === 2 && '🥈'}
                                            {player.rank === 3 && '🥉'}
                                            {player.rank > 3 && `#${player.rank}`}
                                        </div>
                                        <div className="player-info">
                                            <div className="player-name">{player.member_name}</div>
                                            <div className="player-stats">
                                                <span title="Response points">💬 {player.response_points}</span>
                                                <span title="Share points">📤 {player.share_points}</span>
                                            </div>
                                        </div>
                                        <div className="player-total">{player.total_points}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="leaderboard-hint">
                            <i className="bi bi-info-circle"></i>
                            Earn +1 for responding, +1 per share
                        </div>
                    </div>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`toast toast-${toast.type}`}>
                    {toast.message}
                </div>
            )}
        </div>
    )
}

export default WordCloudPage
