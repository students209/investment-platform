'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const components: Components = {
    h1: ({ children }) => (
      <h1 className="text-2xl font-bold text-gray-900 mt-8 mb-4 pb-3 border-b-2 border-emerald-200 first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3 pb-2 border-b border-gray-200 flex items-center gap-2">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-base font-semibold text-gray-700 mt-4 mb-2">
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p className="text-gray-700 leading-7 mb-4">
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-outside ml-5 mb-4 space-y-1.5 text-gray-700">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside ml-5 mb-4 space-y-1.5 text-gray-700">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-7 pl-1">
        {children}
      </li>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-emerald-400 bg-emerald-50/50 pl-4 pr-4 py-3 my-4 rounded-r-lg text-gray-600 italic">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-50">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-gray-100 bg-white">
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-gray-50/50 transition-colors">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
        {children}
      </td>
    ),
    code: ({ children, className: codeClassName }) => {
      const isInline = !codeClassName
      if (isInline) {
        return (
          <code className="bg-gray-100 text-emerald-700 px-1.5 py-0.5 rounded text-sm font-mono">
            {children}
          </code>
        )
      }
      return (
        <code className={`${codeClassName || ''} block`}>
          {children}
        </code>
      )
    },
    pre: ({ children }) => (
      <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 my-4 overflow-x-auto text-sm leading-6 shadow-inner">
        {children}
      </pre>
    ),
    hr: () => (
      <hr className="my-8 border-t-2 border-gray-100" />
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-gray-900">
        {children}
      </strong>
    ),
    a: ({ children, href }) => (
      <a
        href={href}
        className="text-emerald-600 hover:text-emerald-700 underline decoration-emerald-300 hover:decoration-emerald-500 transition-colors"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
  }

  return (
    <div className={`article-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
