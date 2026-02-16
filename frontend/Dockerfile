FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
# VITE_API_URL empty = use relative /api URLs; Vite proxies them to backend (no CORS)
ENV VITE_API_URL=
EXPOSE 3000
CMD ["sh", "-c", "npm install --legacy-peer-deps && npm run dev -- --host 0.0.0.0"]
