# syntax=docker/dockerfile:1

FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production image
FROM node:20-alpine AS production

WORKDIR /app

# Copy built artifacts and necessary files from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# If you need server.ts specifically because you use tsx or compile an executable
# You should either compile server.ts in the build step, or run via tsx.
# Since the package.json has a "start" script, we'll just copy server.ts and server folder
# But it's better to verify your package.json start script.
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/server ./server

# Ensure volume directories exist
RUN mkdir -p /app/data /app/uploads
ENV DB_PATH=/app/data/compta.db
ENV UPLOAD_DIR=/app/uploads

# Set Node environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
