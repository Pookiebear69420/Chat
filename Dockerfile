# Use official Node.js runtime as base image
FROM node:16-alpine

# Create and set working directory
WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port
EXPOSE 8080

# Use exec form of CMD to allow proper signal handling
CMD ["node", "server.js"]
