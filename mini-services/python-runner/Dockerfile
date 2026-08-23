FROM node:20-slim

# Install bun
RUN npm install -g bun

# Install system dependencies for all languages
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    gcc g++ \
    ruby \
    lua5.4 \
    perl \
    bash \
    default-jdk \
    golang-go \
    rustc \
    r-base \
    php-cli \
    gfortran \
    wget gnupg2 \
    && rm -rf /var/lib/apt/lists/*

# Install .NET SDK 8.0 for C#
RUN wget https://dot.net/v1/dotnet-install.sh -O /tmp/dotnet-install.sh && \
    chmod +x /tmp/dotnet-install.sh && \
    /tmp/dotnet-install.sh --channel 8.0 --install-dir /usr/share/dotnet && \
    rm /tmp/dotnet-install.sh && \
    ln -s /usr/share/dotnet/dotnet /usr/local/bin/dotnet

ENV DOTNET_ROOT=/usr/share/dotnet
ENV PATH="${PATH}:/usr/share/dotnet:/usr/share/dotnet/tools"

# Install Python libraries
RUN pip3 install --break-system-packages numpy pandas matplotlib

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY . .

ENV PORT=3003
EXPOSE 3003

CMD ["bun", "index.ts"]
