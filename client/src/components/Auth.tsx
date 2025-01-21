import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useNavigate } from 'react-router-dom'

const customTheme = {
  default: {
    colors: {
      brand: '#2563eb',
      brandAccent: '#1d4ed8',
      brandButtonText: 'white',
      defaultButtonBackground: 'white',
      defaultButtonBackgroundHover: '#f8fafc',
      defaultButtonBorder: 'lightgray',
      defaultButtonText: 'gray',
      dividerBackground: '#e2e8f0',
      inputBackground: 'white',
      inputBorder: '#e2e8f0',
      inputBorderHover: '#2563eb',
      inputBorderFocus: '#2563eb',
      inputText: 'black',
      inputPlaceholder: '#94a3b8',
      inputLabelText: '#64748b',
    },
    space: {
      spaceSmall: '4px',
      spaceMedium: '8px',
      spaceLarge: '16px',
    },
    fonts: {
      bodyFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
      buttonFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
      inputFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
    },
    borderWidths: {
      buttonBorderWidth: '1px',
      inputBorderWidth: '1px',
    },
    radii: {
      borderRadiusButton: '8px',
      buttonBorderRadius: '8px',
      inputBorderRadius: '8px',
    },
  },
};

export default function AuthComponent() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        checkUserRole(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        checkUserRole(session.user.id)
      } else {
        setUserRole(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  const checkUserRole = async (userId: string) => {
    try {
      setError(null)
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single()

      if (error) throw error

      if (!data?.role) {
        throw new Error('No role assigned')
      }

      setUserRole(data.role)
      
      // Redirect based on role
      const roleRoutes = {
        admin: '/admin/dashboard',
        employee: '/employee/tickets',
        customer: '/customer/tickets'
      }

      const route = roleRoutes[data.role as keyof typeof roleRoutes]
      if (route) {
        navigate(route)
      } else {
        throw new Error(`Invalid role: ${data.role}`)
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch user role')
      // Sign out the user if there's a role error
      await supabase.auth.signOut()
    } finally {
      setLoading(false)
    }
  }

  // Show loading state
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your account...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="bg-red-100 text-red-600 p-4 rounded-lg mb-4">
              <p className="font-medium">Authentication Error</p>
              <p className="text-sm">{error}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // If user is already logged in and has a role, show appropriate message
  if (session && userRole) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
          <div className="text-center mb-6">
            <div className="bg-blue-100 text-blue-600 p-4 rounded-lg mb-4">
              <p className="font-medium">Welcome!</p>
              <p className="text-sm">Redirecting you to the {userRole} dashboard...</p>
            </div>
          </div>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // Show login form for unauthenticated users
  return (
    <div className="h-screen w-screen flex">
      {/* Left side - Info Section */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 text-white px-16 py-12 flex-col justify-between">
        <div>
          <h1 className="text-5xl font-bold mb-4">AutoCRM</h1>
          <h2 className="text-2xl font-semibold mb-12 text-blue-100">Streamline Your Customer Support</h2>
          <div className="space-y-8">
            <div className="flex items-start space-x-4">
              <div className="bg-blue-500 rounded-full p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Ticket Management</h3>
                <p className="text-blue-100">Efficiently manage and track customer support tickets in one place</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="bg-blue-500 rounded-full p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Team Collaboration</h3>
                <p className="text-blue-100">Seamless team collaboration and ticket assignment features</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="bg-blue-500 rounded-full p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Real-time Updates</h3>
                <p className="text-blue-100">Get instant notifications and updates on ticket status</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="bg-blue-500 rounded-full p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Analytics</h3>
                <p className="text-blue-100">Track performance metrics and generate insightful reports</p>
              </div>
            </div>
          </div>
        </div>
        <div className="text-sm text-blue-200">
          © 2024 AutoCRM. All rights reserved.
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
              <p className="text-gray-600 mt-2">Sign in to access your account</p>
            </div>
            <Auth
              supabaseClient={supabase}
              appearance={{ 
                theme: ThemeSupa,
                variables: customTheme,
                className: {
                  container: 'w-full',
                  button: 'w-full px-4 py-2 rounded-lg font-medium',
                  input: 'w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500',
                  label: 'block text-sm font-medium text-gray-700 mb-1',
                  loader: 'w-6 h-6 border-2 border-blue-600',
                }
              }}
              providers={[]}
              theme="default"
            />
          </div>
        </div>
      </div>
    </div>
  )
} 