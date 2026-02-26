FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN mkdir -p data/uploads

EXPOSE 3000

CMD ["npm", "run", "docker:dev"]
