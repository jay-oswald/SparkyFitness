# Stage 1: Build the React application
FROM node:20-alpine as builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

# Stage 2: Serve the application
FROM node:20-alpine

WORKDIR /app

# Install 'serve' globally to serve the static files
RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]