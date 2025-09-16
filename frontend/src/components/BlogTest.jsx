import React, { useState, useEffect } from 'react'
import { blogService } from '../services/blogs'

const BlogTest = () => {
  const [testResult, setTestResult] = useState('Testing...')
  const [error, setError] = useState(null)

  useEffect(() => {
    const testBlogService = async () => {
      try {
        console.log('Testing blog service...')
        const result = await blogService.getBlogs()
        console.log('Blog service test result:', result)
        setTestResult(`Success: ${JSON.stringify(result, null, 2)}`)
      } catch (err) {
        console.error('Blog service test error:', err)
        setError(err.message)
        setTestResult(`Error: ${err.message}`)
      }
    }

    testBlogService()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Blog Service Test</h1>
      <div className="bg-gray-100 p-4 rounded">
        <pre className="whitespace-pre-wrap">{testResult}</pre>
        {error && (
          <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  )
}

export default BlogTest
