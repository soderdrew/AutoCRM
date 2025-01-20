export type Database = {
  public: {
    Tables: {
      personal_counts: {
        Row: {
          user_id: string
          value: number
        }
        Insert: {
          user_id: string
          value?: number
        }
        Update: {
          user_id?: string
          value?: number
        }
      }
    }
  }
} 