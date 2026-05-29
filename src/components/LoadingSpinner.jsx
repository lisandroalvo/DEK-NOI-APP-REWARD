export default function LoadingSpinner({ size = 'md', fullScreen = false }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  }

  const spinner = (
    <div className={`${sizes[size]} border-4 border-gray-200 border-t-red-600 rounded-full animate-spin`} />
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-4">
          {spinner}
          <p className="text-sm font-medium text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return spinner
}
