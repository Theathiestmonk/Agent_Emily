import React from 'react'

const CharacterCard = ({ agentName, isVisible = false, position = { x: 0, y: 0 }, likesCount = 0, tasksCount = 0 }) => {
  const getAgentInfo = (name) => {
    switch (name?.toLowerCase()) {
      case 'emily':
        return {
          logo: '/emily_icon.png',
          name: 'Emily',
          abilities: 'Content Manager | Social Media Specialist. Helps businesses optimize their content strategy by suggesting, publishing, searching, and managing posts across all platforms.'
        }
      case 'leo':
        return {
          logo: '/leo_logo.jpg',
          name: 'Leo',
          abilities: 'Content Creator | Creative Director. Specializes in crafting engaging content, writing compelling copy, and designing visuals that drive audience engagement.'
        }
      case 'chase':
        return {
          logo: '/chase_logo.png',
          name: 'Chase',
          abilities: 'Lead Manager | Customer Success Specialist. Focuses on lead nurturing, customer relationship management, and driving sales conversions through strategic follow-ups.'
        }
      case 'orio':
        return {
          logo: null, // No logo for Orio yet
          name: 'Orio',
          abilities: 'Data Analyst | Business Intelligence Expert. Provides actionable insights through advanced analytics to help optimize business performance and ROI.'
        }
      default:
        return {
          logo: '/emily_icon.png',
          name: 'Emily',
          abilities: 'Content Manager | Social Media Specialist. Helps businesses optimize their content strategy by suggesting, publishing, searching, and managing posts across all platforms.'
        }
    }
  }

  const agentInfo = getAgentInfo(agentName)

  if (!isVisible) return null

  return (
    <div
      className="fixed z-50 bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 p-5 min-w-[28rem] max-w-lg pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
        marginTop: '-8px' // Offset from cursor
      }}
    >
      <div className="flex items-start gap-5">
        {/* Agent Logo */}
        <div className="flex-shrink-0">
          {agentInfo.logo ? (
            <img
              src={agentInfo.logo}
              alt={`${agentInfo.name} logo`}
              className="w-20 h-20 rounded-full object-cover border-2 border-white/30 shadow-lg"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold border-2 border-white/30 shadow-lg">
              O
            </div>
          )}
        </div>

        {/* Agent Description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-bold text-gray-900">
              {agentInfo.name}
            </h3>
            <span className="text-yellow-500 font-bold text-sm">★★★★★</span>
            <span className="text-sm font-normal text-gray-600">
              {likesCount} likes | {tasksCount} tasks
            </span>
          </div>
          <div className="text-sm text-gray-600 leading-relaxed">
            {agentInfo.abilities}
          </div>
        </div>
      </div>

      {/* Tooltip arrow */}
      <div
        className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/90"
        style={{ marginTop: '-1px' }}
      ></div>
      <div
        className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/20"
        style={{ marginTop: '0px' }}
      ></div>
    </div>
  )
}

export default CharacterCard
