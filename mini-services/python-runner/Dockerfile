FROM node:20-slim

# Install bun
RUN npm install -g bun

# Install Python and basic tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    gcc g++ \
    ruby \
    lua5.4 \
    perl \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install Python libraries
RUN pip3 install --break-system-packages numpy pandas matplotlib

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY . .

ENV PORT=3003
EXPOSE 3003

CMD ["bun", "index.ts"]
