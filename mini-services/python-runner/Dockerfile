FROM node:20-slim

RUN npm install -g bun

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip gcc g++ ruby lua5.4 perl bash \
    default-jdk golang-go rustc r-base php-cli gfortran \
    wget unzip \
    && rm -rf /var/lib/apt/lists/*

# .NET SDK
RUN wget https://dot.net/v1/dotnet-install.sh -O /tmp/dotnet-install.sh && \
    chmod +x /tmp/dotnet-install.sh && /tmp/dotnet-install.sh --channel 8.0 && \
    rm /tmp/dotnet-install.sh
ENV DOTNET_ROOT=/root/.dotnet
ENV PATH="${PATH}:/root/.dotnet:/root/.dotnet/tools"

# Dart SDK
RUN wget -qO- https://storage.googleapis.com/dart-archive/channels/stable/release/latest/sdk/dartsdk-linux-x64-release.zip > /tmp/dart.zip && \
    unzip -q /tmp/dart.zip -d /opt && rm /tmp/dart.zip && \
    ln -s /opt/dart-sdk/bin/dart /usr/local/bin/dart

RUN pip3 install --break-system-packages numpy pandas matplotlib

WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install
COPY . .
ENV PORT=3003
ENV HOME=/root
EXPOSE 3003
CMD ["bun", "index.ts"]
