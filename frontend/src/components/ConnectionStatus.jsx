import React from 'react'
import { Check, Shield, Key, ExternalLink, Clock, AlertCircle } from 'lucide-react'
import { socialMediaService } from '../services/socialMedia'

const ConnectionStatus = ({ connection, onDisconnect }) => {
  const platformInfo = socialMediaService.getPlatformInfo(connection.platform)
  const methodInfo = socialMediaService.getConnectionMethodInfo(connection.connection_method)

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatusIcon = () => {
    if (connection.is_active) {
      return <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-green-600" />
    }
    return <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-red-600" />
  }

  const getStatusText = () => {
    if (connection.is_active) {
      return 'Connected'
    }
    return 'Disconnected'
  }

  const getStatusColor = () => {
    if (connection.is_active) {
      return 'text-green-600'
    }
    return 'text-red-600'
  }

  const getMethodIcon = () => {
    return connection.connection_method === 'oauth'
      ? <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
      : <Key className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
  }

  return (
    <div className="group relative bg-white rounded-xl border border-black/[0.06] hover:border-black/[0.12] transition-all duration-200">
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 ${platformInfo.color} rounded-lg flex items-center justify-center border border-black/5 flex-shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105`}>
            {platformInfo.icon ? (
              typeof platformInfo.icon === 'string' ? (
                <img
                  src={platformInfo.icon}
                  alt={platformInfo.name}
                  className="w-6 h-6 object-contain filter brightness-0 invert"
                />
              ) : (
                <platformInfo.icon className="w-6 h-6 text-white" />
              )
            ) : (
              <span className="text-white font-bold text-sm">?</span>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            Connected
          </span>
        </div>

        <h3 className="text-[17px] font-semibold text-[#1a1a1a] mb-0.5 tracking-tight">{platformInfo.name}</h3>
        <p className="text-[13px] text-slate-500 leading-tight truncate">
          {connection.account_name || connection.page_name || 'Personal Account'}
        </p>
      </div>

      {/* Internal Content */}
      <div className="px-5 pb-5 space-y-4">
        {/* Info Grid */}
        <div className="pt-4 border-t border-black/[0.04] space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-slate-400">Account Type</span>
            <span className="font-medium text-slate-700 px-2 py-0.5 bg-slate-50 rounded border border-slate-100">
              {connection.account_type || (connection.page_username ? 'Business' : 'Personal')}
            </span>
          </div>
          {connection.connected_at && (
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-slate-400">Linked on</span>
              <span className="text-slate-600 font-medium">{formatDate(connection.connected_at)}</span>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2 pt-2">
          <a
            href={`https://${connection.platform}.com`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-slate-700 bg-white border border-black/[0.08] rounded-md hover:bg-slate-50 hover:border-black/[0.12] transition-all"
          >
            Visit
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          <button
            onClick={() => onDisconnect(connection.id)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-rose-600 bg-white border border-rose-100 rounded-md hover:bg-rose-50 transition-all"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConnectionStatus
