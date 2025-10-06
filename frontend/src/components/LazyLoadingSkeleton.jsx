import React from 'react'

// Skeleton components for different UI elements
export const CardSkeleton = ({ className = "" }) => (
  <div className={`bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-lg border border-purple-100 p-6 animate-pulse ${className}`}>
    <div className="h-4 bg-gradient-to-r from-purple-200 to-pink-200 rounded mb-2"></div>
    <div className="h-8 bg-gradient-to-r from-purple-200 to-pink-200 rounded"></div>
  </div>
)

export const ChartSkeleton = ({ height = 300, className = "" }) => (
  <div className={`bg-gradient-to-br from-white to-pink-50 rounded-xl shadow-lg border border-pink-100 p-6 animate-pulse ${className}`}>
    <div className="h-6 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-1/3 mb-4"></div>
    <div className={`bg-gradient-to-r from-purple-200 to-pink-200 rounded`} style={{ height: `${height}px` }}></div>
  </div>
)

export const TableSkeleton = ({ rows = 5, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-lg border border-gray-100 p-6 animate-pulse ${className}`}>
    <div className="h-6 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-1/4 mb-4"></div>
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex space-x-4">
          <div className="h-4 bg-gradient-to-r from-purple-200 to-pink-200 rounded flex-1"></div>
          <div className="h-4 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-20"></div>
          <div className="h-4 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-16"></div>
        </div>
      ))}
    </div>
  </div>
)

export const ListSkeleton = ({ items = 6, className = "" }) => (
  <div className={`space-y-3 animate-pulse ${className}`}>
    {[...Array(items)].map((_, i) => (
      <div key={i} className="flex items-center space-x-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
        <div className="w-10 h-10 bg-gradient-to-r from-purple-200 to-pink-200 rounded-full"></div>
        <div className="flex-1">
          <div className="h-4 bg-gradient-to-r from-purple-200 to-pink-200 rounded mb-1"></div>
          <div className="h-3 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-2/3"></div>
        </div>
        <div className="h-6 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-16"></div>
      </div>
    ))}
  </div>
)

export const DashboardSkeleton = ({ className = "" }) => (
  <div className={`p-6 space-y-6 ${className}`}>
    {/* Header Skeleton */}
    <div className="animate-pulse">
      <div className="h-8 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-1/3 mb-4"></div>
    </div>
    
    {/* Stats Cards Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
    
    {/* Charts Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartSkeleton height={300} />
      <ChartSkeleton height={300} />
    </div>
    
    {/* Table Skeleton */}
    <TableSkeleton rows={5} />
  </div>
)

export const DashboardWithSidebarSkeleton = ({ className = "" }) => (
  <div className="min-h-screen bg-white">
    {/* Sidebar Skeleton */}
    <div className="fixed left-0 top-0 h-screen w-48 xl:w-64 bg-white shadow-lg z-50">
      <div className="p-3 lg:p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-r from-purple-200 to-pink-200 rounded-full animate-pulse"></div>
            <div>
              <div className="h-4 lg:h-5 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-16 mb-1 animate-pulse"></div>
              <div className="h-3 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-20 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Navigation Skeleton */}
      <nav className="flex-1 p-3 lg:p-4 space-y-1 lg:space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center p-2 lg:p-3 rounded-lg">
            <div className="w-5 h-5 bg-gradient-to-r from-purple-200 to-pink-200 rounded mr-3 animate-pulse"></div>
            <div className="h-4 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-20 animate-pulse"></div>
          </div>
        ))}
      </nav>
      
      {/* User Section Skeleton */}
      <div className="p-4 border-t border-gray-200">
        <div className="space-y-3">
          <div className="flex items-center p-2 lg:p-3 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-200 to-pink-200 rounded-full mr-3 animate-pulse"></div>
            <div className="flex-1">
              <div className="h-4 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-24 mb-1 animate-pulse"></div>
              <div className="h-3 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-32 animate-pulse"></div>
            </div>
          </div>
          <div className="flex items-center p-2 lg:p-3 text-gray-600 rounded-lg">
            <div className="w-5 h-5 bg-gradient-to-r from-purple-200 to-pink-200 rounded mr-3 animate-pulse"></div>
            <div className="h-4 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-16 animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
    
    {/* Main Content Skeleton */}
    <div className="ml-48 xl:ml-64 flex flex-col min-h-screen">
      {/* Header Skeleton */}
      <div className="fixed top-0 right-0 left-48 xl:left-64 bg-white shadow-sm border-b z-30">
        <div className="px-4 lg:px-6 py-3 lg:py-4">
          <div className="flex justify-between items-center">
            <div className="h-6 lg:h-8 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-48 animate-pulse"></div>
            <div className="flex items-center space-x-4">
              <div className="h-8 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-24 animate-pulse"></div>
              <div className="h-8 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-24 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content Skeleton */}
      <div className="flex-1 pt-20 lg:pt-24 p-4 lg:p-6">
        <div className="space-y-6">
          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
          
          {/* Charts Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSkeleton height={300} />
            <ChartSkeleton height={300} />
          </div>
          
          {/* Table Skeleton */}
          <TableSkeleton rows={5} />
        </div>
      </div>
    </div>
  </div>
)

export const ContentSkeleton = ({ className = "" }) => (
  <div className={`p-6 space-y-6 ${className}`}>
    {/* Header */}
    <div className="animate-pulse">
      <div className="h-8 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-1/3 mb-4"></div>
    </div>
    
    {/* Content Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-gradient-to-br from-white to-pink-50 rounded-xl shadow-lg border border-pink-100 p-6 animate-pulse">
          <div className="h-4 bg-gradient-to-r from-purple-200 to-pink-200 rounded mb-2"></div>
          <div className="h-6 bg-gradient-to-r from-purple-200 to-pink-200 rounded mb-4"></div>
          <div className="h-20 bg-gradient-to-r from-purple-200 to-pink-200 rounded mb-4"></div>
          <div className="flex space-x-2">
            <div className="h-8 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-20"></div>
            <div className="h-8 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-16"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
)

export const BlogSkeleton = ({ className = "" }) => (
  <div className={`p-6 space-y-6 ${className}`}>
    {/* Header */}
    <div className="animate-pulse">
      <div className="h-8 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-1/3 mb-4"></div>
    </div>
    
    {/* Blog Posts Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(9)].map((_, i) => (
        <div key={i} className="bg-gradient-to-br from-white to-pink-50 rounded-xl shadow-lg border border-pink-100 overflow-hidden animate-pulse">
          <div className="h-48 bg-gradient-to-r from-purple-200 to-pink-200"></div>
          <div className="p-6">
            <div className="h-4 bg-gradient-to-r from-purple-200 to-pink-200 rounded mb-2"></div>
            <div className="h-6 bg-gradient-to-r from-purple-200 to-pink-200 rounded mb-4"></div>
            <div className="h-16 bg-gradient-to-r from-purple-200 to-pink-200 rounded mb-4"></div>
            <div className="flex justify-between items-center">
              <div className="h-4 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-20"></div>
              <div className="h-8 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-16"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)

// Lazy loading wrapper component
export const LazyWrapper = ({ children, fallback, className = "" }) => (
  <div className={className}>
    {React.Suspense ? (
      <React.Suspense fallback={fallback}>
        {children}
      </React.Suspense>
    ) : (
      children
    )}
  </div>
)

export default {
  CardSkeleton,
  ChartSkeleton,
  TableSkeleton,
  ListSkeleton,
  DashboardSkeleton,
  ContentSkeleton,
  BlogSkeleton,
  LazyWrapper
}
