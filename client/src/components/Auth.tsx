import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Label } from "../components/ui/label"
import { Input } from "../components/ui/input"

// Create the Supabase client
const supabase = createBrowserClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

interface UserFormData {
  firstName?: string;
  lastName?: string;
  orgName?: string;
  email: string;
  password: string;
}

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
  const [selectedRole, setSelectedRole] = useState<'volunteer' | 'organization' | null>(null)
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = searchParams.get('mode') || 'signin'
  const type = searchParams.get('type')

  // Set initial role from URL parameter
  useEffect(() => {
    if (type === 'volunteer' || type === 'organization') {
      setSelectedRole(type)
    }
  }, [type])

  // Handle sign up submission
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    if (selectedRole === 'volunteer' && (!formData.firstName || !formData.lastName)) {
      setError('Please enter both first and last name')
      return
    }
    if (selectedRole === 'organization' && !formData.orgName) {
      setError('Please enter your organization name')
      return
    }
    if (!formData.email || !formData.password) {
      setError('Please enter both email and password')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      console.log('Signup attempt:', { 
        selectedRole,
        firstName: formData.firstName,
        lastName: formData.lastName,
        orgName: formData.orgName
      })

      // Create the user account with SSR client, only storing metadata
      const { data: { user }, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            intended_role: selectedRole === 'volunteer' ? 'employee' : 'customer',
            first_name: selectedRole === 'volunteer' ? formData.firstName : formData.orgName,
            last_name: selectedRole === 'volunteer' ? formData.lastName : null,
            is_active: true,
            user_type: selectedRole
          }
        }
      })

      if (authError) throw authError

      console.log('User created with metadata:', user?.user_metadata)

      // Redirect to verify email page
      navigate('/auth/verify-email', { 
        state: { 
          email: formData.email,
          userType: selectedRole
        } 
      })
    } catch (err) {
      console.error('Error during sign up:', err)
      setError(err instanceof Error ? err.message : 'An error occurred during sign up')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    // Handle auth callback after email confirmation
    const handleAuthCallback = async () => {
      const searchParams = new URLSearchParams(window.location.search)
      if (searchParams.get('error_description')) {
        setError(searchParams.get('error_description') || 'Authentication error')
        return
      }

      // Get session after email confirmation
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        setError(error.message)
        return
      }

      if (session?.user) {
        // After email confirmation, check/create role
        await checkUserRole(session.user.id)
      }
    }

    // Check if we're on the callback URL
    if (window.location.pathname === '/auth/callback') {
      handleAuthCallback()
    } else {
      // Only check session if not on callback URL
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        if (session?.user && session.user.email_confirmed_at) {
          checkUserRole(session.user.id)
        } else {
          setLoading(false)
        }
      })
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user && session.user.email_confirmed_at) {
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
      
      // Get user with SSR client
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('No user found')

      console.log('Checking user role:', {
        userId,
        email_confirmed: user.email_confirmed_at,
        metadata: user.user_metadata
      })

      // Only proceed if email is confirmed
      if (!user.email_confirmed_at) {
        console.log('Email not confirmed yet')
        setLoading(false)
        return
      }

      // Get role from user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single()

      console.log('Existing role check:', { roleData, roleError })

      let userRole: string | null = null

      if (roleError) {
        // Get intended role from metadata, default to employee if not specified
        const intendedRole = user.user_metadata?.intended_role || 'employee'
        console.log('Creating new role:', {
          intendedRole,
          first_name: user.user_metadata?.first_name,
          last_name: user.user_metadata?.last_name
        })
        
        // Create role record
        const { data: insertData, error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: intendedRole,
            first_name: user.user_metadata?.first_name || null,
            last_name: user.user_metadata?.last_name || null,
            is_active: true
          })
          .select()
          .single()

        if (insertError) {
          console.error('Error inserting role:', insertError)
          throw insertError
        }
        
        console.log('Role created:', insertData)
        userRole = intendedRole
      } else {
        userRole = roleData.role
      }

      console.log('Final user role:', userRole)
      setUserRole(userRole)

      // Redirect based on role
      const roleRoutes = {
        admin: '/admin/dashboard',
        employee: '/volunteer/dashboard',
        customer: '/organization/dashboard'
      }

      const route = roleRoutes[userRole as keyof typeof roleRoutes]
      if (route) {
        navigate(route)
      } else {
        throw new Error(`Invalid role: ${userRole}`)
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
    const roleDisplay = userRole === 'customer' ? 'organization' : userRole === 'employee' ? 'volunteer' : userRole
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
          <div className="text-center mb-6">
            <div className="bg-blue-100 text-blue-600 p-4 rounded-lg mb-4">
              <p className="font-medium">Welcome!</p>
              <p className="text-sm">Redirecting you to the {roleDisplay} dashboard...</p>
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
          <h1 className="text-5xl font-bold mb-4">ServeLocal</h1>
          <h2 className="text-2xl font-semibold mb-12 text-blue-100">
            {type === 'organization' 
              ? 'Connect with Dedicated Volunteers'
              : type === 'volunteer'
              ? 'Find Meaningful Service Opportunities'
              : 'Building Stronger Communities Together'}
          </h2>
          <div className="space-y-8">
            <div className="flex items-start space-x-4">
              <div className="bg-blue-500 rounded-full p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Community Impact</h3>
                <p className="text-blue-100">Make a real difference in your local community through meaningful service</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="bg-blue-500 rounded-full p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Hour Tracking</h3>
                <p className="text-blue-100">Easily track and verify volunteer hours for school or organization requirements</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="bg-blue-500 rounded-full p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Easy Matching</h3>
                <p className="text-blue-100">Connect volunteers with opportunities that match their interests and availability</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="bg-blue-500 rounded-full p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Verified Service</h3>
                <p className="text-blue-100">Get official verification for completed service hours and community impact</p>
              </div>
            </div>
          </div>
        </div>
        <div className="text-sm text-blue-200">
          © 2024 ServeLocal. All rights reserved.
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {mode === 'signup'
                  ? 'Welcome to ServeLocal'
                  : 'Welcome Back'}
              </h2>
              <p className="text-gray-600 mt-2">
                {mode === 'signup'
                  ? 'Create an account to start your community service journey'
                  : 'Sign in to continue your community service journey'}
              </p>
            </div>

            {mode === 'signup' ? (
              <form onSubmit={handleSignUp} className="space-y-6">
                <div className="mb-6">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">I want to join as:</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      className={`p-4 text-left border rounded-lg transition-colors ${
                        selectedRole === 'volunteer'
                          ? 'border-blue-600 bg-blue-50 text-blue-600'
                          : 'border-gray-200 hover:border-blue-200'
                      }`}
                      onClick={() => {
                        setSelectedRole('volunteer')
                        setSearchParams({ mode: 'signup', type: 'volunteer' })
                        setFormData(prev => ({
                          ...prev,
                          orgName: undefined,
                        }))
                      }}
                    >
                      <div className="font-semibold mb-1">Volunteer</div>
                      <div className="text-sm text-gray-600">
                        Find and participate in community service opportunities
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`p-4 text-left border rounded-lg transition-colors ${
                        selectedRole === 'organization'
                          ? 'border-blue-600 bg-blue-50 text-blue-600'
                          : 'border-gray-200 hover:border-blue-200'
                      }`}
                      onClick={() => {
                        setSelectedRole('organization')
                        setSearchParams({ mode: 'signup', type: 'organization' })
                        setFormData(prev => ({
                          ...prev,
                          firstName: undefined,
                          lastName: undefined,
                        }))
                      }}
                    >
                      <div className="font-semibold mb-1">Organization</div>
                      <div className="text-sm text-gray-600">
                        Post opportunities and connect with volunteers
                      </div>
                    </button>
                  </div>
                </div>

                {selectedRole === 'volunteer' && (
                  <div className="space-y-4">
                        <div>
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            value={formData.firstName || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                            placeholder="Enter your first name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            value={formData.lastName || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                            placeholder="Enter your last name"
                          />
                        </div>
                  </div>
                )}

                {selectedRole === 'organization' && (
                      <div>
                        <Label htmlFor="orgName">Organization Name</Label>
                        <Input
                          id="orgName"
                          value={formData.orgName || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, orgName: e.target.value }))}
                          placeholder="Enter your organization name"
                        />
                      </div>
                    )}

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <Label htmlFor="password">Create Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Create a secure password"
                  />
                </div>

                    {error && (
                      <div className="text-sm text-red-600 mt-2">
                        {error}
                      </div>
                    )}

                    <button
                  type="submit"
                  disabled={isSubmitting || !selectedRole}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                  {isSubmitting ? 'Creating Account...' : 'Sign Up'}
                    </button>

                <div className="text-center text-sm text-gray-600">
                  <a href="/auth?mode=signin" className="hover:text-blue-600">
                    Already have an account? Sign in
                  </a>
                  </div>
              </form>
            ) : (
              <>
                <Auth
                  supabaseClient={supabase}
                  appearance={{ 
                    theme: ThemeSupa,
                    variables: {
                      default: {
                        colors: {
                          brand: '#2563eb',
                          brandAccent: '#1d4ed8',
                        },
                      },
                    },
                  }}
                  theme="default"
                  providers={[]}
                  redirectTo={window.location.origin + '/auth/callback'}
                  magicLink={false}
                  showLinks={false}
                  view="sign_in"
                  localization={{
                    variables: {
                      sign_in: {
                        email_label: 'Email',
                        password_label: 'Password',
                        email_input_placeholder: 'Enter your email',
                        password_input_placeholder: 'Enter your password',
                        button_label: 'Sign In',
                        loading_button_label: 'Signing in...',
                        social_provider_text: 'Sign in with {{provider}}',
                        link_text: '',
                      },
                    },
                  }}
                />
                <div className="text-center text-sm text-gray-600 mt-6">
                  <a href="/auth?mode=signup" className="hover:text-blue-600">
                    Don't have an account? Sign up
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 