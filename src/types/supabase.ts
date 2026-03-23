export interface Database {
  public: {
    Tables: {
      sensor_data: {
        Row: {
          id: number;
          created_at: string;
          voltage: number;
          current: number;
          temperature: number;
          power: number;
          energy: number;
          saving: number;
        };
        Insert: {
          id?: number;
          created_at?: string;
          voltage: number;
          current: number;
          temperature: number;
          power: number;
          energy: number;
          saving: number;
        };
        Update: {
          id?: number;
          created_at?: string;
          voltage?: number;
          current?: number;
          temperature?: number;
          power?: number;
          energy?: number;
          saving?: number;
        };
      };
      alerts: {
        Row: {
          id: number;
          created_at: string;
          metric: string;
          operator: string;
          threshold: number;
          message: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: number;
          created_at?: string;
          metric: string;
          operator: string;
          threshold: number;
          message?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: number;
          created_at?: string;
          metric?: string;
          operator?: string;
          threshold?: number;
          message?: string | null;
          is_active?: boolean;
        };
      };
    };
  };
}

export type SensorData = Database['public']['Tables']['sensor_data']['Row'];
export type Alert = Database['public']['Tables']['alerts']['Row'];