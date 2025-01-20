import { useState, useEffect } from 'react'
import './App.css'
import { supabase } from './supabaseClient'
import type { Database } from './types/supabase'
import { Session } from '@supabase/supabase-js'
import AuthComponent from './components/Auth'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [personalCount, setPersonalCount] = useState<number>(0)

  useEffect(() => {
    // Get session on initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load the personal counter from the database once user is signed in
  useEffect(() => {
    async function fetchPersonalCount() {
      if (session?.user) {
        const { data, error } = await supabase
          .from('personal_counts')
          .select('value')
          .eq('user_id', session.user.id)
          .single()

        if (data?.value !== undefined) {
          setPersonalCount(data.value)
        } else if (!data) {
          // If there's no row yet, create it
          const { error: insertError } = await supabase
            .from('personal_counts')
            .insert([{ user_id: session.user.id, value: 0 }])

          if (!insertError) {
            setPersonalCount(0)
          }
        }
        if (error) console.error('Error fetching personal count:', error.message)
      }
    }

    fetchPersonalCount()
  }, [session])

  // Update the personal counter in the database
  async function updatePersonalCount(newValue: number) {
    if (!session?.user) return

    setPersonalCount(newValue)
    const { error } = await supabase
      .from('personal_counts')
      .upsert({ user_id: session.user.id, value: newValue })

    if (error) {
      console.error('Error updating personal count:', error.message)
    }
  }

  return (
    <div className="container">
      <AuthComponent />

      {session?.user ? (
        <div style={{ marginTop: '2rem' }}>
          <h2>Personal Counter</h2>
          <div>
            <button onClick={() => updatePersonalCount(personalCount - 1)}>
              -
            </button>
            <span style={{ margin: '0 1rem' }}>
              {personalCount}
            </span>
            <button onClick={() => updatePersonalCount(personalCount + 1)}>
              +
            </button>
          </div>
          <p>Logged in as: {session.user.email}</p>
        </div>
      ) : (
        <p>Please sign in to see your personal counter.</p>
      )}
    </div>
  )
}

export default App
