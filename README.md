# AutoCRM

AutoCRM is a modern volunteer management and customer relationship management system designed to streamline the coordination between organizations and volunteers. It provides an efficient platform for managing volunteer opportunities, tracking service hours, and facilitating communication between organizations and their volunteer workforce.

## Features

### For Volunteers
- **Opportunity Discovery**: Easy-to-use interface to find and browse volunteer opportunities
- **Dashboard**: Personal dashboard showing service hours, active opportunities, and completed services
- **Service Metrics**: Track and visualize volunteer contribution metrics
- **Real-time Updates**: Stay informed about opportunity changes and assignments

### For Organizations
- **Opportunity Management**: Create, manage, and track volunteer opportunities
- **Volunteer Coordination**: Efficiently assign and manage volunteers
- **Feedback System**: Collect and manage feedback for volunteer services
- **Analytics Dashboard**: Track engagement metrics and volunteer participation

## Tech Stack

- **Frontend**:
  - React with TypeScript
  - Vite for build tooling
  - React Router for navigation
  - Modern UI components with responsive design

- **Backend**:
  - Supabase for authentication and database
  - Real-time subscriptions for live updates
  - Secure role-based access control

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager
- Supabase account for backend services

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/AutoCRM.git
cd AutoCRM
```

2. Install dependencies:
```bash
cd client
npm install
```

3. Set up environment variables:
Create a `.env` file in the client directory with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
```

## Project Structure

```
AutoCRM/
├── client/               # Frontend application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── types/       # TypeScript type definitions
│   │   └── utils/       # Utility functions
├── docs/                # Documentation
└── amplify.yml         # AWS Amplify configuration
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team.