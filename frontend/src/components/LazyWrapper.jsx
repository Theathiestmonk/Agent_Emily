import React, { Suspense, useState, useEffect } from 'react'
import { useSkeletonLoading } from '../hooks/useLazyLoading'
import { CardSkeleton, ChartSkeleton, TableSkeleton, ListSkeleton } from './LazyLoadingSkeleton'

/**
 * LazyWrapper component for wrapping components with lazy loading
 * @param {Object} props - Component props
 * @returns {JSX.Element} Wrapped component with lazy loading
 */
const LazyWrapper = ({ 
  children, 
  fallback, 
  skeletonType = 'card',
  minLoadingTime = 500,
  className = "",
  ...props 
}) => {
  const { showSkeleton } = useSkeletonLoading({ 
    minLoadingTime,
    showSkeleton: true 
  })

  const getSkeletonComponent = () => {
    switch (skeletonType) {
      case 'chart':
        return <ChartSkeleton className={className} />
      case 'table':
        return <TableSkeleton className={className} />
      case 'list':
        return <ListSkeleton className={className} />
      case 'card':
      default:
        return <CardSkeleton className={className} />
    }
  }

  const defaultFallback = fallback || getSkeletonComponent()

  return (
    <div className={className} {...props}>
      <Suspense fallback={defaultFallback}>
        {children}
      </Suspense>
    </div>
  )
}

/**
 * LazyComponent wrapper for individual components
 * @param {Object} props - Component props
 * @returns {JSX.Element} Lazy loaded component
 */
export const LazyComponent = ({ 
  component: Component, 
  fallback, 
  skeletonType = 'card',
  minLoadingTime = 500,
  className = "",
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const { showSkeleton } = useSkeletonLoading({ 
    minLoadingTime,
    showSkeleton: !isLoaded 
  })

  useEffect(() => {
    // Simulate component loading
    const timer = setTimeout(() => {
      setIsLoaded(true)
    }, minLoadingTime)

    return () => clearTimeout(timer)
  }, [minLoadingTime])

  if (showSkeleton) {
    const getSkeletonComponent = () => {
      switch (skeletonType) {
        case 'chart':
          return <ChartSkeleton className={className} />
        case 'table':
          return <TableSkeleton className={className} />
        case 'list':
          return <ListSkeleton className={className} />
        case 'card':
        default:
          return <CardSkeleton className={className} />
      }
    }

    return fallback || getSkeletonComponent()
  }

  return <Component {...props} />
}

/**
 * LazyChart wrapper specifically for chart components
 * @param {Object} props - Component props
 * @returns {JSX.Element} Lazy loaded chart
 */
export const LazyChart = ({ 
  children, 
  height = 300, 
  className = "",
  minLoadingTime = 800,
  ...props 
}) => {
  return (
    <LazyWrapper
      skeletonType="chart"
      minLoadingTime={minLoadingTime}
      className={className}
      {...props}
    >
      {children}
    </LazyWrapper>
  )
}

/**
 * LazyTable wrapper specifically for table components
 * @param {Object} props - Component props
 * @returns {JSX.Element} Lazy loaded table
 */
export const LazyTable = ({ 
  children, 
  rows = 5, 
  className = "",
  minLoadingTime = 600,
  ...props 
}) => {
  return (
    <LazyWrapper
      skeletonType="table"
      minLoadingTime={minLoadingTime}
      className={className}
      {...props}
    >
      {children}
    </LazyWrapper>
  )
}

/**
 * LazyList wrapper specifically for list components
 * @param {Object} props - Component props
 * @returns {JSX.Element} Lazy loaded list
 */
export const LazyList = ({ 
  children, 
  items = 6, 
  className = "",
  minLoadingTime = 400,
  ...props 
}) => {
  return (
    <LazyWrapper
      skeletonType="list"
      minLoadingTime={minLoadingTime}
      className={className}
      {...props}
    >
      {children}
    </LazyWrapper>
  )
}

export default LazyWrapper
