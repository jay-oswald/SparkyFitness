# Stage 1: Build the React application
FROM node:20-alpine as builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

RUN VITE_SUPABASE_URL=$VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY npm run build

# Stage 2: Serve the application
FROM node:20-alpine

WORKDIR /app

# Install 'serve' globally to serve the static files
RUN npm install -g serve

COPY --from=builder /app/dist ./dist


EXPOSE 3000

CMD sh -c "find dist -type f -name '*.js' -exec sed -i \"s|__VITE_SUPABASE_URL__|\$VITE_SUPABASE_URL|g\" {} + && \
           find dist -type f -name '*.js' -exec sed -i \"s|__VITE_SUPABASE_ANON_KEY__|\$VITE_SUPABASE_ANON_KEY|g\" {} + && \
           serve -s dist -l 3000"