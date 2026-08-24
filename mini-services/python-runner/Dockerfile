FROM node:20-slim

<<<<<<< HEAD
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

# Kotlin
RUN wget -q https://github.com/JetBrains/kotlin/releases/download/v2.0.21/kotlin-compiler-2.0.21.zip -O /tmp/kotlin.zip && \
    unzip -q /tmp/kotlin.zip -d /opt && rm /tmp/kotlin.zip && \
    ln -s /opt/kotlinc/bin/kotlinc /usr/local/bin/kotlinc

RUN pip3 install --break-system-packages numpy pandas matplotlib

WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install
COPY . .
ENV PORT=3003
ENV HOME=/root
EXPOSE 3003
=======
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
    wget unzip \
    && rm -rf /var/lib/apt/lists/*

# Install .NET SDK 8.0 at ~/.dotnet (where the runner expects it)
RUN wget https://dot.net/v1/dotnet-install.sh -O /tmp/dotnet-install.sh && \
    chmod +x /tmp/dotnet-install.sh && \
    /tmp/dotnet-install.sh --channel 8.0 && \
    rm /tmp/dotnet-install.sh

ENV DOTNET_ROOT=/root/.dotnet
ENV PATH="${PATH}:/root/.dotnet:/root/.dotnet/tools"

# Install Dart SDK
RUN wget -qO- https://storage.googleapis.com/dart-archive/channels/stable/release/latest/sdk/dartsdk-linux-x64-release.zip > /tmp/dart.zip && \
    unzip -q /tmp/dart.zip -d /opt && \
    rm /tmp/dart.zip && \
    ln -s /opt/dart-sdk/bin/dart /usr/local/bin/dart && \
    ln -s /opt/dart-sdk/bin/dartaotruntime /usr/local/bin/dartaotruntime 2>/dev/null || true

# Install Python libraries
RUN pip3 install --break-system-packages numpy pandas matplotlib

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY . .

ENV PORT=3003
ENV HOME=/root
EXPOSE 3003

>>>>>>> d8337da8ca216fa9e2bd81b067047f623ea5ad08
CMD ["bun", "index.ts"]
