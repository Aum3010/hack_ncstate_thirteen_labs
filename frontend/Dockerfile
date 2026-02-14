FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
ENV VITE_API_URL=
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
