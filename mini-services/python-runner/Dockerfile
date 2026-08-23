FROM oven/bun:1.1

WORKDIR /app

# Install system dependencies for all languages
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    nodejs \
    gcc g++ \
    ruby \
    lua5.4 \
    perl \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install Python libraries
RUN pip3 install --break-system-packages numpy pandas matplotlib

# Copy package files and install
COPY package.json bun.lock* ./
RUN bun install

# Copy the rest of the code
COPY . .

# Copy the preamble
COPY preamble.py ./

ENV PORT=3003
EXPOSE 3003

CMD ["bun", "index.ts"]
