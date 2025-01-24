import { useLocation } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Mail } from 'lucide-react'

export default function VerifyEmail() {
  const location = useLocation()
  const { email, userType } = location.state || {}

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="bg-blue-50 p-3 rounded-full mb-4">
            <Mail className="w-6 h-6 text-blue-500" />
          </div>
          <CardTitle className="text-2xl text-center">Check your email</CardTitle>
          <CardDescription className="text-center">
            We've sent a verification link to{' '}
            <span className="font-medium">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-gray-500">
            Click the link in your email to verify your account and complete your {userType === 'volunteer' ? 'volunteer' : 'organization'} registration.
          </p>
          <p className="text-xs text-gray-400">
            If you don't see the email, check your spam folder.
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 