FROM node:20-alpine

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

RUN npm install

# Copy the rest of the frontend
COPY . .

EXPOSE 5173

# --host exposes Vite dev server to Docker network
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
