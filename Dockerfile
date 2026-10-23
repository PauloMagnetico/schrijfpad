FROM node:22-alpine
WORKDIR /srv
COPY server/package*.json server/
RUN cd server && npm install --omit=dev --no-audit --no-fund
COPY server server
COPY app app
EXPOSE 8080
USER node
CMD ["node", "server/server.js"]
