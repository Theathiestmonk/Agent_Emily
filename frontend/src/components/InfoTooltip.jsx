import React, { useState } from 'react'
import { Info } from 'lucide-react'

const InfoTooltip = ({ content, className = "" }) => {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-5 h-5 text-gray-600 hover:text-[#FF4D94] transition-colors duration-200"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        <Info size={16} />
      </button>
      
      {isVisible && (
        <div className="absolute z-50 w-80 p-3 mb-2 text-sm bg-white border border-[#FF6B9D] rounded-lg shadow-lg bottom-full left-0">
          <div className="text-xs leading-relaxed text-[#9E005C]">
            {content}
          </div>
          {/* Arrow pointing down */}
          <div className="absolute top-full left-4 w-2 h-2 bg-white border-r border-b border-[#FF6B9D] rotate-45"></div>
        </div>
      )}
    </div>
  )
}

export default InfoTooltip
