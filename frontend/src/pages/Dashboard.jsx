import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { createRound, getMyRounds } from '../api/wordCloudApi.js'
import CreateRoundModal from '../components/CreateRoundModal.jsx'
import './Dashboard.css'

function Dashboard() {
    const navigate = useNavigate()
    const { user, member, signOut } = useAuth()
    const [rounds, setRounds] = useState([])
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const [toast, setToast] = useState(null)

    useEffect(() => {
        loadRounds()
    }, [])

    async function loadRounds() {
        try {
            setLoading(true)
            const data = await getMyRounds()
            setRounds(data.rounds || [])
        } catch (err) {
            showToast(err?.message || 'Failed to load rounds', 'error')
        } finally {
            setLoading(false)
        }
    }

    async function handleCreateRound(question) {
        try {
            const newRound = await createRound(question)
            setShowCreateModal(false)
            await loadRounds()
            showToast('Round created successfully!', 'success')
            // Navigate to the round after a short delay
            setTimeout(() => {
                navigate(`/round/${newRound.id}`)
            }, 1000)
        } catch (err) {
            throw err // Let modal handle the error
        }
    }

    function showToast(message, type = 'info') {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    function copyShareLink(roundId) {
        const link = `${window.location.origin}/round/${roundId}/share`
        navigator.clipboard.writeText(link).then(() => {
            showToast('Link copied to clipboard!', 'success')
        })
    }

    async function handleLogout() {
        await signOut()
        navigate('/login')
    }

    return (
        <div className="dashboard-container">
            {/* Header */}
            <header className="dashboard-header glass-card-light">
                <div className="dashboard-header-content">
                    <div className="dashboard-logo">
                        <div className="logo-icon">☁️</div>
                        <h2 className="gradient-text">Word Cloud Game</h2>
                    </div>

                    <div className="dashboard-user-menu">
                        <span className="team-badge">Team {user?.team_no || '--'}</span>
                        <div className="user-dropdown">
                            <button
                                className="user-avatar-btn"
                                onClick={() => setMenuOpen(!menuOpen)}
                            >
                                <i className="bi bi-person-circle"></i>
                            </button>
                            {menuOpen && (
                                <div className="user-menu">
                                    <div className="user-info">
                                        <div className="user-name">{member?.name || '--'}</div>
                                        <div className="user-email">{member?.email || '--'}</div>
                                    </div>
                                    <hr />
                                    <button className="btn btn-danger btn-small" onClick={handleLogout}>
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="dashboard-hero">
                <div className="hero-content fade-in">
                    <h1 className="hero-title">
                        Create Amazing <span className="gradient-text">Word Clouds</span>
                    </h1>
                    <p className="hero-subtitle">
                        Ask questions, collect responses, and visualize them in beautiful word clouds
                    </p>
                    <button
                        className="btn btn-large btn-primary pulse-animation"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <i className="bi bi-plus-circle"></i>
                        Create New Round
                    </button>
                </div>
            </section>

            {/* Rounds Grid */}
            <section className="dashboard-rounds">
                <div className="rounds-container">
                    <h3 className="rounds-heading">Your Rounds</h3>

                    {loading ? (
                        <div className="loading-container">
                            <div className="spinner"></div>
                            <p>Loading rounds...</p>
                        </div>
                    ) : rounds.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📊</div>
                            <h4>No rounds yet</h4>
                            <p>Create your first word cloud round to get started</p>
                            <button
                                className="btn btn-medium btn-primary"
                                onClick={() => setShowCreateModal(true)}
                            >
                                Create Round
                            </button>
                        </div>
                    ) : (
                        <div className="rounds-grid">
                            {rounds.map((round) => (
                                <div key={round.id} className="round-card glass-card-light hover-lift">
                                    <div className="round-header">
                                        <span className={`status-badge ${round.status}`}>
                                            {round.status}
                                        </span>
                                        <span className="response-count">
                                            <i className="bi bi-chat-dots"></i>
                                            {round.response_count} responses
                                        </span>
                                    </div>

                                    <h4 className="round-question">{round.question}</h4>

                                    <div className="round-footer">
                                        <div className="round-date">
                                            {new Date(round.created_at).toLocaleDateString()}
                                        </div>
                                        <div className="round-actions">
                                            <button
                                                className="btn btn-small btn-secondary"
                                                onClick={() => copyShareLink(round.id)}
                                                title="Copy share link"
                                            >
                                                <i className="bi bi-share"></i>
                                            </button>
                                            <button
                                                className="btn btn-small btn-primary"
                                                onClick={() => navigate(`/round/${round.id}`)}
                                            >
                                                View Cloud
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Create Round Modal */}
            {showCreateModal && (
                <CreateRoundModal
                    onClose={() => setShowCreateModal(false)}
                    onSubmit={handleCreateRound}
                />
            )}

            {/* Toast Notification */}
            {toast && (
                <div className={`toast toast-${toast.type}`}>
                    {toast.message}
                </div>
            )}
        </div>
    )
}

export default Dashboard
