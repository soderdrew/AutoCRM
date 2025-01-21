export type Database = {
  public: {
    Tables: {
      tickets: {
        Row: {
          id: string
          title: string
          description: string
          status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          tags: string[]
          custom_fields: Record<string, any>
          customer_id: string
          team_id: string | null
          created_at: string
          updated_at: string
          resolved_at: string | null
          closed_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description: string
          status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          tags?: string[]
          custom_fields?: Record<string, any>
          customer_id: string
          team_id?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
          closed_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string
          status?: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          tags?: string[]
          custom_fields?: Record<string, any>
          customer_id?: string
          team_id?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
          closed_at?: string | null
        }
      }
      user_roles: {
        Row: {
          user_id: string
          role: 'customer' | 'employee' | 'admin'
          first_name: string | null
          last_name: string | null
          phone: string | null
          company: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          role?: 'customer' | 'employee' | 'admin'
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          company?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          role?: 'customer' | 'employee' | 'admin'
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          company?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          user_id: string
          is_team_lead: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
          is_team_lead?: boolean
          joined_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
          is_team_lead?: boolean
          joined_at?: string
        }
      }
      ticket_assignments: {
        Row: {
          id: string
          ticket_id: string
          agent_id: string
          assigned_at: string
          active: boolean
        }
        Insert: {
          id?: string
          ticket_id: string
          agent_id: string
          assigned_at?: string
          active?: boolean
        }
        Update: {
          id?: string
          ticket_id?: string
          agent_id?: string
          assigned_at?: string
          active?: boolean
        }
      }
      ticket_comments: {
        Row: {
          id: string
          ticket_id: string
          user_id: string
          content: string
          is_internal: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          user_id: string
          content: string
          is_internal?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          user_id?: string
          content?: string
          is_internal?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
} 