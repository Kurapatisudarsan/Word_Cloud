import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getRoundDetails, submitResponse } from '../api/wordCloudApi.js'
import './ResponsePage.css'

function ResponsePage() {
    const { roundId } = useParams()
    const navigate = useNavigate()
    const [round, setRound] = useState(null)
    const [word, setWord] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [showConfetti, setShowConfetti] = useState(false)

    useEffect(() => {
        loadRound()
    }, [roundId])

    async function loadRound() {
        try {
            setLoading(true)
            const data = await getRoundDetails(roundId)
            setRound(data)
        } catch (err) {
            setError('Round not found')
        } finally {
            setLoading(false)
        }
    }

    function validateWord(value) {
        const trimmed = value.trim()
        if (!trimmed) {
            return 'Please enter a word'
        }
        if (trimmed.includes(' ') || trimmed.includes('\t') || trimmed.includes('\n')) {
            return 'Only one word allowed'
        }
        if (trimmed.length < 2) {
            return 'Word must be at least 2 characters'
        }
        if (trimmed.length > 50) {
            return 'Word is too long (max 50 characters)'
        }
        return ''
    }

    function handleWordChange(value) {
        setWord(value)
        if (error) {
            const validationError = validateWord(value)
            setError(validationError)
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()

        const validationError = validateWord(word)
        if (validationError) {
            setError(validationError)
            return
        }

        try {
            setSubmitting(true)
            setError('')
            await submitResponse(roundId, word.trim())
            setSuccess(true)
            setShowConfetti(true)

            // Redirect to word cloud after 2 seconds
            setTimeout(() => {
                navigate(`/round/${roundId}`)
            }, 2000)
        } catch (err) {
            setError(err?.message || 'Failed to submit response')
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="response-loading">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        )
    }

    if (success) {
        return (
            <div className="response-success">
                {showConfetti && (
                    <div className="confetti">
                        {[...Array(50)].map((_, i) => (
                            <div key={i} className="confetti-piece" style={{
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 0.5}s`,
                                background: `hsl(${Math.random() * 360}, 70%, 60%)`
                            }}></div>
                        ))}
                    </div>
                )}
                <div className="success-content glass-card fade-in">
                    <div className="success-icon">🎉</div>
                    <h2>Response Submitted!</h2>
                    <p className="success-word">"{word.trim()}"</p>
                    <p>You earned +1 point!</p>
                    <div className="success-message">Redirecting to word cloud...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="response-container">
            <div className="response-content">
                <div className="response-card glass-card fade-in">
                    <div className="response-header">
                        <div className="cloud-icon">☁️</div>
                        <h1>Word Cloud Response</h1>
                    </div>

                    <div className="question-section">
                        <label className="question-label">Question:</label>
                        <div className="question-text">{round?.question}</div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Your Answer (One Word)</label>
                            <input
                                type="text"
                                className={`form-input word-input ${error ? 'error shake-animation' : ''}`}
                                placeholder="e.g., happy, excited, calm..."
                                value={word}
                                onChange={(e) => handleWordChange(e.target.value)}
                                maxLength={50}
                                disabled={submitting}
                                autoFocus
                            />
                            <div className="word-count">
                                {word.trim().length}/50 characters
                                {word.trim().split(/\s+/).filter(w => w).length > 1 && (
                                    <span className="word-warning"> • Multiple words detected!</span>
                                )}
                            </div>
                            {error && <div className="form-error">{error}</div>}
                        </div>

                        <div className="response-hints">
                            <h4>Guidelines:</h4>
                            <ul>
                                <li>✓ Enter exactly one word</li>
                                <li>✓ Use letters, numbers, or hyphens</li>
                                <li>✓ Keep it simple and clear</li>
                                <li>✗ No spaces or punctuation</li>
                            </ul>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-large btn-primary"
                            disabled={submitting || !word.trim()}
                        >
                            {submitting ? (
                                <>
                                    <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-send-fill"></i>
                                    Submit Response
                                </>
                            )}
                        </button>
                    </form>

                    <div className="response-footer">
                        <button
                            className="btn btn-small btn-secondary"
                            onClick={() => navigate(`/round/${roundId}`)}
                        >
                            View Word Cloud Instead
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ResponsePage
