# Crypto Scanner

A real-time cryptocurrency market scanner that provides comprehensive technical analysis and market insights. Built with Next.js, Express, and MongoDB.

## Features

- Real-time cryptocurrency pair analysis from Coinbase
- Technical indicators including RSI, MACD, Moving Averages, and Volume analysis
- Modern, responsive UI with sorting and filtering capabilities
- Detailed indicator descriptions and interpretations
- 5-minute data refresh rate

## Project Structure

```
crypto-scanner/
├── frontend/          # Next.js frontend application
│   ├── src/
│   │   ├── app/      # Next.js app router
│   │   ├── components/
│   │   ├── services/
│   │   └── types/
│   └── public/
└── backend/          # Express backend application
    ├── src/
    │   ├── server.ts
    │   └── services/
    └── dist/         # Compiled TypeScript
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (optional for Phase 1)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/crypto-scanner.git
cd crypto-scanner
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

3. Install backend dependencies:
```bash
cd ../backend
npm install
```

4. Create .env files:

Frontend (.env.local):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
```

Backend (.env):
```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/crypto-scanner
NODE_ENV=development
```

### Running the Application

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. Start the frontend development server:
```bash
cd frontend
npm run dev
```

The application will be available at http://localhost:3000

## Future Phases

### Phase 2
- Integration with news sources (crypto news sites, Reddit, Twitter)
- News sentiment analysis
- Historical news correlation with price movements

### Phase 3
- AI-powered market insights using OpenAI
- Overall market sentiment analysis
- Predictive analytics and trend forecasting

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
