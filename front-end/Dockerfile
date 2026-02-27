# Base node image
FROM node:20-alpine
# Set working directory
WORKDIR /app
# Install dependencies
COPY package*.json ./
RUN npm ci
# Copy source code and build
COPY . .
# Make CRA dev server listen on all interfaces inside container
ENV HOST=0.0.0.0
EXPOSE 3000
# Start the app
CMD ["npm", "start"]