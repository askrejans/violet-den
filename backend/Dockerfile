FROM node:22-alpine
RUN apk add --no-cache openssl python3 make g++ certbot
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 4000
CMD ["node", "index.js"]
