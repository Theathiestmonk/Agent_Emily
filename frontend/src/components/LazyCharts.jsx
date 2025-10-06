import React, { lazy, Suspense } from 'react'
import { ChartSkeleton } from './LazyLoadingSkeleton'

// Lazy load heavy chart components
const LazyBarChart = lazy(() => import('recharts').then(module => ({ default: module.BarChart })))
const LazyPieChart = lazy(() => import('recharts').then(module => ({ default: module.PieChart })))
const LazyLineChart = lazy(() => import('recharts').then(module => ({ default: module.LineChart })))
const LazyAreaChart = lazy(() => import('recharts').then(module => ({ default: module.AreaChart })))
const LazyResponsiveContainer = lazy(() => import('recharts').then(module => ({ default: module.ResponsiveContainer })))

// Chart wrapper components with lazy loading
export const LazyBarChartWrapper = ({ children, height = 300, className = "" }) => (
  <Suspense fallback={<ChartSkeleton height={height} className={className} />}>
    <LazyBarChart>
      {children}
    </LazyBarChart>
  </Suspense>
)

export const LazyPieChartWrapper = ({ children, height = 300, className = "" }) => (
  <Suspense fallback={<ChartSkeleton height={height} className={className} />}>
    <LazyPieChart>
      {children}
    </LazyPieChart>
  </Suspense>
)

export const LazyLineChartWrapper = ({ children, height = 300, className = "" }) => (
  <Suspense fallback={<ChartSkeleton height={height} className={className} />}>
    <LazyLineChart>
      {children}
    </LazyLineChart>
  </Suspense>
)

export const LazyAreaChartWrapper = ({ children, height = 300, className = "" }) => (
  <Suspense fallback={<ChartSkeleton height={height} className={className} />}>
    <LazyAreaChart>
      {children}
    </LazyAreaChart>
  </Suspense>
)

export const LazyResponsiveContainerWrapper = ({ children, height = 300, className = "" }) => (
  <Suspense fallback={<ChartSkeleton height={height} className={className} />}>
    <LazyResponsiveContainer>
      {children}
    </LazyResponsiveContainer>
  </Suspense>
)

// Combined chart components for common use cases
export const LazyBarChartWithContainer = ({ data, children, height = 300, className = "" }) => (
  <Suspense fallback={<ChartSkeleton height={height} className={className} />}>
    <LazyResponsiveContainer width="100%" height={height}>
      <LazyBarChart data={data}>
        {children}
      </LazyBarChart>
    </LazyResponsiveContainer>
  </Suspense>
)

export const LazyPieChartWithContainer = ({ data, children, height = 300, className = "" }) => (
  <Suspense fallback={<ChartSkeleton height={height} className={className} />}>
    <LazyResponsiveContainer width="100%" height={height}>
      <LazyPieChart data={data}>
        {children}
      </LazyPieChart>
    </LazyResponsiveContainer>
  </Suspense>
)

export const LazyLineChartWithContainer = ({ data, children, height = 300, className = "" }) => (
  <Suspense fallback={<ChartSkeleton height={height} className={className} />}>
    <LazyResponsiveContainer width="100%" height={height}>
      <LazyLineChart data={data}>
        {children}
      </LazyLineChart>
    </LazyResponsiveContainer>
  </Suspense>
)

export const LazyAreaChartWithContainer = ({ data, children, height = 300, className = "" }) => (
  <Suspense fallback={<ChartSkeleton height={height} className={className} />}>
    <LazyResponsiveContainer width="100%" height={height}>
      <LazyAreaChart data={data}>
        {children}
      </LazyAreaChart>
    </LazyResponsiveContainer>
  </Suspense>
)

export default {
  LazyBarChartWrapper,
  LazyPieChartWrapper,
  LazyLineChartWrapper,
  LazyAreaChartWrapper,
  LazyResponsiveContainerWrapper,
  LazyBarChartWithContainer,
  LazyPieChartWithContainer,
  LazyLineChartWithContainer,
  LazyAreaChartWithContainer
}
