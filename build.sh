#!/bin/bash
# filepath: c:\Users\kgh99\Desktop\joomidang\paper-summarizer-summry-worker\build-and-save.sh
# 1. 기존 tar 파일이 있으면 제거
if [ -f gamecast-api.tar ]; then
    echo "Removing existing gamecast-api.tar..."
    rm gamecast-api.tar
fi

# Create buildx builder instance if it doesn't exist
docker buildx create --use

# Build Docker image for AMD64 platform
echo "Building Docker image for AMD64..."
docker buildx build --platform linux/amd64 -t gamecast-api:latest --load .

# Save Docker image to tar file
echo "Saving Docker image to gamecast-api.tar..."
docker save gamecast-api:latest > gamecast-api.tar

echo "Done! Docker image has been built and saved to gamecast-api.tar"