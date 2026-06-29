FROM node:20-slim

# Install OpenSSL and other required dependencies for Prisma, plus ffmpeg for audio transcoding
RUN apt-get update -y && apt-get install -y openssl libssl-dev ca-certificates ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose the port (backend server port)
EXPOSE 5005

# Start command
# Run migrations + seed (idempotent upsert) then start server
CMD npx prisma migrate deploy && node prisma/seed.js && npm start
