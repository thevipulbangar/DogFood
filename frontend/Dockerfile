FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm config set fetch-retries 5 fetch-retry-mintimeout 20000 && npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
