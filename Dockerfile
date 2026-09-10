FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies omitting devDependencies
RUN npm ci --omit=dev

# Copy application source files
COPY . .

# Expose port
EXPOSE 3000

# Set environment variables defaults
ENV PORT=3000
ENV NODE_ENV=production

# Run start script
CMD ["node", "app.js"]
