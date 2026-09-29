FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8000
CMD ["sh", "-c", "node db/migrate.js && node db/seed.js && node src/index.js"]
