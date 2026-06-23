import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-lg p-8 bg-white rounded-lg shadow-md border border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900">School Management System</h1>
        <p className="mt-3 text-gray-600">
          Manage schools, students, teachers, exams, fees, and more — all in one place.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign in
          </Link>
          <Link
            href="/about"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            About
          </Link>
        </div>
      </div>
    </main>
  )
}
