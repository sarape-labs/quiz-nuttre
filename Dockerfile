# syntax = docker/dockerfile:1

ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Node.js"

# Set production environment
ENV NODE_ENV="production"

# Node.js app lives here
WORKDIR /app

# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build node modules (e.g. better-sqlite3)
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3 python3

# Install node modules
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Copy application code
COPY . .

# Build frontend
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev

# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Expose port 3000
EXPOSE 3000

# Start the server by default
CMD [ "npm", "run", "start" ]
