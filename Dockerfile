# syntax=docker/dockerfile:1.4

# Stage 1: Build React frontend
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
# ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

RUN npm run build

# Stage 2: Runtime container
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache bash curl nano && \
    ARCH=$(uname -m) && \
    echo "Detected architecture: $ARCH" && \
    if [ "$ARCH" = "x86_64" ]; then \
      curl -L https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz -o supabase.tar.gz; \
    elif [ "$ARCH" = "aarch64" ]; then \
      curl -L https://github.com/supabase/cli/releases/latest/download/supabase_linux_arm64.tar.gz -o supabase.tar.gz; \
    else \
      echo "Unsupported architecture: $ARCH" && exit 1; \
    fi && \
    tar -xzf supabase.tar.gz && \
    mv supabase /usr/bin/supabase && \
    chmod +x /usr/bin/supabase && \
    rm supabase.tar.gz && \
    npm install -g serve

COPY init_supabase.sh ./
COPY supabase/ /app/supabase/
RUN chmod +x init_supabase.sh


COPY --from=builder /app/dist ./dist

EXPOSE 3000

#CMD ["sh", "-c", "set -x && ./init_supabase.sh && echo 'Listing dist directory contents:' && ls -l dist && echo 'Listing dist/assets directory contents:' && ls -l dist/assets && echo 'Files found by find:' && find dist -type f -name '*.js' -print -exec echo {} \\; && echo 'VITE_SUPABASE_URL is: '$VITE_SUPABASE_URL && echo 'VITE_SUPABASE_ANON_KEY is: '$VITE_SUPABASE_ANON_KEY && find dist -type f -name '*.js' -print0 | xargs -0 -I {} sed -i \"s|__VITE_SUPABASE_URL__|$VITE_SUPABASE_URL|g\" {} && find dist -type f -name '*.js' -print0 | xargs -0 -I {} sed -i \"s|__VITE_SUPABASE_ANON_KEY__|$VITE_SUPABASE_ANON_KEY|g\" {} && serve -s dist -l 3000"]

CMD ["sh", "-c", "\
  ./init_supabase.sh && \
  echo 'Listing dist directory contents:' && ls -l dist && \
  echo 'Listing dist/assets directory contents:' && ls -l dist/assets && \
  echo 'Files found by find:' && find dist -type f -name '*.js' -print -exec echo {} \\; && \
  find dist -type f -name '*.js' -print0 | xargs -0 -I {} sed -i \"s|__VITE_SUPABASE_URL__|$VITE_SUPABASE_URL|g\" {} && \
  find dist -type f -name '*.js' -print0 | xargs -0 -I {} sed -i \"s|__VITE_SUPABASE_ANON_KEY__|$VITE_SUPABASE_ANON_KEY|g\" {} && \
  serve -s dist -l 3000\
"]
