# Stage 1: Build the frontend with Vite
FROM node:18 AS build

# Set the working directory inside the container
WORKDIR /app

# Copy package.json, yarn.lock, and package-lock.json
COPY package.json yarn.lock ./

# Install dependencies (using yarn)
RUN yarn install --frozen-lockfile

# Copy the rest of the application files
COPY . .

# Build the project for production
RUN yarn build

# Stage 2: Serve the frontend with Nginx
FROM nginx:alpine

# Set the working directory for Nginx
WORKDIR /usr/share/nginx/html

# Remove the default nginx index.html
RUN rm -rf ./*

# Copy the built assets from the previous stage
COPY --from=build /app/dist .

# Expose port 80 for the frontend
EXPOSE 80

# Start Nginx to serve the app
CMD ["nginx", "-g", "daemon off;"]
