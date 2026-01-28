import { useState } from 'react'
import './CreateRoundModal.css'

function CreateRoundModal({ onClose, onSubmit }) {
    const [question, setQuestion] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e) {
        e.preventDefault()
        if (question.trim().length < 5) {
            setError('Question must be at least 5 characters')
            return
        }

        try {
            setLoading(true)
            setError('')
            await onSubmit(question.trim())
        } catch (err) {
            setError(err?.message || 'Failed to create round')
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Create New Round</h3>
                    <button className="modal-close" onClick={onClose}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Question</label>
                        <textarea
                            className={`form-textarea ${error ? 'error' : ''}`}
                            placeholder="e.g., How are you feeling today?"
                            value={question}
                            onChange={(e) => {
                                setQuestion(e.target.value)
                                setError('')
                            }}
                            maxLength={500}
                            rows={4}
                            disabled={loading}
                        />
                        <div className="form-helper">
                            {question.length}/500 characters
                        </div>
                        {error && <div className="form-error">{error}</div>}
                    </div>

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn btn-medium btn-secondary"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-medium btn-primary"
                            disabled={loading || question.trim().length < 5}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-check-circle"></i>
                                    Create Round
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default CreateRoundModal
