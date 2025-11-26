import React, { useState, useRef, useEffect } from 'react'

const DualRangeSlider = ({ 
  min = 16, 
  max = 90, 
  minValue, 
  maxValue, 
  onChange,
  className = ''
}) => {
  const [localMin, setLocalMin] = useState(minValue || min)
  const [localMax, setLocalMax] = useState(maxValue || max)
  const sliderRef = useRef(null)
  const minThumbRef = useRef(null)
  const maxThumbRef = useRef(null)
  const [isDragging, setIsDragging] = useState(null) // 'min' or 'max' or null

  useEffect(() => {
    if (minValue !== undefined) setLocalMin(minValue)
  }, [minValue])

  useEffect(() => {
    if (maxValue !== undefined) setLocalMax(maxValue)
  }, [maxValue])

  const getPercentage = (value) => {
    return ((value - min) / (max - min)) * 100
  }

  const getValueFromPercentage = (percentage) => {
    return Math.round(min + (percentage / 100) * (max - min))
  }

  const handleMouseDown = (type) => {
    setIsDragging(type)
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !sliderRef.current) return

      const rect = sliderRef.current.getBoundingClientRect()
      const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      const value = getValueFromPercentage(percentage)

      if (isDragging === 'min') {
        const newMin = Math.min(value, localMax - 1)
        setLocalMin(newMin)
        onChange?.({ min: newMin, max: localMax })
      } else if (isDragging === 'max') {
        const newMax = Math.max(value, localMin + 1)
        setLocalMax(newMax)
        onChange?.({ min: localMin, max: newMax })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(null)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, localMin, localMax, min, max, onChange])

  const handleInputChange = (type, value) => {
    const numValue = parseInt(value) || min
    if (type === 'min') {
      const newMin = Math.max(min, Math.min(numValue, localMax - 1))
      setLocalMin(newMin)
      onChange?.({ min: newMin, max: localMax })
    } else {
      const newMax = Math.min(max, Math.max(numValue, localMin + 1))
      setLocalMax(newMax)
      onChange?.({ min: localMin, max: newMax })
    }
  }

  const minPercentage = getPercentage(localMin)
  const maxPercentage = getPercentage(localMax)

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Minimum Age
          </label>
          <input
            type="number"
            min={min}
            max={localMax - 1}
            value={localMin}
            onChange={(e) => handleInputChange('min', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
        <div className="mx-4 text-gray-400">-</div>
        <div className="flex-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Maximum Age
          </label>
          <input
            type="number"
            min={localMin + 1}
            max={max}
            value={localMax}
            onChange={(e) => handleInputChange('max', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="relative h-2 bg-gray-200 rounded-full" ref={sliderRef}>
        <div
          className="absolute h-2 bg-pink-500 rounded-full"
          style={{
            left: `${minPercentage}%`,
            width: `${maxPercentage - minPercentage}%`
          }}
        />
        <div
          ref={minThumbRef}
          className="absolute w-5 h-5 bg-pink-600 rounded-full cursor-pointer shadow-md transform -translate-x-1/2 -translate-y-1.5 hover:bg-pink-700 transition-colors"
          style={{ left: `${minPercentage}%` }}
          onMouseDown={() => handleMouseDown('min')}
        />
        <div
          ref={maxThumbRef}
          className="absolute w-5 h-5 bg-pink-600 rounded-full cursor-pointer shadow-md transform -translate-x-1/2 -translate-y-1.5 hover:bg-pink-700 transition-colors"
          style={{ left: `${maxPercentage}%` }}
          onMouseDown={() => handleMouseDown('max')}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{min}</span>
        <span className="font-medium text-gray-700">{localMin} - {localMax}</span>
        <span>{max}+</span>
      </div>
    </div>
  )
}

export default DualRangeSlider

