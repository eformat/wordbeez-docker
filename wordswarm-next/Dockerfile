# Build stage
FROM registry.access.redhat.com/ubi9/nodejs-20 AS builder

USER 0
WORKDIR /opt/app-root/src

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal AS runner

USER 0
WORKDIR /opt/app-root/src

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /opt/app-root/src/public ./public
COPY --from=builder /opt/app-root/src/.next/standalone ./
COPY --from=builder /opt/app-root/src/.next/static ./.next/static

USER 1001

EXPOSE 8080

CMD ["node", "server.js"]
