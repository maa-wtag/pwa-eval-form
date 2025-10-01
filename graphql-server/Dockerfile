FROM node:20-alpine
WORKDIR /app

# 1) Install runtime deps (tsx is in dependencies, so --omit=dev is fine)
COPY package.json ./
RUN npm i --omit=dev

# 2) Copy sources
COPY server.ts ./

# 3) Run TS directly with tsx (no bundling)
ENV PORT=4000
CMD ["node", "--import=tsx", "server.ts"]
