export type Database = {
  public: {
    Tables: {
      videos: {
        Row: {
          id: string
          created_at?: string
          title: string
          description?: string
          video_url: string
          thumbnail_url?: string
          user_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          title: string
          description?: string
          video_url: string
          thumbnail_url?: string
          user_id: string
        }
        Update: {
          id?: string
          created_at?: string
          title?: string
          description?: string
          video_url?: string
          thumbnail_url?: string
          user_id?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 