# Base node image
FROM node:20-alpine
# Set working directory
WORKDIR /app
# Install dependencies
COPY package*.json ./
RUN npm ci
# Copy source code and build
COPY . .
RUN npm run build
# Install serve
RUN npm install -g serve
# Expose port
EXPOSE 3000
# Start the app
CMD ["serve", "-s", "build", "-l", "3000"]