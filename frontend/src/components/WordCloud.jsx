import { useEffect, useRef, useState } from 'react'
import './WordCloud.css'

// Vibrant color palette for word cloud
const COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B195', '#C06C84',
    '#6C5B7B', '#F67280', '#355C7D', '#99B898', '#E84A5F'
]

function WordCloud({ words }) {
    const canvasRef = useRef(null)
    const containerRef = useRef(null)
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

    useEffect(() => {
        if (containerRef.current) {
            const updateDimensions = () => {
                const { width, height } = containerRef.current.getBoundingClientRect()
                setDimensions({ width, height })
            }

            updateDimensions()
            window.addEventListener('resize', updateDimensions)
            return () => window.removeEventListener('resize', updateDimensions)
        }
    }, [])

    useEffect(() => {
        if (words.length > 0 && dimensions.width && dimensions.height) {
            drawWordCloud()
        }
    }, [words, dimensions])

    function drawWordCloud() {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        const { width, height } = dimensions

        canvas.width = width
        canvas.height = height

        // Clear canvas
        ctx.clearRect(0, 0, width, height)

        // Calculate font sizes
        const maxCount = Math.max(...words.map(w => w.count))
        const minFontSize = 16
        const maxFontSize = Math.min(80, width / 8)

        // Create word layout data
        const wordData = words.map((word, index) => {
            const fontSize = minFontSize + (word.count / maxCount) * (maxFontSize - minFontSize)
            const color = COLORS[index % COLORS.length]
            // Fixed rotation based on word text (not random, so it doesn't change)
            // Use simple hash of word text to determine if vertical or horizontal
            const hash = word.text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
            const rotation = hash % 3 === 0 ? 90 : 0  // ~33% will be vertical
            return {
                text: word.text,
                count: word.count,
                fontSize,
                color,
                rotation,
                x: 0,
                y: 0,
                width: 0,
                height: 0
            }
        })

        // Measure text dimensions
        wordData.forEach(word => {
            ctx.font = `bold ${word.fontSize}px Inter, sans-serif`
            const metrics = ctx.measureText(word.text)
            // Swap dimensions for vertical text
            if (word.rotation === 90) {
                word.width = word.fontSize
                word.height = metrics.width
            } else {
                word.width = metrics.width
                word.height = word.fontSize
            }
        })

        // Simple spiral placement algorithm
        const centerX = width / 2
        const centerY = height / 2
        const placedWords = []

        wordData.forEach(word => {
            let placed = false
            let angle = 0
            let radius = 0
            const angleStep = 0.1
            const radiusStep = 5

            while (!placed && radius < Math.max(width, height)) {
                const x = centerX + radius * Math.cos(angle) - word.width / 2
                const y = centerY + radius * Math.sin(angle) + word.height / 3

                // Check collision with placed words
                let collision = false
                for (const placed of placedWords) {
                    if (
                        x < placed.x + placed.width + 10 &&
                        x + word.width + 10 > placed.x &&
                        y < placed.y + placed.height + 10 &&
                        y + word.height + 10 > placed.y
                    ) {
                        collision = true
                        break
                    }
                }

                if (!collision && x >= 0 && x + word.width <= width && y >= 0 && y + word.height <= height) {
                    word.x = x
                    word.y = y
                    placedWords.push(word)
                    placed = true
                }

                angle += angleStep
                radius += radiusStep * angleStep
            }
        })

        // Draw words
        placedWords.forEach(word => {
            ctx.save() // Save current state

            ctx.font = `bold ${word.fontSize}px Inter, sans-serif`
            ctx.fillStyle = word.color
            ctx.textAlign = 'left'
            ctx.textBaseline = 'top'

            // Add subtle shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
            ctx.shadowBlur = 4
            ctx.shadowOffsetX = 2
            ctx.shadowOffsetY = 2

            // Apply rotation if needed
            if (word.rotation === 90) {
                ctx.translate(word.x + word.width / 2, word.y + word.height / 2)
                ctx.rotate(Math.PI / 2)
                ctx.fillText(word.text, -word.height / 2, -word.width / 2)
            } else {
                ctx.fillText(word.text, word.x, word.y)
            }

            // Reset shadow
            ctx.shadowColor = 'transparent'
            ctx.shadowBlur = 0
            ctx.shadowOffsetX = 0
            ctx.shadowOffsetY = 0

            ctx.restore() // Restore state
        })
    }

    return (
        <div className="wordcloud-canvas-container" ref={containerRef}>
            <canvas ref={canvasRef} className="wordcloud-canvas" />
        </div>
    )
}

export default WordCloud
